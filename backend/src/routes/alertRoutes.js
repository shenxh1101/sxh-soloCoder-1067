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
    const { notify_type, webhook_url, notify_target, rule_name } = req.body;

    // 验证必填参数 notify_type
    if (!notify_type) {
      return res.status(400).json({
        success: false,
        error: 'notify_type 不能为空'
      });
    }

    // 根据通知类型验证相应参数
    const webhookTypes = ['webhook', 'dingtalk', 'wechat'];
    const directTypes = ['email', 'sms'];

    if (webhookTypes.includes(notify_type) && (!webhook_url || !webhook_url.trim())) {
      return res.status(400).json({
        success: false,
        error: 'webhook_url 不能为空'
      });
    }

    if (directTypes.includes(notify_type) && (!notify_target || !notify_target.trim())) {
      return res.status(400).json({
        success: false,
        error: notify_type === 'email' ? '邮件地址不能为空' : '手机号码不能为空'
      });
    }

    const result = await alertService.testNotification({
      notify_type,
      webhook_url,
      notify_target,
      rule_name: rule_name || '测试规则'
    });

    res.json({
      success: result.success,
      message: result.message,
      data: result.detail
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
      status: req.query.status,
      assignee: req.query.assignee,
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

// PUT /api/alerts/records/:id/status - 更新告警记录状态
router.put('/records/:id/status', (req, res) => {
  try {
    const { status, assignee, handle_note } = req.body;
    const record = alertService.updateAlertRecordStatus(parseInt(req.params.id), {
      status,
      assignee,
      handle_note
    });
    res.json({
      success: true,
      data: record
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// POST /api/alerts/records/:id/assign - 分配告警记录处理人
router.post('/records/:id/assign', (req, res) => {
  try {
    const { assignee } = req.body;
    const record = alertService.assignAlertRecord(parseInt(req.params.id), assignee);
    res.json({
      success: true,
      data: record
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

// GET /api/alerts/stats/status - 按状态统计告警数量
router.get('/stats/status', (req, res) => {
  try {
    const appId = req.query.app_id ? parseInt(req.query.app_id) : null;
    const stats = alertService.getAlertStatsByStatus(appId);
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

// GET /api/alerts/stats/assignee - 按处理人统计告警处理数量
router.get('/stats/assignee', (req, res) => {
  try {
    const appId = req.query.app_id ? parseInt(req.query.app_id) : null;
    const days = req.query.days ? parseInt(req.query.days) : 7;
    const stats = alertService.getAlertStatsByAssignee(appId, days);
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
