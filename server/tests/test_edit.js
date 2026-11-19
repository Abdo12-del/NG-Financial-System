const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ng-financial-edit-test-'));
process.env.DB_CONFIG_FILE = path.join(testDataDir, 'db_config.json');
process.env.SQLITE_FILE = path.join(testDataDir, 'ng_financial.db');
fs.writeFileSync(process.env.DB_CONFIG_FILE, JSON.stringify({ engine: 'sqlite' }));

const db = require('../db/connection');
const FinancialLedger = require('../ledger/financialLedger');

async function runEditTest() {
  await db.initDb();

  const course = await db.execute(`INSERT INTO courses (name, default_price, status) VALUES ('Edit Test Course', 1000, 'active')`);
  const teacher = await db.execute(`INSERT INTO teachers (full_name, is_active) VALUES ('Edit Test Teacher', 1)`);
  const cohort = await db.execute(`
    INSERT INTO cohorts (course_id, teacher_id, name, compensation_type, compensation_value, status)
    VALUES (?, ?, 'Edit Test Cohort', 'PERCENTAGE', 60, 'active')
  `, [course.insertId, teacher.insertId]);
  const student = await db.execute(`INSERT INTO students (full_name, status) VALUES ('Edit Test Student', 'active')`);
  const enrollment = await db.execute(`
    INSERT INTO enrollments (student_id, cohort_id, agreed_price, net_price, paid_amount, remaining_amount, payment_status, enrollment_date)
    VALUES (?, ?, 1000, 1000, 0, 1000, 'UNPAID', date('now'))
  `, [student.insertId, cohort.insertId]);

  const payment = await FinancialLedger.recordStudentPayment({
    enrollmentId: enrollment.insertId,
    amount: 400,
    paymentMethodId: 1,
    userId: 1,
    username: 'admin'
  });
  await FinancialLedger.editTransaction({
    type: 'payment', id: payment.paymentId, amount: 250, transactionDate: '2026-10-03',
    paymentMethodId: 1, referenceNo: 'EDIT-PAY', notes: 'Corrected payment', reason: 'Test correction',
    userId: 1, username: 'admin'
  });

  const editedEnrollment = await db.getOne(`SELECT paid_amount, remaining_amount, payment_status FROM enrollments WHERE id = ?`, [enrollment.insertId]);
  const editedPaymentLedger = await db.getOne(`SELECT debit_amount FROM financial_ledger WHERE source_table = 'payments' AND source_id = ? AND is_voided = 0`, [payment.paymentId]);
  assert.deepStrictEqual([editedEnrollment.paid_amount, editedEnrollment.remaining_amount, editedEnrollment.payment_status], [250, 750, 'PARTIAL']);
  assert.strictEqual(editedPaymentLedger.debit_amount, 250);

  const expense = await FinancialLedger.recordExpense({
    categoryId: 2, amount: 100, description: 'Expense before edit', paymentMethodId: 1, userId: 1, username: 'admin'
  });
  await FinancialLedger.editTransaction({
    type: 'expense', id: expense.expenseId, amount: 50, transactionDate: '2026-10-03',
    paymentMethodId: 1, description: 'Expense after edit', referenceNo: 'EDIT-EXP', notes: '', reason: 'Test correction',
    userId: 1, username: 'admin'
  });

  const ownerContribution = await FinancialLedger.recordOwnerTransaction({
    transactionType: 'CONTRIBUTION', amount: 80, paymentMethodId: 1, userId: 1, username: 'admin'
  });
  await FinancialLedger.editTransaction({
    type: 'owner_transaction', id: ownerContribution.ownerTxId, amount: 40, transactionDate: '2026-10-03',
    paymentMethodId: 1, notes: 'Corrected contribution', reason: 'Test correction', userId: 1, username: 'admin'
  });

  const ownerWithdrawal = await FinancialLedger.recordOwnerTransaction({
    transactionType: 'WITHDRAWAL', amount: 20, paymentMethodId: 1, userId: 1, username: 'admin'
  });
  await FinancialLedger.editTransaction({
    type: 'owner_transaction', id: ownerWithdrawal.ownerTxId, amount: 10, transactionDate: '2026-10-03',
    paymentMethodId: 1, notes: 'Corrected withdrawal', reason: 'Test correction', userId: 1, username: 'admin'
  });

  const metrics = await FinancialLedger.getDashboardMetrics();
  assert.strictEqual(metrics.totalRevenue, 250);
  assert.strictEqual(metrics.totalExpenses, 50);
  assert.strictEqual(metrics.netProfit, 200);
  assert.strictEqual(metrics.studentOutstanding, 750);
  assert.strictEqual(metrics.teacherPayables, 150);
  assert.strictEqual(metrics.totalOwnerContributions, 40);
  assert.strictEqual(metrics.totalOwnerWithdrawals, 10);
  assert.strictEqual(metrics.currentCashBalance, 230);

  const updateAudits = await db.getOne(`SELECT COUNT(*) as total FROM audit_logs WHERE action_type = 'UPDATE'`);
  assert.strictEqual(Number(updateAudits.total), 4);
  console.log('Transaction edit tests passed.');
}

runEditTest()
  .catch((error) => {
    console.error('Transaction edit tests failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.closeDb();
    fs.rmSync(testDataDir, { recursive: true, force: true });
  });