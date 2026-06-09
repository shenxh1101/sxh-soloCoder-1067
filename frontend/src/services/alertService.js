import request from '../utils/request.js'

// 告警规则相关 API 服务

// 获取告警规则列表
export const getAlertRules = (params) => {
  return request({
    url: '/alerts/rules',
    method: 'get',
    params
  })
}

// 获取告警规则详情
export const getAlertRuleDetail = (id) => {
  return request({
    url: `/alerts/rules/${id}`,
    method: 'get'
  })
}

// 创建告警规则
export const createAlertRule = (data) => {
  return request({
    url: '/alerts/rules',
    method: 'post',
    data
  })
}

// 更新告警规则
export const updateAlertRule = (id, data) => {
  return request({
    url: `/alerts/rules/${id}`,
    method: 'put',
    data
  })
}

// 删除告警规则
export const deleteAlertRule = (id) => {
  return request({
    url: `/alerts/rules/${id}`,
    method: 'delete'
  })
}

// 启用/禁用告警规则
export const toggleAlertRule = (id, enabled) => {
  return request({
    url: `/alerts/rules/${id}`,
    method: 'put',
    data: { is_enabled: enabled ? 1 : 0 }
  })
}

// 获取告警记录列表
export const getAlertRecords = (params) => {
  return request({
    url: '/alerts/records',
    method: 'get',
    params
  })
}

// 标记告警为已解决
export const resolveAlert = (id) => {
  return request({
    url: `/alerts/records/${id}/resolve`,
    method: 'post'
  })
}
