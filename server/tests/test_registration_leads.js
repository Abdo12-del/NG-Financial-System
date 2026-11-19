const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const jwt = require('jsonwebtoken');

const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ng-registration-leads-test-'));
process.env.DB_CONFIG_FILE = path.join(testDataDir, 'db_config.json');
process.env.SQLITE_FILE = path.join(testDataDir, 'ng_financial.db');
process.env.JWT_SECRET = 'ng-registration-leads-test-secret';
fs.writeFileSync(process.env.DB_CONFIG_FILE, JSON.stringify({ engine: 'sqlite' }));

const db = require('../db/connection');
const app = express();
app.use(express.json());
app.use('/api/registration-leads', require('../routes/registrationLeads'));

const headers = {
  Authorization: `Bearer ${jwt.sign({ id: 1, username: 'test-admin', role: 'admin' }, process.env.JWT_SECRET)}`,
  'Content-Type': 'application/json'
};
const viewerHeaders = {
  Authorization: `Bearer ${jwt.sign({ id: 2, username: 'test-viewer', role: 'viewer' }, process.env.JWT_SECRET)}`,
  'Content-Type': 'application/json'
};

async function runRegistrationLeadTest() {
  await db.initDb();
  db.getSqliteDb().exec('ALTER TABLE registration_leads DROP COLUMN telegram_username');
  await db.closeDb();
  await db.initDb();
  assert(
    db.getSqliteDb().pragma('table_info(registration_leads)').some(column => column.name === 'telegram_username'),
    'Existing registration lead tables should be upgraded with a Telegram username column'
  );
  assert(
    db.getSqliteDb().pragma('table_info(registration_leads)').some(column => column.name === 'student_id'),
    'Registration lead tables should include a student link'
  );
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/registration-leads`;

  try {
    let response = await fetch(baseUrl, { headers });
    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual((await response.json()).leads, []);

    response = await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ guardianName: 'أم ياسين', phone: '0550123456', telegramUsername: '@yassine_parent', studentName: 'ياسين', courseInterest: 'البرمجة' })
    });
    assert.strictEqual(response.status, 201);
    const { leadId } = await response.json();

    response = await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ guardianName: ' ', phone: '0550000000' })
    });
    assert.strictEqual(response.status, 400);

    response = await fetch(`${baseUrl}/${leadId}/followups`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contactMethod: 'whatsapp',
        status: 'awaiting_payment',
        note: 'أكدت مبدئياً وسترسل المستحقات غداً',
        nextFollowupDate: '2026-10-14'
      })
    });
    assert.strictEqual(response.status, 201);

    response = await fetch(`${baseUrl}?status=awaiting_payment`, { headers });
    const filtered = await response.json();
    assert.strictEqual(filtered.leads.length, 1);
    assert.strictEqual(filtered.leads[0].status, 'awaiting_payment');
    assert.strictEqual(filtered.leads[0].telegram_username, 'yassine_parent');
    assert.strictEqual(Number(filtered.leads[0].followup_count), 1);
    assert.strictEqual(filtered.leads[0].next_followup_date.slice(0, 10), '2026-10-14');

    response = await fetch(`${baseUrl}/${leadId}/followups`, { headers });
    const { followups } = await response.json();
    assert.strictEqual(followups.length, 1);
    assert.strictEqual(followups[0].contact_method, 'whatsapp');
    assert.strictEqual(followups[0].note, 'أكدت مبدئياً وسترسل المستحقات غداً');

    response = await fetch(`${baseUrl}/${leadId}/followups`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ contactMethod: 'fax', status: 'callback' })
    });
    assert.strictEqual(response.status, 400);

    response = await fetch(baseUrl, {
      method: 'POST',
      headers: viewerHeaders,
      body: JSON.stringify({ guardianName: 'وليّ', phone: '0550000000' })
    });
    assert.strictEqual(response.status, 403);

    response = await fetch(`${baseUrl}/${leadId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        guardianName: 'أم ياسين',
        phone: '0550999999',
        telegramUsername: 'yassine_parent',
        studentName: 'ياسين',
        courseInterest: 'الروبوتيك',
        nextFollowupDate: '',
        notes: 'تفضّل الاتصال مساءً'
      })
    });
    assert.strictEqual(response.status, 200);

    response = await fetch(`${baseUrl}?search=الروبوتيك`, { headers });
    assert.strictEqual((await response.json()).leads.length, 1);

    const course = await db.execute(`
      INSERT INTO courses (name, default_price, status) VALUES ('الروبوتيك', 12000, 'active')
    `);
    const teacher = await db.execute(`
      INSERT INTO teachers (full_name, specialty) VALUES ('أستاذ الاختبار', 'روبوتيك')
    `);
    const cohort = await db.execute(`
      INSERT INTO cohorts (course_id, teacher_id, name, status) VALUES (?, ?, 'فوج تجريبي', 'upcoming')
    `, [course.insertId, teacher.insertId]);

    response = await fetch(`${baseUrl}/${leadId}/convert`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        studentName: 'ياسين',
        cohortId: cohort.insertId,
        agreedPrice: 12000,
        discountAmount: 13000
      })
    });
    assert.strictEqual(response.status, 400);

    response = await fetch(`${baseUrl}/${leadId}/convert`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        studentName: 'ياسين',
        cohortId: cohort.insertId,
        agreedPrice: 12000,
        discountAmount: 2000
      })
    });
    assert.strictEqual(response.status, 201);
    const converted = await response.json();
    const student = await db.getOne('SELECT * FROM students WHERE id = ?', [converted.studentId]);
    assert.strictEqual(student.full_name, 'ياسين');
    assert.strictEqual(student.guardian_phone, '0550999999');
    const enrollment = await db.getOne('SELECT * FROM enrollments WHERE id = ?', [converted.enrollmentId]);
    assert.strictEqual(Number(enrollment.net_price), 10000);
    assert.strictEqual(Number(enrollment.remaining_amount), 10000);
    assert.strictEqual(enrollment.payment_status, 'UNPAID');

    response = await fetch(`${baseUrl}/${leadId}/convert`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ studentName: 'ياسين', cohortId: cohort.insertId })
    });
    assert.strictEqual(response.status, 409);

    response = await fetch(baseUrl, { headers });
    const convertedLead = (await response.json()).leads.find(item => item.id === leadId);
    assert.strictEqual(convertedLead.status, 'enrolled');
    assert.strictEqual(convertedLead.student_id, converted.studentId);
    assert.strictEqual(convertedLead.converted_student_name, 'ياسين');
    assert.strictEqual(Number(convertedLead.followup_count), 2);

    response = await fetch(`${baseUrl}/${leadId}/followups`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ contactMethod: 'phone', status: 'callback' })
    });
    assert.strictEqual(response.status, 409);

    response = await fetch(`${baseUrl}/${leadId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        guardianName: 'أم ياسين',
        phone: '0550999999',
        telegramUsername: 'yassine_parent',
        studentName: 'ياسين',
        courseInterest: 'الروبوتيك'
      })
    });
    assert.strictEqual(response.status, 409);
    assert.strictEqual(Number((await db.getOne('SELECT COUNT(*) AS total FROM students')).total), 1);
    assert.strictEqual(Number((await db.getOne('SELECT COUNT(*) AS total FROM enrollments')).total), 1);
    console.log('Registration lead tests passed.');
  } finally {
    await new Promise(resolve => server.close(resolve));
    await db.closeDb();
    fs.rmSync(testDataDir, { recursive: true, force: true });
  }
}

runRegistrationLeadTest().catch(async error => {
  console.error(error);
  await db.closeDb();
  fs.rmSync(testDataDir, { recursive: true, force: true });
  process.exitCode = 1;
});
