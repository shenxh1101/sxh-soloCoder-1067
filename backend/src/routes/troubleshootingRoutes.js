const express = require('express');
const router = express.Router();
const troubleshootingService = require('../services/troubleshootingService');
const logService = require('../services/logService');
const alertService = require('../services/alertService');

router.get('/context', (req, res) => {
  try {
    const { app_id, log_id, exception_hash, trace_id } = req.query;

    if (!app_id) {
      return res.status(400).json({
        success: false,
        error: 'app_id 为必填参数'
      });
    }

    const appId = parseInt(app_id);

    const trace_logs = trace_id ? troubleshootingService.getTraceLogs(trace_id, appId) : [];
    const error_trend = troubleshootingService.getAppErrorTrend(appId, 24);
    const related_alerts = troubleshootingService.getRelatedAlerts(appId, log_id, exception_hash, trace_id, 10);

    res.json({
      success: true,
      data: {
        trace_logs,
        error_trend,
        related_alerts
      }
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/trace/:traceId', (req, res) => {
  try {
    const { traceId } = req.params;
    const { app_id } = req.query;

    const appId = app_id ? parseInt(app_id) : null;
    const logs = troubleshootingService.getTraceLogs(traceId, appId);

    res.json({
      success: true,
      data: logs
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/app-error-trend/:appId', (req, res) => {
  try {
    const { appId } = req.params;
    const { hours } = req.query;

    const parsedHours = hours ? parseInt(hours) : 24;
    const trend = troubleshootingService.getAppErrorTrend(parseInt(appId), parsedHours);

    res.json({
      success: true,
      data: trend
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/related-alerts', (req, res) => {
  try {
    const { app_id, log_id, exception_hash, trace_id, limit } = req.query;

    if (!app_id) {
      return res.status(400).json({
        success: false,
        error: 'app_id 为必填参数'
      });
    }

    const parsedLimit = limit ? parseInt(limit) : 10;
    const alerts = troubleshootingService.getRelatedAlerts(
      parseInt(app_id),
      log_id,
      exception_hash,
      trace_id,
      parsedLimit
    );

    res.json({
      success: true,
      data: alerts
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/notes', (req, res) => {
  try {
    const filters = {
      app_id: req.query.app_id ? parseInt(req.query.app_id) : null,
      log_id: req.query.log_id,
      exception_hash: req.query.exception_hash,
      trace_id: req.query.trace_id,
      status: req.query.status,
      assignee: req.query.assignee,
      page: req.query.page ? parseInt(req.query.page) : 1,
      page_size: req.query.page_size ? parseInt(req.query.page_size) : 20
    };

    const result = troubleshootingService.getTroubleshootingNotes(filters);

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

router.get('/notes/:id', (req, res) => {
  try {
    const note = troubleshootingService.getTroubleshootingNoteById(parseInt(req.params.id));

    if (!note) {
      return res.status(404).json({
        success: false,
        error: '排障备注不存在'
      });
    }

    res.json({
      success: true,
      data: note
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

router.post('/notes', (req, res) => {
  try {
    const note = troubleshootingService.createTroubleshootingNote(req.body);

    res.status(201).json({
      success: true,
      data: note
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

router.put('/notes/:id', (req, res) => {
  try {
    const note = troubleshootingService.updateTroubleshootingNote(parseInt(req.params.id), req.body);

    res.json({
      success: true,
      data: note
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

router.delete('/notes/:id', (req, res) => {
  try {
    const result = troubleshootingService.deleteTroubleshootingNote(parseInt(req.params.id));

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

module.exports = router;
