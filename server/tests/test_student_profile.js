const assert = require('assert');
const express = require('express');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const os = require('os');
const path = require('path');

const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ng-student-profile-test-'));
process.env.DB_CONFIG_FILE = path.join(testDataDir, 'db_config.json');
process.env.SQLITE_FILE = path.join(testDataDir, 'ng_financial.db');
fs.writeFileSync(process.env.DB_CONFIG_FILE, JSON.stringify({ engine: 'sqlite' }));

const db = require('../db/connection');
const FinancialLedger = require('../ledger/financialLedger');
const studentsRouter = require('../routes/students');
const JWT_SECRET = process.env.JWT_SECRET || 'ng_financial_system_local_secret_key_2026';

async function runStudentProfileTest() {
  await db.initDb();
  let user = await db.getOne(`SELECT id FROM users WHERE username = 'student-edit-test'`);
  if (!user) {
    const insertedUser = await db.execute(`
      INSERT INTO users (username, password_hash, full_name, role, is_active)
      VALUES ('student-edit-test', 'test-hash', 'Student Edit Test', 'admin', 1)
    `);
    user = { id: insertedUser.insertId };
  }
  const studentResult = await db.execute(`
    INSERT INTO students (full_name, phone, status)
    VALUES ('Before Edit', '0550000000', 'active')
  `);

  const app = express();
  app.use(express.json());
  app.use('/api/students', studentsRouter);
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/students/${studentResult.insertId}`;
  const studentsApiUrl = `http://127.0.0.1:${server.address().port}/api/students`;
  const adminToken = jwt.sign({ id: user.id, username: 'student-edit-test', role: 'admin' }, JWT_SECRET);
  const viewerToken = jwt.sign({ id: user.id, username: 'student-edit-test', role: 'viewer' }, JWT_SECRET);

  try {
    const response = await fetch(baseUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminToken },
      body: JSON.stringify({
        fullName: 'After Edit',
        phone: '0660000000',
        guardianPhone: '0770000000',
        email: 'student@example.com',
        notes: 'Corrected profile'
      })
    });
    assert.strictEqual(response.status, 200);

    const student = await db.getOne(`SELECT * FROM students WHERE id = ?`, [studentResult.insertId]);
    assert.deepStrictEqual(
      [student.full_name, student.phone, student.guardian_phone, student.email, student.notes],
      ['After Edit', '0660000000', '0770000000', 'student@example.com', 'Corrected profile']
    );
    assert.strictEqual((await db.getOne(`SELECT COUNT(*) as total FROM enrollments WHERE student_id = ?`, [studentResult.insertId])).total, 0);
    assert.strictEqual((await db.getOne(`SELECT COUNT(*) as total FROM audit_logs WHERE entity_name = 'students' AND entity_id = ? AND action_type = 'UPDATE'`, [studentResult.insertId])).total, 1);

    const invalidResponse = await fetch(baseUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminToken },
      body: JSON.stringify({ fullName: '  ' })
    });
    assert.strictEqual(invalidResponse.status, 400);

    const forbiddenResponse = await fetch(baseUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + viewerToken },
      body: JSON.stringify({ fullName: 'Unauthorized Edit' })
    });
    assert.strictEqual(forbiddenResponse.status, 403);

    const course = await db.execute(`INSERT INTO courses (name, default_price, status) VALUES ('Drop Test Course', 1000, 'active')`);
    const teacher = await db.execute(`INSERT INTO teachers (full_name, is_active) VALUES ('Drop Test Teacher', 1)`);
    const cohortWithoutPayment = await db.execute(`
      INSERT INTO cohorts (course_id, teacher_id, name, status)
      VALUES (?, ?, 'Unpaid Drop Cohort', 'active')
    `, [course.insertId, teacher.insertId]);
    const unpaidEnrollment = await db.execute(`
      INSERT INTO enrollments (student_id, cohort_id, agreed_price, net_price, paid_amount, remaining_amount, payment_status, enrollment_date)
      VALUES (?, ?, 1000, 1000, 0, 1000, 'UNPAID', date('now'))
    `, [studentResult.insertId, cohortWithoutPayment.insertId]);
    const dropResponse = await fetch(`${baseUrl}/enrollments/${unpaidEnrollment.insertId}/drop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminToken },
      body: JSON.stringify({ reason: 'Student was not enrolled in this cohort' })
    });
    assert.strictEqual(dropResponse.status, 200);
    assert.strictEqual((await dropResponse.json()).studentRetained, true);
    assert.ok(await db.getOne(`SELECT id FROM students WHERE id = ?`, [studentResult.insertId]));
    assert.strictEqual((await db.getOne(`SELECT status FROM enrollments WHERE id = ?`, [unpaidEnrollment.insertId])).status, 'dropped');
    assert.strictEqual((await db.getOne(`SELECT action_type FROM audit_logs WHERE entity_name = 'enrollments' AND entity_id = ?`, [unpaidEnrollment.insertId])).action_type, 'DELETE');

    const cohortWithPayment = await db.execute(`
      INSERT INTO cohorts (course_id, teacher_id, name, status)
      VALUES (?, ?, 'Paid Drop Cohort', 'active')
    `, [course.insertId, teacher.insertId]);
    const paidEnrollment = await db.execute(`
      INSERT INTO enrollments (student_id, cohort_id, agreed_price, net_price, paid_amount, remaining_amount, payment_status, enrollment_date)
      VALUES (?, ?, 1000, 1000, 0, 1000, 'UNPAID', date('now'))
    `, [studentResult.insertId, cohortWithPayment.insertId]);
    await FinancialLedger.recordStudentPayment({ enrollmentId: paidEnrollment.insertId, amount: 100, paymentMethodId: 1 });
    const blockedDropResponse = await fetch(`${baseUrl}/enrollments/${paidEnrollment.insertId}/drop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminToken },
      body: JSON.stringify({ reason: 'Test payment guard' })
    });
    assert.strictEqual(blockedDropResponse.status, 400);
    assert.strictEqual((await db.getOne(`SELECT status FROM enrollments WHERE id = ?`, [paidEnrollment.insertId])).status, 'enrolled');

    const secondStudent = await db.execute(`INSERT INTO students (full_name, status) VALUES ('Batch Transfer Student', 'active')`);
    const secondEnrollment = await db.execute(`
      INSERT INTO enrollments (student_id, cohort_id, agreed_price, net_price, paid_amount, remaining_amount, payment_status, enrollment_date)
      VALUES (?, ?, 1000, 1000, 0, 1000, 'UNPAID', date('now'))
    `, [secondStudent.insertId, cohortWithoutPayment.insertId]);
    const destinationCohort = await db.execute(`
      INSERT INTO cohorts (course_id, teacher_id, name, status, max_students)
      VALUES (?, ?, 'Transfer Destination', 'active', 2)
    `, [course.insertId, teacher.insertId]);
    const transferResponse = await fetch(`${studentsApiUrl}/enrollments/transfer`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminToken },
      body: JSON.stringify({
        enrollmentIds: [paidEnrollment.insertId, secondEnrollment.insertId],
        cohortId: destinationCohort.insertId
      })
    });
    assert.strictEqual(transferResponse.status, 200);
    assert.strictEqual((await transferResponse.json()).transferred, 2);
    assert.deepStrictEqual(
      (await db.getOne(`SELECT cohort_id, paid_amount, remaining_amount FROM enrollments WHERE id = ?`, [paidEnrollment.insertId])),
      { cohort_id: destinationCohort.insertId, paid_amount: 100, remaining_amount: 900 }
    );
    assert.strictEqual(
      Number((await db.getOne(`SELECT cohort_id FROM payments WHERE enrollment_id = ?`, [paidEnrollment.insertId])).cohort_id),
      Number(destinationCohort.insertId)
    );
    assert.strictEqual(
      Number((await db.getOne(`SELECT cohort_id FROM financial_ledger WHERE source_table = 'payments' AND source_id = (SELECT id FROM payments WHERE enrollment_id = ?)`, [paidEnrollment.insertId])).cohort_id),
      Number(destinationCohort.insertId)
    );
    assert.strictEqual(
      Number((await db.getOne(`SELECT COUNT(*) AS total FROM audit_logs WHERE entity_name = 'enrollments' AND action_type = 'UPDATE' AND entity_id IN (?, ?)`, [paidEnrollment.insertId, secondEnrollment.insertId])).total),
      2
    );
    const fullCohort = await db.execute(`
      INSERT INTO cohorts (course_id, teacher_id, name, status, max_students)
      VALUES (?, ?, 'Full Transfer Cohort', 'active', 1)
    `, [course.insertId, teacher.insertId]);
    const capacityStudent = await db.execute(`INSERT INTO students (full_name, status) VALUES ('Capacity Student', 'active')`);
    await db.execute(`
      INSERT INTO enrollments (student_id, cohort_id, agreed_price, net_price, paid_amount, remaining_amount, payment_status, enrollment_date)
      VALUES (?, ?, 1000, 1000, 0, 1000, 'UNPAID', date('now'))
    `, [capacityStudent.insertId, fullCohort.insertId]);
    const fullCohortResponse = await fetch(`${studentsApiUrl}/enrollments/transfer`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminToken },
      body: JSON.stringify({
        enrollmentIds: [paidEnrollment.insertId, secondEnrollment.insertId],
        cohortId: fullCohort.insertId
      })
    });
    assert.strictEqual(fullCohortResponse.status, 400);
    assert.strictEqual(
      Number((await db.getOne(`SELECT cohort_id FROM enrollments WHERE id = ?`, [paidEnrollment.insertId])).cohort_id),
      Number(destinationCohort.insertId)
    );

    const protectedDeleteResponse = await fetch(baseUrl, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminToken },
      body: JSON.stringify({ reason: 'Should preserve financial history' })
    });
    assert.strictEqual(protectedDeleteResponse.status, 400);
    assert.ok(await db.getOne(`SELECT id FROM students WHERE id = ?`, [studentResult.insertId]));

    const unusedStudent = await db.execute(`INSERT INTO students (full_name, status) VALUES ('Unused Student', 'active')`);
    const deleteUnusedResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/students/${unusedStudent.insertId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminToken },
      body: JSON.stringify({ reason: 'Created by mistake and never enrolled' })
    });
    assert.strictEqual(deleteUnusedResponse.status, 200);
    assert.strictEqual(await db.getOne(`SELECT id FROM students WHERE id = ?`, [unusedStudent.insertId]), null);
    assert.strictEqual((await db.getOne(`SELECT action_type FROM audit_logs WHERE entity_name = 'students' AND entity_id = ?`, [unusedStudent.insertId])).action_type, 'DELETE');
    console.log('Student profile edit tests passed.');
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

runStudentProfileTest()
  .catch((error) => {
    console.error('Student profile edit tests failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.closeDb();
    fs.rmSync(testDataDir, { recursive: true, force: true });
  });