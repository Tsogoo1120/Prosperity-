import { resolveGetVideoUrl } from './getVideoUrl.js'

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

export function createDevVideoApi(env) {
  return async (req, res, next) => {
    if (!req.url?.startsWith('/api/get-video-url')) return next()
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'method_not_allowed' })
      return
    }

    let body
    try {
      body = JSON.parse(await readBody(req))
    } catch {
      sendJson(res, 400, { error: 'bad_request' })
      return
    }

    const result = await resolveGetVideoUrl(
      { authorization: req.headers.authorization, body },
      env,
    )
    sendJson(res, result.status, result.body)
  }
}
