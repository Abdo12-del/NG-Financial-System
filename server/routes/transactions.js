const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const FinancialLedger = require('../ledger/financialLedger');
const { authenticate, requireRole } = require('./auth');

// List transactions with full search & filtering
router.get('/', authenticate, async (req, res) => {
  try {
    const {
      type, // 'all', 'revenue', 'expense'
      startDate,
      endDate,
      courseId,
      cohortId,
      teacherId,
      paymentMethodId,
      categoryId,
      search,
      page = 1,
      limit = 25
    } = req.query;

    let whereClauses = ['1=1'];
    let params = [];

    if (type === 'revenue') {
      whereClauses.push('l.is_operating_revenue = 1');
    } else if (type === 'expense') {
      whereClauses.push('l.is_operating_expense = 1');
    }

    if (startDate) {
      whereClauses.push('l.entry_date >= ?');
      params.push(startDate);
    }
    if (endDate) {
      whereClauses.push('l.entry_date <= ?');
      params.push(endDate);
    }
    if (courseId) {
      whereClauses.push('c.course_id = ?');
      params.push(courseId);
    }
    if (cohortId) {
      whereClauses.push('l.cohort_id = ?');
      params.push(cohortId);
    }
    if (teacherId) {
      whereClauses.push('l.teacher_id = ?');
      params.push(teacherId);
    }
    if (search) {
      whereClauses.push('(l.description LIKE ? OR l.entry_code LIKE ? OR s.full_name LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    const whereStr = whereClauses.join(' AND ');

    // Count
    const countSql = `
      SELECT COUNT(*) as total
      FROM financial_ledger l
      LEFT JOIN cohorts c ON l.cohort_id = c.id
      LEFT JOIN students s ON l.student_id = s.id
      WHERE ${whereStr}
    `;
    const countRow = await db.getOne(countSql, params);
    const total = countRow ? countRow.total : 0;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const dataSql = `
      SELECT
        l.id as ledger_id,
        l.entry_code,
        l.entry_date,
        l.ledger_category,
        l.source_table,
        l.source_id,
        l.debit_amount,
        l.credit_amount,
        l.description,
        l.is_operating_revenue,
        l.is_operating_expense,
        l.is_owner_equity,
        l.is_voided,
        fa.name_ar as account_name,
        crs.name as course_name,
        c.name as cohort_name,
        t.full_name as teacher_name,
        s.full_name as student_name,
        u.username as creator_name
      FROM financial_ledger l
      LEFT JOIN financial_accounts fa ON l.financial_account_id = fa.id
      LEFT JOIN cohorts c ON l.cohort_id = c.id
      LEFT JOIN courses crs ON c.course_id = crs.id
      LEFT JOIN teachers t ON l.teacher_id = t.id
      LEFT JOIN students s ON l.student_id = s.id
      LEFT JOIN users u ON l.created_by = u.id
      WHERE ${whereStr}
      ORDER BY l.id DESC
      LIMIT ? OFFSET ?
    `;
    const rows = await db.query(dataSql, [...params, parseInt(limit), offset]);

    res.json({
      transactions: rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Error fetching transactions:', err);
    res.status(500).json({ error: err.message });
  }
});

// Add Revenue (Student Payment)
router.post('/revenue', authenticate, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { enrollmentId, studentId, cohortId, amount, paymentDate, paymentMethodId, referenceNo, notes } = req.body;

    let targetEnrollmentId = enrollmentId;
    if (!targetEnrollmentId && studentId && cohortId) {
      const enr = await db.getOne(`SELECT id FROM enrollments WHERE student_id = ? AND cohort_id = ?`, [studentId, cohortId]);
      if (enr) {
        targetEnrollmentId = enr.id;
      } else {
        // Auto enroll student if not already enrolled
        const cohort = await db.getOne(`SELECT c.*, crs.default_price FROM cohorts c JOIN courses crs ON c.course_id = crs.id WHERE c.id = ?`, [cohortId]);
        if (!cohort) return res.status(404).json({ error: 'الفوج المحدد غير موجود' });
        const enrollPrice = parseFloat(cohort.default_price || 0);
        const ins = await db.execute(`
          INSERT INTO enrollments (student_id, cohort_id, agreed_price, net_price, paid_amount, remaining_amount, payment_status, enrollment_date)
          VALUES (?, ?, ?, ?, 0.00, ?, 'UNPAID', date('now'))
        `, [studentId, cohortId, enrollPrice, enrollPrice, enrollPrice]);
        targetEnrollmentId = ins.insertId;
      }
    }

    if (!targetEnrollmentId) {
      return res.status(400).json({ error: 'يرجى تحديد تسجيل الطالب أو الفوج والطالب معاً' });
    }

    const result = await FinancialLedger.recordStudentPayment({
      enrollmentId: targetEnrollmentId,
      amount,
      paymentDate,
      paymentMethodId: paymentMethodId || 1,
      referenceNo,
      notes,
      userId: req.user.id,
      username: req.user.username
    });

    res.json({ success: true, message: 'تم تسجيل دفعة الإيراد بنجاح', data: result });
  } catch (err) {
    console.error('Error recording revenue:', err);
    res.status(400).json({ error: err.message });
  }
});

// Add Expense
router.post('/expense', authenticate, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { categoryId, amount, expenseDate, description, paymentMethodId, cohortId, teacherId, referenceNo, notes } = req.body;

    const result = await FinancialLedger.recordExpense({
      categoryId,
      amount,
      expenseDate,
      description,
      paymentMethodId: paymentMethodId || 1,
      cohortId,
      teacherId,
      referenceNo,
      notes,
      userId: req.user.id,
      username: req.user.username
    });

    res.json({ success: true, message: 'تم تسجيل المصروف بنجاح', data: result });
  } catch (err) {
    console.error('Error recording expense:', err);
    res.status(400).json({ error: err.message });
  }
});

// Void / Reverse Transaction
router.post('/void', authenticate, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { type, id, reason } = req.body;
    if (!type || !id || !reason) {
      return res.status(400).json({ error: 'نوع المعاملة ورقمها وسبب الإلغاء مطلوبة' });
    }

    const result = await FinancialLedger.voidTransaction({
      type,
      id,
      reason,
      userId: req.user.id,
      username: req.user.username
    });

    res.json(result);
  } catch (err) {
    console.error('Error voiding transaction:', err);
    res.status(400).json({ error: err.message });
  }
});

// Get Single Transaction Details
router.get('/:id', authenticate, async (req, res) => {
  try {
    const id = req.params.id;
    const ledger = await db.getOne(`
      SELECT
        l.*,
        fa.name_ar as account_name,
        crs.name as course_name,
        c.name as cohort_name,
        t.full_name as teacher_name,
        s.full_name as student_name,
        u.username as creator_name
      FROM financial_ledger l
      LEFT JOIN financial_accounts fa ON l.financial_account_id = fa.id
      LEFT JOIN cohorts c ON l.cohort_id = c.id
      LEFT JOIN courses crs ON c.course_id = crs.id
      LEFT JOIN teachers t ON l.teacher_id = t.id
      LEFT JOIN students s ON l.student_id = s.id
      LEFT JOIN users u ON l.created_by = u.id
      WHERE l.id = ?
    `, [id]);

    if (!ledger) return res.status(404).json({ error: 'المعاملة غير موجودة' });

    let sourceRecord = null;
    if (ledger.source_table === 'payments') {
      sourceRecord = await db.getOne(`SELECT * FROM payments WHERE id = ?`, [ledger.source_id]);
    } else if (ledger.source_table === 'expenses') {
      sourceRecord = await db.getOne(`SELECT * FROM expenses WHERE id = ?`, [ledger.source_id]);
    } else if (ledger.source_table === 'owner_transactions') {
      sourceRecord = await db.getOne(`SELECT * FROM owner_transactions WHERE id = ?`, [ledger.source_id]);
    }

    res.json({ ledger, sourceRecord });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
