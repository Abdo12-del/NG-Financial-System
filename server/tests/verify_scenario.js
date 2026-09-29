const db = require('../db/connection');
const FinancialLedger = require('../ledger/financialLedger');

async function runScenarioTest() {
  console.log('--- Starting Verification of NG Financial System Core Accounting Scenario ---');
  await db.initDb();

  // Reset test tables in SQLite for clean scenario test
  const sqlite = db.getSqliteDb();
  sqlite.exec(`
    DELETE FROM audit_logs;
    DELETE FROM financial_ledger;
    DELETE FROM teacher_compensations;
    DELETE FROM payments;
    DELETE FROM expenses;
    DELETE FROM owner_transactions;
    DELETE FROM enrollments;
    DELETE FROM students;
    DELETE FROM cohorts;
    DELETE FROM courses;
    DELETE FROM teachers;
    UPDATE financial_accounts SET balance = 0;
  `);

  console.log('1. Adding Test Course, Teacher, Cohort, and Student...');
  // Add course
  const courseRes = await db.execute(`
    INSERT INTO courses (name, default_price, age_group, duration, description, status)
    VALUES ('دورة البرمجة الاحترافية', 4000.00, 'الشباب والناشئة', '3 أشهر', 'برمجة وتطوير', 'active')
  `);
  const courseId = courseRes.insertId;

  // Add teacher
  const teacherRes = await db.execute(`
    INSERT INTO teachers (full_name, phone, email, specialty, is_active)
    VALUES ('الأستاذ أحمد أمين', '0555123456', 'amine@ngacademy.dz', 'علوم الحاسوب', 1)
  `);
  const teacherId = teacherRes.insertId;

  // Add cohort with 60% compensation
  const cohortRes = await db.execute(`
    INSERT INTO cohorts (course_id, teacher_id, name, compensation_type, compensation_value, status)
    VALUES (?, ?, 'فوج المطورين A1', 'PERCENTAGE', 60.00, 'active')
  `, [courseId, teacherId]);
  const cohortId = cohortRes.insertId;

  // Add student
  const studentRes = await db.execute(`
    INSERT INTO students (full_name, phone, email, status)
    VALUES ('ياسين عبد القادر', '0666789012', 'yacine@example.com', 'active')
  `);
  const studentId = studentRes.insertId;

  // Add enrollment
  const enrollRes = await db.execute(`
    INSERT INTO enrollments (student_id, cohort_id, agreed_price, net_price, paid_amount, remaining_amount, payment_status, enrollment_date)
    VALUES (?, ?, 4000.00, 4000.00, 0.00, 4000.00, 'UNPAID', date('now'))
  `, [studentId, cohortId]);
  const enrollmentId = enrollRes.insertId;

  console.log('2. Step 1: Owner contributes 50,000 DZD (ضخ سيولة شخصية)...');
  await FinancialLedger.recordOwnerTransaction({
    transactionType: 'CONTRIBUTION',
    amount: 50000.00,
    paymentMethodId: 1, // Cash safe
    notes: 'تمويل أولي وتشغيل'
  });

  console.log('3. Step 2: Student pays 4,000 DZD for the course (تسجيل ودفع الطالب)...');
  const payResult = await FinancialLedger.recordStudentPayment({
    enrollmentId,
    amount: 4000.00,
    paymentMethodId: 1,
    notes: 'دفع كامل رسوم الدورة'
  });
  console.log(`   Teacher Share accrued: ${payResult.teacherShare} DZD (Expected: 2400.00 DZD)`);

  console.log('4. Step 3: Academy pays 5,000 DZD for advertising (مصروف إعلانات)...');
  await FinancialLedger.recordExpense({
    categoryId: 2, // الإعلانات
    amount: 5000.00,
    description: 'حملة إعلانات فيسبوك وإنستغرام',
    paymentMethodId: 1
  });

  console.log('5. Step 4: Owner withdraws 10,000 DZD (سحب شخصي للمالك)...');
  await FinancialLedger.recordOwnerTransaction({
    transactionType: 'WITHDRAWAL',
    amount: 10000.00,
    paymentMethodId: 1,
    notes: 'سحب أرباح جزئي للمالك'
  });

  console.log('6. Evaluating Financial Metrics...');
  const metrics = await FinancialLedger.getDashboardMetrics();
  console.log('\n================ ACTUAL SYSTEM OUTPUT ================');
  console.log(`Total Operating Revenue (الإيرادات التشغيلية)   : ${metrics.totalRevenue} DZD (Expected: 4,000 DZD)`);
  console.log(`Total Operating Expenses (المصروفات التشغيلية) : ${metrics.totalExpenses} DZD (Expected: 5,000 DZD)`);
  console.log(`Net Operating Profit (صافي الربح التشغيلي)     : ${metrics.netProfit} DZD (Expected: -1,000 DZD)`);
  console.log(`Current Cash Balance (الرصيد النقدي الحالي)    : ${metrics.currentCashBalance} DZD (Expected: 39,000 DZD)`);
  console.log(`Owner Contributions (إجمالي ضخ المالك)          : ${metrics.totalOwnerContributions} DZD (Expected: 50,000 DZD)`);
  console.log(`Owner Withdrawals (إجمالي سحب المالك)          : ${metrics.totalOwnerWithdrawals} DZD (Expected: 10,000 DZD)`);
  console.log(`Owner Balance (الرصيد المستحق للمالك)          : ${metrics.ownerBalance} DZD (Expected: 40,000 DZD)`);
  console.log(`Teacher Payables (مستحقات الأساتذة)            : ${metrics.teacherPayables} DZD (Expected: 2,400 DZD)`);
  console.log(`Student Outstanding (المتبقي على الطلاب)       : ${metrics.studentOutstanding} DZD (Expected: 0 DZD)`);
  console.log('======================================================\n');

  // Assertions
  const asserts = [
    { label: 'Revenue matches 4000', ok: metrics.totalRevenue === 4000 },
    { label: 'Expenses match 5000', ok: metrics.totalExpenses === 5000 },
    { label: 'Net Profit is -1000', ok: metrics.netProfit === -1000 },
    { label: 'Cash Balance is 39000 (50k in + 4k in - 5k out - 10k out)', ok: metrics.currentCashBalance === 39000 },
    { label: 'Owner Balance is 40000 (50k - 10k)', ok: metrics.ownerBalance === 40000 },
    { label: 'Teacher Payables is 2400 (60% of 4000)', ok: metrics.teacherPayables === 2400 },
    { label: 'Student Outstanding is 0', ok: metrics.studentOutstanding === 0 }
  ];

  let allPassed = true;
  for (const a of asserts) {
    if (a.ok) {
      console.log(`✅ [PASS] ${a.label}`);
    } else {
      console.error(`❌ [FAIL] ${a.label}`);
      allPassed = false;
    }
  }

  if (allPassed) {
    console.log('\n🎉 ALL FINANCIAL ACCOUNTING RULES AND FORMULAS VERIFIED 100% ACCURATE!');
  } else {
    process.exit(1);
  }
}

runScenarioTest().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
