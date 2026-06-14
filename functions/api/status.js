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

export async function onRequest(context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const url = new URL(context.request.url)
  const path = url.searchParams.get('path')

  if (!isAllowedPath(path)) {
    return new Response(JSON.stringify({ error: '无效的请求路径' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const apiKey = context.env.VITE_UPTIMEROBOT_API_KEY

    url.searchParams.delete('path')
    const qs = url.searchParams.toString()
    const targetUrl = `${V3_BASE}/${path}${qs ? '?' + qs : ''}`

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    })

    const newResponse = new Response(response.body, response)
    newResponse.headers.set('Access-Control-Allow-Origin', '*')
    return newResponse

  } catch (error) {
    return new Response(JSON.stringify({ error: '请求失败' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}
