const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { authenticate, requireRole } = require('./auth');

const contactStatuses = new Set(['callback', 'no_answer', 'awaiting_payment', 'confirmed', 'not_interested']);
const contactMethods = new Set(['phone', 'whatsapp', 'telegram', 'in_person', 'other']);

function validContactDate(value) {
  if (value === null || value === undefined || value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

router.get('/:id/contact-followups', authenticate, async (req, res) => {
  try {
    const studentId = Number(req.params.id);
    if (!Number.isInteger(studentId) || studentId <= 0) {
      return res.status(400).json({ error: 'رقم الطالب غير صالح' });
    }
    const student = await db.getOne('SELECT id FROM students WHERE id = ?', [studentId]);
    if (!student) return res.status(404).json({ error: 'الطالب غير موجود' });
    const followups = await db.query(`
      SELECT f.*, u.full_name AS user_name
      FROM student_contact_followups f
      LEFT JOIN users u ON u.id = f.user_id
      WHERE f.student_id = ?
      ORDER BY f.contacted_at DESC, f.id DESC
    `, [studentId]);
    res.json({ followups });
  } catch (err) {
    console.error('Error fetching student contact history:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/contact-followups', authenticate, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const studentId = Number(req.params.id);
    const { contactMethod, status, note } = req.body;
    const nextContactDate = req.body.nextContactDate || null;
    if (!Number.isInteger(studentId) || studentId <= 0) {
      return res.status(400).json({ error: 'رقم الطالب غير صالح' });
    }
    if (!contactMethods.has(contactMethod)) return res.status(400).json({ error: 'وسيلة التواصل غير صحيحة' });
    if (!contactStatuses.has(status)) return res.status(400).json({ error: 'حالة المتابعة غير صحيحة' });
    if (!validContactDate(nextContactDate)) return res.status(400).json({ error: 'تاريخ المتابعة غير صحيح' });

    const result = await db.transaction(async tx => {
      const student = await tx.getOne('SELECT id FROM students WHERE id = ?', [studentId]);
      if (!student) return { notFound: true };
      await tx.execute(`
        UPDATE students
        SET contact_status = ?, next_contact_date = ?, updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `, [status, nextContactDate, studentId]);
      const followup = await tx.execute(`
        INSERT INTO student_contact_followups
          (student_id, user_id, contact_method, status, note, next_contact_date)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        studentId,
        req.user.id || null,
        contactMethod,
        status,
        typeof note === 'string' ? note.trim() || null : null,
        nextContactDate
      ]);
      return { followupId: followup.insertId };
    });
    if (result.notFound) return res.status(404).json({ error: 'الطالب غير موجود' });
    res.status(201).json({ success: true, followupId: result.followupId });
  } catch (err) {
    console.error('Error recording student contact follow-up:', err);
    res.status(500).json({ error: err.message });
  }
});

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
        s.contact_status,
        s.next_contact_date,
        EXISTS(SELECT 1 FROM enrollments e2 WHERE e2.student_id = s.id) as has_enrollment_history,
        EXISTS(SELECT 1 FROM payments p2 WHERE p2.student_id = s.id) as has_payment_history,
        e.id as enrollment_id,
        e.cohort_id,
        c.course_id,
        c.name as cohort_name,
        crs.name as course_name,
        e.agreed_price,
        e.discount_amount,
        e.net_price,
        e.paid_amount,
        e.remaining_amount,
        e.payment_status,
        e.confirmation_status,
        e.billing_start_month,
        (SELECT MAX(cf.contacted_at) FROM student_contact_followups cf WHERE cf.student_id = s.id) as last_contact_at,
        (SELECT MAX(payment_date) FROM payments p WHERE p.enrollment_id = e.id AND p.status = 'completed') as last_payment_date
      FROM students s
      LEFT JOIN enrollments e ON s.id = e.student_id AND e.status != 'dropped'
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
    let whereClauses = ['e.remaining_amount > 0', "e.status != 'dropped'", "e.confirmation_status != 'pending'"];
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
        s.contact_status,
        s.next_contact_date,
        e.id as enrollment_id,
        e.cohort_id,
        c.course_id,
        c.name as cohort_name,
        crs.name as course_name,
        e.net_price,
        e.paid_amount,
        e.remaining_amount,
        e.payment_status,
        e.confirmation_status,
        e.billing_start_month,
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

router.put('/enrollments/transfer', authenticate, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { enrollmentIds, cohortId } = req.body;
    const targetCohortId = Number(cohortId);
    if (!Array.isArray(enrollmentIds) || enrollmentIds.length === 0 || enrollmentIds.length > 500) {
      return res.status(400).json({ error: 'يرجى تحديد طالب واحد على الأقل (بحد أقصى 500 طالب)' });
    }
    if (!Number.isInteger(targetCohortId) || targetCohortId <= 0) {
      return res.status(400).json({ error: 'الفوج المستهدف غير صالح' });
    }
    const ids = enrollmentIds.map(Number);
    if (ids.some(id => !Number.isInteger(id) || id <= 0) || new Set(ids).size !== ids.length) {
      return res.status(400).json({ error: 'قائمة تسجيلات الطلاب غير صالحة' });
    }

    const result = await db.transaction(async tx => {
      const target = await tx.getOne(`
        SELECT c.id, c.name, c.course_id, c.max_students, c.status
        FROM cohorts c
        JOIN courses crs ON crs.id = c.course_id
        WHERE c.id = ?
      `, [targetCohortId]);
      if (!target) return { error: 'الفوج المستهدف غير موجود', status: 404 };
      if (target.status !== 'active') return { error: 'لا يمكن النقل إلى فوج غير نشط', status: 400 };

      const enrollments = [];
      for (const id of ids) {
        const enrollment = await tx.getOne(`
          SELECT e.*, s.full_name AS student_name, c.name AS source_cohort_name, c.course_id AS source_course_id
          FROM enrollments e
          JOIN students s ON s.id = e.student_id
          JOIN cohorts c ON c.id = e.cohort_id
          WHERE e.id = ?
        `, [id]);
        if (!enrollment || enrollment.status === 'dropped') {
          return { error: 'أحد تسجيلات الطلاب المحددة غير موجود أو مستبعد', status: 400 };
        }
        if (Number(enrollment.source_course_id) !== Number(target.course_id)) {
          return { error: 'يمكن نقل الطلاب بين أفواج الدورة التدريبية نفسها فقط', status: 400 };
        }
        if (Number(enrollment.cohort_id) === targetCohortId) {
          return { error: `الطالب ${enrollment.student_name} مسجل بالفعل في الفوج المستهدف`, status: 400 };
        }
        const existing = await tx.getOne(
          'SELECT id FROM enrollments WHERE student_id = ? AND cohort_id = ?',
          [enrollment.student_id, targetCohortId]
        );
        if (existing) {
          return { error: `لا يمكن نقل ${enrollment.student_name} لوجود تسجيل سابق له في الفوج المستهدف`, status: 409 };
        }
        enrollments.push(enrollment);
      }

      const currentCount = await tx.getOne(
        "SELECT COUNT(*) AS total FROM enrollments WHERE cohort_id = ? AND status != 'dropped'",
        [targetCohortId]
      );
      if (Number(target.max_students) > 0 && Number(currentCount?.total || 0) + enrollments.length > Number(target.max_students)) {
        return { error: `الفوج المستهدف لا يتسع لجميع الطلاب المحددين (المقاعد المتبقية: ${Math.max(0, Number(target.max_students) - Number(currentCount?.total || 0))})`, status: 400 };
      }

      for (const enrollment of enrollments) {
        const payments = await tx.query('SELECT id FROM payments WHERE enrollment_id = ?', [enrollment.id]);
        const paymentIds = payments.map(payment => payment.id);

        await tx.execute(`
          UPDATE enrollments
          SET cohort_id = ?, updated_at = datetime('now', 'localtime')
          WHERE id = ?
        `, [targetCohortId, enrollment.id]);
        await tx.execute('UPDATE payments SET cohort_id = ? WHERE enrollment_id = ?', [targetCohortId, enrollment.id]);
        if (paymentIds.length > 0) {
          const placeholders = paymentIds.map(() => '?').join(', ');
          await tx.execute(
            `UPDATE financial_ledger SET cohort_id = ? WHERE source_table = 'payments' AND source_id IN (${placeholders})`,
            [targetCohortId, ...paymentIds]
          );
        }
        await tx.execute(`
          INSERT INTO audit_logs
            (user_id, username, action_type, entity_name, entity_id, old_values, new_values, details, created_at)
          VALUES (?, ?, 'UPDATE', 'enrollments', ?, ?, ?, ?, datetime('now', 'localtime'))
        `, [
          req.user.id,
          req.user.username,
          enrollment.id,
          JSON.stringify({ cohort_id: enrollment.cohort_id, cohort_name: enrollment.source_cohort_name }),
          JSON.stringify({ cohort_id: targetCohortId, cohort_name: target.name }),
          `نقل الطالب ${enrollment.student_name} من ${enrollment.source_cohort_name} إلى ${target.name}`
        ]);
      }
      return { transferred: enrollments.length, cohortName: target.name };
    });

    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json({
      success: true,
      transferred: result.transferred,
      message: `تم نقل ${result.transferred} طالب إلى ${result.cohortName} بنجاح`
    });
  } catch (err) {
    console.error('Error transferring student enrollments:', err);
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
          INSERT INTO enrollments (student_id, cohort_id, agreed_price, discount_amount, net_price, paid_amount, remaining_amount, payment_status, confirmation_status, enrollment_date)
          VALUES (?, ?, ?, ?, ?, 0.00, ?, 'UNPAID', 'pending', date('now'))
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
      INSERT INTO enrollments (student_id, cohort_id, agreed_price, discount_amount, net_price, paid_amount, remaining_amount, payment_status, confirmation_status, enrollment_date)
      VALUES (?, ?, ?, ?, ?, 0.00, ?, 'UNPAID', 'pending', date('now'))
    `, [studentId, cohortId, grossPrice, discount, netPrice, netPrice]);

    res.json({ success: true, enrollmentId: enrollRes.insertId, message: 'تم تسجيل الطالب في الفوج' });
  } catch (err) {
    res.status(400).json({ error: err.message.includes('UNIQUE') ? 'الطالب مسجل بالفعل في هذا الفوج' : err.message });
  }
});

router.put('/:studentId/enrollments/:enrollmentId/confirmation', authenticate, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const studentId = Number(req.params.studentId);
    const enrollmentId = Number(req.params.enrollmentId);
    const nextStatus = req.body.confirmationStatus;
    if (!Number.isInteger(studentId) || studentId <= 0 || !Number.isInteger(enrollmentId) || enrollmentId <= 0) {
      return res.status(400).json({ error: 'بيانات تسجيل الطالب غير صالحة' });
    }
    if (!['confirmed', 'frozen'].includes(nextStatus)) {
      return res.status(400).json({ error: 'حالة التأكيد غير صالحة' });
    }

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const result = await db.transaction(async tx => {
      const enrollment = await tx.getOne(`
        SELECT e.id, e.confirmation_status, e.status AS enrollment_status, s.full_name AS student_name,
          c.name AS cohort_name
        FROM enrollments e
        JOIN students s ON s.id = e.student_id
        JOIN cohorts c ON c.id = e.cohort_id
        WHERE e.id = ? AND e.student_id = ?
      `, [enrollmentId, studentId]);
      if (!enrollment || enrollment.enrollment_status === 'dropped') return { notFound: true };
      if (enrollment.confirmation_status === nextStatus) return { unchanged: true };
      if (enrollment.confirmation_status === 'pending' && nextStatus !== 'confirmed') {
        return { invalidTransition: true };
      }

      await tx.execute(`
        UPDATE enrollments
        SET confirmation_status = ?, billing_start_month = ?, updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `, [nextStatus, nextStatus === 'confirmed' ? currentMonth : enrollment.billing_start_month || null, enrollmentId]);
      await tx.execute(`
        INSERT INTO audit_logs
          (user_id, username, action_type, entity_name, entity_id, old_values, new_values, details, created_at)
        VALUES (?, ?, 'UPDATE', 'enrollments', ?, ?, ?, ?, datetime('now', 'localtime'))
      `, [
        req.user.id,
        req.user.username,
        enrollmentId,
        JSON.stringify({ confirmation_status: enrollment.confirmation_status }),
        JSON.stringify({ confirmation_status: nextStatus, billing_start_month: nextStatus === 'confirmed' ? currentMonth : enrollment.billing_start_month || null }),
        `${nextStatus === 'confirmed' ? 'تأكيد' : 'تجميد'} تسجيل الطالب ${enrollment.student_name} في فوج ${enrollment.cohort_name}`
      ]);
      return { changed: true };
    });

    if (result.notFound) return res.status(404).json({ error: 'تسجيل الطالب غير موجود أو مستبعد' });
    if (result.invalidTransition) return res.status(400).json({ error: 'لا يمكن تجميد تسجيل بانتظار التأكيد؛ أكّد التسجيل أولًا' });
    if (result.unchanged) return res.status(400).json({ error: 'التسجيل في هذه الحالة بالفعل' });
    res.json({
      success: true,
      confirmationStatus: nextStatus,
      message: nextStatus === 'confirmed'
        ? `تم تأكيد التسجيل، وتبدأ المستحقات الشهرية من ${currentMonth}`
        : 'تم تجميد التسجيل؛ أوقفت المستحقات الشهرية الجديدة مع الإبقاء على المستحقات السابقة'
    });
  } catch (err) {
    console.error('Error updating student enrollment confirmation:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:studentId/enrollments/:enrollmentId/drop', authenticate, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const studentId = Number(req.params.studentId);
    const enrollmentId = Number(req.params.enrollmentId);
    const { reason } = req.body;
    if (!Number.isInteger(studentId) || !Number.isInteger(enrollmentId) || studentId <= 0 || enrollmentId <= 0) {
      return res.status(400).json({ error: 'بيانات تسجيل الطالب غير صالحة' });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'يرجى كتابة سبب إزالة التسجيل' });
    }

    const result = await db.transaction(async (tx) => {
      const enrollment = await tx.getOne(`
        SELECT e.*, s.full_name as student_name, c.name as cohort_name
        FROM enrollments e
        JOIN students s ON s.id = e.student_id
        JOIN cohorts c ON c.id = e.cohort_id
        WHERE e.id = ? AND e.student_id = ?
      `, [enrollmentId, studentId]);
      if (!enrollment) return { notFound: true };
      if (enrollment.status === 'dropped') return { alreadyDropped: true };

      const activePayments = await tx.getOne(`
        SELECT COUNT(*) as total FROM payments
        WHERE enrollment_id = ? AND status != 'voided'
      `, [enrollmentId]);
      if (Number(activePayments?.total || 0) > 0) return { hasPayments: true };

      await tx.execute(`
        UPDATE enrollments
        SET status = 'dropped', updated_at = datetime('now', 'localtime')
        WHERE id = ? AND student_id = ?
      `, [enrollmentId, studentId]);
      await tx.execute(`
        INSERT INTO audit_logs (user_id, username, action_type, entity_name, entity_id, old_values, new_values, details, created_at)
        VALUES (?, ?, 'DELETE', 'enrollments', ?, ?, ?, ?, datetime('now', 'localtime'))
      `, [req.user.id, req.user.username, enrollmentId, JSON.stringify(enrollment), JSON.stringify({ status: 'dropped' }),
        `إزالة تسجيل الطالب ${enrollment.student_name} من ${enrollment.cohort_name}: ${reason.trim()}`]);
      return { dropped: true, studentName: enrollment.student_name, cohortName: enrollment.cohort_name };
    });

    if (result.notFound) return res.status(404).json({ error: 'تسجيل الطالب غير موجود' });
    if (result.alreadyDropped) return res.status(400).json({ error: 'هذا التسجيل مستبعد بالفعل' });
    if (result.hasPayments) {
      return res.status(400).json({ error: 'لا يمكن إزالة هذا التسجيل لوجود دفعات مرتبطة به؛ ألغِ الدفعات الفعّالة أولًا' });
    }
    res.json({
      success: true,
      message: `تمت إزالة تسجيل ${result.studentName} من ${result.cohortName} مع الإبقاء على ملف الطالب`,
      studentRetained: true
    });
  } catch (err) {
    console.error('Error dropping enrollment:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authenticate, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const studentId = Number(req.params.id);
    const { fullName, phone, guardianPhone, email, notes } = req.body;
    if (!Number.isInteger(studentId) || studentId <= 0) {
      return res.status(400).json({ error: 'رقم الطالب غير صالح' });
    }
    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ error: 'اسم الطالب مطلوب' });
    }

    const updatedStudent = await db.transaction(async (tx) => {
      const student = await tx.getOne(`SELECT * FROM students WHERE id = ?`, [studentId]);
      if (!student) return null;

      const updated = {
        full_name: fullName.trim(),
        phone: phone?.trim() || null,
        guardian_phone: guardianPhone?.trim() || null,
        email: email?.trim() || null,
        notes: notes?.trim() || null
      };
      await tx.execute(`
        UPDATE students
        SET full_name = ?, phone = ?, guardian_phone = ?, email = ?, notes = ?, updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `, [updated.full_name, updated.phone, updated.guardian_phone, updated.email, updated.notes, studentId]);
      await tx.execute(`
        INSERT INTO audit_logs (user_id, username, action_type, entity_name, entity_id, old_values, new_values, details, created_at)
        VALUES (?, ?, 'UPDATE', 'students', ?, ?, ?, ?, datetime('now', 'localtime'))
      `, [req.user.id, req.user.username, studentId, JSON.stringify(student), JSON.stringify(updated), `تعديل بيانات الطالب: ${student.full_name}`]);
      return { id: studentId, ...updated };
    });

    if (!updatedStudent) return res.status(404).json({ error: 'الطالب غير موجود' });
    res.json({ success: true, student: updatedStudent, message: 'تم تحديث بيانات الطالب بنجاح' });
  } catch (err) {
    console.error('Error updating student:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticate, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const studentId = Number(req.params.id);
    const { reason } = req.body;
    if (!Number.isInteger(studentId) || studentId <= 0) {
      return res.status(400).json({ error: 'رقم الطالب غير صالح' });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'يرجى ذكر سبب حذف ملف الطالب' });
    }

    const result = await db.transaction(async (tx) => {
      const student = await tx.getOne(`SELECT id, full_name FROM students WHERE id = ?`, [studentId]);
      if (!student) return { notFound: true };
      const enrollmentCount = await tx.getOne(`SELECT COUNT(*) as total FROM enrollments WHERE student_id = ?`, [studentId]);
      const paymentCount = await tx.getOne(`SELECT COUNT(*) as total FROM payments WHERE student_id = ?`, [studentId]);
      if (Number(enrollmentCount?.total || 0) > 0 || Number(paymentCount?.total || 0) > 0) {
        return { hasHistory: true };
      }

      await tx.execute(`
        INSERT INTO audit_logs (user_id, username, action_type, entity_name, entity_id, old_values, details, created_at)
        VALUES (?, ?, 'DELETE', 'students', ?, ?, ?, datetime('now', 'localtime'))
      `, [req.user.id, req.user.username, studentId, JSON.stringify({ full_name: student.full_name }),
        `حذف ملف طالب غير مسجل: ${student.full_name}. السبب: ${reason.trim()}`]);
      await tx.execute(`DELETE FROM students WHERE id = ?`, [studentId]);
      return { deleted: true };
    });

    if (result.notFound) return res.status(404).json({ error: 'الطالب غير موجود' });
    if (result.hasHistory) {
      return res.status(400).json({ error: 'لا يمكن حذف ملف له تسجيلات أو دفعات سابقة؛ استخدم إزالة التسجيل أو اترك الملف محفوظًا للتدقيق' });
    }
    res.json({ success: true, message: 'تم حذف ملف الطالب غير المسجل بنجاح' });
  } catch (err) {
    console.error('Error deleting student:', err);
    res.status(500).json({ error: err.message });
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
