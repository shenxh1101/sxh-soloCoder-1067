const express = require('express');
const router = express.Router();
const logService = require('../services/logService');

// POST /api/logs - 单条日志写入
router.post('/', (req, res) => {
  try {
    const log = logService.createLog(req.body);
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

// POST /api/logs/batch - 批量上报
router.post('/batch', (req, res) => {
  try {
    const result = logService.createLogsBatch(req.body);
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

// GET /api/logs/exceptions/aggregate - 异常聚合
router.get('/exceptions/aggregate', (req, res) => {
  try {
    const filters = {
      app_id: req.query.app_id,
      start_time: req.query.start_time,
      end_time: req.query.end_time,
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
