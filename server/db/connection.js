const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');
const Database = require('better-sqlite3');

let mariaPool = null;
let sqliteDb = null;
let currentEngine = 'sqlite'; // 'mariadb' or 'sqlite'

const DB_CONFIG_FILE = path.join(__dirname, '../../data/db_config.json');
const SQLITE_FILE = path.join(__dirname, '../../data/ng_financial.db');

function ensureDataDir() {
  const dir = path.join(__dirname, '../../data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadConfig() {
  ensureDataDir();
  if (fs.existsSync(DB_CONFIG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DB_CONFIG_FILE, 'utf8'));
    } catch (e) {
      console.error('Error reading db_config.json', e);
    }
  }
  return {
    engine: 'auto',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ng_financial'
  };
}

function saveConfig(config) {
  ensureDataDir();
  fs.writeFileSync(DB_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

// Convert MySQL SQL dialect quirks to SQLite if needed
function translateSqlForSqlite(sql) {
  let translated = sql
    .replace(/ENGINE\s*=\s*InnoDB/gi, '')
    .replace(/DEFAULT\s+CHARSET\s*=\s*utf8mb4/gi, '')
    .replace(/COLLATE\s*=\s*utf8mb4_unicode_ci/gi, '')
    .replace(/COLLATE\s+utf8mb4_unicode_ci/gi, '')
    .replace(/INT\s+AUTO_INCREMENT\s+PRIMARY\s+KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
    .replace(/INT\s+NOT\s+NULL\s+AUTO_INCREMENT\s+PRIMARY\s+KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
    .replace(/DATETIME\s+ON\s+UPDATE\s+CURRENT_TIMESTAMP/gi, 'DATETIME')
    .replace(/CURRENT_TIMESTAMP\s+ON\s+UPDATE\s+CURRENT_TIMESTAMP/gi, 'CURRENT_TIMESTAMP')
    .replace(/ON\s+DUPLICATE\s+KEY\s+UPDATE/gi, 'ON CONFLICT DO UPDATE SET');
  return translated;
}

function initSqlite() {
  ensureDataDir();
  sqliteDb = new Database(SQLITE_FILE);
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('foreign_keys = ON');

  // Create SQLite tables if not present
  const schemaSql = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS financial_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name_ar TEXT NOT NULL,
      name_en TEXT NOT NULL,
      account_type TEXT NOT NULL DEFAULT 'CASH',
      balance REAL NOT NULL DEFAULT 0.00,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS payment_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name_ar TEXT NOT NULL,
      name_en TEXT NOT NULL,
      default_account_id INTEGER NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (default_account_id) REFERENCES financial_accounts(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS expense_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      is_system INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      default_price REAL NOT NULL DEFAULT 0.00,
      age_group TEXT NULL,
      duration TEXT NULL,
      description TEXT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS teachers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      phone TEXT NULL,
      email TEXT NULL,
      specialty TEXT NULL,
      notes TEXT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS cohorts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      teacher_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      start_date TEXT NULL,
      end_date TEXT NULL,
      max_students INTEGER NOT NULL DEFAULT 20,
      compensation_type TEXT NOT NULL DEFAULT 'PERCENTAGE',
      compensation_value REAL NOT NULL DEFAULT 60.00,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      phone TEXT NULL,
      guardian_phone TEXT NULL,
      email TEXT NULL,
      notes TEXT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      cohort_id INTEGER NOT NULL,
      agreed_price REAL NOT NULL DEFAULT 0.00,
      discount_amount REAL NOT NULL DEFAULT 0.00,
      net_price REAL NOT NULL DEFAULT 0.00,
      paid_amount REAL NOT NULL DEFAULT 0.00,
      remaining_amount REAL NOT NULL DEFAULT 0.00,
      payment_status TEXT NOT NULL DEFAULT 'UNPAID',
      enrollment_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'enrolled',
      notes TEXT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
      FOREIGN KEY (cohort_id) REFERENCES cohorts(id) ON DELETE RESTRICT,
      UNIQUE(student_id, cohort_id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_code TEXT NOT NULL UNIQUE,
      enrollment_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      cohort_id INTEGER NOT NULL,
      financial_account_id INTEGER NOT NULL,
      payment_method_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_date TEXT NOT NULL,
      reference_no TEXT NULL,
      notes TEXT NULL,
      status TEXT NOT NULL DEFAULT 'completed',
      void_reason TEXT NULL,
      voided_at TEXT NULL,
      voided_by INTEGER NULL,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE RESTRICT,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
      FOREIGN KEY (cohort_id) REFERENCES cohorts(id) ON DELETE RESTRICT,
      FOREIGN KEY (financial_account_id) REFERENCES financial_accounts(id) ON DELETE RESTRICT,
      FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE RESTRICT,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_code TEXT NOT NULL UNIQUE,
      category_id INTEGER NOT NULL,
      financial_account_id INTEGER NOT NULL,
      payment_method_id INTEGER NOT NULL,
      cohort_id INTEGER NULL,
      teacher_id INTEGER NULL,
      amount REAL NOT NULL,
      expense_date TEXT NOT NULL,
      description TEXT NOT NULL,
      reference_no TEXT NULL,
      notes TEXT NULL,
      status TEXT NOT NULL DEFAULT 'completed',
      void_reason TEXT NULL,
      voided_at TEXT NULL,
      voided_by INTEGER NULL,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE RESTRICT,
      FOREIGN KEY (financial_account_id) REFERENCES financial_accounts(id) ON DELETE RESTRICT,
      FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE RESTRICT,
      FOREIGN KEY (cohort_id) REFERENCES cohorts(id) ON DELETE SET NULL,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS owner_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_code TEXT NOT NULL UNIQUE,
      transaction_type TEXT NOT NULL,
      financial_account_id INTEGER NOT NULL,
      payment_method_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      transaction_date TEXT NOT NULL,
      reference_no TEXT NULL,
      notes TEXT NULL,
      status TEXT NOT NULL DEFAULT 'completed',
      void_reason TEXT NULL,
      voided_at TEXT NULL,
      voided_by INTEGER NULL,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (financial_account_id) REFERENCES financial_accounts(id) ON DELETE RESTRICT,
      FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE RESTRICT,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS financial_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_code TEXT NOT NULL UNIQUE,
      entry_date TEXT NOT NULL,
      ledger_category TEXT NOT NULL,
      source_table TEXT NOT NULL,
      source_id INTEGER NOT NULL,
      financial_account_id INTEGER NOT NULL,
      debit_amount REAL NOT NULL DEFAULT 0.00,
      credit_amount REAL NOT NULL DEFAULT 0.00,
      cohort_id INTEGER NULL,
      teacher_id INTEGER NULL,
      student_id INTEGER NULL,
      is_operating_revenue INTEGER NOT NULL DEFAULT 0,
      is_operating_expense INTEGER NOT NULL DEFAULT 0,
      is_owner_equity INTEGER NOT NULL DEFAULT 0,
      is_voided INTEGER NOT NULL DEFAULT 0,
      reversal_entry_id INTEGER NULL,
      description TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (financial_account_id) REFERENCES financial_accounts(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS teacher_compensations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cohort_id INTEGER NOT NULL,
      teacher_id INTEGER NOT NULL,
      payment_id INTEGER NULL,
      expense_id INTEGER NULL,
      entry_type TEXT NOT NULL,
      amount REAL NOT NULL,
      calculation_basis TEXT NOT NULL,
      entry_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (cohort_id) REFERENCES cohorts(id) ON DELETE RESTRICT,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE RESTRICT,
      FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL,
      FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NULL,
      username TEXT NOT NULL,
      action_type TEXT NOT NULL,
      entity_name TEXT NOT NULL,
      entity_id INTEGER NULL,
      old_values TEXT NULL,
      new_values TEXT NULL,
      details TEXT NULL,
      ip_address TEXT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key_name TEXT PRIMARY KEY,
      value_data TEXT NOT NULL,
      description TEXT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `;
  sqliteDb.exec(schemaSql);
  seedSqliteDefaults();
}

function seedSqliteDefaults() {
  const userCount = sqliteDb.prepare('SELECT count(*) as count FROM users').get().count;
  if (userCount === 0) {
    const adminHash = '$2b$10$j914DCkfbxNPVuBG1CgOgu2ZlzfYf4TrTndTSrwmwJ/5bz28Nb1Ha'; // admin123
    sqliteDb.prepare(`
      INSERT INTO users (id, username, password_hash, full_name, role, is_active)
      VALUES (1, 'admin', ?, 'مدير النظام - NG Academy', 'admin', 1)
    `).run(adminHash);
  }

  const accountCount = sqliteDb.prepare('SELECT count(*) as count FROM financial_accounts').get().count;
  if (accountCount === 0) {
    const insertAccount = sqliteDb.prepare(`
      INSERT INTO financial_accounts (id, code, name_ar, name_en, account_type, balance, is_active)
      VALUES (?, ?, ?, ?, ?, 0.0, 1)
    `);
    insertAccount.run(1, 'CASH_SAFE', 'الخزينة النقدية (الصندوق الرئيسي)', 'Main Cash Safe', 'CASH');
    insertAccount.run(2, 'CCP_ACCOUNT', 'حساب البريد الجاري (CCP)', 'Post Office CCP Account', 'CCP');
    insertAccount.run(3, 'BANK_ACCOUNT', 'الحساب البنكي', 'Bank Account', 'BANK');
    insertAccount.run(4, 'DIGITAL_WALLET', 'المحفظة الإلكترونية', 'Digital Wallet / BaridiMob', 'DIGITAL');
  }

  const methodCount = sqliteDb.prepare('SELECT count(*) as count FROM payment_methods').get().count;
  if (methodCount === 0) {
    const insertMethod = sqliteDb.prepare(`
      INSERT INTO payment_methods (id, code, name_ar, name_en, default_account_id, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `);
    insertMethod.run(1, 'CASH', 'نقدًا', 'Cash', 1);
    insertMethod.run(2, 'CCP', 'CCP', 'CCP', 2);
    insertMethod.run(3, 'BANK_TRANSFER', 'تحويل بنكي', 'Bank Transfer', 3);
    insertMethod.run(4, 'ELECTRONIC_TRANSFER', 'تحويل إلكتروني', 'Electronic Transfer', 4);
    insertMethod.run(5, 'OTHER', 'أخرى', 'Other', 1);
  }

  const catCount = sqliteDb.prepare('SELECT count(*) as count FROM expense_categories').get().count;
  if (catCount === 0) {
    const insertCat = sqliteDb.prepare('INSERT INTO expense_categories (id, name, is_system, is_active) VALUES (?, ?, ?, 1)');
    insertCat.run(1, 'أجور الأساتذة', 1);
    insertCat.run(2, 'الإعلانات', 1);
    insertCat.run(3, 'المنصات والخدمات', 1);
    insertCat.run(4, 'البرامج والاشتراكات', 1);
    insertCat.run(5, 'المعدات', 1);
    insertCat.run(6, 'المصاريف الإدارية', 1);
    insertCat.run(7, 'التسويق', 1);
    insertCat.run(8, 'أخرى', 1);
  }

  const settingCount = sqliteDb.prepare('SELECT count(*) as count FROM settings').get().count;
  if (settingCount === 0) {
    const insertSetting = sqliteDb.prepare('INSERT INTO settings (key_name, value_data, description) VALUES (?, ?, ?)');
    insertSetting.run('currency_code', 'DZD', 'رمز العملة الرسمية للنظام');
    insertSetting.run('academy_name', 'NG Academy', 'اسم الأكاديمية');
    insertSetting.run('allow_overpayment', 'false', 'السماح بالدفع الزائد');
    insertSetting.run('mariadb_host', 'localhost', 'عنوان خادم MariaDB المحلي');
    insertSetting.run('mariadb_port', '3306', 'منفذ خادم MariaDB المحلي');
    insertSetting.run('mariadb_database', 'ng_financial', 'اسم قاعدة البيانات');
    insertSetting.run('mariadb_user', 'root', 'اسم مستخدم قاعدة البيانات');
    insertSetting.run('theme_color', '#38B6FF', 'اللون الأساسي للنظام');
  }
}

async function tryConnectMariaDb(config) {
  try {
    const pool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      decimalNumbers: true
    });
    // Test connection
    const conn = await pool.getConnection();
    conn.release();
    mariaPool = pool;
    currentEngine = 'mariadb';
    console.log(`[Database] Successfully connected to MariaDB 10.11.7 at ${config.host}:${config.port}/${config.database}`);
    return true;
  } catch (err) {
    console.warn(`[Database] MariaDB connection failed (${err.message}). Using embedded SQLite database.`);
    return false;
  }
}

async function initDb() {
  const config = loadConfig();
  let connected = false;
  if (config.engine === 'mariadb' || config.engine === 'auto') {
    connected = await tryConnectMariaDb(config);
  }

  if (!connected) {
    currentEngine = 'sqlite';
    initSqlite();
    console.log(`[Database] Embedded SQLite engine initialized at ${SQLITE_FILE}`);
  }
  return currentEngine;
}

async function testMariaDbConnection(config) {
  try {
    const connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      connectTimeout: 4000
    });
    const [rows] = await connection.execute('SELECT VERSION() as version, DATABASE() as db');
    await connection.end();
    return { success: true, version: rows[0].version, database: rows[0].db };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function query(sql, params = []) {
  if (currentEngine === 'mariadb' && mariaPool) {
    const [rows] = await mariaPool.query(sql, params);
    return rows;
  } else {
    // SQLite
    const stmt = sqliteDb.prepare(sql);
    if (sql.trim().toUpperCase().startsWith('SELECT') || sql.trim().toUpperCase().startsWith('PRAGMA')) {
      return stmt.all(params);
    } else {
      const info = stmt.run(params);
      return { insertId: info.lastInsertRowid, affectedRows: info.changes };
    }
  }
}

async function getOne(sql, params = []) {
  if (currentEngine === 'mariadb' && mariaPool) {
    const [rows] = await mariaPool.query(sql, params);
    return rows[0] || null;
  } else {
    const stmt = sqliteDb.prepare(sql);
    return stmt.get(params) || null;
  }
}

async function execute(sql, params = []) {
  return query(sql, params);
}

// Transaction wrapper
async function transaction(callback) {
  if (currentEngine === 'mariadb' && mariaPool) {
    const connection = await mariaPool.getConnection();
    await connection.beginTransaction();
    try {
      const helper = {
        query: async (sql, params = []) => {
          const [rows] = await connection.query(sql, params);
          return rows;
        },
        getOne: async (sql, params = []) => {
          const [rows] = await connection.query(sql, params);
          return rows[0] || null;
        },
        execute: async (sql, params = []) => {
          const [rows] = await connection.execute(sql, params);
          return rows;
        }
      };
      const result = await callback(helper);
      await connection.commit();
      return result;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } else {
    // SQLite manual transaction for async support
    sqliteDb.exec('BEGIN IMMEDIATE');
    try {
      const helper = {
        query: async (sql, params = []) => {
          const stmt = sqliteDb.prepare(sql);
          if (sql.trim().toUpperCase().startsWith('SELECT') || sql.trim().toUpperCase().startsWith('PRAGMA')) {
            return stmt.all(params);
          } else {
            const info = stmt.run(params);
            return { insertId: info.lastInsertRowid, affectedRows: info.changes };
          }
        },
        getOne: async (sql, params = []) => {
          const stmt = sqliteDb.prepare(sql);
          return stmt.get(params) || null;
        },
        execute: async (sql, params = []) => {
          const stmt = sqliteDb.prepare(sql);
          const info = stmt.run(params);
          return { insertId: info.lastInsertRowid, affectedRows: info.changes };
        }
      };
      const result = await callback(helper);
      sqliteDb.exec('COMMIT');
      return result;
    } catch (err) {
      try { sqliteDb.exec('ROLLBACK'); } catch (_) {}
      throw err;
    }
  }
}

module.exports = {
  initDb,
  query,
  getOne,
  execute,
  transaction,
  getCurrentEngine: () => currentEngine,
  testMariaDbConnection,
  saveConfig,
  loadConfig,
  getSqliteDb: () => sqliteDb,
  getMariaPool: () => mariaPool
};
