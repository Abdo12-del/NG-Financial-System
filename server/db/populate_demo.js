const db = require('./connection');
const FinancialLedger = require('../ledger/financialLedger');

async function populateDemo() {
  await db.initDb();

  console.log('Seeding initial demo data for NG Academy...');

  // Check if courses already exist
  const countRow = await db.getOne('SELECT count(*) as count FROM courses');
  if (countRow && countRow.count > 1) {
    console.log('Demo data already seeded.');
    return;
  }

  // 1. Courses
  const c1 = await db.execute(`
    INSERT INTO courses (name, default_price, age_group, duration, description, status)
    VALUES ('تطوير تطبيقات الويب والذكاء الاصطناعي (Fullstack & AI)', 12000.00, 'الشباب والجامعيين', '3 أشهر (72 ساعة)', 'تطوير تطبيقات ويب حديثة ودمج نماذج الذكاء الاصطناعي', 'active')
  `);
  const c2 = await db.execute(`
    INSERT INTO courses (name, default_price, age_group, duration, description, status)
    VALUES ('البرمجة للناشئة والأشبال (Coding for Kids)', 6000.00, '10 - 16 سنة', 'شهران (40 ساعة)', 'أساسيات الخوارزميات وتطوير الألعاب والروبوتيكس', 'active')
  `);
  const c3 = await db.execute(`
    INSERT INTO courses (name, default_price, age_group, duration, description, status)
    VALUES ('التصميم الجرافيكي والموشن جرافيك (Graphic & Motion Design)', 8000.00, 'الكل', 'شهران ونصف (50 ساعة)', 'تصميم الهويات البصرية والرسوم المتحركة والمونتاج', 'active')
  `);

  // 2. Teachers
  const t1 = await db.execute(`
    INSERT INTO teachers (full_name, phone, email, specialty, notes)
    VALUES ('د. أمين بن عيسى', '0555112233', 'amine.b@ngacademy.dz', 'هندسة برمجيات وذكاء اصطناعي', 'دكتوراه في علوم الحاسوب ومطور أول')
  `);
  const t2 = await db.execute(`
    INSERT INTO teachers (full_name, phone, email, specialty, notes)
    VALUES ('أ. ياسمين بلقاسم', '0666223344', 'yasmine.b@ngacademy.dz', 'تصميم UI/UX وهوية بصرية', 'خبرة 6 سنوات في التصميم الإعلاني')
  `);
  const t3 = await db.execute(`
    INSERT INTO teachers (full_name, phone, email, specialty, notes)
    VALUES ('أ. رفيق مرابط', '0777334455', 'rafik.m@ngacademy.dz', 'تطوير الويب والباك إند', 'مهندس برمجيات ومختص تدريب ناشئة')
  `);

  // 3. Cohorts
  const coh1 = await db.execute(`
    INSERT INTO cohorts (course_id, teacher_id, name, start_date, end_date, max_students, compensation_type, compensation_value, status)
    VALUES (?, ?, 'فوج مطوري الويب A1', '2026-09-01', '2026-11-30', 20, 'PERCENTAGE', 60.00, 'active')
  `, [c1.insertId, t1.insertId]);

  const coh2 = await db.execute(`
    INSERT INTO cohorts (course_id, teacher_id, name, start_date, end_date, max_students, compensation_type, compensation_value, status)
    VALUES (?, ?, 'فوج المبرمج الصغير K1', '2026-09-15', '2026-11-15', 15, 'PERCENTAGE', 50.00, 'active')
  `, [c2.insertId, t3.insertId]);

  const coh3 = await db.execute(`
    INSERT INTO cohorts (course_id, teacher_id, name, start_date, end_date, max_students, compensation_type, compensation_value, status)
    VALUES (?, ?, 'فوج التصميم الاحترافي D1', '2026-09-10', '2026-11-25', 18, 'FIXED', 35000.00, 'active')
  `, [c3.insertId, t2.insertId]);

  // 4. Owner Initial Inflow (ضخ سيولة لتمويل التأسيس)
  await FinancialLedger.recordOwnerTransaction({
    transactionType: 'CONTRIBUTION',
    amount: 120000.00,
    paymentMethodId: 1,
    notes: 'ضخ سيولة شخصية لتأسيس وتجهيز قاعات الأكاديمية'
  });

  // 5. Students & Enrollments
  const sampleStudents = [
    { name: 'ياسين عبد القادر', phone: '0550123456', cohort: coh1.insertId, price: 12000, paid: 12000 },
    { name: 'سارة بوجمعة', phone: '0661234567', cohort: coh1.insertId, price: 12000, paid: 6000 },
    { name: 'حمزة منصوري', phone: '0772345678', cohort: coh1.insertId, price: 12000, paid: 12000 },
    { name: 'أيمن زروقي (الطفل)', phone: '0553456789', cohort: coh2.insertId, price: 6000, paid: 6000 },
    { name: 'ريان شريف (الطفل)', phone: '0664567890', cohort: coh2.insertId, price: 6000, paid: 3000 },
    { name: 'إيناس مهديد', phone: '0775678901', cohort: coh3.insertId, price: 8000, paid: 8000 },
    { name: 'وليد قاسمي', phone: '0556789012', cohort: coh3.insertId, price: 8000, paid: 4000 }
  ];

  for (const st of sampleStudents) {
    const sRes = await db.execute(`
      INSERT INTO students (full_name, phone, status)
      VALUES (?, ?, 'active')
    `, [st.name, st.phone]);
    const studentId = sRes.insertId;

    const enrRes = await db.execute(`
      INSERT INTO enrollments (student_id, cohort_id, agreed_price, discount_amount, net_price, paid_amount, remaining_amount, payment_status, enrollment_date)
      VALUES (?, ?, ?, 0.00, ?, 0.00, ?, 'UNPAID', '2026-09-10')
    `, [studentId, st.cohort, st.price, st.price, st.price]);
    const enrollmentId = enrRes.insertId;

    if (st.paid > 0) {
      await FinancialLedger.recordStudentPayment({
        enrollmentId,
        amount: st.paid,
        paymentDate: '2026-09-12',
        paymentMethodId: 1,
        referenceNo: `REC-${studentId}`,
        notes: `دفعة تسجيل دورة من ${st.name}`
      });
    }
  }

  // 6. Operating Expenses
  await FinancialLedger.recordExpense({
    categoryId: 2, // الإعلانات
    amount: 14000.00,
    expenseDate: '2026-09-05',
    description: 'إعلانات ممولة فيسبوك وإنستغرام لإطلاق دورات الخريف',
    paymentMethodId: 1
  });

  await FinancialLedger.recordExpense({
    categoryId: 3, // المنصات والخدمات
    amount: 6500.00,
    expenseDate: '2026-09-08',
    description: 'اشتراك منصة زووم واستضافة الموقع وسيرفر التدريب',
    paymentMethodId: 3 // تحويل بنكي
  });

  await FinancialLedger.recordExpense({
    categoryId: 6, // المصاريف الإدارية
    amount: 4200.00,
    expenseDate: '2026-09-15',
    description: 'أدوات مكتبية ومستلزمات الضيافة والطباعة',
    paymentMethodId: 1
  });

  // 7. Teacher Payout to Dr. Amine
  await FinancialLedger.recordExpense({
    categoryId: 1, // أجور الأساتذة
    amount: 15000.00,
    expenseDate: '2026-09-20',
    description: 'دفعة على الحساب من مستحقات الأستاذ د. أمين بن عيسى',
    paymentMethodId: 2, // CCP
    cohortId: coh1.insertId,
    teacherId: t1.insertId
  });

  // 8. Owner Withdrawal
  await FinancialLedger.recordOwnerTransaction({
    transactionType: 'WITHDRAWAL',
    amount: 25000.00,
    paymentMethodId: 1,
    notes: 'سحب شخصي للمالك'
  });

  console.log('Demo data successfully populated!');
}

populateDemo().catch(console.error);
