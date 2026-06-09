const express = require('express');
const router = express.Router();
const alertService = require('../services/alertService');

// GET /api/alerts/rules - 告警规则列表
router.get('/rules', (req, res) => {
  try {
    const rules = alertService.getAlertRules(
      req.query.app_id ? parseInt(req.query.app_id) : null,
      req.query.is_enabled !== undefined ? req.query.is_enabled === 'true' : null
    );
    res.json({
      success: true,
      data: rules
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// GET /api/alerts/rules/:id - 告警规则详情
router.get('/rules/:id', (req, res) => {
  try {
    const rule = alertService.getAlertRuleById(parseInt(req.params.id));
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: '告警规则不存在'
      });
    }
    res.json({
      success: true,
      data: rule
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// POST /api/alerts/rules - 创建告警规则
router.post('/rules', (req, res) => {
  try {
    const rule = alertService.createAlertRule(req.body);
    res.status(201).json({
      success: true,
      data: rule
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// PUT /api/alerts/rules/:id - 更新告警规则
router.put('/rules/:id', (req, res) => {
  try {
    const rule = alertService.updateAlertRule(parseInt(req.params.id), req.body);
    res.json({
      success: true,
      data: rule
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// DELETE /api/alerts/rules/:id - 删除告警规则
router.delete('/rules/:id', (req, res) => {
  try {
    const result = alertService.deleteAlertRule(parseInt(req.params.id));
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

// POST /api/alerts/rules/test-notification - 测试通知发送
router.post('/rules/test-notification', async (req, res) => {
  try {
    const { notify_type, webhook_url, rule_name } = req.body;
    const result = await alertService.testNotification({ notify_type, webhook_url, rule_name });
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

// GET /api/alerts/records - 告警记录
router.get('/records', (req, res) => {
  try {
    const filters = {
      rule_id: req.query.rule_id ? parseInt(req.query.rule_id) : null,
      app_id: req.query.app_id ? parseInt(req.query.app_id) : null,
      resolved: req.query.resolved !== undefined ? req.query.resolved === 'true' : undefined,
      start_time: req.query.start_time,
      end_time: req.query.end_time,
      page: req.query.page ? parseInt(req.query.page) : 1,
      page_size: req.query.page_size ? parseInt(req.query.page_size) : 20
    };

    const result = alertService.getAlertRecords(filters);
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

// POST /api/alerts/records/:id/resolve - 标记告警为已解决
router.post('/records/:id/resolve', (req, res) => {
  try {
    const result = alertService.resolveAlert(parseInt(req.params.id));
    res.json({
      success: true,
      message: result.message
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// POST /api/alerts/rules/test-notification - 测试通知发送
router.post('/rules/test-notification', async (req, res) => {
  try {
    const { notify_type, webhook_url, rule_name } = req.body;
    const result = await alertService.testNotification({
      notify_type,
      webhook_url,
      rule_name: rule_name || '测试规则'
    });
    res.json({
      success: result.success,
      message: result.message
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
