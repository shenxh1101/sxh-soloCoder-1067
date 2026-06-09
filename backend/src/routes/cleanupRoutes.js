const express = require('express');
const router = express.Router();
const cleanupService = require('../services/cleanupService');

// GET /api/cleanup/policies - 清理策略列表
router.get('/policies', (req, res) => {
  try {
    const policies = cleanupService.getCleanupPolicies(
      req.query.app_id ? parseInt(req.query.app_id) : null,
      req.query.is_enabled !== undefined ? req.query.is_enabled === 'true' : null
    );
    res.json({
      success: true,
      data: policies
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// GET /api/cleanup/policies/:id - 清理策略详情
router.get('/policies/:id', (req, res) => {
  try {
    const policy = cleanupService.getCleanupPolicyById(parseInt(req.params.id));
    if (!policy) {
      return res.status(404).json({
        success: false,
        error: '清理策略不存在'
      });
    }
    res.json({
      success: true,
      data: policy
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// POST /api/cleanup/policies - 创建清理策略
router.post('/policies', (req, res) => {
  try {
    const policy = cleanupService.createCleanupPolicy(req.body);
    res.status(201).json({
      success: true,
      data: policy
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// PUT /api/cleanup/policies/:id - 更新清理策略
router.put('/policies/:id', (req, res) => {
  try {
    const policy = cleanupService.updateCleanupPolicy(parseInt(req.params.id), req.body);
    res.json({
      success: true,
      data: policy
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// POST /api/cleanup/trigger - 手动触发清理
router.post('/trigger', (req, res) => {
  try {
    const policyId = req.body.policy_id ? parseInt(req.body.policy_id) : null;
    const results = cleanupService.triggerCleanup(policyId);
    res.json({
      success: true,
      data: results
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
