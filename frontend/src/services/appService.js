import request from '../utils/request.js'

// 应用管理相关 API 服务

// 获取应用列表
export const getApps = (params) => {
  return request({
    url: '/apps',
    method: 'get',
    params
  })
}

// 获取应用详情
export const getAppDetail = (id) => {
  return request({
    url: `/apps/${id}`,
    method: 'get'
  })
}

// 创建应用
export const createApp = (data) => {
  return request({
    url: '/apps',
    method: 'post',
    data
  })
}

// 更新应用
export const updateApp = (id, data) => {
  return request({
    url: `/apps/${id}`,
    method: 'put',
    data
  })
}

// 删除应用
export const deleteApp = (id) => {
  return request({
    url: `/apps/${id}`,
    method: 'delete'
  })
}

// 重置 API Key
export const resetApiKey = (id) => {
  return request({
    url: `/apps/${id}/regenerate-key`,
    method: 'post'
  })
}

// 获取清理策略列表
export const getCleanupPolicies = (params) => {
  return request({
    url: '/cleanup/policies',
    method: 'get',
    params
  })
}

// 创建清理策略
export const createCleanupPolicy = (data) => {
  return request({
    url: '/cleanup/policies',
    method: 'post',
    data
  })
}

// 更新清理策略
export const updateCleanupPolicy = (id, data) => {
  return request({
    url: `/cleanup/policies/${id}`,
    method: 'put',
    data
  })
}

// 触发清理
export const triggerCleanup = () => {
  return request({
    url: '/cleanup/trigger',
    method: 'post'
  })
}
