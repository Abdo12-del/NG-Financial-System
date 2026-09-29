const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { authenticate, requireRole } = require('./auth');

// List Audit Logs
router.get('/', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { actionType, entityName, search, limit = 50, page = 1 } = req.query;
    let whereClauses = ['1=1'];
    let params = [];

    if (actionType) {
      whereClauses.push('action_type = ?');
      params.push(actionType);
    }
    if (entityName) {
      whereClauses.push('entity_name = ?');
      params.push(entityName);
    }
    if (search) {
      whereClauses.push('(username LIKE ? OR details LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s);
    }

    const whereStr = whereClauses.join(' AND ');
    const countRow = await db.getOne(`SELECT COUNT(*) as total FROM audit_logs WHERE ${whereStr}`, params);
    const total = countRow ? countRow.total : 0;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const logs = await db.query(`
      SELECT * FROM audit_logs
      WHERE ${whereStr}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    res.json({
      logs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
