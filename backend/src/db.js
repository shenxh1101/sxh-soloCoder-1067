const Database = require('better-sqlite3');
const path = require('path');
const dayjs = require('dayjs');

// 数据库文件路径
const dbPath = path.join(__dirname, '..', 'data', 'logs.db');

// 创建数据库连接
const db = new Database(dbPath, { verbose: console.log });

// 启用外键约束
db.pragma('foreign_keys = ON');

// 初始化数据库表
function initDatabase() {
  // 应用表
  db.exec(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      api_key TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active'
    )
  `);

  // 尝试为已存在的表添加 status 字段（如果不存在）
  try {
    db.exec(`
      ALTER TABLE applications ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
    `);
    console.log('已为 applications 表添加 status 字段');
  } catch (err) {
    // 如果字段已存在，忽略错误
    if (!err.message.includes('duplicate column name')) {
      console.log('检查 applications 表 status 字段:', err.message);
    }
  }

  // 日志表
  db.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id INTEGER NOT NULL,
      level TEXT NOT NULL CHECK(level IN ('debug', 'info', 'warn', 'error', 'fatal')),
      message TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      source TEXT,
      stack_trace TEXT,
      metadata TEXT,
      exception_type TEXT,
      exception_hash TEXT,
      FOREIGN KEY (app_id) REFERENCES applications(id) ON DELETE CASCADE
    )
  `);

  // 创建日志索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_logs_app_id ON logs(app_id);
    CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
    CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_logs_exception_hash ON logs(exception_hash);
  `);

  // 告警规则表
  db.exec(`
    CREATE TABLE IF NOT EXISTS alert_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      condition_type TEXT NOT NULL CHECK(condition_type IN ('error_count', 'keyword', 'level')),
      condition_value TEXT NOT NULL,
      level_threshold TEXT CHECK(level_threshold IN ('debug', 'info', 'warn', 'error', 'fatal')),
      notify_type TEXT NOT NULL,
      notify_target TEXT,
      webhook_url TEXT,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (app_id) REFERENCES applications(id) ON DELETE CASCADE
    )
  `);

  // 尝试为已存在的 alert_rules 表添加 notify_target 字段（如果不存在）
  try {
    db.exec(`
      ALTER TABLE alert_rules ADD COLUMN notify_target TEXT
    `);
    console.log('已为 alert_rules 表添加 notify_target 字段');
  } catch (err) {
    if (!err.message.includes('duplicate column name')) {
      console.log('检查 alert_rules 表 notify_target 字段:', err.message);
    }
  }

  // 告警记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS alert_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_id INTEGER NOT NULL,
      app_id INTEGER NOT NULL,
      triggered_at TEXT NOT NULL,
      log_count INTEGER NOT NULL DEFAULT 0,
      message TEXT NOT NULL,
      resolved INTEGER NOT NULL DEFAULT 0,
      resolved_at TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'ignored', 'resolved')),
      assignee TEXT,
      handle_note TEXT,
      handled_at TEXT,
      FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE,
      FOREIGN KEY (app_id) REFERENCES applications(id) ON DELETE CASCADE
    )
  `);

  // 为 alert_records 表添加 status 字段
  try {
    db.exec(`
      ALTER TABLE alert_records ADD COLUMN status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'ignored', 'resolved'))
    `);
    console.log('已为 alert_records 表添加 status 字段');
  } catch (err) {
    if (!err.message.includes('duplicate column name')) {
      console.log('检查 alert_records 表 status 字段:', err.message);
    }
  }

  // 为 alert_records 表添加 assignee 字段
  try {
    db.exec(`
      ALTER TABLE alert_records ADD COLUMN assignee TEXT
    `);
    console.log('已为 alert_records 表添加 assignee 字段');
  } catch (err) {
    if (!err.message.includes('duplicate column name')) {
      console.log('检查 alert_records 表 assignee 字段:', err.message);
    }
  }

  // 为 alert_records 表添加 handle_note 字段
  try {
    db.exec(`
      ALTER TABLE alert_records ADD COLUMN handle_note TEXT
    `);
    console.log('已为 alert_records 表添加 handle_note 字段');
  } catch (err) {
    if (!err.message.includes('duplicate column name')) {
      console.log('检查 alert_records 表 handle_note 字段:', err.message);
    }
  }

  // 为 alert_records 表添加 handled_at 字段
  try {
    db.exec(`
      ALTER TABLE alert_records ADD COLUMN handled_at TEXT
    `);
    console.log('已为 alert_records 表添加 handled_at 字段');
  } catch (err) {
    if (!err.message.includes('duplicate column name')) {
      console.log('检查 alert_records 表 handled_at 字段:', err.message);
    }
  }

  // 数据迁移：将 resolved 字段值映射到 status 字段
  try {
    const updateStmt = db.prepare(`
      UPDATE alert_records 
      SET status = CASE 
        WHEN resolved = 1 THEN 'resolved'
        WHEN status = 'pending' THEN 'pending'
        ELSE status
      END,
      handled_at = CASE
        WHEN resolved = 1 AND handled_at IS NULL THEN resolved_at
        ELSE handled_at
      END
      WHERE status IS NULL OR (resolved = 1 AND status != 'resolved')
    `);
    const result = updateStmt.run();
    if (result.changes > 0) {
      console.log(`已迁移 ${result.changes} 条 alert_records 数据的 resolved 状态到 status 字段`);
    }
  } catch (err) {
    console.log('数据迁移 alert_records resolved 到 status 失败:', err.message);
  }

  // 创建告警记录索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_alert_records_rule_id ON alert_records(rule_id);
    CREATE INDEX IF NOT EXISTS idx_alert_records_triggered_at ON alert_records(triggered_at);
    CREATE INDEX IF NOT EXISTS idx_alert_records_status ON alert_records(status);
    CREATE INDEX IF NOT EXISTS idx_alert_records_assignee ON alert_records(assignee);
  `);

  // 清理策略表
  db.exec(`
    CREATE TABLE IF NOT EXISTS cleanup_policies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id INTEGER NOT NULL UNIQUE,
      retention_days INTEGER NOT NULL DEFAULT 30,
      max_logs INTEGER NOT NULL DEFAULT 100000,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      last_run_at TEXT,
      FOREIGN KEY (app_id) REFERENCES applications(id) ON DELETE CASCADE
    )
  `);

  // 排障备注表
  db.exec(`
    CREATE TABLE IF NOT EXISTS troubleshooting_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id INTEGER NOT NULL,
      log_id INTEGER,
      exception_hash TEXT,
      trace_id TEXT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      assignee TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (app_id) REFERENCES applications(id) ON DELETE CASCADE
    )
  `);

  // 创建排障备注索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_troubleshooting_app_id ON troubleshooting_notes(app_id);
    CREATE INDEX IF NOT EXISTS idx_troubleshooting_trace_id ON troubleshooting_notes(trace_id);
    CREATE INDEX IF NOT EXISTS idx_troubleshooting_exception_hash ON troubleshooting_notes(exception_hash);
  `);

  console.log('数据库初始化完成');
}

// 辅助函数：获取当前时间
function getCurrentTime() {
  return dayjs().format('YYYY-MM-DD HH:mm:ss');
}

module.exports = {
  db,
  initDatabase,
  getCurrentTime
};
