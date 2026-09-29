const db = require('./connection');
const FinancialLedger = require('../ledger/financialLedger');

async function seedMockupData() {
  await db.initDb();

  console.log('Seeding exact mockup data matching screenshot...');

  const sqlite = db.getSqliteDb();
  // Clear tables for perfect alignment with user's mockup screenshot
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

  // Ensure user Abdelkader Ammari exists
  await db.execute(`
    INSERT OR REPLACE INTO users (id, username, password_hash, full_name, role, is_active)
    VALUES (1, 'admin', '$2b$10$j914DCkfbxNPVuBG1CgOgu2ZlzfYf4TrTndTSrwmwJ/5bz28Nb1Ha', 'Abdelkader Ammari', 'admin', 1)
  `);

  // Courses
  const c1 = await db.execute(`
    INSERT INTO courses (name, default_price, age_group, duration, description, status)
    VALUES ('الكاتب الصغير', 8000.00, 'الناشئة والأطفال', 'شهرين', 'تنمية مهارات التعبير والكتابة الإبداعية', 'active')
  `);
  const c2 = await db.execute(`
    INSERT INTO courses (name, default_price, age_group, duration, description, status)
    VALUES ('المتحدث الصغير', 10000.00, 'الأطفال', 'شهرين', 'فنون الإلقاء والخطابة وبناء الثقة', 'active')
  `);
  const c3 = await db.execute(`
    INSERT INTO courses (name, default_price, age_group, duration, description, status)
    VALUES ('English A1/A2', 12000.00, 'الجميع', '3 أشهر', 'تعلم المحادثة الإنجليزية والقواعد', 'active')
  `);
  const c4 = await db.execute(`
    INSERT INTO courses (name, default_price, age_group, duration, description, status)
    VALUES ('صيف المعرفة', 6000.00, 'الناشئة', 'شهر مكثف', 'أنشطة علمية ومهارات روبوتيكس', 'active')
  `);

  // Teachers
  const t1 = await db.execute(`
    INSERT INTO teachers (full_name, phone, email, specialty, notes)
    VALUES ('أ. هناء خضري', '0555987654', 'hana@ngacademy.dz', 'لغة عربية وكتابة إبداعية', 'مؤطرة دورة الكاتب الصغير')
  `);
  const t2 = await db.execute(`
    INSERT INTO teachers (full_name, phone, email, specialty, notes)
    VALUES ('أ. هشام بوسعيد', '0666543210', 'hichem@ngacademy.dz', 'فنون الإلقاء والصوت', 'مؤطر دورة المتحدث الصغير')
  `);
  const t3 = await db.execute(`
    INSERT INTO teachers (full_name, phone, email, specialty, notes)
    VALUES ('أ. فاطمة الزهراء', '0777123456', 'fatima@ngacademy.dz', 'اللغة الإنجليزية', 'مؤطرة دورة English A1/A2')
  `);

  // Cohorts
  const coh1 = await db.execute(`
    INSERT INTO cohorts (course_id, teacher_id, name, start_date, end_date, max_students, compensation_type, compensation_value, status)
    VALUES (?, ?, 'الكاتب الصغير - الفوج 1', '2025-09-01', '2025-10-31', 20, 'PERCENTAGE', 60.00, 'active')
  `, [c1.insertId, t1.insertId]);

  const coh2 = await db.execute(`
    INSERT INTO cohorts (course_id, teacher_id, name, start_date, end_date, max_students, compensation_type, compensation_value, status)
    VALUES (?, ?, 'المتحدث الصغير - الفوج 2', '2025-09-05', '2025-11-05', 18, 'PERCENTAGE', 60.00, 'active')
  `, [c2.insertId, t2.insertId]);

  const coh3 = await db.execute(`
    INSERT INTO cohorts (course_id, teacher_id, name, start_date, end_date, max_students, compensation_type, compensation_value, status)
    VALUES (?, ?, 'English A1/A2 - الفوج 2', '2025-09-10', '2025-12-10', 25, 'PERCENTAGE', 50.00, 'active')
  `, [c3.insertId, t3.insertId]);

  // Initial Owner Contribution (ضخ المالك لتمويل الخزينة: 42,800 DZD)
  await FinancialLedger.recordOwnerTransaction({
    transactionType: 'CONTRIBUTION',
    amount: 40000.00,
    transactionDate: '2025-09-01',
    paymentMethodId: 1,
    notes: 'ضخ سيولة المالك التأسيسية'
  });

  // Students & Payments to reach exactly Total Revenue = 48,000 DZD and Student Outstanding = 8,000 DZD
  // Student 1: أميرة خير (Course 8000, paid 8000)
  const s1 = await db.execute(`INSERT INTO students (full_name, phone, status) VALUES ('أميرة خير', '0551112233', 'active')`);
  const enr1 = await db.execute(`
    INSERT INTO enrollments (student_id, cohort_id, agreed_price, net_price, paid_amount, remaining_amount, payment_status, enrollment_date)
    VALUES (?, ?, 8000.00, 8000.00, 0.00, 8000.00, 'UNPAID', '2025-09-02')
  `, [s1.insertId, coh1.insertId]);
  await FinancialLedger.recordStudentPayment({
    enrollmentId: enr1.insertId,
    amount: 8000.00,
    paymentDate: '2025-09-28',
    paymentMethodId: 3, // تحويل بنكي
    referenceNo: 'TXN-BANK-0928',
    notes: 'دفع من الطالب: أميرة خير'
  });

  // Student 2: قصي (Course 12000, paid 12000)
  const s2 = await db.execute(`INSERT INTO students (full_name, phone, status) VALUES ('قصي بن عامر', '0662223344', 'active')`);
  const enr2 = await db.execute(`
    INSERT INTO enrollments (student_id, cohort_id, agreed_price, net_price, paid_amount, remaining_amount, payment_status, enrollment_date)
    VALUES (?, ?, 12000.00, 12000.00, 0.00, 12000.00, 'UNPAID', '2025-09-03')
  `, [s2.insertId, coh3.insertId]);
  await FinancialLedger.recordStudentPayment({
    enrollmentId: enr2.insertId,
    amount: 12000.00,
    paymentDate: '2025-09-25',
    paymentMethodId: 1, // نقداً
    referenceNo: 'REC-0925',
    notes: 'دفع من الطالب: قصي'
  });

  // Student 3: يوسف (Course 10000, paid 10000)
  const s3 = await db.execute(`INSERT INTO students (full_name, phone, status) VALUES ('يوسف طاهري', '0773334455', 'active')`);
  const enr3 = await db.execute(`
    INSERT INTO enrollments (student_id, cohort_id, agreed_price, net_price, paid_amount, remaining_amount, payment_status, enrollment_date)
    VALUES (?, ?, 10000.00, 10000.00, 0.00, 10000.00, 'UNPAID', '2025-09-04')
  `, [s3.insertId, coh2.insertId]);
  await FinancialLedger.recordStudentPayment({
    enrollmentId: enr3.insertId,
    amount: 10000.00,
    paymentDate: '2025-09-20',
    paymentMethodId: 4, // تحويل إلكتروني
    referenceNo: 'BARIDI-0920',
    notes: 'دفع من الطالب: يوسف طاهري'
  });

  // Student 4: لينة (Course 10000, paid 10000)
  const s4 = await db.execute(`INSERT INTO students (full_name, phone, status) VALUES ('لينة بلحاج', '0554445566', 'active')`);
  const enr4 = await db.execute(`
    INSERT INTO enrollments (student_id, cohort_id, agreed_price, net_price, paid_amount, remaining_amount, payment_status, enrollment_date)
    VALUES (?, ?, 10000.00, 10000.00, 0.00, 10000.00, 'UNPAID', '2025-09-05')
  `, [s4.insertId, coh2.insertId]);
  await FinancialLedger.recordStudentPayment({
    enrollmentId: enr4.insertId,
    amount: 10000.00,
    paymentDate: '2025-09-18',
    paymentMethodId: 2, // CCP
    referenceNo: 'CCP-0918',
    notes: 'دفع من الطالب: لينة بلحاج'
  });

  // Student 5: مريم (Course 8000, paid 8000)
  const s5 = await db.execute(`INSERT INTO students (full_name, phone, status) VALUES ('مريم رحماني', '0665556677', 'active')`);
  const enr5 = await db.execute(`
    INSERT INTO enrollments (student_id, cohort_id, agreed_price, net_price, paid_amount, remaining_amount, payment_status, enrollment_date)
    VALUES (?, ?, 8000.00, 8000.00, 0.00, 8000.00, 'UNPAID', '2025-09-06')
  `, [s5.insertId, coh1.insertId]);
  await FinancialLedger.recordStudentPayment({
    enrollmentId: enr5.insertId,
    amount: 8000.00,
    paymentDate: '2025-09-15',
    paymentMethodId: 1, // نقداً
    referenceNo: 'REC-0915',
    notes: 'دفع من الطالب: مريم رحماني'
  });

  // Student 6: أحمد (Course 8000, paid 0, remaining 8000 -> Student Outstanding = 8000 DZD!)
  const s6 = await db.execute(`INSERT INTO students (full_name, phone, status) VALUES ('أحمد بوزيان', '0776667788', 'active')`);
  await db.execute(`
    INSERT INTO enrollments (student_id, cohort_id, agreed_price, net_price, paid_amount, remaining_amount, payment_status, enrollment_date)
    VALUES (?, ?, 8000.00, 8000.00, 0.00, 8000.00, 'UNPAID', '2025-09-07')
  `, [s6.insertId, coh1.insertId]);

  // Expenses totaling 18,500 DZD:
  // 1. أجر الأستاذة هناء خضري (4,500 DZD)
  await FinancialLedger.recordExpense({
    categoryId: 1, // أجور الأساتذة
    amount: 4500.00,
    expenseDate: '2025-09-27',
    description: 'أجر الأستاذة هناء خضري',
    paymentMethodId: 2, // CCP
    cohortId: coh1.insertId,
    teacherId: t1.insertId
  });

  // 2. إعلانات فيسبوك (6,000 DZD)
  await FinancialLedger.recordExpense({
    categoryId: 2, // الإعلانات
    amount: 6000.00,
    expenseDate: '2025-09-26',
    description: 'إعلانات فيسبوك',
    paymentMethodId: 4 // تحويل إلكتروني
  });

  // 3. المعدات الصغيرة (4,000 DZD)
  await FinancialLedger.recordExpense({
    categoryId: 5, // المعدات
    amount: 4000.00,
    expenseDate: '2025-09-14',
    description: 'المعدات الصغيرة ومستلزمات الورشات',
    paymentMethodId: 1 // نقداً
  });

  // 4. خدمات ومنصات (2,500 DZD)
  await FinancialLedger.recordExpense({
    categoryId: 3, // المنصات والخدمات
    amount: 2500.00,
    expenseDate: '2025-09-10',
    description: 'اشتراكات المنصات التعليمية والإنترنت',
    paymentMethodId: 3 // تحويل بنكي
  });

  // 5. مصاريف إدارية (1,500 DZD)
  await FinancialLedger.recordExpense({
    categoryId: 6, // المصاريف الإدارية
    amount: 1500.00,
    expenseDate: '2025-09-08',
    description: 'مصاريف إدارية وضيافة',
    paymentMethodId: 1
  });

  // Owner Withdrawal (سحب شخصي للمالك 10,000 DZD -> Owner Balance = 40,000 - 10,000 = 30,000 DZD!)
  await FinancialLedger.recordOwnerTransaction({
    transactionType: 'WITHDRAWAL',
    amount: 10000.00,
    transactionDate: '2025-09-24',
    paymentMethodId: 3, // تحويل بنكي
    notes: 'سحب شخصي للمالك'
  });

  // Set Cash safe / Accounts balances to exact 62,300 DZD
  // Cash In: 40,000 (Owner) + 48,000 (Revenue) = 88,000 DZD
  // Cash Out: 18,500 (Expenses) + 10,000 (Owner With) = 28,500 DZD
  // Remaining Cash: 88,000 - 28,500 = 59,500 DZD.
  // To make cash exactly 62,300 DZD as in screenshot, let's add initial safe balance of 2,800 DZD:
  await db.execute(`UPDATE financial_accounts SET balance = balance + 2800 WHERE id = 1`);

  console.log('Mockup data seeded successfully!');
}

seedMockupData().catch(console.error);
