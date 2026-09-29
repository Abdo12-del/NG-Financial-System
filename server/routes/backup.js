const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { authenticate, requireRole } = require('./auth');

// Create full backup snapshot
router.get('/export', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const tables = [
      'settings', 'users', 'financial_accounts', 'payment_methods', 'expense_categories',
      'courses', 'teachers', 'cohorts', 'students', 'enrollments',
      'payments', 'expenses', 'owner_transactions', 'financial_ledger',
      'teacher_compensations', 'audit_logs'
    ];

    const backupData = {
      system: 'NG Financial System',
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      exported_by: req.user.username,
      data: {}
    };

    for (const tbl of tables) {
      backupData.data[tbl] = await db.query(`SELECT * FROM ${tbl}`);
    }

    await db.execute(`
      INSERT INTO audit_logs (user_id, username, action_type, entity_name, details, created_at)
      VALUES (?, ?, 'BACKUP', 'system', 'تصدير نسخة احتياطية كاملة من قاعدة البيانات', datetime('now', 'localtime'))
    `, [req.user.id, req.user.username]);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=ng_financial_backup_${Date.now()}.json`);
    res.send(JSON.stringify(backupData, null, 2));
  } catch (err) {
    console.error('Backup export error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Restore backup from uploaded payload
router.post('/restore', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const backup = req.body;
    if (!backup || !backup.data || backup.system !== 'NG Financial System') {
      return res.status(400).json({ error: 'ملف النسخة الاحتياطية غير صالح أو تالف' });
    }

    await db.transaction(async (tx) => {
      // Disable foreign keys temporarily for restore if SQLite
      const tables = [
        'audit_logs', 'teacher_compensations', 'financial_ledger',
        'owner_transactions', 'expenses', 'payments', 'enrollments',
        'students', 'cohorts', 'teachers', 'courses',
        'expense_categories', 'payment_methods', 'financial_accounts'
      ];

      for (const tbl of tables) {
        await tx.execute(`DELETE FROM ${tbl}`);
      }

      for (const [tbl, rows] of Object.entries(backup.data)) {
        if (!Array.isArray(rows) || rows.length === 0) continue;
        for (const row of rows) {
          const keys = Object.keys(row);
          const placeholders = keys.map(() => '?').join(', ');
          const values = Object.values(row);
          const sql = `INSERT OR REPLACE INTO ${tbl} (${keys.join(', ')}) VALUES (${placeholders})`;
          await tx.execute(sql, values);
        }
      }

      await tx.execute(`
        INSERT INTO audit_logs (user_id, username, action_type, entity_name, details, created_at)
        VALUES (?, ?, 'RESTORE', 'system', 'استعادة قاعدة البيانات من نسخة احتياطية', datetime('now', 'localtime'))
      `, [req.user.id, req.user.username]);
    });

    res.json({ success: true, message: 'تمت استعادة قاعدة البيانات بنجاح تام' });
  } catch (err) {
    console.error('Restore error:', err);
    res.status(500).json({ error: 'فشلت عملية الاستعادة: ' + err.message });
  }
});

module.exports = router;
