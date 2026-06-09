const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./db');
const { startCleanupScheduler } = require('./services/cleanupService');

// 导入路由
const logRoutes = require('./routes/logRoutes');
const appRoutes = require('./routes/appRoutes');
const alertRoutes = require('./routes/alertRoutes');
const cleanupRoutes = require('./routes/cleanupRoutes');
const statsRoutes = require('./routes/statsRoutes');

// 初始化数据库
initDatabase();

// 创建 Express 应用
const app = express();
const PORT = 3001;

// 启用 CORS
app.use(cors());

// 启用 JSON 解析
app.use(express.json({ limit: '10mb' }));

// 日志中间件
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleString()}] ${req.method} ${req.url}`);
  next();
});

// 注册路由
app.use('/api/logs', logRoutes);
app.use('/api/apps', appRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/cleanup', cleanupRoutes);
app.use('/api/stats', statsRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `路径 ${req.method} ${req.url} 不存在`
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`日志服务已启动，监听端口 ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
  
  // 启动日志清理定时任务
  startCleanupScheduler();
});
