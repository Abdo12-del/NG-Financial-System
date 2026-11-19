const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { authenticate, requireRole } = require('./auth');

const statuses = new Set([
  'new',
  'callback',
  'no_answer',
  'interested',
  'awaiting_payment',
  'enrolled',
  'not_interested'
]);
const contactMethods = new Set(['phone', 'whatsapp', 'telegram', 'in_person', 'other']);

function validDate(value) {
  if (value === null || value === undefined || value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

router.get('/', authenticate, async (req, res) => {
  try {
    const { search, status } = req.query;
    const where = [];
    const params = [];
    if (search) {
      where.push('(l.guardian_name LIKE ? OR l.phone LIKE ? OR l.student_name LIKE ? OR l.course_interest LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }
    if (status && statuses.has(status)) {
      where.push('l.status = ?');
      params.push(status);
    }
    const leads = await db.query(`
      SELECT l.*,
        s.full_name AS converted_student_name,
        (SELECT MAX(f.contacted_at) FROM registration_lead_followups f WHERE f.lead_id = l.id) AS last_contact_at,
        (SELECT COUNT(*) FROM registration_lead_followups f WHERE f.lead_id = l.id) AS followup_count
      FROM registration_leads l
      LEFT JOIN students s ON s.id = l.student_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY
        CASE WHEN l.next_followup_date IS NOT NULL THEN 0 ELSE 1 END,
        l.next_followup_date ASC,
        l.updated_at DESC,
        l.id DESC
    `, params);
    res.json({ leads });
  } catch (err) {
    console.error('Error fetching registration leads:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const guardianName = typeof req.body.guardianName === 'string' ? req.body.guardianName.trim() : '';
    const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
    const telegramUsername = typeof req.body.telegramUsername === 'string'
      ? req.body.telegramUsername.trim().replace(/^@/, '').slice(0, 100) || null
      : null;
    const nextFollowupDate = req.body.nextFollowupDate || null;
    if (!guardianName) return res.status(400).json({ error: 'اسم الولي مطلوب' });
    if (!phone) return res.status(400).json({ error: 'رقم هاتف الولي مطلوب' });
    if (!validDate(nextFollowupDate)) return res.status(400).json({ error: 'تاريخ المتابعة غير صحيح' });

    const result = await db.execute(`
      INSERT INTO registration_leads
        (guardian_name, phone, telegram_username, student_name, course_interest, status, next_followup_date, notes)
      VALUES (?, ?, ?, ?, ?, 'new', ?, ?)
    `, [
      guardianName,
      phone,
      telegramUsername,
      typeof req.body.studentName === 'string' ? req.body.studentName.trim() || null : null,
      typeof req.body.courseInterest === 'string' ? req.body.courseInterest.trim() || null : null,
      nextFollowupDate,
      typeof req.body.notes === 'string' ? req.body.notes.trim() || null : null
    ]);
    res.status(201).json({ success: true, leadId: result.insertId });
  } catch (err) {
    console.error('Error adding registration lead:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authenticate, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'رقم السجل غير صحيح' });
    const guardianName = typeof req.body.guardianName === 'string' ? req.body.guardianName.trim() : '';
    const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
    const telegramUsername = typeof req.body.telegramUsername === 'string'
      ? req.body.telegramUsername.trim().replace(/^@/, '').slice(0, 100) || null
      : null;
    const nextFollowupDate = req.body.nextFollowupDate || null;
    if (!guardianName) return res.status(400).json({ error: 'اسم الولي مطلوب' });
    if (!phone) return res.status(400).json({ error: 'رقم هاتف الولي مطلوب' });
    if (!validDate(nextFollowupDate)) return res.status(400).json({ error: 'تاريخ المتابعة غير صحيح' });
    const existingLead = await db.getOne('SELECT student_id FROM registration_leads WHERE id = ?', [id]);
    if (!existingLead) return res.status(404).json({ error: 'سجل الولي غير موجود' });
    if (existingLead.student_id) return res.status(409).json({ error: 'تم تحويل السجل إلى طالب؛ عدّل بياناته من صفحة الطلاب' });

    const result = await db.execute(`
      UPDATE registration_leads
      SET guardian_name = ?, phone = ?, telegram_username = ?, student_name = ?, course_interest = ?,
        next_followup_date = ?, notes = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `, [
      guardianName,
      phone,
      telegramUsername,
      typeof req.body.studentName === 'string' ? req.body.studentName.trim() || null : null,
      typeof req.body.courseInterest === 'string' ? req.body.courseInterest.trim() || null : null,
      nextFollowupDate,
      typeof req.body.notes === 'string' ? req.body.notes.trim() || null : null,
      id
    ]);
    if (!result.affectedRows) return res.status(404).json({ error: 'سجل الولي غير موجود' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating registration lead:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/convert', authenticate, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const cohortId = Number(req.body.cohortId);
    const studentName = typeof req.body.studentName === 'string' ? req.body.studentName.trim() : '';
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'رقم السجل غير صحيح' });
    if (!Number.isInteger(cohortId) || cohortId <= 0) return res.status(400).json({ error: 'يرجى اختيار الفوج' });
    if (!studentName) return res.status(400).json({ error: 'اسم الطالب مطلوب' });

    const result = await db.transaction(async tx => {
      const lead = await tx.getOne('SELECT * FROM registration_leads WHERE id = ?', [id]);
      if (!lead) return { notFound: true };
      if (lead.student_id) return { alreadyConverted: true, studentId: lead.student_id };

      const cohort = await tx.getOne(`
        SELECT c.id, c.status, crs.default_price
        FROM cohorts c
        JOIN courses crs ON crs.id = c.course_id
        WHERE c.id = ?
      `, [cohortId]);
      if (!cohort || !['active', 'upcoming'].includes(cohort.status)) return { invalidCohort: true };

      const agreedPrice = req.body.agreedPrice === '' || req.body.agreedPrice === undefined
        ? Number(cohort.default_price)
        : Number(req.body.agreedPrice);
      const discountAmount = req.body.discountAmount === '' || req.body.discountAmount === undefined
        ? 0
        : Number(req.body.discountAmount);
      if (!Number.isFinite(agreedPrice) || agreedPrice < 0
        || !Number.isFinite(discountAmount) || discountAmount < 0 || discountAmount > agreedPrice) {
        return { invalidPrice: true };
      }

      const netPrice = agreedPrice - discountAmount;
      const student = await tx.execute(`
        INSERT INTO students (full_name, guardian_phone, notes, status, created_at)
        VALUES (?, ?, ?, 'active', datetime('now', 'localtime'))
      `, [studentName, lead.phone, lead.notes]);
      const enrollment = await tx.execute(`
        INSERT INTO enrollments
          (student_id, cohort_id, agreed_price, discount_amount, net_price, paid_amount,
           remaining_amount, payment_status, confirmation_status, enrollment_date, status)
        VALUES (?, ?, ?, ?, ?, 0, ?, 'UNPAID', 'pending', date('now'), 'enrolled')
      `, [student.insertId, cohortId, agreedPrice, discountAmount, netPrice, netPrice]);
      await tx.execute(`
        UPDATE registration_leads
        SET status = 'enrolled', student_id = ?, next_followup_date = NULL,
          updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `, [student.insertId, id]);
      await tx.execute(`
        INSERT INTO registration_lead_followups
          (lead_id, user_id, contact_method, status, note)
        VALUES (?, ?, 'other', 'enrolled', ?)
      `, [id, req.user.id || null, `تم إنشاء ملف الطالب ${studentName} وتسجيله في الفوج`]);
      return { studentId: student.insertId, enrollmentId: enrollment.insertId };
    });

    if (result.notFound) return res.status(404).json({ error: 'سجل الولي غير موجود' });
    if (result.alreadyConverted) {
      return res.status(409).json({ error: 'تم تحويل هذا السجل إلى طالب مسبقًا', studentId: result.studentId });
    }
    if (result.invalidCohort) return res.status(400).json({ error: 'الفوج غير موجود أو غير متاح للتسجيل' });
    if (result.invalidPrice) return res.status(400).json({ error: 'السعر والخصم يجب أن يكونا أرقامًا صحيحة غير سالبة، والخصم لا يتجاوز السعر' });
    res.status(201).json({ success: true, ...result, message: 'تم تسجيل الطالب وربط ملفه بسجل المتابعة' });
  } catch (err) {
    console.error('Error converting registration lead:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/followups', authenticate, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'رقم السجل غير صحيح' });
    const lead = await db.getOne('SELECT id FROM registration_leads WHERE id = ?', [id]);
    if (!lead) return res.status(404).json({ error: 'سجل الولي غير موجود' });
    const followups = await db.query(`
      SELECT f.*, u.full_name AS user_name
      FROM registration_lead_followups f
      LEFT JOIN users u ON u.id = f.user_id
      WHERE f.lead_id = ?
      ORDER BY f.contacted_at DESC, f.id DESC
    `, [id]);
    res.json({ followups });
  } catch (err) {
    console.error('Error fetching registration follow-ups:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/followups', authenticate, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { contactMethod, status, note } = req.body;
    const nextFollowupDate = req.body.nextFollowupDate || null;
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'رقم السجل غير صحيح' });
    if (!contactMethods.has(contactMethod)) return res.status(400).json({ error: 'وسيلة التواصل غير صحيحة' });
    if (!statuses.has(status) || status === 'new') return res.status(400).json({ error: 'حالة المتابعة غير صحيحة' });
    if (!validDate(nextFollowupDate)) return res.status(400).json({ error: 'تاريخ المتابعة غير صحيح' });

    const result = await db.transaction(async tx => {
      const lead = await tx.getOne('SELECT id, student_id FROM registration_leads WHERE id = ?', [id]);
      if (!lead) return { notFound: true };
      if (lead.student_id) return { alreadyConverted: true };
      await tx.execute(`
        UPDATE registration_leads
        SET status = ?, next_followup_date = ?, updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `, [status, nextFollowupDate, id]);
      const followup = await tx.execute(`
        INSERT INTO registration_lead_followups
          (lead_id, user_id, contact_method, status, note, next_followup_date)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [id, req.user.id || null, contactMethod, status,
        typeof note === 'string' ? note.trim() || null : null, nextFollowupDate]);
      return { followupId: followup.insertId };
    });
    if (result.notFound) return res.status(404).json({ error: 'سجل الولي غير موجود' });
    if (result.alreadyConverted) return res.status(409).json({ error: 'تم تحويل السجل إلى طالب؛ لا يمكن إضافة متابعة جديدة هنا' });
    res.status(201).json({ success: true, followupId: result.followupId });
  } catch (err) {
    console.error('Error recording registration follow-up:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
