const { db, getCurrentTime } = require('../db');
const crypto = require('crypto');

// 生成 API Key
function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

// 获取应用列表
function getApps(status = null) {
  let sql = 'SELECT * FROM applications';
  let params = [];

  if (status) {
    sql += ' WHERE status = ?';
    params.push(status);
  }

  sql += ' ORDER BY created_at DESC';

  return db.prepare(sql).all(...params);
}

// 获取应用详情
function getAppById(id) {
  return db.prepare('SELECT * FROM applications WHERE id = ?').get(id);
}

// 根据 API Key 获取应用
function getAppByApiKey(apiKey) {
  return db.prepare('SELECT * FROM applications WHERE api_key = ?').get(apiKey);
}

// 创建应用
function createApp(appData) {
  const { name, description } = appData;

  if (!name || name.trim() === '') {
    throw new Error('应用名称不能为空');
  }

  // 检查名称是否已存在
  const existingApp = db.prepare('SELECT id FROM applications WHERE name = ?').get(name);
  if (existingApp) {
    throw new Error('应用名称已存在');
  }

  const apiKey = generateApiKey();
  const createdAt = getCurrentTime();

  const stmt = db.prepare(`
    INSERT INTO applications (name, api_key, description, created_at, status)
    VALUES (?, ?, ?, ?, 'active')
  `);

  const result = stmt.run(name, apiKey, description || null, createdAt);

  return getAppById(result.lastInsertRowid);
}

// 更新应用
function updateApp(id, appData) {
  const { name, description, status } = appData;

  const existingApp = getAppById(id);
  if (!existingApp) {
    throw new Error('应用不存在');
  }

  // 如果更新名称，检查是否与其他应用冲突
  if (name && name !== existingApp.name) {
    const nameConflict = db.prepare('SELECT id FROM applications WHERE name = ? AND id != ?').get(name, id);
    if (nameConflict) {
      throw new Error('应用名称已存在');
    }
  }

  // 验证状态
  if (status && !['active', 'inactive'].includes(status)) {
    throw new Error('无效的状态值');
  }

  const stmt = db.prepare(`
    UPDATE applications
    SET name = COALESCE(?, name),
        description = COALESCE(?, description),
        status = COALESCE(?, status)
    WHERE id = ?
  `);

  stmt.run(
    name || existingApp.name,
    description !== undefined ? description : existingApp.description,
    status || existingApp.status,
    id
  );

  return getAppById(id);
}

// 删除应用
function deleteApp(id) {
  const existingApp = getAppById(id);
  if (!existingApp) {
    throw new Error('应用不存在');
  }

  // 使用事务删除相关数据
  const deleteTransaction = db.transaction((appId) => {
    // 删除日志
    db.prepare('DELETE FROM logs WHERE app_id = ?').run(appId);
    // 删除告警规则
    db.prepare('DELETE FROM alert_rules WHERE app_id = ?').run(appId);
    // 删除告警记录
    db.prepare('DELETE FROM alert_records WHERE app_id = ?').run(appId);
    // 删除清理策略
    db.prepare('DELETE FROM cleanup_policies WHERE app_id = ?').run(appId);
    // 删除应用
    db.prepare('DELETE FROM applications WHERE id = ?').run(appId);
  });

  deleteTransaction(id);

  return { success: true, message: '应用已删除' };
}

// 重新生成 API Key
function regenerateApiKey(id) {
  const existingApp = getAppById(id);
  if (!existingApp) {
    throw new Error('应用不存在');
  }

  const newApiKey = generateApiKey();

  db.prepare('UPDATE applications SET api_key = ? WHERE id = ?').run(newApiKey, id);

  return getAppById(id);
}

module.exports = {
  getApps,
  getAppById,
  getAppByApiKey,
  createApp,
  updateApp,
  deleteApp,
  regenerateApiKey
};
