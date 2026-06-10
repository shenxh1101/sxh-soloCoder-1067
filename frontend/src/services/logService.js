import request from '../utils/request.js'

// 日志相关 API 服务

// 获取日志列表（支持多条件筛选和分页）
export const getLogs = (params) => {
  return request({
    url: '/logs',
    method: 'get',
    params
  })
}

// 获取日志详情
export const getLogDetail = (id) => {
  return request({
    url: `/logs/${id}`,
    method: 'get'
  })
}

// 搜索日志（同 getLogs，保留别名）
export const searchLogs = (params) => {
  return getLogs(params)
}

// 获取异常聚合数据
export const getExceptionAggregation = (params) => {
  return request({
    url: '/logs/exceptions/aggregate',
    method: 'get',
    params
  })
}

// 获取日志摘要
export const getLogSummary = (params) => {
  return request({
    url: '/logs/summary',
    method: 'get',
    params
  })
}

// 单条日志写入
export const createLog = (data) => {
  return request({
    url: '/logs',
    method: 'post',
    data
  })
}

// 批量上报日志
export const createLogsBatch = (data) => {
  return request({
    url: '/logs/batch',
    method: 'post',
    data
  })
}

// 导出日志
export const exportLogs = (params) => {
  return request({
    url: '/logs/export',
    method: 'get',
    params,
    responseType: 'blob'
  })
}

// 获取异常样例日志
export const getExceptionSamples = (exceptionHash, limit = 3) => {
  return request({
    url: `/logs/exceptions/${exceptionHash}/samples`,
    method: 'get',
    params: { limit }
  })
}

// 导出异常聚合数据
export const exportExceptions = (params) => {
  return request({
    url: '/logs/exceptions/export',
    method: 'get',
    params,
    responseType: 'blob'
  })
}
