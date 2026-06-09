import request from '../utils/request.js'

// 统计数据相关 API 服务

// 获取概览统计数据
export const getOverviewStats = () => {
  return request({
    url: '/stats/overview',
    method: 'get'
  })
}

// 获取日志趋势数据
export const getLogTrend = (params) => {
  return request({
    url: '/stats/trend',
    method: 'get',
    params
  })
}

// 获取日志级别分布
export const getLogLevelDistribution = (params) => {
  return request({
    url: '/stats/levels',
    method: 'get',
    params
  })
}

// 获取按应用统计
export const getAppStats = (params) => {
  return request({
    url: '/stats/apps',
    method: 'get',
    params
  })
}

// 获取实时统计（最近1小时）
export const getRealtimeStats = () => {
  return request({
    url: '/stats/realtime',
    method: 'get'
  })
}

// 获取最近告警列表（从告警记录API获取）
export const getRecentAlerts = (params) => {
  return request({
    url: '/alerts/records',
    method: 'get',
    params: { page_size: 10, ...params }
  })
}

// 获取异常 TOP（从异常聚合API获取）
export const getTopExceptions = (params) => {
  return request({
    url: '/logs/exceptions/aggregate',
    method: 'get',
    params: { page_size: 5, ...params }
  })
}
