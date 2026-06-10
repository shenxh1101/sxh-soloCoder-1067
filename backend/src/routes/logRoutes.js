const express = require('express');
const router = express.Router();
const logService = require('../services/logService');
const { apiKeyAuth } = require('../middleware/auth');

// POST /api/logs - 单条日志写入（需要 API Key 认证）
router.post('/', apiKeyAuth, (req, res) => {
  try {
    // 使用 req.appId，忽略请求体中的 app_id，防止越权
    const logData = { ...req.body, app_id: req.appId };
    const log = logService.createLog(logData);
    res.status(201).json({
      success: true,
      data: log
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// POST /api/logs/batch - 批量上报（需要 API Key 认证）
router.post('/batch', apiKeyAuth, (req, res) => {
  try {
    // 使用 req.appId，忽略请求体中的 app_id，防止越权
    const logsData = Array.isArray(req.body) 
      ? req.body.map(log => ({ ...log, app_id: req.appId }))
      : req.body;
    const result = logService.createLogsBatch(logsData);
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// GET /api/logs - 日志查询
router.get('/', (req, res) => {
  try {
    const filters = {
      app_id: req.query.app_id,
      start_time: req.query.start_time,
      end_time: req.query.end_time,
      keyword: req.query.keyword,
      level: req.query.level,
      source: req.query.source,
      page: req.query.page ? parseInt(req.query.page) : 1,
      page_size: req.query.page_size ? parseInt(req.query.page_size) : 20
    };

    const result = logService.queryLogs(filters);
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// GET /api/logs/exceptions - 异常聚合（别名，兼容前端调用）
router.get('/exceptions', (req, res) => {
  try {
    const filters = {
      app_id: req.query.app_id,
      start_time: req.query.start_time,
      end_time: req.query.end_time,
      exception_type: req.query.exception_type,
      page: req.query.page ? parseInt(req.query.page) : 1,
      page_size: req.query.page_size ? parseInt(req.query.page_size) : 20
    };

    const result = logService.getExceptionAggregate(filters);
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// GET /api/logs/exceptions/aggregate - 异常聚合
router.get('/exceptions/aggregate', (req, res) => {
  try {
    const filters = {
      app_id: req.query.app_id,
      start_time: req.query.start_time,
      end_time: req.query.end_time,
      exception_type: req.query.exception_type,
      page: req.query.page ? parseInt(req.query.page) : 1,
      page_size: req.query.page_size ? parseInt(req.query.page_size) : 20
    };

    const result = logService.getExceptionAggregate(filters);
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// GET /api/logs/exceptions/export - 导出异常聚合数据为 CSV
router.get('/exceptions/export', (req, res) => {
  try {
    // 收集筛选参数
    const filters = {
      app_id: req.query.app_id,
      start_time: req.query.start_time,
      end_time: req.query.end_time,
      exception_type: req.query.exception_type
    };

    const result = logService.exportExceptionsToCSV(filters);

    // 设置响应头
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);

    // 发送 CSV 内容（添加 BOM 以支持 Excel 正确显示中文）
    res.send('\ufeff' + result.csv);
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// GET /api/logs/summary - 日志摘要
router.get('/summary', (req, res) => {
  try {
    const filters = {
      app_id: req.query.app_id,
      days: req.query.days ? parseInt(req.query.days) : 7
    };

    const result = logService.getLogSummary(filters);
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// GET /api/logs/export - 导出日志为 CSV（注意：必须放在 /:id 路由之前）
router.get('/export', (req, res) => {
  try {
    // 收集所有筛选参数，确保按当前筛选条件导出
    const filters = {
      app_id: req.query.app_id,
      start_time: req.query.start_time,
      end_time: req.query.end_time,
      keyword: req.query.keyword,
      level: req.query.level,
      source: req.query.source,
      exception_type: req.query.exception_type
    };

    const result = logService.exportLogsToCSV(filters);
    
    // 设置响应头
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    
    // 发送 CSV 内容（添加 BOM 以支持 Excel 正确显示中文）
    res.send('\ufeff' + result.csv);
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// GET /api/logs/:id - 日志详情
router.get('/:id', (req, res) => {
  try {
    const log = logService.getLogById(parseInt(req.params.id));
    if (!log) {
      return res.status(404).json({
        success: false,
        error: '日志不存在'
      });
    }
    res.json({
      success: true,
      data: log
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
