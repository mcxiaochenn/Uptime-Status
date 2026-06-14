const API_KEY = process.env.VITE_UPTIMEROBOT_API_KEY
const V3_BASE = 'https://api.uptimerobot.com/v3'

const ALLOWED_PREFIXES = [
  'monitors',
  'incidents',
]

function isAllowedPath(path) {
  if (!path) return false
  const clean = path.split('?')[0].replace(/^\/+/, '')
  return ALLOWED_PREFIXES.some(prefix => clean === prefix || clean.startsWith(prefix + '/'))
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const path = req.query.path
  if (!isAllowedPath(path)) {
    return res.status(400).json({ error: '无效的请求路径' })
  }

  try {
    const { path: _, ...restQuery } = req.query
    const qs = new URLSearchParams(restQuery).toString()
    const url = `${V3_BASE}/${path}${qs ? '?' + qs : ''}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/json',
      },
    })

    const data = await response.json()
    return res.status(response.status).json(data)

  } catch (error) {
    return res.status(500).json({ error: '请求失败' })
  }
}
