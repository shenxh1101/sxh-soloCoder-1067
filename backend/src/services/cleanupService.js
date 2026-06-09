const { db, getCurrentTime } = require('../db');
const dayjs = require('dayjs');

let cleanupInterval = null;

// 获取清理策略列表
function getCleanupPolicies(appId = null, isEnabled = null) {
  let sql = `
    SELECT cp.*, a.name as app_name 
    FROM cleanup_policies cp
    LEFT JOIN applications a ON cp.app_id = a.id
  `;
  let params = [];
  let whereClause = [];

  if (appId) {
    whereClause.push('cp.app_id = ?');
    params.push(appId);
  }

  if (isEnabled !== null) {
    whereClause.push('cp.is_enabled = ?');
    params.push(isEnabled ? 1 : 0);
  }

  if (whereClause.length > 0) {
    sql += ' WHERE ' + whereClause.join(' AND ');
  }

  sql += ' ORDER BY cp.id DESC';

  return db.prepare(sql).all(...params);
}

// 获取清理策略详情
function getCleanupPolicyById(id) {
  return db.prepare(`
    SELECT cp.*, a.name as app_name 
    FROM cleanup_policies cp
    LEFT JOIN applications a ON cp.app_id = a.id
    WHERE cp.id = ?
  `).get(id);
}

// 根据应用ID获取清理策略
function getCleanupPolicyByAppId(appId) {
  return db.prepare(`
    SELECT cp.*, a.name as app_name 
    FROM cleanup_policies cp
    LEFT JOIN applications a ON cp.app_id = a.id
    WHERE cp.app_id = ?
  `).get(appId);
}

// 创建清理策略
function createCleanupPolicy(policyData) {
  const { app_id, retention_days = 30, max_logs = 100000, is_enabled = 1 } = policyData;

  // 验证应用是否存在
  const app = db.prepare('SELECT id FROM applications WHERE id = ?').get(app_id);
  if (!app) {
    throw new Error('应用不存在');
  }

  // 检查该应用是否已有策略
  const existingPolicy = db.prepare('SELECT id FROM cleanup_policies WHERE app_id = ?').get(app_id);
  if (existingPolicy) {
    throw new Error('该应用已有清理策略');
  }

  // 验证保留天数
  if (retention_days < 1) {
    throw new Error('保留天数必须大于0');
  }

  // 验证最大日志数
  if (max_logs < 1) {
    throw new Error('最大日志数必须大于0');
  }

  const stmt = db.prepare(`
    INSERT INTO cleanup_policies (app_id, retention_days, max_logs, is_enabled, last_run_at)
    VALUES (?, ?, ?, ?, NULL)
  `);

  const result = stmt.run(app_id, retention_days, max_logs, is_enabled ? 1 : 0);

  return getCleanupPolicyById(result.lastInsertRowid);
}

// 更新清理策略
function updateCleanupPolicy(id, policyData) {
  const existingPolicy = getCleanupPolicyById(id);
  if (!existingPolicy) {
    throw new Error('清理策略不存在');
  }

  const { retention_days, max_logs, is_enabled } = policyData;

  // 验证保留天数
  if (retention_days !== undefined && retention_days < 1) {
    throw new Error('保留天数必须大于0');
  }

  // 验证最大日志数
  if (max_logs !== undefined && max_logs < 1) {
    throw new Error('最大日志数必须大于0');
  }

  const stmt = db.prepare(`
    UPDATE cleanup_policies
    SET retention_days = COALESCE(?, retention_days),
        max_logs = COALESCE(?, max_logs),
        is_enabled = COALESCE(?, is_enabled)
    WHERE id = ?
  `);

  stmt.run(
    retention_days !== undefined ? retention_days : existingPolicy.retention_days,
    max_logs !== undefined ? max_logs : existingPolicy.max_logs,
    is_enabled !== undefined ? (is_enabled ? 1 : 0) : existingPolicy.is_enabled,
    id
  );

  return getCleanupPolicyById(id);
}

// 执行清理操作
function executeCleanup(policyId = null) {
  let policies = [];

  if (policyId) {
    const policy = getCleanupPolicyById(policyId);
    if (policy) {
      policies = [policy];
    }
  } else {
    // 获取所有启用的策略
    policies = getCleanupPolicies(null, true);
  }

  const results = [];

  for (const policy of policies) {
    try {
      const result = cleanupAppLogs(policy);
      results.push(result);

      // 更新最后运行时间
      db.prepare(`
        UPDATE cleanup_policies 
        SET last_run_at = ? 
        WHERE id = ?
      `).run(getCurrentTime(), policy.id);
    } catch (err) {
      console.error(`清理应用 ${policy.app_id} 日志时出错:`, err);
      results.push({
        app_id: policy.app_id,
        app_name: policy.app_name,
        success: false,
        error: err.message
      });
    }
  }

  return results;
}

// 清理指定应用的日志
function cleanupAppLogs(policy) {
  const { app_id, app_name, retention_days, max_logs } = policy;
  let deletedCount = 0;

  // 使用事务进行清理
  const cleanupTransaction = db.transaction(() => {
    // 1. 按保留天数清理
    const cutoffDate = dayjs().subtract(retention_days, 'day').format('YYYY-MM-DD HH:mm:ss');
    const deleteByDateStmt = db.prepare(`
      DELETE FROM logs 
      WHERE app_id = ? AND timestamp < ?
    `);
    const dateResult = deleteByDateStmt.run(app_id, cutoffDate);
    deletedCount += dateResult.changes;

    // 2. 按最大日志数量清理（保留最新的）
    const countResult = db.prepare(`
      SELECT COUNT(*) as count FROM logs WHERE app_id = ?
    `).get(app_id);

    if (countResult.count > max_logs) {
      const excessCount = countResult.count - max_logs;
      // 获取需要删除的最旧的日志ID
      const idsToDelete = db.prepare(`
        SELECT id FROM logs 
        WHERE app_id = ? 
        ORDER BY timestamp ASC 
        LIMIT ?
      `).all(app_id, excessCount);

      if (idsToDelete.length > 0) {
        const placeholders = idsToDelete.map(() => '?').join(',');
        const deleteByIdsStmt = db.prepare(`
          DELETE FROM logs 
          WHERE id IN (${placeholders})
        `);
        const idResult = deleteByIdsStmt.run(...idsToDelete.map(r => r.id));
        deletedCount += idResult.changes;
      }
    }
  });

  cleanupTransaction();

  console.log(`[清理任务] 应用 ${app_name || app_id} 已清理 ${deletedCount} 条日志`);

  return {
    app_id,
    app_name,
    success: true,
    deleted_count: deletedCount,
    retention_days,
    max_logs,
    executed_at: getCurrentTime()
  };
}

// 启动定时清理任务
function startCleanupScheduler() {
  // 先停止已有的定时任务
  stopCleanupScheduler();

  // 每小时执行一次清理（毫秒）
  const ONE_HOUR = 60 * 60 * 1000;

  console.log('日志清理定时任务已启动，每小时执行一次');

  // 立即执行一次
  setTimeout(() => {
    executeCleanup();
  }, 5000); // 5秒后首次执行

  // 设置定时任务
  cleanupInterval = setInterval(() => {
    executeCleanup();
  }, ONE_HOUR);
}

// 停止定时清理任务
function stopCleanupScheduler() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log('日志清理定时任务已停止');
  }
}

// 手动触发清理
function triggerCleanup(policyId = null) {
  return executeCleanup(policyId);
}

module.exports = {
  getCleanupPolicies,
  getCleanupPolicyById,
  getCleanupPolicyByAppId,
  createCleanupPolicy,
  updateCleanupPolicy,
  executeCleanup,
  startCleanupScheduler,
  stopCleanupScheduler,
  triggerCleanup
};
