const { db, getCurrentTime } = require('../db');
const dayjs = require('dayjs');

function getTraceLogs(traceId, appId = null) {
  let sql = `
    SELECT * FROM logs 
    WHERE metadata LIKE ?
  `;
  let params = [`%"traceId"%`];

  if (appId) {
    sql += ' AND app_id = ?';
    params.push(appId);
  }

  sql += ' ORDER BY timestamp DESC LIMIT 500';

  const logs = db.prepare(sql).all(...params);

  const result = [];
  for (const log of logs) {
    if (log.metadata) {
      try {
        const parsedMetadata = JSON.parse(log.metadata);
        if (parsedMetadata.traceId === traceId) {
          log.metadata = parsedMetadata;
          log.traceId = parsedMetadata.traceId;
          result.push(log);
        }
      } catch (e) {
        // 解析失败跳过
      }
    }
  }

  return result.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function getAppErrorTrend(appId, hours = 24) {
  const startTime = dayjs().subtract(hours, 'hour').format('YYYY-MM-DD HH:mm:ss');

  const sql = `
    SELECT 
      strftime('%Y-%m-%d %H:00:00', timestamp) as time,
      SUM(CASE WHEN level = 'error' THEN 1 ELSE 0 END) as error_count,
      SUM(CASE WHEN level = 'fatal' THEN 1 ELSE 0 END) as fatal_count,
      COUNT(*) as total
    FROM logs
    WHERE app_id = ? 
      AND timestamp >= ?
      AND level IN ('error', 'fatal')
    GROUP BY strftime('%Y-%m-%d %H:00:00', timestamp)
    ORDER BY time ASC
  `;

  const rawData = db.prepare(sql).all(appId, startTime);

  const trendMap = {};
  rawData.forEach(item => {
    trendMap[item.time] = {
      time: item.time,
      error_count: item.error_count,
      fatal_count: item.fatal_count,
      total: item.total
    };
  });

  const result = [];
  for (let i = hours - 1; i >= 0; i--) {
    const hourTime = dayjs().subtract(i, 'hour').format('YYYY-MM-DD HH:00:00');
    if (trendMap[hourTime]) {
      result.push(trendMap[hourTime]);
    } else {
      result.push({
        time: hourTime,
        error_count: 0,
        fatal_count: 0,
        total: 0
      });
    }
  }

  return result;
}

function getRelatedAlerts(appId, logId = null, exceptionHash = null, traceId = null, limit = 10) {
  let sql = `
    SELECT ar.*, a.name as app_name, alr.name as rule_name
    FROM alert_records ar
    LEFT JOIN applications a ON ar.app_id = a.id
    LEFT JOIN alert_rules alr ON ar.rule_id = alr.id
    WHERE ar.app_id = ?
  `;
  let params = [appId];

  if (logId) {
    sql += ' AND ar.message LIKE ?';
    params.push(`%日志ID: ${logId}%`);
  }

  if (exceptionHash) {
    sql += ' AND ar.message LIKE ?';
    params.push(`%${exceptionHash}%`);
  }

  if (traceId) {
    sql += ' AND ar.message LIKE ?';
    params.push(`%${traceId}%`);
  }

  sql += ' ORDER BY ar.triggered_at DESC LIMIT ?';
  params.push(limit);

  return db.prepare(sql).all(...params);
}

function createTroubleshootingNote(data) {
  const {
    app_id,
    log_id,
    exception_hash,
    trace_id,
    title,
    content,
    assignee,
    metadata
  } = data;

  if (!app_id) {
    throw new Error('app_id 为必填字段');
  }
  if (!title || !title.trim()) {
    throw new Error('title 为必填字段');
  }
  if (!content || !content.trim()) {
    throw new Error('content 为必填字段');
  }

  const app = db.prepare('SELECT id FROM applications WHERE id = ?').get(app_id);
  if (!app) {
    throw new Error('应用不存在');
  }

  const createdAt = getCurrentTime();
  const updatedAt = createdAt;

  const stmt = db.prepare(`
    INSERT INTO troubleshooting_notes (
      app_id, log_id, exception_hash, trace_id, title, content,
      assignee, metadata, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    app_id,
    log_id || null,
    exception_hash || null,
    trace_id || null,
    title.trim(),
    content.trim(),
    assignee || null,
    metadata ? JSON.stringify(metadata) : null,
    createdAt,
    updatedAt
  );

  return getTroubleshootingNoteById(result.lastInsertRowid);
}

function getTroubleshootingNotes(filters = {}) {
  const {
    app_id,
    log_id,
    exception_hash,
    trace_id,
    status,
    assignee,
    page = 1,
    page_size = 20
  } = filters;

  let sql = `
    SELECT tn.*, a.name as app_name
    FROM troubleshooting_notes tn
    LEFT JOIN applications a ON tn.app_id = a.id
  `;
  let params = [];
  let whereClause = [];

  if (app_id) {
    whereClause.push('tn.app_id = ?');
    params.push(app_id);
  }

  if (log_id) {
    whereClause.push('tn.log_id = ?');
    params.push(log_id);
  }

  if (exception_hash) {
    whereClause.push('tn.exception_hash = ?');
    params.push(exception_hash);
  }

  if (trace_id) {
    whereClause.push('tn.trace_id = ?');
    params.push(trace_id);
  }

  if (status) {
    whereClause.push('tn.status = ?');
    params.push(status);
  }

  if (assignee) {
    whereClause.push('tn.assignee = ?');
    params.push(assignee);
  }

  if (whereClause.length > 0) {
    sql += ' WHERE ' + whereClause.join(' AND ');
  }

  const countSql = sql.replace('SELECT tn.*, a.name as app_name', 'SELECT COUNT(*) as total');
  const { total } = db.prepare(countSql).get(...params);

  sql += ' ORDER BY tn.created_at DESC LIMIT ? OFFSET ?';
  const offset = (page - 1) * page_size;

  const notes = db.prepare(sql).all(...params, page_size, offset);

  notes.forEach(note => {
    if (note.metadata) {
      try {
        note.metadata = JSON.parse(note.metadata);
      } catch (e) {
        // 解析失败保持原样
      }
    }
  });

  return {
    list: notes,
    total,
    page: parseInt(page),
    page_size: parseInt(page_size),
    total_pages: Math.ceil(total / page_size)
  };
}

function getTroubleshootingNoteById(id) {
  const note = db.prepare(`
    SELECT tn.*, a.name as app_name
    FROM troubleshooting_notes tn
    LEFT JOIN applications a ON tn.app_id = a.id
    WHERE tn.id = ?
  `).get(id);

  if (note && note.metadata) {
    try {
      note.metadata = JSON.parse(note.metadata);
    } catch (e) {
      // 解析失败保持原样
    }
  }

  return note;
}

function updateTroubleshootingNote(id, data) {
  const existingNote = getTroubleshootingNoteById(id);
  if (!existingNote) {
    throw new Error('排障记录不存在');
  }

  const {
    title,
    content,
    assignee,
    status,
    metadata
  } = data;

  const updatedAt = getCurrentTime();

  const stmt = db.prepare(`
    UPDATE troubleshooting_notes
    SET title = COALESCE(?, title),
        content = COALESCE(?, content),
        assignee = COALESCE(?, assignee),
        status = COALESCE(?, status),
        metadata = COALESCE(?, metadata),
        updated_at = ?
    WHERE id = ?
  `);

  stmt.run(
    title ? title.trim() : existingNote.title,
    content ? content.trim() : existingNote.content,
    assignee !== undefined ? (assignee || null) : existingNote.assignee,
    status || existingNote.status,
    metadata !== undefined ? (metadata ? JSON.stringify(metadata) : null) : existingNote.metadata,
    updatedAt,
    id
  );

  return getTroubleshootingNoteById(id);
}

function deleteTroubleshootingNote(id) {
  const existingNote = getTroubleshootingNoteById(id);
  if (!existingNote) {
    throw new Error('排障记录不存在');
  }

  db.prepare('DELETE FROM troubleshooting_notes WHERE id = ?').run(id);

  return { success: true, message: '排障记录已删除' };
}

module.exports = {
  getTraceLogs,
  getAppErrorTrend,
  getRelatedAlerts,
  createTroubleshootingNote,
  getTroubleshootingNotes,
  getTroubleshootingNoteById,
  updateTroubleshootingNote,
  deleteTroubleshootingNote
};
