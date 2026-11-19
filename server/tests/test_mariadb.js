const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ng-financial-mariadb-test-'));
const dbConfigFile = path.join(testDataDir, 'db_config.json');
const sqliteFile = path.join(testDataDir, 'ng_financial.db');
const mariaDataDir = path.join(testDataDir, 'mariadb');
const mariaPort = 34000 + Math.floor(Math.random() * 10000);

process.env.DB_CONFIG_FILE = dbConfigFile;
process.env.SQLITE_FILE = sqliteFile;

const db = require('../db/connection');
const FinancialLedger = require('../ledger/financialLedger');

async function createSqliteScenario() {
  fs.writeFileSync(dbConfigFile, JSON.stringify({ engine: 'sqlite' }));
  await db.initDb();

  const course = await db.execute(`
    INSERT INTO courses (name, default_price, status)
    VALUES ('Migration Course', 1000, 'active')
  `);
  const teacher = await db.execute(`
    INSERT INTO teachers (full_name, is_active)
    VALUES ('Migration Teacher', 1)
  `);
  const cohort = await db.execute(`
    INSERT INTO cohorts (course_id, teacher_id, name, status)
    VALUES (?, ?, 'Migration Cohort', 'active')
  `, [course.insertId, teacher.insertId]);
  const student = await db.execute(`
    INSERT INTO students (full_name, phone, status)
    VALUES ('Migration Student', '0550000000', 'active')
  `);
  const enrollment = await db.execute(`
    INSERT INTO enrollments (student_id, cohort_id, agreed_price, net_price, paid_amount, remaining_amount, payment_status, enrollment_date)
    VALUES (?, ?, 1000, 1000, 0, 1000, 'UNPAID', date('now'))
  `, [student.insertId, cohort.insertId]);

  await FinancialLedger.recordStudentPayment({
    enrollmentId: enrollment.insertId,
    amount: 100,
    paymentMethodId: 1,
    notes: 'Pre-migration payment'
  });
  await db.execute(`
    INSERT INTO marketing_campaigns (
      name, platform, budget, spent_amount, conversation_count,
      registration_count, confirmed_count, attended_count
    ) VALUES ('Migration Campaign', 'Instagram', 5000, 3200, 32, 12, 8, 6)
  `);
  const campaign = await db.getOne("SELECT id FROM marketing_campaigns WHERE name = 'Migration Campaign'");
  await db.execute(`
    INSERT INTO marketing_campaign_followups (
      campaign_id, followup_date, spent_amount, conversation_count,
      registration_count, confirmed_count, attended_count, notes
    ) VALUES (?, '2026-10-01', 3200, 32, 12, 8, 6, 'Pre-migration follow-up')
  `, [campaign.id]);
}

async function runMariaDbMigrationTest() {
  if (process.platform !== 'win32') {
    throw new Error('This integration test requires the bundled Windows MariaDB binaries.');
  }

  await createSqliteScenario();
  await db.closeDb();

  fs.writeFileSync(dbConfigFile, JSON.stringify({
    engine: 'mariadb',
    bundled: true,
    dataDir: mariaDataDir,
    host: '127.0.0.1',
    port: mariaPort,
    user: 'root',
    database: 'ng_financial'
  }));

  assert.strictEqual(await db.initDb(), 'mariadb');
  assert.ok(fs.existsSync(sqliteFile), 'SQLite source must remain after migration');

  const counts = await db.getOne(`
    SELECT
      (SELECT COUNT(*) FROM students) as students,
      (SELECT COUNT(*) FROM enrollments) as enrollments,
      (SELECT COUNT(*) FROM payments) as payments,
      (SELECT COUNT(*) FROM financial_ledger) as ledger_entries,
      (SELECT COUNT(*) FROM marketing_campaigns) as campaigns,
      (SELECT COUNT(*) FROM marketing_campaign_followups) as campaign_followups
  `);
  assert.deepStrictEqual(
    [Number(counts.students), Number(counts.enrollments), Number(counts.payments)],
    [1, 1, 1]
  );
  assert.ok(Number(counts.ledger_entries) > 0, 'Financial ledger entries must be migrated');
  assert.strictEqual(Number(counts.campaigns), 1, 'Marketing campaigns must be migrated');
  assert.strictEqual(Number(counts.campaign_followups), 1, 'Marketing campaign follow-ups must be migrated');
  const migratedCampaign = await db.getOne('SELECT name, spent_amount, attended_count FROM marketing_campaigns LIMIT 1');
  assert.deepStrictEqual(
    [migratedCampaign.name, Number(migratedCampaign.spent_amount), Number(migratedCampaign.attended_count)],
    ['Migration Campaign', 3200, 6]
  );

  const migratedEnrollment = await db.getOne(`SELECT id FROM enrollments LIMIT 1`);
  await FinancialLedger.recordStudentPayment({
    enrollmentId: migratedEnrollment.id,
    amount: 50,
    paymentMethodId: 1,
    notes: 'Post-migration payment'
  });

  await assert.rejects(() => FinancialLedger.recordStudentPayment({
    enrollmentId: migratedEnrollment.id,
    amount: 1000,
    paymentMethodId: 1
  }), /أكبر من المبلغ المتبقي/);

  await FinancialLedger.recordStudentPayment({
    enrollmentId: migratedEnrollment.id,
    amount: 1000,
    paymentMethodId: 1,
    allowOverpayment: true,
    notes: 'Two installments paid together'
  });

  await FinancialLedger.recordExpense({
    categoryId: 2,
    amount: 25,
    description: 'Post-migration expense',
    paymentMethodId: 1
  });
  await FinancialLedger.recordOwnerTransaction({
    transactionType: 'CONTRIBUTION',
    amount: 10,
    paymentMethodId: 1,
    notes: 'Post-migration contribution'
  });

  const migratedPaymentTotal = await db.getOne(`SELECT SUM(amount) as total FROM payments WHERE student_id = 1`);
  assert.strictEqual(Number(migratedPaymentTotal.total), 1150);

  const metrics = await FinancialLedger.getDashboardMetrics();
  assert.strictEqual(metrics.totalRevenue, 1150);
  assert.strictEqual(metrics.totalExpenses, 25);
  assert.strictEqual(metrics.totalOwnerContributions, 10);
  assert.strictEqual(metrics.currentCashBalance, 1135);

  const monthStart = await db.getOne(`SELECT date('now', '-11 months', 'start of month') as value`);
  assert.ok(/^\d{4}-\d{2}-01$/.test(monthStart.value));

  const upsertSql = `INSERT INTO settings (key_name, value_data, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON DUPLICATE KEY UPDATE value_data = VALUES(value_data), updated_at = CURRENT_TIMESTAMP`;
  await db.execute(upsertSql, ['mariadb_test', 'first']);
  await db.execute(upsertSql, ['mariadb_test', 'ok']);
  const setting = await db.getOne(`SELECT value_data FROM settings WHERE key_name = ?`, ['mariadb_test']);
  assert.strictEqual(setting.value_data, 'ok');

  console.log('MariaDB migration and payment integration test passed.');
}

runMariaDbMigrationTest()
  .catch(error => {
    console.error('MariaDB integration test failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.closeDb();
    fs.rmSync(testDataDir, { recursive: true, force: true });
  });