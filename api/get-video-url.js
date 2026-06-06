import { resolveGetVideoUrl } from '../server/getVideoUrl.js'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export default async function handler(req, res) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

  const authorization = req.headers.authorization ?? req.headers.Authorization
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body

  const result = await resolveGetVideoUrl({ authorization, body }, process.env)
  // #region agent log
  try{const fs=await import('node:fs');fs.appendFileSync('debug-f0e9bf.log',JSON.stringify({sessionId:'f0e9bf',location:'api/get-video-url.js:handler:result',message:'Vercel handler response',data:{status:result.status,error:result.body?.error??null,hasUrl:!!result.body?.url},timestamp:Date.now(),hypothesisId:'D'})+'\n')}catch{}
  // #endregion
  res.status(result.status).json(result.body)
}
