const { db } = require('../db');
const dayjs = require('dayjs');
const alertService = require('./alertService');

// 获取统计概览
function getOverviewStats() {
  // 总日志数
  const totalLogs = db.prepare('SELECT COUNT(*) as count FROM logs').get().count;

  // 今日日志数
  const todayStart = dayjs().format('YYYY-MM-DD 00:00:00');
  const todayLogs = db.prepare(`
    SELECT COUNT(*) as count FROM logs WHERE timestamp >= ?
  `).get(todayStart).count;

  // 错误日志总数
  const errorLogs = db.prepare(`
    SELECT COUNT(*) as count FROM logs WHERE level IN ('error', 'fatal')
  `).get().count;

  // 活跃应用数
  const activeApps = db.prepare(`
    SELECT COUNT(*) as count FROM applications WHERE status = 'active'
  `).get().count;

  // 未解决告警数
  const unresolvedAlerts = db.prepare(`
    SELECT COUNT(*) as count FROM alert_records WHERE resolved = 0
  `).get().count;

  // 告警状态统计
  const alertStats = alertService.getAlertStatsByStatus();

  return {
    total_logs: totalLogs,
    today_logs: todayLogs,
    error_logs: errorLogs,
    active_apps: activeApps,
    unresolved_alerts: unresolvedAlerts,
    alert_stats: alertStats,
    generated_at: new Date().toISOString()
  };
}

// 获取日志趋势 - 最近N天按天统计
function getTrendStats(days = 7) {
  const startDate = dayjs().subtract(days - 1, 'day').format('YYYY-MM-DD 00:00:00');

  const stats = db.prepare(`
    SELECT 
      DATE(timestamp) as date,
      COUNT(*) as total,
      SUM(CASE WHEN level = 'debug' THEN 1 ELSE 0 END) as debug,
      SUM(CASE WHEN level = 'info' THEN 1 ELSE 0 END) as info,
      SUM(CASE WHEN level = 'warn' THEN 1 ELSE 0 END) as warn,
      SUM(CASE WHEN level = 'error' THEN 1 ELSE 0 END) as error,
      SUM(CASE WHEN level = 'fatal' THEN 1 ELSE 0 END) as fatal
    FROM logs 
    WHERE timestamp >= ?
    GROUP BY DATE(timestamp)
    ORDER BY date ASC
  `).all(startDate);

  // 填充缺失的日期
  const trendMap = {};
  stats.forEach(stat => {
    trendMap[stat.date] = {
      date: stat.date,
      total: stat.total,
      debug: stat.debug,
      info: stat.info,
      warn: stat.warn,
      error: stat.error,
      fatal: stat.fatal
    };
  });

  const trend = [];
  for (let i = 0; i < days; i++) {
    const date = dayjs().subtract(days - 1 - i, 'day').format('YYYY-MM-DD');
    if (trendMap[date]) {
      trend.push(trendMap[date]);
    } else {
      trend.push({
        date,
        total: 0,
        debug: 0,
        info: 0,
        warn: 0,
        error: 0,
        fatal: 0
      });
    }
  }

  return {
    days,
    data: trend
  };
}

// 按级别统计
function getLevelStats(appId = null, days = null) {
  let whereClause = [];
  let params = [];

  if (appId) {
    whereClause.push('app_id = ?');
    params.push(appId);
  }

  if (days) {
    const startDate = dayjs().subtract(days - 1, 'day').format('YYYY-MM-DD 00:00:00');
    whereClause.push('timestamp >= ?');
    params.push(startDate);
  }

  const whereSql = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';

  // 先查询总数
  const total = db.prepare(`SELECT COUNT(*) as count FROM logs ${whereSql}`).get(...params).count;

  // 再查询各级别统计
  const stats = db.prepare(`
    SELECT 
      level,
      COUNT(*) as count,
      ROUND(COUNT(*) * 100.0 / ?, 2) as percentage
    FROM logs 
    ${whereSql}
    GROUP BY level
    ORDER BY count DESC
  `).all(total, ...params);

  return {
    total,
    data: stats
  };
}

// 按应用统计
function getAppStats(days = null) {
  let whereClause = [];
  let params = [];

  if (days) {
    const startDate = dayjs().subtract(days - 1, 'day').format('YYYY-MM-DD 00:00:00');
    whereClause.push('l.timestamp >= ?');
    params.push(startDate);
  }

  const whereSql = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';

  const stats = db.prepare(`
    SELECT 
      a.id as app_id,
      a.name as app_name,
      COUNT(l.id) as total_logs,
      SUM(CASE WHEN l.level = 'error' THEN 1 ELSE 0 END) as error_logs,
      SUM(CASE WHEN l.level = 'fatal' THEN 1 ELSE 0 END) as fatal_logs,
      MAX(l.timestamp) as last_log_time
    FROM applications a
    LEFT JOIN logs l ON a.id = l.app_id
    ${whereSql}
    GROUP BY a.id, a.name
    ORDER BY total_logs DESC
  `).all(...params);

  return {
    data: stats
  };
}

// 获取实时统计（最近1小时）
function getRealtimeStats() {
  const oneHourAgo = dayjs().subtract(1, 'hour').format('YYYY-MM-DD HH:mm:ss');

  // 最近1小时的日志数量按分钟统计
  const minuteStats = db.prepare(`
    SELECT 
      strftime('%Y-%m-%d %H:%M', timestamp) as minute,
      COUNT(*) as count
    FROM logs 
    WHERE timestamp >= ?
    GROUP BY strftime('%Y-%m-%d %H:%M', timestamp)
    ORDER BY minute ASC
  `).all(oneHourAgo);

  // 最近1小时各级别数量
  const levelStats = db.prepare(`
    SELECT 
      level,
      COUNT(*) as count
    FROM logs 
    WHERE timestamp >= ?
    GROUP BY level
    ORDER BY count DESC
  `).all(oneHourAgo);

  // 最近1小时总日志数
  const total = db.prepare(`
    SELECT COUNT(*) as count FROM logs WHERE timestamp >= ?
  `).get(oneHourAgo).count;

  return {
    time_range: 'last_1_hour',
    total_logs: total,
    by_minute: minuteStats,
    by_level: levelStats
  };
}

module.exports = {
  getOverviewStats,
  getTrendStats,
  getLevelStats,
  getAppStats,
  getRealtimeStats
};
