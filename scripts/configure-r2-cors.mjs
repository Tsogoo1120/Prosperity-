import { S3Client, PutBucketCorsCommand, HeadBucketCommand } from '@aws-sdk/client-s3'
import { readFileSync, appendFileSync } from 'node:fs'

const LOG_PATH = 'debug-b8d68b.log'
const SESSION_ID = 'b8d68b'

function debugLog(location, message, data, hypothesisId) {
  const entry = JSON.stringify({
    sessionId: SESSION_ID,
    location,
    message,
    data,
    hypothesisId,
    timestamp: Date.now(),
    runId: 'configure-cors',
  })
  try {
    appendFileSync(LOG_PATH, entry + '\n')
  } catch { /* ignore */ }
  fetch('http://127.0.0.1:7686/ingest/90f54ecd-c6e4-49a7-aa05-6b179f41c50d', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': SESSION_ID },
    body: entry,
  }).catch(() => {})
}

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith('#'))
    .map((line) => {
      const i = line.indexOf('=')
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()]
    }),
)

const productionOrigins = [
  'https://www.tsogoo.site',
  'https://tsogoo.site',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]

const corsRules = [
  {
    AllowedOrigins: productionOrigins,
    AllowedMethods: ['GET', 'PUT', 'HEAD'],
    AllowedHeaders: ['*'],
    ExposeHeaders: ['ETag'],
    MaxAgeSeconds: 3000,
  },
]

const cfCorsRules = [
  {
    allowed: {
      methods: ['GET', 'PUT', 'HEAD'],
      origins: productionOrigins,
      headers: ['*'],
    },
    exposeHeaders: ['ETag'],
    maxAgeSeconds: 3000,
  },
]

function mask(value) {
  if (!value) return '(missing)'
  if (value.length <= 8) return '***'
  return `${value.slice(0, 4)}…${value.slice(-4)}`
}

async function configureViaCloudflareApi() {
  const token = env.CLOUDFLARE_API_TOKEN
  const accountId = env.R2_ACCOUNT_ID
  const bucket = env.R2_BUCKET
  if (!token || !accountId || !bucket) return false

  debugLog('configure-r2-cors.mjs:cfApi', 'Trying Cloudflare REST API', {
    accountId: mask(accountId),
    bucket,
  }, 'A')

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucket}/cors`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rules: cfCorsRules }),
    },
  )
  const body = await res.json().catch(() => ({}))
  debugLog('configure-r2-cors.mjs:cfApiResult', 'Cloudflare API response', {
    status: res.status,
    success: body?.success,
    errors: body?.errors?.map((e) => e.message),
  }, 'A')

  if (!res.ok || !body.success) {
    throw new Error(
      `Cloudflare API failed (${res.status}): ${body?.errors?.[0]?.message ?? 'unknown error'}`,
    )
  }
  return true
}

async function configureViaS3Api() {
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

  debugLog('configure-r2-cors.mjs:s3Probe', 'Probing bucket access', {
    bucket: env.R2_BUCKET,
    endpoint: env.R2_ENDPOINT ? '(set)' : '(missing)',
    accessKeyId: mask(env.R2_ACCESS_KEY_ID),
  }, 'A')

  try {
    await client.send(new HeadBucketCommand({ Bucket: env.R2_BUCKET }))
    debugLog('configure-r2-cors.mjs:s3Probe', 'HeadBucket OK', { bucket: env.R2_BUCKET }, 'A')
  } catch (err) {
    debugLog('configure-r2-cors.mjs:s3Probe', 'HeadBucket failed', {
      code: err.Code ?? err.name,
      status: err.$metadata?.httpStatusCode,
    }, 'B')
  }

  await client.send(
    new PutBucketCorsCommand({
      Bucket: env.R2_BUCKET,
      CORSConfiguration: { CORSRules: corsRules },
    }),
  )
  return true
}

const required = ['R2_BUCKET', 'R2_ACCOUNT_ID']
for (const key of required) {
  if (!env[key]) {
    console.error(`Missing ${key} in .env`)
    process.exit(1)
  }
}

const hasS3Creds = env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_ENDPOINT
const hasCfToken = !!env.CLOUDFLARE_API_TOKEN

if (!hasS3Creds && !hasCfToken) {
  console.error(
    'Need either R2 S3 credentials (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT)\n' +
    'or CLOUDFLARE_API_TOKEN + R2_ACCOUNT_ID for the Cloudflare REST API.',
  )
  process.exit(1)
}

try {
  if (hasS3Creds) {
    try {
      await configureViaS3Api()
      console.log(`R2 CORS configured on bucket: ${env.R2_BUCKET} (S3 API)`)
      process.exit(0)
    } catch (err) {
      debugLog('configure-r2-cors.mjs:s3Error', 'PutBucketCors failed', {
        code: err.Code ?? err.name,
        status: err.$metadata?.httpStatusCode,
        message: err.message,
      }, 'A')

      if (err.Code === 'AccessDenied' || err.$metadata?.httpStatusCode === 403) {
        console.warn(
          'S3 PutBucketCors denied — R2 tokens with "Object Read & Write" cannot set bucket CORS.\n' +
          'Use "Admin Read & Write" for this one-time setup, or set CLOUDFLARE_API_TOKEN in .env.',
        )
        if (!hasCfToken) throw err
      } else {
        throw err
      }
    }
  }

  if (hasCfToken) {
    await configureViaCloudflareApi()
    console.log(`R2 CORS configured on bucket: ${env.R2_BUCKET} (Cloudflare API)`)
    process.exit(0)
  }
} catch (err) {
  console.error('\nFailed to configure R2 CORS:', err.message ?? err)
  console.error(`
Manual fix (Cloudflare dashboard → JSON tab — array format, NOT wrangler "rules" wrapper):
  1. R2 → ${env.R2_BUCKET} → Settings → CORS policy → Add CORS policy
  2. Paste this JSON:

${JSON.stringify(corsRules, null, 2)}

Or create an API token with "Account → R2 → Edit" permission, add as CLOUDFLARE_API_TOKEN in .env, then re-run:
  npm run configure:cors
`)
  process.exit(1)
}
