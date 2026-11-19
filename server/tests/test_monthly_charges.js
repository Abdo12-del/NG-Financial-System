const assert = require('assert');
const express = require('express');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const os = require('os');
const path = require('path');

const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ng-monthly-charges-test-'));
process.env.DB_CONFIG_FILE = path.join(testDataDir, 'db_config.json');
process.env.SQLITE_FILE = path.join(testDataDir, 'ng_financial.db');
fs.writeFileSync(process.env.DB_CONFIG_FILE, JSON.stringify({ engine: 'sqlite' }));

const db = require('../db/connection');
const cohortsRouter = require('../routes/cohorts');
const studentsRouter = require('../routes/students');
const JWT_SECRET = process.env.JWT_SECRET || 'ng_financial_system_local_secret_key_2026';

async function runMonthlyChargesTest() {
  await db.initDb();
  const userResult = await db.execute(`
    INSERT INTO users (username, password_hash, full_name, role, is_active)
    VALUES ('monthly-charge-test', 'test-hash', 'Monthly Charge Test', 'admin', 1)
  `);
  const course = await db.execute(`INSERT INTO courses (name, default_price) VALUES ('Monthly Fee Test Course', 1000)`);
  const teacher = await db.execute(`INSERT INTO teachers (full_name) VALUES ('Monthly Fee Test Teacher')`);
  const cohort = await db.execute(`
    INSERT INTO cohorts (course_id, teacher_id, name, status)
    VALUES (?, ?, 'Monthly Fee Test Cohort', 'active')
  `, [course.insertId, teacher.insertId]);
  const firstStudent = await db.execute(`INSERT INTO students (full_name) VALUES ('Monthly Fee Student One')`);
  const secondStudent = await db.execute(`INSERT INTO students (full_name) VALUES ('Monthly Fee Student Two')`);
  const firstEnrollment = await db.execute(`
    INSERT INTO enrollments
      (student_id, cohort_id, agreed_price, net_price, paid_amount, remaining_amount, payment_status, enrollment_date)
    VALUES (?, ?, 1000, 1000, 0, 1000, 'UNPAID', date('now'))
  `, [firstStudent.insertId, cohort.insertId]);
  const secondEnrollment = await db.execute(`
    INSERT INTO enrollments
      (student_id, cohort_id, agreed_price, net_price, paid_amount, remaining_amount, payment_status, enrollment_date)
    VALUES (?, ?, 1000, 1000, 200, 800, 'PARTIAL', date('now'))
  `, [secondStudent.insertId, cohort.insertId]);
  const pendingStudent = await db.execute(`INSERT INTO students (full_name) VALUES ('Pending Confirmation Student')`);
  const pendingEnrollment = await db.execute(`
    INSERT INTO enrollments
      (student_id, cohort_id, agreed_price, net_price, paid_amount, remaining_amount, payment_status, confirmation_status, enrollment_date)
    VALUES (?, ?, 1200, 1200, 0, 1200, 'UNPAID', 'pending', date('now'))
  `, [pendingStudent.insertId, cohort.insertId]);

  const app = express();
  app.use(express.json());
  app.use('/api/cohorts', cohortsRouter);
  app.use('/api/students', studentsRouter);
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const url = `http://127.0.0.1:${server.address().port}/api/cohorts/cohorts/${cohort.insertId}/monthly-charges`;
  const studentsUrl = `http://127.0.0.1:${server.address().port}/api/students`;
  const adminToken = jwt.sign({ id: userResult.insertId, username: 'monthly-charge-test', role: 'admin' }, JWT_SECRET);
  const viewerToken = jwt.sign({ id: userResult.insertId, username: 'monthly-charge-test', role: 'viewer' }, JWT_SECRET);
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` };

  const postCharge = (body, requestHeaders = headers) => fetch(url, {
    method: 'POST',
    headers: requestHeaders,
    body: JSON.stringify(body)
  });
  const updateConfirmation = (status) => fetch(
    `${studentsUrl}/${pendingStudent.insertId}/enrollments/${pendingEnrollment.insertId}/confirmation`,
    { method: 'PUT', headers, body: JSON.stringify({ confirmationStatus: status }) }
  );

  try {
    const pendingOutstanding = await fetch(`${studentsUrl}/outstanding`, { headers });
    assert.strictEqual(pendingOutstanding.status, 200);
    const pendingOutstandingData = await pendingOutstanding.json();
    assert.ok(!pendingOutstandingData.outstanding.some(row => row.enrollment_id === pendingEnrollment.insertId));
    const pendingChargeResponse = await postCharge({
      enrollmentIds: [pendingEnrollment.insertId],
      month: '2026-11',
      amount: 1500
    });
    assert.strictEqual(pendingChargeResponse.status, 400);
    assert.strictEqual((await db.getOne(`SELECT remaining_amount FROM enrollments WHERE id = ?`, [pendingEnrollment.insertId])).remaining_amount, 1200);

    const confirmResponse = await updateConfirmation('confirmed');
    assert.strictEqual(confirmResponse.status, 200);
    const confirmedEnrollment = await db.getOne(`SELECT confirmation_status, billing_start_month FROM enrollments WHERE id = ?`, [pendingEnrollment.insertId]);
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    assert.deepStrictEqual([confirmedEnrollment.confirmation_status, confirmedEnrollment.billing_start_month], ['confirmed', currentMonth]);
    const pastMonth = `${now.getFullYear() - 1}-12`;
    const pastMonthChargeResponse = await postCharge({
      enrollmentIds: [pendingEnrollment.insertId],
      month: pastMonth,
      amount: 1500
    });
    assert.strictEqual(pastMonthChargeResponse.status, 400);

    const payload = {
      enrollmentIds: [firstEnrollment.insertId, secondEnrollment.insertId],
      month: '2026-11',
      amount: '1500'
    };
    const response = await postCharge(payload);
    assert.strictEqual(response.status, 201);
    assert.deepStrictEqual(
      (({ count, totalAmount }) => [count, totalAmount])(await response.json()),
      [2, 3000]
    );

    const first = await db.getOne(`SELECT agreed_price, net_price, paid_amount, remaining_amount, payment_status FROM enrollments WHERE id = ?`, [firstEnrollment.insertId]);
    const second = await db.getOne(`SELECT agreed_price, net_price, paid_amount, remaining_amount, payment_status FROM enrollments WHERE id = ?`, [secondEnrollment.insertId]);
    assert.deepStrictEqual(
      [first.agreed_price, first.net_price, first.paid_amount, first.remaining_amount, first.payment_status],
      [2500, 2500, 0, 2500, 'UNPAID']
    );
    assert.deepStrictEqual(
      [second.agreed_price, second.net_price, second.paid_amount, second.remaining_amount, second.payment_status],
      [2500, 2500, 200, 2300, 'PARTIAL']
    );
    assert.strictEqual((await db.getOne(`SELECT COUNT(*) AS total FROM monthly_enrollment_charges WHERE cohort_id = ? AND charge_month = ?`, [cohort.insertId, '2026-11'])).total, 2);

    const duplicateResponse = await postCharge(payload);
    assert.strictEqual(duplicateResponse.status, 409);
    assert.strictEqual((await db.getOne(`SELECT remaining_amount FROM enrollments WHERE id = ?`, [firstEnrollment.insertId])).remaining_amount, 2500);

    const invalidMonthResponse = await postCharge({ ...payload, month: '2026-13' });
    assert.strictEqual(invalidMonthResponse.status, 400);
    const invalidAmountResponse = await postCharge({ ...payload, month: '2026-12', amount: 10.001 });
    assert.strictEqual(invalidAmountResponse.status, 400);
    const viewerResponse = await postCharge(
      { ...payload, month: '2026-12' },
      { ...headers, Authorization: `Bearer ${viewerToken}` }
    );
    assert.strictEqual(viewerResponse.status, 403);
    assert.strictEqual((await db.getOne(`SELECT COUNT(*) AS total FROM monthly_enrollment_charges WHERE charge_month = ?`, ['2026-12'])).total, 0);

    const freezeResponse = await updateConfirmation('frozen');
    assert.strictEqual(freezeResponse.status, 200);
    const frozenChargeResponse = await postCharge({
      enrollmentIds: [pendingEnrollment.insertId],
      month: '2026-12',
      amount: 1500
    });
    assert.strictEqual(frozenChargeResponse.status, 400);
    assert.strictEqual((await db.getOne(`SELECT remaining_amount FROM enrollments WHERE id = ?`, [pendingEnrollment.insertId])).remaining_amount, 1200);
    const reactivateResponse = await updateConfirmation('confirmed');
    assert.strictEqual(reactivateResponse.status, 200);
    const reactivatedEnrollment = await db.getOne(`SELECT confirmation_status, billing_start_month FROM enrollments WHERE id = ?`, [pendingEnrollment.insertId]);
    assert.deepStrictEqual([reactivatedEnrollment.confirmation_status, reactivatedEnrollment.billing_start_month], ['confirmed', currentMonth]);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await db.closeDb();
    fs.rmSync(testDataDir, { recursive: true, force: true });
  }
}

runMonthlyChargesTest()
  .then(() => console.log('Monthly cohort charge tests passed.'))
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
