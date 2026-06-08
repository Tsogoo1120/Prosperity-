import { GetObjectCommand, PutObjectCommand, S3Client } from 'npm:@aws-sdk/client-s3@3'
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner@3'

const R2_DOWNLOAD_TTL = 3600
const R2_UPLOAD_TTL = 900

export const VIDEO_CACHE_CONTROL = 'public, max-age=31536000, immutable'

let cached: S3Client | null = null

function envOrThrow(name: string): string {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`Missing environment variable: ${name}`)
  return v
}

export function getR2Client(): S3Client {
  if (cached) return cached
  const accountId = envOrThrow('R2_ACCOUNT_ID')
  const endpoint = Deno.env.get('R2_ENDPOINT') ?? `https://${accountId}.r2.cloudflarestorage.com`
  cached = new S3Client({
    region: 'auto',
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: envOrThrow('R2_ACCESS_KEY_ID'),
      secretAccessKey: envOrThrow('R2_SECRET_ACCESS_KEY'),
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })
  return cached
}

export const R2_BUCKET = Deno.env.get('R2_BUCKET') ?? 'union-videos'

export function generateR2Key(prefix: string, filename: string): string {
  const ext = (filename.split('.').pop() ?? 'mp4').toLowerCase()
  return `videos/${prefix}/${crypto.randomUUID()}.${ext}`
}

export async function presignDownload(key: string): Promise<string> {
  const client = getR2Client()
  const cmd = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key })
  return getSignedUrl(client, cmd, { expiresIn: R2_DOWNLOAD_TTL })
}

export async function presignUpload(
  key: string,
  contentType: string,
  cacheControl?: string,
): Promise<string> {
  const client = getR2Client()
  const cmd = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
    CacheControl: cacheControl,
  })
  const signableHeaders = new Set(['host'])
  if (cacheControl) signableHeaders.add('cache-control')
  return getSignedUrl(client, cmd, { expiresIn: R2_UPLOAD_TTL, signableHeaders })
}

export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
  const client = getR2Client()
  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  )
}
