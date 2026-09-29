const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { authenticate, requireRole } = require('./auth');

// Get all system settings
router.get('/', authenticate, async (req, res) => {
  try {
    const settingsRows = await db.query(`SELECT * FROM settings`);
    const settings = {};
    settingsRows.forEach(r => {
      settings[r.key_name] = r.value_data;
    });

    const accounts = await db.query(`SELECT * FROM financial_accounts WHERE is_active = 1`);
    const paymentMethods = await db.query(`SELECT * FROM payment_methods WHERE is_active = 1`);
    const categories = await db.query(`SELECT * FROM expense_categories WHERE is_active = 1`);

    res.json({
      settings,
      accounts,
      paymentMethods,
      categories,
      currentDbEngine: db.getCurrentEngine()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update settings
router.post('/', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'بيانات الإعدادات غير صحيحة' });
    }

    for (const [key, val] of Object.entries(settings)) {
      await db.execute(`
        INSERT INTO settings (key_name, value_data, updated_at)
        VALUES (?, ?, datetime('now', 'localtime'))
        ON CONFLICT(key_name) DO UPDATE SET value_data = excluded.value_data, updated_at = datetime('now', 'localtime')
      `, [key, String(val)]);
    }

    await db.execute(`
      INSERT INTO audit_logs (user_id, username, action_type, entity_name, details, created_at)
      VALUES (?, ?, 'UPDATE', 'settings', 'تحديث إعدادات النظام', datetime('now', 'localtime'))
    `, [req.user.id, req.user.username]);

    res.json({ success: true, message: 'تم حفظ الإعدادات بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test MariaDB Connection
router.post('/test-connection', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { host, port, user, password, database } = req.body;
    const result = await db.testMariaDbConnection({
      host: host || 'localhost',
      port: parseInt(port || '3306', 10),
      user: user || 'root',
      password: password || '',
      database: database || 'ng_financial'
    });

    if (result.success) {
      res.json({
        success: true,
        message: `تم الاتصال بنجاح بخادم MariaDB (الإصدار: ${result.version}) في قاعدة البيانات ${result.database}`
      });
    } else {
      res.status(400).json({
        success: false,
        error: `فشل الاتصال بخادم MariaDB: ${result.error}`
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add Expense Category
router.post('/categories', authenticate, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'اسم التصنيف مطلوب' });
    }

    const result = await db.execute(`
      INSERT INTO expense_categories (name, is_system, is_active, created_at)
      VALUES (?, 0, 1, datetime('now', 'localtime'))
    `, [name.trim()]);

    res.json({ success: true, categoryId: result.insertId, message: 'تمت إضافة التصنيف بنجاح' });
  } catch (err) {
    res.status(400).json({ error: err.message.includes('UNIQUE') ? 'هذا التصنيف موجود بالفعل' : err.message });
  }
});

module.exports = router;
