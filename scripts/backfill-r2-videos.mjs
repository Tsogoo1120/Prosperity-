/**
 * Backfill R2 videos:
 *   - Adds Cache-Control: public, max-age=31536000, immutable
 *   - Re-encodes MP4 with +faststart (moov atom at front) for instant playback
 *   - Optional re-encode to H.264 CRF 23 to shrink file size
 *   - Marks processed objects with metadata.optimized=1 so reruns skip them
 *
 * Requirements:
 *   - ffmpeg on PATH
 *   - .env with R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET
 *
 * Usage:
 *   node scripts/backfill-r2-videos.mjs                 # faststart only (fast, lossless)
 *   node scripts/backfill-r2-videos.mjs --reencode      # full H.264 re-encode (slow, much smaller)
 *   node scripts/backfill-r2-videos.mjs --prefix=videos/video-lessons/
 *   node scripts/backfill-r2-videos.mjs --force         # ignore optimized marker
 *   node scripts/backfill-r2-videos.mjs --dry-run
 *   node scripts/backfill-r2-videos.mjs --concurrency=2
 */

import {
  S3Client,
  ListObjectsV2Command,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3'
import { readFileSync, createWriteStream, statSync, mkdtempSync, rmSync, createReadStream } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { pipeline } from 'node:stream/promises'

const VIDEO_CACHE_CONTROL = 'public, max-age=31536000, immutable'
const VIDEO_EXT_RE = /\.(mp4|m4v|mov|webm)$/i

const args = parseArgs(process.argv.slice(2))
const env = loadEnv()

const required = ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_ENDPOINT', 'R2_BUCKET']
for (const k of required) {
  if (!env[k]) {
    console.error(`Missing ${k} in .env`)
    process.exit(1)
  }
}

const client = new S3Client({
  region: 'auto',
  endpoint: env.R2_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
})

const prefix = args.prefix ?? 'videos/'
const concurrency = Math.max(1, Number(args.concurrency ?? 2))
const dryRun = !!args['dry-run']
const force = !!args.force
const reencode = !!args.reencode

console.log(`Bucket: ${env.R2_BUCKET}`)
console.log(`Prefix: ${prefix}`)
console.log(`Mode:   ${reencode ? 're-encode H.264 CRF 23 + faststart' : 'faststart only (codec copy)'}`)
console.log(`Force:  ${force}  Dry-run: ${dryRun}  Concurrency: ${concurrency}`)
console.log('')

const keys = await listAllKeys(prefix)
const videoKeys = keys.filter((k) => VIDEO_EXT_RE.test(k))
console.log(`Found ${videoKeys.length} video objects (${keys.length} total).`)

const queue = videoKeys.slice()
const stats = { processed: 0, skipped: 0, failed: 0, savedBytes: 0 }

const workers = Array.from({ length: concurrency }, () => worker())
await Promise.all(workers)

console.log('')
console.log('Summary:')
console.log(`  processed: ${stats.processed}`)
console.log(`  skipped:   ${stats.skipped}`)
console.log(`  failed:    ${stats.failed}`)
console.log(`  saved:     ${(stats.savedBytes / (1024 * 1024)).toFixed(1)} MB`)

async function worker() {
  while (queue.length) {
    const key = queue.shift()
    if (!key) return
    try {
      await processKey(key)
    } catch (err) {
      stats.failed++
      console.error(`  FAIL ${key}: ${err?.message ?? err}`)
    }
  }
}

async function processKey(key) {
  const head = await client.send(new HeadObjectCommand({ Bucket: env.R2_BUCKET, Key: key }))
  const meta = head.Metadata ?? {}
  if (!force && meta.optimized === '1') {
    stats.skipped++
    console.log(`  skip  ${key} (already optimized)`)
    return
  }

  const contentType = head.ContentType ?? guessType(key)
  const sizeBefore = Number(head.ContentLength ?? 0)

  if (dryRun) {
    console.log(`  dry   ${key} (${humanSize(sizeBefore)})`)
    return
  }

  const tmp = mkdtempSync(join(tmpdir(), 'r2vid-'))
  const inPath = join(tmp, 'in' + extOf(key))
  const outPath = join(tmp, 'out.mp4')

  try {
    const get = await client.send(new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key }))
    await pipeline(get.Body, createWriteStream(inPath))

    await runFfmpeg(inPath, outPath, reencode)

    const sizeAfter = statSync(outPath).size
    const body = createReadStream(outPath)

    await client.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: key,
        Body: body,
        ContentType: 'video/mp4',
        ContentLength: sizeAfter,
        CacheControl: VIDEO_CACHE_CONTROL,
        Metadata: { ...meta, optimized: '1' },
      }),
    )

    const saved = sizeBefore - sizeAfter
    stats.processed++
    stats.savedBytes += Math.max(0, saved)
    const pct = sizeBefore > 0 ? ((1 - sizeAfter / sizeBefore) * 100).toFixed(0) : '0'
    console.log(`  ok    ${key}  ${humanSize(sizeBefore)} → ${humanSize(sizeAfter)}  (-${pct}%)`)
  } finally {
    try { rmSync(tmp, { recursive: true, force: true }) } catch { /* ignore */ }
  }
}

function runFfmpeg(inPath, outPath, doReencode) {
  const args = doReencode
    ? [
        '-y', '-i', inPath,
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '23',
        '-vf', "scale='min(1280,iw)':-2",
        '-c:a', 'aac', '-b:a', '128k',
        '-movflags', '+faststart',
        outPath,
      ]
    : [
        '-y', '-i', inPath,
        '-c', 'copy',
        '-movflags', '+faststart',
        outPath,
      ]
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    p.stderr.on('data', (d) => { stderr += d.toString() })
    p.on('error', reject)
    p.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-400)}`))
    })
  })
}

async function listAllKeys(pfx) {
  const out = []
  let token
  do {
    const res = await client.send(new ListObjectsV2Command({
      Bucket: env.R2_BUCKET,
      Prefix: pfx,
      ContinuationToken: token,
    }))
    for (const o of res.Contents ?? []) if (o.Key) out.push(o.Key)
    token = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (token)
  return out
}

function parseArgs(argv) {
  const out = {}
  for (const a of argv) {
    if (!a.startsWith('--')) continue
    const [k, v] = a.slice(2).split('=')
    out[k] = v ?? true
  }
  return out
}

function loadEnv() {
  return Object.fromEntries(
    readFileSync('.env', 'utf8')
      .split('\n')
      .filter((line) => line.trim() && !line.startsWith('#'))
      .map((line) => {
        const i = line.indexOf('=')
        return [line.slice(0, i).trim(), line.slice(i + 1).trim()]
      }),
  )
}

function extOf(key) {
  const m = key.match(/\.[a-z0-9]+$/i)
  return m ? m[0] : '.mp4'
}

function guessType(key) {
  const ext = extOf(key).toLowerCase()
  return { '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm' }[ext] ?? 'video/mp4'
}

function humanSize(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
}
