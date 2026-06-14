/**
 * 监控数据处理工具模块
 * 适配 UptimeRobot API v3
 * @module monitor
 */

/**
 * 数据验证工具
 */
const Validator = {
  isValidNumber(value) {
    return value != null && !isNaN(value) && value > 0
  },
  isValidArray(arr) {
    return Array.isArray(arr) && arr.length > 0
  },
}

/**
 * 将 v3 的 response time time_series 按小时分组为 24 个槽位
 * @param {Array} timeSeries - [{timestamp: ISO string, value: number}]
 * @returns {Array} 24 个元素，每个小时的平均响应时间（ms），无数据为 null
 */
function groupTimeSeriesByHour(timeSeries) {
  const hourly = Array(24).fill(null)
  const groups = Array.from({ length: 24 }, () => [])

  if (!Validator.isValidArray(timeSeries)) return hourly

  const now = Date.now()
  for (const point of timeSeries) {
    if (!point || !Validator.isValidNumber(point.value)) continue
    const ts = new Date(point.timestamp).getTime()
    const hoursAgo = Math.floor((now - ts) / (60 * 60 * 1000))
    if (hoursAgo >= 0 && hoursAgo < 24) {
      const slot = 23 - hoursAgo
      groups[slot].push(point.value)
    }
  }

  for (let i = 0; i < 24; i++) {
    if (groups[i].length > 0) {
      hourly[i] = Math.round(
        groups[i].reduce((s, v) => s + v, 0) / groups[i].length
      )
    }
  }

  return hourly
}

/**
 * 从 v3 uptime stats 提取 30 天每日可用率
 * v3 只返回聚合值，这里用聚合值填充 30 天
 * @param {Object} uptimeData - v3 uptime stats 响应
 * @returns {{ dailyUptimes: number[], uptime: number }}
 */
function processUptimeData(uptimeData) {
  const uptimePercent = uptimeData?.uptime
  const uptime = Validator.isValidNumber(uptimePercent) ? uptimePercent : 0
  const dailyUptimes = Array(30).fill(uptime)
  return { dailyUptimes, uptime }
}

/**
 * 从 v3 lastIncident 提取故障日志
 * @param {Object} monitor - 原始 monitor 对象
 * @returns {{ logs: Array, totalDowntime: number }}
 */
function processDowntimeLogs(monitor) {
  const incident = monitor.lastIncident
  if (!incident || !incident.startedAt) {
    return { logs: [], totalDowntime: 0 }
  }

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  const startedAt = new Date(incident.startedAt).getTime()

  if (startedAt < thirtyDaysAgo) {
    return { logs: [], totalDowntime: 0 }
  }

  const log = {
    id: incident.id,
    type: 1,
    datetime: Math.floor(startedAt / 1000),
    duration: incident.duration || 0,
    reason: incident.reason || incident.cause || '',
  }

  return {
    logs: [log],
    totalDowntime: log.duration,
  }
}

/**
 * 处理监控数据（主入口）
 * @param {Object} monitor - 已映射为 snake_case 且包含 _stats 的 monitor 对象
 * @returns {Object} 处理后的监控数据
 */
export const processMonitorData = (monitor) => {
  try {
    const respTimeData = monitor._stats?.respTime
    const uptimeData = monitor._stats?.uptime

    const avgResponseTime = Validator.isValidNumber(respTimeData?.summary?.avg)
      ? Math.round(respTimeData.summary.avg)
      : null

    const dailyResponseTimes = groupTimeSeriesByHour(respTimeData?.time_series)

    const { dailyUptimes, uptime } = processUptimeData(uptimeData)

    const { logs: downtimeLogs, totalDowntime } = processDowntimeLogs(monitor)

    const { _stats, lastIncident, ...cleanMonitor } = monitor

    return {
      ...cleanMonitor,
      stats: {
        avgResponseTime,
        dailyResponseTimes,
        uptime,
        dailyUptimes,
        downtimeLogs,
        totalDowntime,
      },
    }
  } catch (error) {
    console.error('处理监控数据失败:', error)
    throw new Error('处理监控数据失败: ' + error.message)
  }
}
