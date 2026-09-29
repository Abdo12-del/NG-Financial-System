const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { authenticate, requireRole } = require('./auth');

// List courses with stats
router.get('/courses', authenticate, async (req, res) => {
  try {
    const courses = await db.query(`
      SELECT
        crs.*,
        COUNT(DISTINCT c.id) as cohort_count,
        COUNT(DISTINCT e.id) as student_count
      FROM courses crs
      LEFT JOIN cohorts c ON crs.id = c.course_id
      LEFT JOIN enrollments e ON c.id = e.cohort_id
      GROUP BY crs.id
      ORDER BY crs.id DESC
    `);
    res.json({ courses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add course
router.post('/courses', authenticate, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { name, defaultPrice, ageGroup, duration, description, status } = req.body;
    if (!name) return res.status(400).json({ error: 'اسم الدورة مطلوب' });

    const result = await db.execute(`
      INSERT INTO courses (name, default_price, age_group, duration, description, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `, [name.trim(), defaultPrice || 0, ageGroup || null, duration || null, description || null, status || 'active']);

    res.json({ success: true, courseId: result.insertId, message: 'تمت إضافة الدورة بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List Cohorts
router.get('/cohorts', authenticate, async (req, res) => {
  try {
    const { courseId, status } = req.query;
    let whereClauses = ['1=1'];
    let params = [];

    if (courseId) {
      whereClauses.push('c.course_id = ?');
      params.push(courseId);
    }
    if (status) {
      whereClauses.push('c.status = ?');
      params.push(status);
    }

    const cohorts = await db.query(`
      SELECT
        c.*,
        crs.name as course_name,
        crs.default_price as course_default_price,
        t.full_name as teacher_name,
        t.phone as teacher_phone,
        COUNT(e.id) as enrolled_students_count,
        COALESCE(SUM(e.net_price), 0) as total_enrollment_value,
        COALESCE(SUM(e.paid_amount), 0) as total_collected_revenue,
        COALESCE(SUM(e.remaining_amount), 0) as total_outstanding
      FROM cohorts c
      JOIN courses crs ON c.course_id = crs.id
      JOIN teachers t ON c.teacher_id = t.id
      LEFT JOIN enrollments e ON c.id = e.cohort_id AND e.status != 'dropped'
      WHERE ${whereClauses.join(' AND ')}
      GROUP BY c.id
      ORDER BY c.id DESC
    `, params);

    res.json({ cohorts });
  } catch (err) {
    console.error('Error fetching cohorts:', err);
    res.status(500).json({ error: err.message });
  }
});

// Add Cohort
router.post('/cohorts', authenticate, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { courseId, teacherId, name, startDate, endDate, maxStudents, compensationType, compensationValue, notes, status } = req.body;
    if (!courseId || !teacherId || !name) {
      return res.status(400).json({ error: 'الدورة والأستاذ واسم الفوج مطلوبة' });
    }

    const result = await db.execute(`
      INSERT INTO cohorts (
        course_id, teacher_id, name, start_date, end_date, max_students,
        compensation_type, compensation_value, notes, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `, [
      courseId, teacherId, name.trim(), startDate || null, endDate || null,
      maxStudents || 20, compensationType || 'PERCENTAGE', compensationValue || 60.00,
      notes || null, status || 'active'
    ]);

    res.json({ success: true, cohortId: result.insertId, message: 'تم إنشاء الفوج بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cohort Financial Summary (التقرير والملخص المالي المفصل للفوج)
router.get('/cohorts/:id/summary', authenticate, async (req, res) => {
  try {
    const cohortId = req.params.id;
    const cohort = await db.getOne(`
      SELECT
        c.*,
        crs.name as course_name,
        crs.default_price,
        t.full_name as teacher_name,
        t.phone as teacher_phone
      FROM cohorts c
      JOIN courses crs ON c.course_id = crs.id
      JOIN teachers t ON c.teacher_id = t.id
      WHERE c.id = ?
    `, [cohortId]);

    if (!cohort) return res.status(404).json({ error: 'الفوج غير موجود' });

    // Enrollments
    const enrollments = await db.query(`
      SELECT
        e.*,
        s.full_name as student_name,
        s.phone as student_phone
      FROM enrollments e
      JOIN students s ON e.student_id = s.id
      WHERE e.cohort_id = ?
      ORDER BY e.id ASC
    `, [cohortId]);

    const totalEnrollmentValue = enrollments.reduce((sum, e) => sum + parseFloat(e.net_price || 0), 0);
    const totalCollected = enrollments.reduce((sum, e) => sum + parseFloat(e.paid_amount || 0), 0);
    const totalRemaining = enrollments.reduce((sum, e) => sum + parseFloat(e.remaining_amount || 0), 0);

    // Teacher Share calculation
    let teacherTotalShare = 0;
    if (cohort.compensation_type === 'PERCENTAGE') {
      const rate = parseFloat(cohort.compensation_value);
      // Teacher share is calculated based on revenue collected from students
      teacherTotalShare = parseFloat(((totalCollected * rate) / 100).toFixed(2));
    } else {
      // Fixed contract
      teacherTotalShare = parseFloat(cohort.compensation_value);
    }

    // Direct Expenses linked to this cohort
    const expensesRow = await db.getOne(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE cohort_id = ? AND status = 'completed' AND category_id != 1
    `, [cohortId]);
    const directExpenses = parseFloat(expensesRow?.total || 0);

    // Teacher Paid for this cohort
    const teacherPaidRow = await db.getOne(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM teacher_compensations
      WHERE cohort_id = ? AND entry_type = 'PAYOUT' AND status = 'active'
    `, [cohortId]);
    const teacherPaid = parseFloat(teacherPaidRow?.total || 0);

    // Academy Net Profit from Cohort
    // Academy Share = Collected Revenue - Teacher Total Share - Direct Expenses
    const academyNetProfit = totalCollected - teacherTotalShare - directExpenses;
    const profitMargin = totalCollected > 0 ? ((academyNetProfit / totalCollected) * 100).toFixed(1) : 0;

    res.json({
      cohort,
      financials: {
        totalEnrollmentValue,
        totalCollected,
        totalRemaining,
        teacherTotalShare,
        teacherPaid,
        teacherRemainingDue: Math.max(0, teacherTotalShare - teacherPaid),
        directExpenses,
        academyNetProfit,
        profitMargin
      },
      enrollments
    });
  } catch (err) {
    console.error('Error in cohort summary:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
