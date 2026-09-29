const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const FinancialLedger = require('../ledger/financialLedger');
const { authenticate, requireRole } = require('./auth');

// List teachers with earnings summary
router.get('/', authenticate, async (req, res) => {
  try {
    const { search } = req.query;
    let whereClauses = ['t.is_active = 1'];
    let params = [];

    if (search) {
      whereClauses.push('(t.full_name LIKE ? OR t.phone LIKE ? OR t.specialty LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const teachers = await db.query(`
      SELECT
        t.*,
        COUNT(DISTINCT c.id) as cohort_count,
        COALESCE(
          (SELECT SUM(tc.amount) FROM teacher_compensations tc WHERE tc.teacher_id = t.id AND tc.entry_type = 'ACCRUAL' AND tc.status = 'active'),
          0
        ) as total_accrued,
        COALESCE(
          (SELECT SUM(tc.amount) FROM teacher_compensations tc WHERE tc.teacher_id = t.id AND tc.entry_type = 'PAYOUT' AND tc.status = 'active'),
          0
        ) as total_paid
      FROM teachers t
      LEFT JOIN cohorts c ON t.id = c.teacher_id
      WHERE ${whereClauses.join(' AND ')}
      GROUP BY t.id
      ORDER BY t.id DESC
    `, params);

    const formatted = teachers.map(t => {
      const accrued = parseFloat(t.total_accrued || 0);
      const paid = parseFloat(t.total_paid || 0);
      return {
        ...t,
        total_accrued: accrued,
        total_paid: paid,
        remaining_balance: Math.max(0, accrued - paid)
      };
    });

    res.json({ teachers: formatted });
  } catch (err) {
    console.error('Error fetching teachers:', err);
    res.status(500).json({ error: err.message });
  }
});

// Add Teacher
router.post('/', authenticate, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { fullName, phone, email, specialty, notes } = req.body;
    if (!fullName || fullName.trim() === '') {
      return res.status(400).json({ error: 'اسم الأستاذ مطلوب' });
    }

    const result = await db.execute(`
      INSERT INTO teachers (full_name, phone, email, specialty, notes, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, 1, datetime('now', 'localtime'))
    `, [fullName.trim(), phone || null, email || null, specialty || null, notes || null]);

    res.json({ success: true, teacherId: result.insertId, message: 'تمت إضافة الأستاذ بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Payout to teacher (صرف مستحقات أستاذ)
router.post('/payout', authenticate, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { teacherId, cohortId, amount, paymentMethodId, description, referenceNo, notes } = req.body;
    if (!teacherId || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'يرجى تحديد الأستاذ ومبلغ الصرف بشكل صحيح' });
    }

    const teacher = await db.getOne(`SELECT * FROM teachers WHERE id = ?`, [teacherId]);
    if (!teacher) return res.status(404).json({ error: 'الأستاذ غير موجود' });

    // Find category ID for "أجور الأساتذة"
    let cat = await db.getOne(`SELECT id FROM expense_categories WHERE name LIKE '%أجور الأساتذة%' OR name LIKE '%أجور%'`);
    const categoryId = cat ? cat.id : 1;

    const result = await FinancialLedger.recordExpense({
      categoryId,
      amount: parseFloat(amount),
      expenseDate: new Date().toISOString().slice(0, 10),
      description: description || `صرف أجر/مستحقات للأستاذ: ${teacher.full_name}`,
      paymentMethodId: paymentMethodId || 1,
      cohortId: cohortId || null,
      teacherId: teacher.id,
      referenceNo,
      notes,
      userId: req.user.id,
      username: req.user.username
    });

    res.json({ success: true, message: `تم صرف ${amount} دج للأستاذ ${teacher.full_name} بنجاح`, data: result });
  } catch (err) {
    console.error('Error paying teacher:', err);
    res.status(400).json({ error: err.message });
  }
});

// Teacher Statement (كشف استحقاقات ومدفوعات أستاذ)
router.get('/:id/statement', authenticate, async (req, res) => {
  try {
    const teacherId = req.params.id;
    const teacher = await db.getOne(`SELECT * FROM teachers WHERE id = ?`, [teacherId]);
    if (!teacher) return res.status(404).json({ error: 'الأستاذ غير موجود' });

    const entries = await db.query(`
      SELECT
        tc.*,
        c.name as cohort_name,
        crs.name as course_name
      FROM teacher_compensations tc
      LEFT JOIN cohorts c ON tc.cohort_id = c.id
      LEFT JOIN courses crs ON c.course_id = crs.id
      WHERE tc.teacher_id = ?
      ORDER BY tc.id DESC
    `, [teacherId]);

    const totalAccrued = entries.filter(e => e.entry_type === 'ACCRUAL' && e.status === 'active')
      .reduce((sum, e) => sum + parseFloat(e.amount), 0);
    const totalPaid = entries.filter(e => e.entry_type === 'PAYOUT' && e.status === 'active')
      .reduce((sum, e) => sum + parseFloat(e.amount), 0);

    res.json({
      teacher,
      summary: {
        totalAccrued,
        totalPaid,
        balanceDue: Math.max(0, totalAccrued - totalPaid)
      },
      entries
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
