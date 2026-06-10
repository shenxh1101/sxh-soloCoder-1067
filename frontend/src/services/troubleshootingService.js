import request from '../utils/request.js'

// 排障工作台相关 API 服务

// 获取排障上下文（trace日志 + 错误趋势 + 相关告警）
export const getTroubleshootingContext = (params) => {
  return request({
    url: '/troubleshooting/context',
    method: 'get',
    params
  })
}

// 获取同Trace日志
export const getTraceLogs = (traceId, appId) => {
  return request({
    url: `/troubleshooting/trace/${traceId}`,
    method: 'get',
    params: { app_id: appId }
  })
}

// 获取应用错误趋势
export const getAppErrorTrend = (appId, hours = 24) => {
  return request({
    url: `/troubleshooting/app-error-trend/${appId}`,
    method: 'get',
    params: { hours }
  })
}

// 获取相关告警记录
export const getRelatedAlerts = (params) => {
  return request({
    url: '/troubleshooting/related-alerts',
    method: 'get',
    params
  })
}

// 获取排障备注列表
export const getTroubleshootingNotes = (params) => {
  return request({
    url: '/troubleshooting/notes',
    method: 'get',
    params
  })
}

// 获取单条排障备注
export const getTroubleshootingNote = (id) => {
  return request({
    url: `/troubleshooting/notes/${id}`,
    method: 'get'
  })
}

// 创建排障备注
export const createTroubleshootingNote = (data) => {
  return request({
    url: '/troubleshooting/notes',
    method: 'post',
    data
  })
}

// 更新排障备注
export const updateTroubleshootingNote = (id, data) => {
  return request({
    url: `/troubleshooting/notes/${id}`,
    method: 'put',
    data
  })
}

// 删除排障备注
export const deleteTroubleshootingNote = (id) => {
  return request({
    url: `/troubleshooting/notes/${id}`,
    method: 'delete'
  })
}
