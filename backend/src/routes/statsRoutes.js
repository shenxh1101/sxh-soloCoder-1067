const express = require('express');
const router = express.Router();
const statsService = require('../services/statsService');

// GET /api/stats/overview - 统计概览
router.get('/overview', (req, res) => {
  try {
    const stats = statsService.getOverviewStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// GET /api/stats/trend - 日志趋势
router.get('/trend', (req, res) => {
  try {
    const days = req.query.days ? parseInt(req.query.days) : 7;
    const stats = statsService.getTrendStats(days);
    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// GET /api/stats/levels - 按级别统计
router.get('/levels', (req, res) => {
  try {
    const appId = req.query.app_id ? parseInt(req.query.app_id) : null;
    const days = req.query.days ? parseInt(req.query.days) : null;
    const stats = statsService.getLevelStats(appId, days);
    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// GET /api/stats/apps - 按应用统计
router.get('/apps', (req, res) => {
  try {
    const days = req.query.days ? parseInt(req.query.days) : null;
    const stats = statsService.getAppStats(days);
    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// GET /api/stats/realtime - 实时统计（最近1小时）
router.get('/realtime', (req, res) => {
  try {
    const stats = statsService.getRealtimeStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
