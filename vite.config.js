import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import fs from 'fs'

function parseEnvFile() {
  const envPath = path.resolve(__dirname, '.env')
  if (!fs.existsSync(envPath)) return {}
  const content = fs.readFileSync(envPath, 'utf-8')
  const env = {}
  for (const line of content.split('\n')) {
    const match = line.match(/^\s*([\w]+)\s*=\s*"?([^"\n]*)"?/)
    if (match) env[match[1].trim()] = match[2].trim()
  }
  return env
}

const ALLOWED_PREFIXES = ['monitors', 'incidents']

function isAllowedPath(p) {
  if (!p) return false
  const clean = p.split('?')[0].replace(/^\/+/, '')
  return ALLOWED_PREFIXES.some(prefix => clean === prefix || clean.startsWith(prefix + '/'))
}

function localApiProxy() {
  const env = parseEnvFile()
  const apiKey = env.VITE_UPTIMEROBOT_API_KEY

  return {
    name: 'local-api-proxy',
    configureServer(server) {
      server.middlewares.use('/api/status', async (req, res) => {
        const url = new URL(req.url, 'http://localhost')
        const apiPath = url.searchParams.get('path')

        if (!isAllowedPath(apiPath)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: '无效的请求路径' }))
          return
        }

        url.searchParams.delete('path')
        const qs = url.searchParams.toString()
        const targetUrl = `https://api.uptimerobot.com/v3/${apiPath}${qs ? '?' + qs : ''}`

        try {
          const response = await fetch(targetUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Accept': 'application/json',
            },
          })

          const data = await response.text()
          res.writeHead(response.status, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          })
          res.end(data)
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: '代理请求失败' }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [vue(), localApiProxy()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 3100,
    open: true
  }
})
