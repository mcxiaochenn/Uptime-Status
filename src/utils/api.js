/**
 * API 请求相关工具函数
 * 通过代理与 UptimeRobot API v3 通信
 */

import { processMonitorData } from './monitor'

const API_URL = import.meta.env.VITE_UPTIMEROBOT_API_URL
const STATUS_SORT = import.meta.env.VITE_UPTIMEROBOT_STATUS_SORT

/** v3 状态字符串 → 数字映射 */
const STATUS_MAP = {
  PAUSED: 0,
  STARTED: 1,
  UP: 2,
  LOOKS_DOWN: 8,
  DOWN: 9,
}

/** v3 监控类型字符串 → 数字映射 */
const TYPE_MAP = {
  HTTP: 1,
  HTTPS: 1,
  KEYWORD: 2,
  PING: 3,
  PORT: 4,
  HEARTBEAT: 5,
  DNS: 6,
  API: 7,
  UDP: 8,
}

const delay = (ms) => new Promise(r => setTimeout(r, ms))

/**
 * 通过代理请求 v3 API（带 429 重试）
 */
async function proxyFetch(path, params = {}, retries = 3) {
  const qs = new URLSearchParams({ path, ...params }).toString()
  const url = `${API_URL}?${qs}`

  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url)

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After')
      const waitMs = retryAfter
        ? parseInt(retryAfter) * 1000
        : Math.pow(2, attempt + 1) * 3000
      console.warn(`速率限制，${waitMs}ms 后重试 (${attempt + 1}/${retries})`)
      await delay(waitMs)
      continue
    }

    if (!response.ok) throw new Error(`代理请求失败: ${response.status}`)
    return response.json()
  }

  throw new Error('超过最大重试次数')
}

/**
 * 获取全部 monitor 列表（处理分页）
 */
async function fetchAllMonitors() {
  const monitors = []
  let cursor = null

  while (true) {
    const params = { limit: '50' }
    if (cursor) params.cursor = cursor

    const data = await proxyFetch('monitors', params)
    if (data.data) monitors.push(...data.data)
    if (!data.nextLink) break
    cursor = new URL(data.nextLink).searchParams.get('cursor')
    if (!cursor) break
  }

  return monitors
}

/**
 * 将 v3 monitor 数据映射为兼容旧格式的 snake_case 对象
 */
function mapMonitorFields(m) {
  return {
    ...m,
    friendly_name: m.friendlyName,
    create_datetime: m.createDateTime
      ? Math.floor(new Date(m.createDateTime).getTime() / 1000)
      : 0,
    status: STATUS_MAP[m.status] ?? 2,
    type: TYPE_MAP[m.type] ?? 1,
  }
}

/**
 * 获取单个 monitor 的统计数据
 */
async function fetchMonitorStats(monitorId) {
  const now = new Date()
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const to = now.toISOString()

  const [respTime, uptime] = await Promise.all([
    proxyFetch(`monitors/${monitorId}/stats/response-time`, {
      includeTimeSeries: 'true',
    }),
    proxyFetch(`monitors/${monitorId}/stats/uptime`, {
      from,
      to,
    }),
  ])
  return { respTime, uptime }
}

/**
 * 获取监控数据（主入口）
 */
export const fetchMonitorData = async () => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 120000)

  try {
    const rawMonitors = await fetchAllMonitors()

    const enriched = []
    for (const m of rawMonitors) {
      try {
        const stats = await fetchMonitorStats(m.id)
        enriched.push({ ...m, _stats: stats })
      } catch (e) {
        console.warn(`获取 monitor ${m.id} 统计数据失败:`, e)
        enriched.push({ ...m, _stats: null })
      }
      await delay(6500)
    }

    const mapped = enriched.map(mapMonitorFields)

    if (STATUS_SORT === 'friendly_name') {
      mapped.sort((a, b) => (a.friendly_name || '').localeCompare(b.friendly_name || ''))
    } else if (STATUS_SORT === 'create_datetime') {
      mapped.sort((a, b) => b.create_datetime - a.create_datetime)
    }

    return mapped.map(processMonitorData)

  } catch (error) {
    console.error('获取监控数据失败:', error)
    throw new Error('获取监控数据失败: ' + error.message)
  } finally {
    clearTimeout(timeoutId)
  }
}
