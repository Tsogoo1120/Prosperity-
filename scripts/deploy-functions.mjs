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
  '--project-ref', projectRef,
]

function run(args) {
  const r = spawnSync('npx', ['supabase', ...args], { stdio: 'inherit', shell: true })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

run(secretArgs)
run([
  'functions', 'deploy',
  'get-video-url', 'upload-video', 'send-email', 'subscription-expire', 'subscription-expiring',
  '--project-ref', projectRef,
  '--no-verify-jwt',
])

console.log('Edge functions deployed.')
