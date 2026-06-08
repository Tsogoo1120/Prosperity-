import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const i = line.indexOf('=')
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()]
    }),
)

const projectRef = 'gtewmyhzpuwzmkdtgink'

const secretArgs = [
  'secrets', 'set',
  `R2_ACCOUNT_ID=${env.R2_ACCOUNT_ID}`,
  `R2_ACCESS_KEY_ID=${env.R2_ACCESS_KEY_ID}`,
  `R2_SECRET_ACCESS_KEY=${env.R2_SECRET_ACCESS_KEY}`,
  `R2_BUCKET=${env.R2_BUCKET}`,
  `R2_ENDPOINT=${env.R2_ENDPOINT}`,
]
if (env.CLOUDFLARE_API_TOKEN) secretArgs.push(`CLOUDFLARE_API_TOKEN=${env.CLOUDFLARE_API_TOKEN}`)
if (env.CLOUDFLARE_ACCOUNT_ID) secretArgs.push(`CLOUDFLARE_ACCOUNT_ID=${env.CLOUDFLARE_ACCOUNT_ID}`)
if (env.CLOUDFLARE_STREAM_CUSTOMER_CODE) secretArgs.push(`CLOUDFLARE_STREAM_CUSTOMER_CODE=${env.CLOUDFLARE_STREAM_CUSTOMER_CODE}`)
secretArgs.push('--project-ref', projectRef)

function run(args) {
  const childEnv = { ...process.env }
  if (env.SUPABASE_ACCESS_TOKEN) {
    childEnv.SUPABASE_ACCESS_TOKEN = env.SUPABASE_ACCESS_TOKEN
  }
  const r = spawnSync('npx', ['supabase', ...args], {
    stdio: 'inherit',
    shell: true,
    env: childEnv,
  })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

run(secretArgs)
run([
  'functions', 'deploy',
  'get-video-url', 'upload-video', 'stream-upload-url', 'send-email', 'subscription-expire', 'subscription-expiring',
  '--project-ref', projectRef,
  '--no-verify-jwt',
])

console.log('Edge functions deployed.')
