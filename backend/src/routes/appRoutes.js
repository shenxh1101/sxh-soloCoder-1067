const express = require('express');
const router = express.Router();
const appService = require('../services/appService');

// GET /api/apps - 应用列表
router.get('/', (req, res) => {
  try {
    const apps = appService.getApps(req.query.status);
    res.json({
      success: true,
      data: apps
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// GET /api/apps/:id - 应用详情
router.get('/:id', (req, res) => {
  try {
    const app = appService.getAppById(parseInt(req.params.id));
    if (!app) {
      return res.status(404).json({
        success: false,
        error: '应用不存在'
      });
    }
    res.json({
      success: true,
      data: app
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// POST /api/apps - 创建应用
router.post('/', (req, res) => {
  try {
    const app = appService.createApp(req.body);
    res.status(201).json({
      success: true,
      data: app
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// PUT /api/apps/:id - 更新应用
router.put('/:id', (req, res) => {
  try {
    const app = appService.updateApp(parseInt(req.params.id), req.body);
    res.json({
      success: true,
      data: app
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// DELETE /api/apps/:id - 删除应用
router.delete('/:id', (req, res) => {
  try {
    const result = appService.deleteApp(parseInt(req.params.id));
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

// POST /api/apps/:id/regenerate-key - 重新生成 API Key
router.post('/:id/regenerate-key', (req, res) => {
  try {
    const app = appService.regenerateApiKey(parseInt(req.params.id));
    res.json({
      success: true,
      data: app
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
