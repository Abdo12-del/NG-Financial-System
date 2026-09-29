const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { authenticate, requireRole } = require('./auth');

// List all students
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, status, cohortId, paymentStatus } = req.query;

    let whereClauses = ['1=1'];
    let params = [];

    if (search) {
      whereClauses.push('(s.full_name LIKE ? OR s.phone LIKE ? OR s.email LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term);
    }
    if (status) {
      whereClauses.push('s.status = ?');
      params.push(status);
    }
    if (cohortId) {
      whereClauses.push('e.cohort_id = ?');
      params.push(cohortId);
    }
    if (paymentStatus) {
      whereClauses.push('e.payment_status = ?');
      params.push(paymentStatus);
    }

    const sql = `
      SELECT
        s.id as student_id,
        s.full_name,
        s.phone,
        s.guardian_phone,
        s.email,
        s.status as student_status,
        e.id as enrollment_id,
        e.cohort_id,
        c.name as cohort_name,
        crs.name as course_name,
        e.agreed_price,
        e.discount_amount,
        e.net_price,
        e.paid_amount,
        e.remaining_amount,
        e.payment_status,
        (SELECT MAX(payment_date) FROM payments p WHERE p.enrollment_id = e.id AND p.status = 'completed') as last_payment_date
      FROM students s
      LEFT JOIN enrollments e ON s.id = e.student_id
      LEFT JOIN cohorts c ON e.cohort_id = c.id
      LEFT JOIN courses crs ON c.course_id = crs.id
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY s.id DESC
    `;
    const students = await db.query(sql, params);
    res.json({ students });
  } catch (err) {
    console.error('Error fetching students:', err);
    res.status(500).json({ error: err.message });
  }
});

// Dedicated Outstanding Payments (المبالغ المستحقة من الطلاب)
router.get('/outstanding', authenticate, async (req, res) => {
  try {
    const { search, cohortId } = req.query;
    let whereClauses = ['e.remaining_amount > 0', "e.status != 'dropped'"];
    let params = [];

    if (search) {
      whereClauses.push('(s.full_name LIKE ? OR s.phone LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term);
    }
    if (cohortId) {
      whereClauses.push('e.cohort_id = ?');
      params.push(cohortId);
    }

    const sql = `
      SELECT
        s.id as student_id,
        s.full_name,
        s.phone,
        s.guardian_phone,
        e.id as enrollment_id,
        e.cohort_id,
        c.name as cohort_name,
        crs.name as course_name,
        e.net_price,
        e.paid_amount,
        e.remaining_amount,
        e.payment_status,
        (SELECT MAX(payment_date) FROM payments p WHERE p.enrollment_id = e.id AND p.status = 'completed') as last_payment_date
      FROM enrollments e
      JOIN students s ON e.student_id = s.id
      JOIN cohorts c ON e.cohort_id = c.id
      JOIN courses crs ON c.course_id = crs.id
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY e.remaining_amount DESC
    `;
    const outstanding = await db.query(sql, params);

    const totalRemaining = outstanding.reduce((sum, item) => sum + parseFloat(item.remaining_amount || 0), 0);
    res.json({ outstanding, totalRemaining });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add New Student (optionally enroll directly)
router.post('/', authenticate, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { fullName, phone, guardianPhone, email, notes, cohortId, agreedPrice, discountAmount } = req.body;
    if (!fullName || fullName.trim() === '') {
      return res.status(400).json({ error: 'اسم الطالب مطلوب' });
    }

    const studentRes = await db.execute(`
      INSERT INTO students (full_name, phone, guardian_phone, email, notes, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'active', datetime('now', 'localtime'))
    `, [fullName.trim(), phone || null, guardianPhone || null, email || null, notes || null]);
    const studentId = studentRes.insertId;

    let enrollmentId = null;
    if (cohortId) {
      const cohort = await db.getOne(`
        SELECT c.*, crs.default_price
        FROM cohorts c
        JOIN courses crs ON c.course_id = crs.id
        WHERE c.id = ?
      `, [cohortId]);

      if (cohort) {
        const grossPrice = agreedPrice !== undefined ? parseFloat(agreedPrice) : parseFloat(cohort.default_price);
        const discount = discountAmount !== undefined ? parseFloat(discountAmount) : 0;
        const netPrice = Math.max(0, grossPrice - discount);

        const enrollRes = await db.execute(`
          INSERT INTO enrollments (student_id, cohort_id, agreed_price, discount_amount, net_price, paid_amount, remaining_amount, payment_status, enrollment_date)
          VALUES (?, ?, ?, ?, ?, 0.00, ?, 'UNPAID', date('now'))
        `, [studentId, cohortId, grossPrice, discount, netPrice, netPrice]);
        enrollmentId = enrollRes.insertId;
      }
    }

    res.json({ success: true, studentId, enrollmentId, message: 'تمت إضافة الطالب بنجاح' });
  } catch (err) {
    console.error('Error adding student:', err);
    res.status(500).json({ error: err.message });
  }
});

// Enroll existing student in another cohort
router.post('/enroll', authenticate, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { studentId, cohortId, agreedPrice, discountAmount } = req.body;
    if (!studentId || !cohortId) {
      return res.status(400).json({ error: 'الطالب والفوج مطلوبان' });
    }

    const cohort = await db.getOne(`SELECT c.*, crs.default_price FROM cohorts c JOIN courses crs ON c.course_id = crs.id WHERE c.id = ?`, [cohortId]);
    if (!cohort) return res.status(404).json({ error: 'الفوج غير موجود' });

    const grossPrice = agreedPrice !== undefined ? parseFloat(agreedPrice) : parseFloat(cohort.default_price);
    const discount = discountAmount !== undefined ? parseFloat(discountAmount) : 0;
    const netPrice = Math.max(0, grossPrice - discount);

    const enrollRes = await db.execute(`
      INSERT INTO enrollments (student_id, cohort_id, agreed_price, discount_amount, net_price, paid_amount, remaining_amount, payment_status, enrollment_date)
      VALUES (?, ?, ?, ?, ?, 0.00, ?, 'UNPAID', date('now'))
    `, [studentId, cohortId, grossPrice, discount, netPrice, netPrice]);

    res.json({ success: true, enrollmentId: enrollRes.insertId, message: 'تم تسجيل الطالب في الفوج' });
  } catch (err) {
    res.status(400).json({ error: err.message.includes('UNIQUE') ? 'الطالب مسجل بالفعل في هذا الفوج' : err.message });
  }
});

// Get Student details & payment history
router.get('/:id', authenticate, async (req, res) => {
  try {
    const student = await db.getOne(`SELECT * FROM students WHERE id = ?`, [req.params.id]);
    if (!student) return res.status(404).json({ error: 'الطالب غير موجود' });

    const enrollments = await db.query(`
      SELECT e.*, c.name as cohort_name, crs.name as course_name, t.full_name as teacher_name
      FROM enrollments e
      JOIN cohorts c ON e.cohort_id = c.id
      JOIN courses crs ON c.course_id = crs.id
      JOIN teachers t ON c.teacher_id = t.id
      WHERE e.student_id = ?
    `, [student.id]);

    const payments = await db.query(`
      SELECT p.*, fa.name_ar as account_name, pm.name_ar as method_name, c.name as cohort_name
      FROM payments p
      JOIN financial_accounts fa ON p.financial_account_id = fa.id
      JOIN payment_methods pm ON p.payment_method_id = pm.id
      JOIN cohorts c ON p.cohort_id = c.id
      WHERE p.student_id = ?
      ORDER BY p.id DESC
    `, [student.id]);

    res.json({ student, enrollments, payments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
