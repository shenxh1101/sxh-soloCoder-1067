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
  const validNotifyTypes = ['email', 'sms', 'webhook', 'dingtalk', 'wechat'];
  if (!validNotifyTypes.includes(notify_type)) {
    throw new Error(`无效的通知类型: ${notify_type}`);
  }

  // 如果是 webhook/dingtalk/wechat 类型，必须提供 webhook_url
  const webhookNotifyTypes = ['webhook', 'dingtalk', 'wechat'];
  if (webhookNotifyTypes.includes(notify_type) && !webhook_url) {
    throw new Error(`${notify_type} 通知类型必须提供 webhook_url`);
  }

  // 如果是级别条件，必须提供 level_threshold 或 condition_value
  if (condition_type === 'level' && !level_threshold && !condition_value) {
    throw new Error('级别条件必须提供 level_threshold 或 condition_value');
  }

  // 验证级别阈值（支持大小写）
  const normalizedLevel = (level_threshold || condition_value)?.toLowerCase();
  if (condition_type === 'level' && normalizedLevel && !levelPriority.hasOwnProperty(normalizedLevel)) {
    throw new Error(`无效的级别阈值: ${level_threshold || condition_value}`);
  }

  const createdAt = getCurrentTime();

  const stmt = db.prepare(`
    INSERT INTO alert_rules (
      app_id, name, condition_type, condition_value, level_threshold,
      notify_type, webhook_url, is_enabled, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const finalLevelThreshold = condition_type === 'level' 
    ? (level_threshold || condition_value)?.toLowerCase() 
    : (level_threshold || null);

  const result = stmt.run(
    app_id,
    name,
    condition_type,
    condition_value,
    finalLevelThreshold,
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
    const validNotifyTypes = ['email', 'sms', 'webhook', 'dingtalk', 'wechat'];
    if (!validNotifyTypes.includes(notify_type)) {
      throw new Error(`无效的通知类型: ${notify_type}`);
    }
  }

  // 如果是 webhook/dingtalk/wechat 类型，必须提供 webhook_url
  const finalNotifyType = notify_type || existingRule.notify_type;
  const finalWebhookUrl = webhook_url !== undefined ? webhook_url : existingRule.webhook_url;
  const webhookNotifyTypes = ['webhook', 'dingtalk', 'wechat'];
  if (webhookNotifyTypes.includes(finalNotifyType) && !finalWebhookUrl) {
    throw new Error(`${finalNotifyType} 通知类型必须提供 webhook_url`);
  }

  // 验证级别阈值（支持大小写）
  const finalConditionType = condition_type || existingRule.condition_type;
  const finalLevelThreshold = level_threshold !== undefined ? level_threshold : existingRule.level_threshold;
  const finalConditionValue = condition_value !== undefined ? condition_value : existingRule.condition_value;
  if (finalConditionType === 'level' && !finalLevelThreshold && !finalConditionValue) {
    throw new Error('级别条件必须提供 level_threshold 或 condition_value');
  }

  const normalizedLevel = (finalLevelThreshold || finalConditionValue)?.toLowerCase();
  if (finalConditionType === 'level' && normalizedLevel && !levelPriority.hasOwnProperty(normalizedLevel)) {
    throw new Error(`无效的级别阈值: ${finalLevelThreshold || finalConditionValue}`);
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

  const updateConditionType = condition_type || existingRule.condition_type;
  const updateLevelThreshold = level_threshold !== undefined ? level_threshold : existingRule.level_threshold;
  const updateConditionValue = condition_value !== undefined ? condition_value : existingRule.condition_value;
  
  const dbLevelThreshold = updateConditionType === 'level'
    ? (updateLevelThreshold || updateConditionValue)?.toLowerCase()
    : (level_threshold !== undefined ? level_threshold : existingRule.level_threshold);

  stmt.run(
    name || existingRule.name,
    condition_type || existingRule.condition_type,
    condition_value !== undefined ? condition_value : existingRule.condition_value,
    dbLevelThreshold,
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
          // 检查日志级别是否达到阈值（统一转小写）
          const normalizedLevel = level?.toLowerCase();
          const normalizedThreshold = rule.level_threshold?.toLowerCase();
          if (normalizedLevel && normalizedThreshold && 
              levelPriority[normalizedLevel] >= levelPriority[normalizedThreshold]) {
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
          const normalizedLogLevel = level?.toLowerCase();
          if (!isNaN(threshold) && (normalizedLogLevel === 'error' || normalizedLogLevel === 'fatal')) {
            // 统计最近5分钟内的错误数量
            const fiveMinutesAgo = dayjs().subtract(5, 'minute').format('YYYY-MM-DD HH:mm:ss');
            const countResult = db.prepare(`
              SELECT COUNT(*) as count FROM logs 
              WHERE app_id = ? AND level IN ('error', 'fatal', 'ERROR', 'FATAL') AND timestamp >= ?
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

        // 调用统一的通知发送函数
        sendNotification(rule, triggerMessage, triggerLogCount, appId);
      }
    }
  } catch (err) {
    console.error('检查告警规则时出错:', err);
  }
}

// 统一发送通知函数
async function sendNotification(rule, message, logCount, appId) {
  try {
    switch (rule.notify_type) {
      case 'email':
        console.log(`[邮件通知] ${message} - 规则: ${rule.name}, 应用ID: ${appId}`);
        break;
      case 'sms':
        console.log(`[短信通知] ${message} - 规则: ${rule.name}, 应用ID: ${appId}`);
        break;
      case 'webhook':
      case 'dingtalk':
      case 'wechat':
        if (rule.webhook_url) {
          await sendWebhookNotification(rule, message, logCount, appId);
        } else {
          console.error(`[${rule.notify_type}通知] 缺少 webhook_url，规则ID: ${rule.id}`);
        }
        break;
      default:
        console.error(`未知的通知类型: ${rule.notify_type}`);
    }
  } catch (err) {
    console.error('发送通知时出错:', err);
  }
}

// 发送 Webhook 通知
async function sendWebhookNotification(rule, message, logCount, appId) {
  try {
    const http = require('http');
    const https = require('https');
    const url = require('url');

    const parsedUrl = url.parse(rule.webhook_url);
    let payload;

    // 根据通知类型构建不同的 payload
    switch (rule.notify_type) {
      case 'dingtalk':
        payload = {
          msgtype: 'text',
          text: {
            content: message
          }
        };
        break;
      case 'wechat':
        payload = {
          msgtype: 'markdown',
          markdown: {
            content: message
          }
        };
        break;
      case 'webhook':
      default:
        payload = {
          rule_id: rule.id,
          rule_name: rule.name,
          app_id: appId,
          message,
          log_count: logCount,
          triggered_at: getCurrentTime(),
          notify_type: rule.notify_type
        };
    }

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
    const notifyType = rule.notify_type;

    const req = client.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`[${notifyType}通知] 发送成功，状态码: ${res.statusCode}, 规则: ${rule.name}`);
        } else {
          console.error(`[${notifyType}通知] 发送失败，状态码: ${res.statusCode}, 响应: ${responseData}`);
        }
      });
    });

    req.on('error', (err) => {
      console.error(`[${notifyType}通知] 发送失败: ${err.message}, 规则: ${rule.name}`);
    });

    req.write(data);
    req.end();
  } catch (err) {
    console.error(`发送 ${rule.notify_type} 通知时出错:`, err);
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

// 测试通知发送
async function testNotification({ notify_type, webhook_url, rule_name = '测试规则' }) {
  const validNotifyTypes = ['webhook', 'dingtalk', 'wechat'];
  if (!validNotifyTypes.includes(notify_type)) {
    throw new Error(`无效的通知类型: ${notify_type}，必须是 webhook、dingtalk 或 wechat 之一`);
  }

  if (!webhook_url || !webhook_url.trim()) {
    throw new Error('webhook_url 不能为空');
  }

  const message = `【测试通知】这是来自告警规则「${rule_name}」的测试消息。如果您收到此消息，说明 Webhook 配置成功！触发时间：${getCurrentTime()}`;

  const testRule = {
    id: 0,
    name: rule_name,
    notify_type,
    webhook_url
  };

  await sendNotification(testRule, message, 1, 0);

  return { success: true, message: '测试通知发送成功，请检查对应的通知渠道' };
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
  sendNotification,
  testNotification,
  resolveAlert
};
