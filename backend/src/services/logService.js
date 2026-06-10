const { db, getCurrentTime } = require('../db');
const crypto = require('crypto');
const dayjs = require('dayjs');
const { checkAlertRules } = require('./alertService');

// 生成异常哈希值
function generateExceptionHash(exceptionType, message, stackTrace) {
  const content = `${exceptionType || ''}:${message || ''}:${stackTrace ? stackTrace.split('\n')[0] : ''}`;
  return crypto.createHash('md5').update(content).digest('hex');
}

// 单条日志写入
function createLog(logData) {
  const {
    app_id,
    level,
    message,
    timestamp,
    source,
    stack_trace,
    metadata,
    exception_type
  } = logData;

  // 验证日志级别
  const validLevels = ['debug', 'info', 'warn', 'error', 'fatal'];
  if (!validLevels.includes(level)) {
    throw new Error(`无效的日志级别: ${level}`);
  }

  // 验证应用是否存在
  const app = db.prepare('SELECT id, status FROM applications WHERE id = ?').get(app_id);
  if (!app) {
    throw new Error('应用不存在');
  }
  if (app.status !== 'active') {
    throw new Error('应用已被禁用');
  }

  // 生成异常哈希
  let exception_hash = null;
  if (exception_type || stack_trace) {
    exception_hash = generateExceptionHash(exception_type, message, stack_trace);
  }

  const stmt = db.prepare(`
    INSERT INTO logs (app_id, level, message, timestamp, source, stack_trace, metadata, exception_type, exception_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    app_id,
    level,
    message,
    timestamp || getCurrentTime(),
    source || null,
    stack_trace || null,
    metadata ? JSON.stringify(metadata) : null,
    exception_type || null,
    exception_hash
  );

  const logId = result.lastInsertRowid;

  // 异步检查告警规则
  setImmediate(() => {
    checkAlertRules(app_id, level, message, logId);
  });

  return getLogById(logId);
}

// 批量日志写入
function createLogsBatch(logsData) {
  if (!Array.isArray(logsData) || logsData.length === 0) {
    throw new Error('日志数据不能为空');
  }

  const results = [];
  const errors = [];

  const insert = db.transaction((logs) => {
    for (const logData of logs) {
      try {
        const {
          app_id,
          level,
          message,
          timestamp,
          source,
          stack_trace,
          metadata,
          exception_type
        } = logData;

        // 验证日志级别
        const validLevels = ['debug', 'info', 'warn', 'error', 'fatal'];
        if (!validLevels.includes(level)) {
          errors.push({ log: logData, error: `无效的日志级别: ${level}` });
          continue;
        }

        // 验证应用是否存在
        const app = db.prepare('SELECT id, status FROM applications WHERE id = ?').get(app_id);
        if (!app) {
          errors.push({ log: logData, error: '应用不存在' });
          continue;
        }
        if (app.status !== 'active') {
          errors.push({ log: logData, error: '应用已被禁用' });
          continue;
        }

        // 生成异常哈希
        let exception_hash = null;
        if (exception_type || stack_trace) {
          exception_hash = generateExceptionHash(exception_type, message, stack_trace);
        }

        const stmt = db.prepare(`
          INSERT INTO logs (app_id, level, message, timestamp, source, stack_trace, metadata, exception_type, exception_hash)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
          app_id,
          level,
          message,
          timestamp || getCurrentTime(),
          source || null,
          stack_trace || null,
          metadata ? JSON.stringify(metadata) : null,
          exception_type || null,
          exception_hash
        );

        results.push({
          id: result.lastInsertRowid,
          app_id,
          level,
          message
        });

        // 异步检查告警规则
        setImmediate(() => {
          checkAlertRules(app_id, level, message, result.lastInsertRowid);
        });
      } catch (err) {
        errors.push({ log: logData, error: err.message });
      }
    }
  });

  insert(logsData);

  return {
    success: results.length,
    failed: errors.length,
    results,
    errors
  };
}

// 根据ID获取日志
function getLogById(id) {
  const log = db.prepare('SELECT * FROM logs WHERE id = ?').get(id);
  if (log && log.metadata) {
    try {
      log.metadata = JSON.parse(log.metadata);
    } catch (e) {
      // 解析失败保持原样
    }
  }
  return log;
}

// 日志查询
function queryLogs(filters = {}) {
  const {
    app_id,
    start_time,
    end_time,
    keyword,
    level,
    source,
    exception_type,
    page = 1,
    page_size = 20
  } = filters;

  let whereClause = [];
  let params = [];

  if (app_id) {
    whereClause.push('app_id = ?');
    params.push(app_id);
  }

  if (start_time) {
    whereClause.push('timestamp >= ?');
    params.push(start_time);
  }

  if (end_time) {
    whereClause.push('timestamp <= ?');
    params.push(end_time);
  }

  if (keyword) {
    whereClause.push('(message LIKE ? OR stack_trace LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  if (level) {
    if (level.includes(',')) {
      const levels = level.split(',').filter(l => l.trim());
      const placeholders = levels.map(() => '?').join(', ');
      whereClause.push(`level IN (${placeholders})`);
      params.push(...levels);
    } else {
      whereClause.push('level = ?');
      params.push(level);
    }
  }

  if (source) {
    if (source.includes(',')) {
      const sources = source.split(',').filter(s => s.trim());
      const placeholders = sources.map(() => '?').join(', ');
      whereClause.push(`source IN (${placeholders})`);
      params.push(...sources);
    } else {
      whereClause.push('source = ?');
      params.push(source);
    }
  }

  if (exception_type) {
    if (exception_type.includes(',')) {
      const types = exception_type.split(',').filter(t => t.trim());
      const placeholders = types.map(() => '?').join(', ');
      whereClause.push(`exception_type IN (${placeholders})`);
      params.push(...types);
    } else {
      whereClause.push('exception_type = ?');
      params.push(exception_type);
    }
  }

  const whereSql = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';

  // 查询总数
  const countStmt = db.prepare(`SELECT COUNT(*) as total FROM logs ${whereSql}`);
  const { total } = countStmt.get(...params);

  // 查询数据
  const offset = (page - 1) * page_size;
  const dataStmt = db.prepare(`
    SELECT * FROM logs ${whereSql}
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `);

  const logs = dataStmt.all(...params, page_size, offset);

  // 解析 metadata 并提取 traceId
  logs.forEach(log => {
    if (log.metadata) {
      try {
        const parsedMetadata = JSON.parse(log.metadata);
        log.metadata = parsedMetadata;
        if (parsedMetadata.traceId !== undefined) {
          log.traceId = parsedMetadata.traceId;
        }
      } catch (e) {
        // 解析失败保持原样
      }
    }
  });

  return {
    list: logs,
    total,
    page: parseInt(page),
    page_size: parseInt(page_size),
    total_pages: Math.ceil(total / page_size)
  };
}

// 异常聚合 - 按 exception_hash 分组统计
function getExceptionAggregate(filters = {}) {
  const { app_id, start_time, end_time, exception_type, page = 1, page_size = 20 } = filters;

  let whereClause = ['exception_hash IS NOT NULL'];
  let params = [];

  if (app_id) {
    whereClause.push('app_id = ?');
    params.push(app_id);
  }

  if (start_time) {
    whereClause.push('timestamp >= ?');
    params.push(start_time);
  }

  if (end_time) {
    whereClause.push('timestamp <= ?');
    params.push(end_time);
  }

  if (exception_type) {
    if (exception_type.includes(',')) {
      const types = exception_type.split(',').filter(t => t.trim());
      const placeholders = types.map(() => '?').join(', ');
      whereClause.push(`exception_type IN (${placeholders})`);
      params.push(...types);
    } else {
      whereClause.push('exception_type = ?');
      params.push(exception_type);
    }
  }

  const whereSql = `WHERE ${whereClause.join(' AND ')}`;

  // 查询总数（不同的异常哈希数量）
  const countStmt = db.prepare(`
    SELECT COUNT(DISTINCT exception_hash) as total 
    FROM logs ${whereSql}
  `);
  const { total } = countStmt.get(...params);

  // 聚合查询
  const offset = (page - 1) * page_size;
  const dataStmt = db.prepare(`
    SELECT 
      app_id,
      exception_hash,
      exception_type,
      message,
      COUNT(*) as count,
      MIN(timestamp) as first_seen,
      MAX(timestamp) as last_seen,
      GROUP_CONCAT(DISTINCT source) as sources
    FROM logs ${whereSql}
    GROUP BY app_id, exception_hash, exception_type, message
    ORDER BY last_seen DESC
    LIMIT ? OFFSET ?
  `);

  const exceptions = dataStmt.all(...params, page_size, offset);

  // 处理 sources 字段和获取样例日志
  exceptions.forEach(e => {
    if (e.sources) {
      e.sources = e.sources.split(',');
    } else {
      e.sources = [];
    }

    // 获取最近3条样例日志
    e.sample_logs = getExceptionSamples(e.exception_hash, 3);
  });

  return {
    list: exceptions,
    total,
    page: parseInt(page),
    page_size: parseInt(page_size),
    total_pages: Math.ceil(total / page_size)
  };
}

// 获取异常样例日志
function getExceptionSamples(exception_hash, limit = 3) {
  const stmt = db.prepare(`
    SELECT id, timestamp, level, message, stack_trace
    FROM logs
    WHERE exception_hash = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);

  return stmt.all(exception_hash, limit);
}

// CSV 字段转义
function escapeCSVField(field) {
  if (field === null || field === undefined) {
    return '';
  }
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// 导出日志为 CSV
function exportLogsToCSV(filters = {}) {
  const {
    app_id,
    start_time,
    end_time,
    keyword,
    level,
    source,
    exception_type
  } = filters;

  let whereClause = [];
  let params = [];

  if (app_id) {
    whereClause.push('l.app_id = ?');
    params.push(app_id);
  }

  if (start_time) {
    whereClause.push('l.timestamp >= ?');
    params.push(start_time);
  }

  if (end_time) {
    whereClause.push('l.timestamp <= ?');
    params.push(end_time);
  }

  if (keyword) {
    whereClause.push('(l.message LIKE ? OR l.stack_trace LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  if (level) {
    if (level.includes(',')) {
      const levels = level.split(',').filter(l => l.trim());
      const placeholders = levels.map(() => '?').join(', ');
      whereClause.push(`l.level IN (${placeholders})`);
      params.push(...levels);
    } else {
      whereClause.push('l.level = ?');
      params.push(level);
    }
  }

  if (source) {
    if (source.includes(',')) {
      const sources = source.split(',').filter(s => s.trim());
      const placeholders = sources.map(() => '?').join(', ');
      whereClause.push(`l.source IN (${placeholders})`);
      params.push(...sources);
    } else {
      whereClause.push('l.source = ?');
      params.push(source);
    }
  }

  if (exception_type) {
    if (exception_type.includes(',')) {
      const types = exception_type.split(',').filter(t => t.trim());
      const placeholders = types.map(() => '?').join(', ');
      whereClause.push(`l.exception_type IN (${placeholders})`);
      params.push(...types);
    } else {
      whereClause.push('l.exception_type = ?');
      params.push(exception_type);
    }
  }

  const whereSql = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';

  // 查询所有符合条件的日志，join 应用表获取应用名称
  const stmt = db.prepare(`
    SELECT 
      l.timestamp,
      a.name as app_name,
      l.level,
      l.source,
      l.message,
      l.exception_type,
      l.metadata
    FROM logs l
    LEFT JOIN applications a ON l.app_id = a.id
    ${whereSql}
    ORDER BY l.timestamp DESC
  `);

  const logs = stmt.all(...params);

  // 生成 CSV
  const headers = ['时间', '应用', '级别', '来源', '消息', '异常类型', 'TraceId'];
  const rows = logs.map(log => {
    let traceId = '';
    if (log.metadata) {
      try {
        const parsed = JSON.parse(log.metadata);
        if (parsed.traceId !== undefined) {
          traceId = parsed.traceId;
        }
      } catch (e) {
        // 解析失败保持空
      }
    }

    return [
      log.timestamp,
      log.app_name,
      log.level,
      log.source,
      log.message,
      log.exception_type,
      traceId
    ].map(escapeCSVField).join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');

  // 生成文件名
  const now = new Date();
  const timestamp = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0') + '_' +
    now.getHours().toString().padStart(2, '0') +
    now.getMinutes().toString().padStart(2, '0') +
    now.getSeconds().toString().padStart(2, '0');
  const filename = `logs_${timestamp}.csv`;

  return {
    csv: csvContent,
    filename,
    count: logs.length
  };
}

// 导出异常聚合数据为 CSV
function exportExceptionsToCSV(filters = {}) {
  const { app_id, start_time, end_time, exception_type } = filters;

  let whereClause = ['l.exception_hash IS NOT NULL'];
  let params = [];

  if (app_id) {
    whereClause.push('l.app_id = ?');
    params.push(app_id);
  }

  if (start_time) {
    whereClause.push('l.timestamp >= ?');
    params.push(start_time);
  }

  if (end_time) {
    whereClause.push('l.timestamp <= ?');
    params.push(end_time);
  }

  if (exception_type) {
    if (exception_type.includes(',')) {
      const types = exception_type.split(',').filter(t => t.trim());
      const placeholders = types.map(() => '?').join(', ');
      whereClause.push(`l.exception_type IN (${placeholders})`);
      params.push(...types);
    } else {
      whereClause.push('l.exception_type = ?');
      params.push(exception_type);
    }
  }

  const whereSql = `WHERE ${whereClause.join(' AND ')}`;

  // 查询所有符合条件的异常聚合数据，JOIN 应用表获取应用名称
  const stmt = db.prepare(`
    SELECT 
      l.exception_type,
      a.name as app_name,
      COUNT(*) as count,
      MIN(l.timestamp) as first_seen,
      MAX(l.timestamp) as last_seen,
      GROUP_CONCAT(DISTINCT l.source) as sources
    FROM logs l
    LEFT JOIN applications a ON l.app_id = a.id
    ${whereSql}
    GROUP BY l.app_id, l.exception_hash, l.exception_type
    ORDER BY last_seen DESC
  `);

  const exceptions = stmt.all(...params);

  // 生成 CSV
  const headers = ['异常类型', '所属应用', '出现次数', '首次出现', '最后出现', '来源列表'];
  const rows = exceptions.map(e => {
    // 处理 sources 字段，转为逗号分隔的字符串
    const sourcesStr = e.sources ? e.sources.replace(/,/g, '、') : '';
    
    return [
      e.exception_type || '未知异常',
      e.app_name || '未知应用',
      e.count,
      e.first_seen,
      e.last_seen,
      sourcesStr
    ].map(escapeCSVField).join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');

  // 生成文件名
  const now = new Date();
  const timestamp = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0') + '_' +
    now.getHours().toString().padStart(2, '0') +
    now.getMinutes().toString().padStart(2, '0') +
    now.getSeconds().toString().padStart(2, '0');
  const filename = `exception_aggregate_${timestamp}.csv`;

  return {
    csv: csvContent,
    filename,
    count: exceptions.length
  };
}

// 日志摘要 - 按级别统计数量和趋势
function getLogSummary(filters = {}) {
  const { app_id, days = 7 } = filters;

  // 按级别统计数量
  let levelWhere = [];
  let levelParams = [];

  if (app_id) {
    levelWhere.push('app_id = ?');
    levelParams.push(app_id);
  }

  const levelWhereSql = levelWhere.length > 0 ? `WHERE ${levelWhere.join(' AND ')}` : '';

  const levelStats = db.prepare(`
    SELECT level, COUNT(*) as count
    FROM logs ${levelWhereSql}
    GROUP BY level
    ORDER BY count DESC
  `).all(...levelParams);

  // 转换为对象格式
  const levelCounts = {
    debug: 0,
    info: 0,
    warn: 0,
    error: 0,
    fatal: 0
  };

  levelStats.forEach(stat => {
    levelCounts[stat.level] = stat.count;
  });

  // 趋势统计 - 按天统计
  let trendWhere = [];
  let trendParams = [];

  if (app_id) {
    trendWhere.push('app_id = ?');
    trendParams.push(app_id);
  }

  const startDate = dayjs().subtract(days - 1, 'day').format('YYYY-MM-DD 00:00:00');
  trendWhere.push('timestamp >= ?');
  trendParams.push(startDate);

  const trendWhereSql = `WHERE ${trendWhere.join(' AND ')}`;

  const trendStats = db.prepare(`
    SELECT 
      DATE(timestamp) as date,
      level,
      COUNT(*) as count
    FROM logs ${trendWhereSql}
    GROUP BY DATE(timestamp), level
    ORDER BY date ASC
  `).all(...trendParams);

  // 格式化趋势数据
  const trendMap = {};
  trendStats.forEach(stat => {
    if (!trendMap[stat.date]) {
      trendMap[stat.date] = {
        date: stat.date,
        debug: 0,
        info: 0,
        warn: 0,
        error: 0,
        fatal: 0,
        total: 0
      };
    }
    trendMap[stat.date][stat.level] = stat.count;
    trendMap[stat.date].total += stat.count;
  });

  // 填充缺失的日期
  const trend = [];
  for (let i = 0; i < days; i++) {
    const date = dayjs().subtract(days - 1 - i, 'day').format('YYYY-MM-DD');
    if (trendMap[date]) {
      trend.push(trendMap[date]);
    } else {
      trend.push({
        date,
        debug: 0,
        info: 0,
        warn: 0,
        error: 0,
        fatal: 0,
        total: 0
      });
    }
  }

  return {
    level_counts: levelCounts,
    trend
  };
}

module.exports = {
  createLog,
  createLogsBatch,
  getLogById,
  queryLogs,
  getExceptionAggregate,
  getExceptionSamples,
  exportLogsToCSV,
  exportExceptionsToCSV,
  getLogSummary,
  generateExceptionHash
};
