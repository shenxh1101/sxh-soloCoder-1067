const { db } = require('../db');

/**
 * API Key 认证中间件
 * 从请求头 x-api-key 或查询参数 apiKey 获取 API Key
 * 验证 API Key 是否存在且应用状态为 active
 */
function apiKeyAuth(req, res, next) {
  // 从请求头或查询参数获取 API Key
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: '无效的 API Key 或应用已停用'
    });
  }

  // 查询 applications 表验证 API Key
  const app = db.prepare(`
    SELECT id, status 
    FROM applications 
    WHERE api_key = ? AND status = 'active'
  `).get(apiKey);

  if (!app) {
    return res.status(401).json({
      success: false,
      error: '无效的 API Key 或应用已停用'
    });
  }

  // 验证通过，将 appId 挂载到 req.appId
  req.appId = app.id;
  next();
}

module.exports = {
  apiKeyAuth
};
