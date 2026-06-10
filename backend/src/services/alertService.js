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

// 验证邮箱格式（简单验证包含@）
function validateEmail(email) {
  if (!email || !email.trim()) return false;
  const emails = email.split(',').map(e => e.trim()).filter(e => e);
  return emails.every(e => e.includes('@'));
}

// 验证手机号格式（简单验证11位数字）
function validatePhone(phone) {
  if (!phone || !phone.trim()) return false;
  const phones = phone.split(',').map(p => p.trim()).filter(p => p);
  return phones.every(p => /^\d{11}$/.test(p));
}

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
    notify_target,
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
  // 优先使用 level_threshold，其次使用 condition_value
  const rawLevelValue = level_threshold || condition_value;
  const normalizedLevel = rawLevelValue?.toLowerCase();
  if (condition_type === 'level' && normalizedLevel && !levelPriority.hasOwnProperty(normalizedLevel)) {
    throw new Error(`无效的级别阈值: ${rawLevelValue}`);
  }

  const createdAt = getCurrentTime();

  const stmt = db.prepare(`
    INSERT INTO alert_rules (
      app_id, name, condition_type, condition_value, level_threshold,
      notify_type, notify_target, webhook_url, is_enabled, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // 级别阈值统一转为小写存入数据库
  // condition_type 为 'level' 时 condition_value 可以为 null
  let finalConditionValue = condition_value;
  let finalLevelThreshold = level_threshold;

  if (condition_type === 'level') {
    // 优先使用 level_threshold，其次使用 condition_value，统一转小写
    finalLevelThreshold = (level_threshold || condition_value)?.toLowerCase() || null;
    // level 类型时 condition_value 可以为 null
    finalConditionValue = condition_value || null;
  } else {
    finalLevelThreshold = level_threshold || null;
  }

  const result = stmt.run(
    app_id,
    name,
    condition_type,
    finalConditionValue,
    finalLevelThreshold,
    notify_type,
    notify_target || null,
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
    notify_target,
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
  // 优先使用 level_threshold，其次使用 condition_value
  const finalConditionType = condition_type || existingRule.condition_type;
  const inputLevelThreshold = level_threshold !== undefined ? level_threshold : existingRule.level_threshold;
  const inputConditionValue = condition_value !== undefined ? condition_value : existingRule.condition_value;
  const rawLevelValue = inputLevelThreshold || inputConditionValue;
  
  if (finalConditionType === 'level' && !inputLevelThreshold && !inputConditionValue) {
    throw new Error('级别条件必须提供 level_threshold 或 condition_value');
  }

  const normalizedLevel = rawLevelValue?.toLowerCase();
  if (finalConditionType === 'level' && normalizedLevel && !levelPriority.hasOwnProperty(normalizedLevel)) {
    throw new Error(`无效的级别阈值: ${rawLevelValue}`);
  }

  const stmt = db.prepare(`
    UPDATE alert_rules
    SET name = COALESCE(?, name),
        condition_type = COALESCE(?, condition_type),
        condition_value = ?,
        level_threshold = ?,
        notify_type = COALESCE(?, notify_type),
        notify_target = COALESCE(?, notify_target),
        webhook_url = COALESCE(?, webhook_url),
        is_enabled = COALESCE(?, is_enabled)
    WHERE id = ?
  `);

  const updateConditionType = condition_type || existingRule.condition_type;
  const updateLevelThreshold = level_threshold !== undefined ? level_threshold : existingRule.level_threshold;
  const updateConditionValue = condition_value !== undefined ? condition_value : existingRule.condition_value;
  
  // 计算最终存入数据库的值
  let dbLevelThreshold;
  let dbConditionValue;

  if (updateConditionType === 'level') {
    // 级别阈值统一转为小写
    dbLevelThreshold = (updateLevelThreshold || updateConditionValue)?.toLowerCase() || null;
    // level 类型时 condition_value 可以为 null
    dbConditionValue = updateConditionValue !== undefined ? updateConditionValue : existingRule.condition_value;
    // 如果显式传入了 condition_value 为 null，则设为 null
    if (condition_value !== undefined && condition_value === null) {
      dbConditionValue = null;
    }
  } else {
    dbLevelThreshold = level_threshold !== undefined ? level_threshold : existingRule.level_threshold;
    dbConditionValue = condition_value !== undefined ? condition_value : existingRule.condition_value;
  }

  stmt.run(
    name || existingRule.name,
    condition_type || existingRule.condition_type,
    dbConditionValue,
    dbLevelThreshold,
    notify_type || existingRule.notify_type,
    notify_target !== undefined ? notify_target : existingRule.notify_target,
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
    status,
    assignee,
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

  // 支持按状态筛选
  if (status) {
    const validStatuses = ['pending', 'processing', 'ignored', 'resolved'];
    if (!validStatuses.includes(status)) {
      throw new Error(`无效的状态值: ${status}，有效值为 ${validStatuses.join(', ')}`);
    }
    whereClause.push('ar.status = ?');
    params.push(status);
  }

  // 支持按处理人筛选
  if (assignee) {
    whereClause.push('ar.assignee = ?');
    params.push(assignee);
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

  // 查询数据（包含新增字段 status, assignee, handle_note, handled_at）
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
  let result = {
    success: false,
    message: '',
    detail: null
  };

  try {
    const notifyTarget = rule.notify_target || '未配置';

    switch (rule.notify_type) {
      case 'email':
        // 邮件通知 - 验证 notify_target 配置和格式
        console.log(`[邮件通知] 准备发送 - 规则: ${rule.name}, 应用ID: ${appId}, 通知目标: ${notifyTarget}, 消息内容: ${message.substring(0, 150)}`);
        
        if (!rule.notify_target || !rule.notify_target.trim()) {
          const errorMsg = '邮件通知目标未配置';
          console.error(`[邮件通知] ${errorMsg} - 规则: ${rule.name}, 应用ID: ${appId}`);
          result = {
            success: false,
            message: errorMsg,
            detail: {
              notify_type: 'email',
              notify_target: notifyTarget,
              rule_name: rule.name,
              app_id: appId,
              error: '缺少 notify_target 配置'
            }
          };
        } else if (!validateEmail(rule.notify_target)) {
          const errorMsg = '邮件地址格式不正确，需包含@符号，多个地址用逗号分隔';
          console.error(`[邮件通知] ${errorMsg} - 规则: ${rule.name}, 应用ID: ${appId}, 通知目标: ${notifyTarget}`);
          result = {
            success: false,
            message: errorMsg,
            detail: {
              notify_type: 'email',
              notify_target: notifyTarget,
              rule_name: rule.name,
              app_id: appId,
              error: '邮件格式验证失败'
            }
          };
        } else {
          console.log(`[邮件通知] 模拟发送成功 - 规则: ${rule.name}, 应用ID: ${appId}, 通知目标: ${notifyTarget}, 消息: ${message.substring(0, 100)}`);
          result = {
            success: true,
            message: '邮件通知模拟发送成功',
            detail: {
              notify_type: 'email',
              notify_target: notifyTarget,
              rule_name: rule.name,
              app_id: appId,
              simulated: true,
              message_preview: message.substring(0, 100)
            }
          };
        }
        break;
      case 'sms':
        // 短信通知 - 验证 notify_target 配置和格式
        console.log(`[短信通知] 准备发送 - 规则: ${rule.name}, 应用ID: ${appId}, 通知目标: ${notifyTarget}, 消息内容: ${message.substring(0, 150)}`);
        
        if (!rule.notify_target || !rule.notify_target.trim()) {
          const errorMsg = '短信通知目标未配置';
          console.error(`[短信通知] ${errorMsg} - 规则: ${rule.name}, 应用ID: ${appId}`);
          result = {
            success: false,
            message: errorMsg,
            detail: {
              notify_type: 'sms',
              notify_target: notifyTarget,
              rule_name: rule.name,
              app_id: appId,
              error: '缺少 notify_target 配置'
            }
          };
        } else if (!validatePhone(rule.notify_target)) {
          const errorMsg = '手机号格式不正确，需为11位数字，多个号码用逗号分隔';
          console.error(`[短信通知] ${errorMsg} - 规则: ${rule.name}, 应用ID: ${appId}, 通知目标: ${notifyTarget}`);
          result = {
            success: false,
            message: errorMsg,
            detail: {
              notify_type: 'sms',
              notify_target: notifyTarget,
              rule_name: rule.name,
              app_id: appId,
              error: '手机号格式验证失败'
            }
          };
        } else {
          console.log(`[短信通知] 模拟发送成功 - 规则: ${rule.name}, 应用ID: ${appId}, 通知目标: ${notifyTarget}, 消息: ${message.substring(0, 100)}`);
          result = {
            success: true,
            message: '短信通知模拟发送成功',
            detail: {
              notify_type: 'sms',
              notify_target: notifyTarget,
              rule_name: rule.name,
              app_id: appId,
              simulated: true,
              message_preview: message.substring(0, 100)
            }
          };
        }
        break;
      case 'webhook':
      case 'dingtalk':
      case 'wechat':
        if (rule.webhook_url) {
          const webhookResult = await sendWebhookNotification(rule, message, logCount, appId);
          result = webhookResult;
        } else {
          const errorMsg = `缺少 webhook_url，规则ID: ${rule.id}`;
          console.error(`[${rule.notify_type}通知] ${errorMsg}`);
          result = {
            success: false,
            message: errorMsg,
            detail: {
              notify_type: rule.notify_type,
              rule_name: rule.name,
              app_id: appId
            }
          };
        }
        break;
      default:
        const errorMsg = `未知的通知类型: ${rule.notify_type}`;
        console.error(errorMsg);
        result = {
          success: false,
          message: errorMsg,
          detail: {
            notify_type: rule.notify_type,
            rule_name: rule.name,
            app_id: appId
          }
        };
    }
  } catch (err) {
    const errorMsg = `发送通知时出错: ${err.message}`;
    console.error(errorMsg, err);
    result = {
      success: false,
      message: errorMsg,
      detail: {
        notify_type: rule.notify_type,
        rule_name: rule.name,
        app_id: appId,
        error: err.message
      }
    };
  }

  // 记录发送结果日志
  console.log(`[通知结果] 类型: ${rule.notify_type}, 成功: ${result.success}, 消息: ${result.message}`);
  
  return result;
}

// 发送 Webhook 通知
async function sendWebhookNotification(rule, message, logCount, appId) {
  let result = {
    success: false,
    message: '',
    detail: null
  };

  try {
    const http = require('http');
    const https = require('https');
    const url = require('url');
    const notifyType = rule.notify_type;
    const notifyTarget = rule.notify_target || '未配置';

    const parsedUrl = url.parse(rule.webhook_url);
    let payload;

    // 根据通知类型构建不同的 payload
    switch (notifyType) {
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
          notify_type: notifyType
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

    return new Promise((resolve) => {
      const req = client.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const successMsg = `发送成功，状态码: ${res.statusCode}`;
            console.log(`[${notifyType}通知] ${successMsg}, 规则: ${rule.name}, 通知目标: ${notifyTarget}`);
            result = {
              success: true,
              message: successMsg,
              detail: {
                notify_type: notifyType,
                notify_target: notifyTarget,
                webhook_url: rule.webhook_url,
                status_code: res.statusCode,
                response: responseData,
                rule_name: rule.name,
                app_id: appId
              }
            };
          } else {
            const errorMsg = `发送失败，状态码: ${res.statusCode}, 响应: ${responseData}`;
            console.error(`[${notifyType}通知] ${errorMsg}, 规则: ${rule.name}, 通知目标: ${notifyTarget}`);
            result = {
              success: false,
              message: errorMsg,
              detail: {
                notify_type: notifyType,
                notify_target: notifyTarget,
                webhook_url: rule.webhook_url,
                status_code: res.statusCode,
                response: responseData,
                rule_name: rule.name,
                app_id: appId
              }
            };
          }
          console.log(`[通知结果] 类型: ${notifyType}, 成功: ${result.success}, 消息: ${result.message}`);
          resolve(result);
        });
      });

      req.on('error', (err) => {
        const errorMsg = `发送失败: ${err.message}`;
        console.error(`[${notifyType}通知] ${errorMsg}, 规则: ${rule.name}, 通知目标: ${notifyTarget}`);
        result = {
          success: false,
          message: errorMsg,
          detail: {
            notify_type: notifyType,
            notify_target: notifyTarget,
            webhook_url: rule.webhook_url,
            error: err.message,
            rule_name: rule.name,
            app_id: appId
          }
        };
        console.log(`[通知结果] 类型: ${notifyType}, 成功: ${result.success}, 消息: ${result.message}`);
        resolve(result);
      });

      req.write(data);
      req.end();
    });
  } catch (err) {
    const errorMsg = `发送 ${rule.notify_type} 通知时出错: ${err.message}`;
    console.error(errorMsg, err);
    result = {
      success: false,
      message: errorMsg,
      detail: {
        notify_type: rule.notify_type,
        notify_target: rule.notify_target || '未配置',
        webhook_url: rule.webhook_url,
        error: err.message,
        rule_name: rule.name,
        app_id: appId
      }
    };
    console.log(`[通知结果] 类型: ${rule.notify_type}, 成功: ${result.success}, 消息: ${result.message}`);
    return result;
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
    SET resolved = 1, resolved_at = ?, status = 'resolved', handled_at = ?
    WHERE id = ?
  `).run(getCurrentTime(), getCurrentTime(), recordId);

  return { success: true, message: '告警已标记为已解决' };
}

// 更新告警记录状态
function updateAlertRecordStatus(id, data) {
  const { status, assignee, handle_note } = data;

  // 验证记录是否存在
  const record = db.prepare('SELECT * FROM alert_records WHERE id = ?').get(id);
  if (!record) {
    throw new Error('告警记录不存在');
  }

  // 验证 status 有效值
  const validStatuses = ['pending', 'processing', 'ignored', 'resolved'];
  if (status && !validStatuses.includes(status)) {
    throw new Error(`无效的状态值: ${status}，有效值为 ${validStatuses.join(', ')}`);
  }

  const finalStatus = status || record.status;
  const currentTime = getCurrentTime();

  // 计算 resolved 字段值
  const resolved = finalStatus === 'resolved' ? 1 : 0;

  // 计算 handled_at 字段值（status 为 resolved 或 ignored 时设置）
  const handledAt = (finalStatus === 'resolved' || finalStatus === 'ignored') ? currentTime : record.handled_at;

  // 构建更新语句
  const stmt = db.prepare(`
    UPDATE alert_records
    SET status = COALESCE(?, status),
        assignee = COALESCE(?, assignee),
        handle_note = COALESCE(?, handle_note),
        resolved = ?,
        resolved_at = CASE WHEN ? = 'resolved' THEN ? ELSE resolved_at END,
        handled_at = ?
    WHERE id = ?
  `);

  stmt.run(
    status || record.status,
    assignee !== undefined ? assignee : record.assignee,
    handle_note !== undefined ? handle_note : record.handle_note,
    resolved,
    finalStatus,
    currentTime,
    handledAt,
    id
  );

  // 返回更新后的记录
  return db.prepare(`
    SELECT ar.*, a.name as app_name, alr.name as rule_name
    FROM alert_records ar
    LEFT JOIN applications a ON ar.app_id = a.id
    LEFT JOIN alert_rules alr ON ar.rule_id = alr.id
    WHERE ar.id = ?
  `).get(id);
}

// 分配告警记录处理人
function assignAlertRecord(id, assignee) {
  if (!assignee || !assignee.trim()) {
    throw new Error('处理人不能为空');
  }

  return updateAlertRecordStatus(id, {
    status: 'processing',
    assignee: assignee.trim()
  });
}

// 测试通知发送
async function testNotification({ notify_type, webhook_url, notify_target, rule_name = '测试规则' }) {
  const validNotifyTypes = ['email', 'sms', 'webhook', 'dingtalk', 'wechat'];
  if (!validNotifyTypes.includes(notify_type)) {
    throw new Error(`无效的通知类型: ${notify_type}，必须是 ${validNotifyTypes.join('、')} 之一`);
  }

  // webhook 类型需要 webhook_url
  const webhookNotifyTypes = ['webhook', 'dingtalk', 'wechat'];
  if (webhookNotifyTypes.includes(notify_type) && (!webhook_url || !webhook_url.trim())) {
    throw new Error('webhook_url 不能为空');
  }

  // email/sms 类型必须提供 notify_target 并验证格式
  if (notify_type === 'email') {
    if (!notify_target || !notify_target.trim()) {
      throw new Error('邮件通知目标不能为空，请输入邮件地址');
    }
    if (!validateEmail(notify_target)) {
      throw new Error('邮件地址格式不正确，需包含@符号，多个地址用逗号分隔');
    }
  }

  if (notify_type === 'sms') {
    if (!notify_target || !notify_target.trim()) {
      throw new Error('短信通知目标不能为空，请输入手机号码');
    }
    if (!validatePhone(notify_target)) {
      throw new Error('手机号格式不正确，需为11位数字，多个号码用逗号分隔');
    }
  }

  const message = `【测试通知】这是来自告警规则「${rule_name}」的测试消息。如果您收到此消息，说明配置成功！触发时间：${getCurrentTime()}`;

  const testRule = {
    id: 0,
    name: rule_name,
    notify_type,
    webhook_url: webhook_url || null,
    notify_target: notify_target || null
  };

  // 调用 sendNotification 并获取发送结果
  const sendResult = await sendNotification(testRule, message, 1, 0);

  // 根据通知类型返回不同的消息
  let resultMessage;
  if (notify_type === 'email') {
    resultMessage = sendResult.success 
      ? `邮件测试通知已模拟发送至 ${notify_target}，请检查日志确认`
      : sendResult.message;
  } else if (notify_type === 'sms') {
    resultMessage = sendResult.success
      ? `短信测试通知已模拟发送至 ${notify_target}，请检查日志确认`
      : sendResult.message;
  } else {
    resultMessage = sendResult.success
      ? '测试通知发送成功，请检查对应的通知渠道'
      : sendResult.message;
  }

  return {
    success: sendResult.success,
    message: resultMessage,
    detail: sendResult.detail
  };
}

// 按状态统计告警记录数量
function getAlertStatsByStatus(appId = null) {
  const statuses = ['pending', 'processing', 'ignored', 'resolved'];
  const result = {
    pending: 0,
    processing: 0,
    ignored: 0,
    resolved: 0
  };

  let sql = `
    SELECT status, COUNT(*) as count
    FROM alert_records
  `;
  let params = [];

  if (appId) {
    sql += ' WHERE app_id = ?';
    params.push(appId);
  }

  sql += ' GROUP BY status';

  const rows = db.prepare(sql).all(...params);

  for (const row of rows) {
    if (result.hasOwnProperty(row.status)) {
      result[row.status] = row.count;
    }
  }

  return result;
}

// 按处理人统计最近 N 天的处理数量
function getAlertStatsByAssignee(appId = null, days = 7) {
  const daysAgo = dayjs().subtract(days, 'day').format('YYYY-MM-DD HH:mm:ss');

  let sql = `
    SELECT 
      assignee,
      SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_count,
      SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing_count,
      COUNT(*) as total
    FROM alert_records
    WHERE assignee IS NOT NULL
      AND handled_at >= ?
  `;
  let params = [daysAgo];

  if (appId) {
    sql += ' AND app_id = ?';
    params.push(appId);
  }

  sql += ' GROUP BY assignee ORDER BY resolved_count DESC';

  const rows = db.prepare(sql).all(...params);

  return rows.map(row => ({
    assignee: row.assignee,
    resolved_count: row.resolved_count || 0,
    processing_count: row.processing_count || 0,
    total: row.total || 0
  }));
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
  sendWebhookNotification,
  testNotification,
  resolveAlert,
  updateAlertRecordStatus,
  assignAlertRecord,
  getAlertStatsByStatus,
  getAlertStatsByAssignee
};
