const { db, getCurrentTime } = require('../db');
const dayjs = require('dayjs');

// 日志级别优先级
const levelPriority = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4
};

// 获取告警规则列表
function getAlertRules(appId = null, isEnabled = null) {
  let sql = `
    SELECT ar.*, a.name as app_name 
    FROM alert_rules ar
    LEFT JOIN applications a ON ar.app_id = a.id
  `;
  let params = [];
  let whereClause = [];

  if (appId) {
    whereClause.push('ar.app_id = ?');
    params.push(appId);
  }

  if (isEnabled !== null) {
    whereClause.push('ar.is_enabled = ?');
    params.push(isEnabled ? 1 : 0);
  }

  if (whereClause.length > 0) {
    sql += ' WHERE ' + whereClause.join(' AND ');
  }

  sql += ' ORDER BY ar.created_at DESC';

  return db.prepare(sql).all(...params);
}

// 获取告警规则详情
function getAlertRuleById(id) {
  return db.prepare(`
    SELECT ar.*, a.name as app_name 
    FROM alert_rules ar
    LEFT JOIN applications a ON ar.app_id = a.id
    WHERE ar.id = ?
  `).get(id);
}

// 创建告警规则
function createAlertRule(ruleData) {
  const {
    app_id,
    name,
    condition_type,
    condition_value,
    level_threshold,
    notify_type,
    webhook_url,
    is_enabled = 1
  } = ruleData;

  // 验证应用是否存在
  const app = db.prepare('SELECT id FROM applications WHERE id = ?').get(app_id);
  if (!app) {
    throw new Error('应用不存在');
  }

  // 验证条件类型
  const validConditionTypes = ['error_count', 'keyword', 'level'];
  if (!validConditionTypes.includes(condition_type)) {
    throw new Error(`无效的条件类型: ${condition_type}`);
  }

  // 验证通知类型
  const validNotifyTypes = ['webhook', 'email', 'sms'];
  if (!validNotifyTypes.includes(notify_type)) {
    throw new Error(`无效的通知类型: ${notify_type}`);
  }

  // 如果是 webhook 类型，必须提供 webhook_url
  if (notify_type === 'webhook' && !webhook_url) {
    throw new Error('Webhook 通知类型必须提供 webhook_url');
  }

  // 如果是级别条件，必须提供 level_threshold
  if (condition_type === 'level' && !level_threshold) {
    throw new Error('级别条件必须提供 level_threshold');
  }

  // 验证级别阈值
  if (level_threshold && !levelPriority.hasOwnProperty(level_threshold)) {
    throw new Error(`无效的级别阈值: ${level_threshold}`);
  }

  const createdAt = getCurrentTime();

  const stmt = db.prepare(`
    INSERT INTO alert_rules (
      app_id, name, condition_type, condition_value, level_threshold,
      notify_type, webhook_url, is_enabled, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    app_id,
    name,
    condition_type,
    condition_value,
    level_threshold || null,
    notify_type,
    webhook_url || null,
    is_enabled ? 1 : 0,
    createdAt
  );

  return getAlertRuleById(result.lastInsertRowid);
}

// 更新告警规则
function updateAlertRule(id, ruleData) {
  const existingRule = getAlertRuleById(id);
  if (!existingRule) {
    throw new Error('告警规则不存在');
  }

  const {
    name,
    condition_type,
    condition_value,
    level_threshold,
    notify_type,
    webhook_url,
    is_enabled
  } = ruleData;

  // 验证条件类型
  if (condition_type) {
    const validConditionTypes = ['error_count', 'keyword', 'level'];
    if (!validConditionTypes.includes(condition_type)) {
      throw new Error(`无效的条件类型: ${condition_type}`);
    }
  }

  // 验证通知类型
  if (notify_type) {
    const validNotifyTypes = ['webhook', 'email', 'sms'];
    if (!validNotifyTypes.includes(notify_type)) {
      throw new Error(`无效的通知类型: ${notify_type}`);
    }
  }

  // 如果是 webhook 类型，必须提供 webhook_url
  const finalNotifyType = notify_type || existingRule.notify_type;
  const finalWebhookUrl = webhook_url !== undefined ? webhook_url : existingRule.webhook_url;
  if (finalNotifyType === 'webhook' && !finalWebhookUrl) {
    throw new Error('Webhook 通知类型必须提供 webhook_url');
  }

  // 验证级别阈值
  const finalConditionType = condition_type || existingRule.condition_type;
  const finalLevelThreshold = level_threshold !== undefined ? level_threshold : existingRule.level_threshold;
  if (finalConditionType === 'level' && !finalLevelThreshold) {
    throw new Error('级别条件必须提供 level_threshold');
  }

  if (finalLevelThreshold && !levelPriority.hasOwnProperty(finalLevelThreshold)) {
    throw new Error(`无效的级别阈值: ${finalLevelThreshold}`);
  }

  const stmt = db.prepare(`
    UPDATE alert_rules
    SET name = COALESCE(?, name),
        condition_type = COALESCE(?, condition_type),
        condition_value = COALESCE(?, condition_value),
        level_threshold = COALESCE(?, level_threshold),
        notify_type = COALESCE(?, notify_type),
        webhook_url = COALESCE(?, webhook_url),
        is_enabled = COALESCE(?, is_enabled)
    WHERE id = ?
  `);

  stmt.run(
    name || existingRule.name,
    condition_type || existingRule.condition_type,
    condition_value || existingRule.condition_value,
    level_threshold !== undefined ? level_threshold : existingRule.level_threshold,
    notify_type || existingRule.notify_type,
    webhook_url !== undefined ? webhook_url : existingRule.webhook_url,
    is_enabled !== undefined ? (is_enabled ? 1 : 0) : existingRule.is_enabled,
    id
  );

  return getAlertRuleById(id);
}

// 删除告警规则
function deleteAlertRule(id) {
  const existingRule = getAlertRuleById(id);
  if (!existingRule) {
    throw new Error('告警规则不存在');
  }

  // 删除关联的告警记录
  db.prepare('DELETE FROM alert_records WHERE rule_id = ?').run(id);
  // 删除告警规则
  db.prepare('DELETE FROM alert_rules WHERE id = ?').run(id);

  return { success: true, message: '告警规则已删除' };
}

// 获取告警记录
function getAlertRecords(filters = {}) {
  const {
    rule_id,
    app_id,
    resolved,
    start_time,
    end_time,
    page = 1,
    page_size = 20
  } = filters;

  let sql = `
    SELECT ar.*, a.name as app_name, alr.name as rule_name
    FROM alert_records ar
    LEFT JOIN applications a ON ar.app_id = a.id
    LEFT JOIN alert_rules alr ON ar.rule_id = alr.id
  `;
  let params = [];
  let whereClause = [];

  if (rule_id) {
    whereClause.push('ar.rule_id = ?');
    params.push(rule_id);
  }

  if (app_id) {
    whereClause.push('ar.app_id = ?');
    params.push(app_id);
  }

  if (resolved !== undefined) {
    whereClause.push('ar.resolved = ?');
    params.push(resolved ? 1 : 0);
  }

  if (start_time) {
    whereClause.push('ar.triggered_at >= ?');
    params.push(start_time);
  }

  if (end_time) {
    whereClause.push('ar.triggered_at <= ?');
    params.push(end_time);
  }

  if (whereClause.length > 0) {
    sql += ' WHERE ' + whereClause.join(' AND ');
  }

  // 查询总数
  const countSql = sql.replace('SELECT ar.*, a.name as app_name, alr.name as rule_name', 'SELECT COUNT(*) as total');
  const { total } = db.prepare(countSql).get(...params);

  // 查询数据
  sql += ' ORDER BY ar.triggered_at DESC LIMIT ? OFFSET ?';
  const offset = (page - 1) * page_size;

  const records = db.prepare(sql).all(...params, page_size, offset);

  return {
    list: records,
    total,
    page: parseInt(page),
    page_size: parseInt(page_size),
    total_pages: Math.ceil(total / page_size)
  };
}

// 创建告警记录
function createAlertRecord(ruleId, appId, logCount, message) {
  const stmt = db.prepare(`
    INSERT INTO alert_records (rule_id, app_id, triggered_at, log_count, message, resolved)
    VALUES (?, ?, ?, ?, ?, 0)
  `);

  const result = stmt.run(ruleId, appId, getCurrentTime(), logCount, message);
  return result.lastInsertRowid;
}

// 检查告警规则 - 当日志写入时触发
function checkAlertRules(appId, level, message, logId) {
  try {
    // 获取该应用启用的告警规则
    const rules = db.prepare(`
      SELECT * FROM alert_rules 
      WHERE app_id = ? AND is_enabled = 1
    `).all(appId);

    for (const rule of rules) {
      let triggered = false;
      let triggerMessage = '';
      let triggerLogCount = 1;

      switch (rule.condition_type) {
        case 'level':
          // 检查日志级别是否达到阈值
          if (levelPriority[level] >= levelPriority[rule.level_threshold]) {
            triggered = true;
            triggerMessage = `[${rule.name}] 日志级别达到阈值: ${level} >= ${rule.level_threshold}, 消息: ${message.substring(0, 100)}`;
          }
          break;

        case 'keyword':
          // 检查日志消息是否包含关键字
          if (message.includes(rule.condition_value)) {
            triggered = true;
            triggerMessage = `[${rule.name}] 日志包含关键字 "${rule.condition_value}": ${message.substring(0, 100)}`;
          }
          break;

        case 'error_count':
          // 统计最近一段时间内的错误数量
          const threshold = parseInt(rule.condition_value);
          if (!isNaN(threshold) && (level === 'error' || level === 'fatal')) {
            // 统计最近5分钟内的错误数量
            const fiveMinutesAgo = dayjs().subtract(5, 'minute').format('YYYY-MM-DD HH:mm:ss');
            const countResult = db.prepare(`
              SELECT COUNT(*) as count FROM logs 
              WHERE app_id = ? AND level IN ('error', 'fatal') AND timestamp >= ?
            `).get(appId, fiveMinutesAgo);

            if (countResult.count >= threshold) {
              // 检查最近5分钟内是否已经触发过相同规则的告警
              const recentAlert = db.prepare(`
                SELECT id FROM alert_records 
                WHERE rule_id = ? AND triggered_at >= ? AND resolved = 0
              `).get(rule.id, fiveMinutesAgo);

              if (!recentAlert) {
                triggered = true;
                triggerLogCount = countResult.count;
                triggerMessage = `[${rule.name}] 最近5分钟错误数量达到阈值: ${countResult.count}/${threshold}`;
              }
            }
          }
          break;
      }

      if (triggered) {
        // 创建告警记录
        const recordId = createAlertRecord(rule.id, appId, triggerLogCount, triggerMessage);
        console.log(`告警已触发: ${triggerMessage}, 记录ID: ${recordId}`);

        // 如果是 webhook 通知，发送 HTTP 请求
        if (rule.notify_type === 'webhook' && rule.webhook_url) {
          sendWebhookNotification(rule, triggerMessage, triggerLogCount, appId);
        }
      }
    }
  } catch (err) {
    console.error('检查告警规则时出错:', err);
  }
}

// 发送 Webhook 通知
async function sendWebhookNotification(rule, message, logCount, appId) {
  try {
    const payload = {
      rule_id: rule.id,
      rule_name: rule.name,
      app_id: appId,
      message,
      log_count: logCount,
      triggered_at: getCurrentTime(),
      notify_type: rule.notify_type
    };

    // 使用 fetch 或 http 模块发送请求
    const http = require('http');
    const https = require('https');
    const url = require('url');

    const parsedUrl = url.parse(rule.webhook_url);
    const data = JSON.stringify(payload);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const client = parsedUrl.protocol === 'https:' ? https : http;
    const req = client.request(options, (res) => {
      console.log(`Webhook 发送成功，状态码: ${res.statusCode}`);
    });

    req.on('error', (err) => {
      console.error('Webhook 发送失败:', err.message);
    });

    req.write(data);
    req.end();
  } catch (err) {
    console.error('发送 Webhook 通知时出错:', err);
  }
}

// 标记告警为已解决
function resolveAlert(recordId) {
  const record = db.prepare('SELECT * FROM alert_records WHERE id = ?').get(recordId);
  if (!record) {
    throw new Error('告警记录不存在');
  }

  db.prepare(`
    UPDATE alert_records 
    SET resolved = 1, resolved_at = ? 
    WHERE id = ?
  `).run(getCurrentTime(), recordId);

  return { success: true, message: '告警已标记为已解决' };
}

module.exports = {
  getAlertRules,
  getAlertRuleById,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
  getAlertRecords,
  createAlertRecord,
  checkAlertRules,
  resolveAlert
};
