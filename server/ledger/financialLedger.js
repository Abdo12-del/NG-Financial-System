const db = require('../db/connection');

class FinancialLedgerService {
  /**
   * Generates a unique transaction reference code
   */
  static generateCode(prefix) {
    const date = new Date();
    const ymd = date.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${ymd}-${rand}`;
  }

  /**
   * Record Audit Log
   */
  static async recordAudit(executor, { userId, username, actionType, entityName, entityId, oldValues, newValues, details }) {
    const sql = `
      INSERT INTO audit_logs (user_id, username, action_type, entity_name, entity_id, old_values, new_values, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `;
    await executor.execute(sql, [
      userId || null,
      username || 'system',
      actionType,
      entityName,
      entityId || null,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      details || null
    ]);
  }

  /**
   * 1. Record Student Payment
   */
  static async recordStudentPayment({
    enrollmentId,
    amount,
    paymentDate,
    paymentMethodId,
    referenceNo,
    notes,
    userId,
    username
  }) {
    amount = parseFloat(amount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error('المبلغ المدفوع يجب أن يكون رقمًا أكبر من الصفر');
    }

    return await db.transaction(async (tx) => {
      // 1. Fetch enrollment, cohort, course, teacher
      const enrollment = await tx.getOne(`
        SELECT e.*, c.teacher_id, c.compensation_type, c.compensation_value, c.name as cohort_name,
               s.full_name as student_name, crs.name as course_name
        FROM enrollments e
        JOIN cohorts c ON e.cohort_id = c.id
        JOIN courses crs ON c.course_id = crs.id
        JOIN students s ON e.student_id = s.id
        WHERE e.id = ?
      `, [enrollmentId]);

      if (!enrollment) {
        throw new Error('لم يتم العثور على تسجيل الطالب المحدد');
      }

      // Check overpayment validation
      const allowOverpaymentSetting = await tx.getOne(`SELECT value_data FROM settings WHERE key_name = 'allow_overpayment'`);
      const allowOverpayment = allowOverpaymentSetting?.value_data === 'true';

      const remainingBefore = parseFloat(enrollment.remaining_amount);
      if (!allowOverpayment && amount > (remainingBefore + 0.001)) {
        throw new Error(`المبلغ المدخل (${amount} دج) أكبر من المبلغ المتبقي على الطالب (${remainingBefore} دج)`);
      }

      // Payment method & default financial account
      const method = await tx.getOne(`SELECT * FROM payment_methods WHERE id = ?`, [paymentMethodId]);
      if (!method) {
        throw new Error('طريقة الدفع المحددة غير صحيحة');
      }
      const accountId = method.default_account_id || 1;

      const paymentCode = FinancialLedgerService.generateCode('PAY');
      const pDate = paymentDate || new Date().toISOString().slice(0, 10);

      // 2. Insert into payments
      const paymentRes = await tx.execute(`
        INSERT INTO payments (
          payment_code, enrollment_id, student_id, cohort_id, financial_account_id,
          payment_method_id, amount, payment_date, reference_no, notes, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)
      `, [
        paymentCode, enrollment.id, enrollment.student_id, enrollment.cohort_id,
        accountId, paymentMethodId, amount, pDate, referenceNo || null, notes || null, userId || 1
      ]);
      const paymentId = paymentRes.insertId;

      // 3. Update Enrollment paid and remaining amounts
      const newPaid = parseFloat(enrollment.paid_amount) + amount;
      const newRemaining = Math.max(0, parseFloat(enrollment.net_price) - newPaid);
      const newPaymentStatus = newRemaining <= 0 ? 'PAID' : (newPaid > 0 ? 'PARTIAL' : 'UNPAID');

      await tx.execute(`
        UPDATE enrollments
        SET paid_amount = ?, remaining_amount = ?, payment_status = ?, updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `, [newPaid, newRemaining, newPaymentStatus, enrollment.id]);

      // 4. Update Financial Account Balance (Cash Safe / Bank / CCP increases)
      await tx.execute(`
        UPDATE financial_accounts
        SET balance = balance + ?, updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `, [amount, accountId]);

      // 5. Create Financial Ledger Entry (Operating Revenue & Cash In)
      const ledgerCode = FinancialLedgerService.generateCode('LDG-REV');
      await tx.execute(`
        INSERT INTO financial_ledger (
          entry_code, entry_date, ledger_category, source_table, source_id,
          financial_account_id, debit_amount, credit_amount, cohort_id, teacher_id, student_id,
          is_operating_revenue, is_operating_expense, is_owner_equity, is_voided,
          description, created_by
        ) VALUES (?, ?, 'STUDENT_PAYMENT', 'payments', ?, ?, ?, 0.00, ?, ?, ?, 1, 0, 0, 0, ?, ?)
      `, [
        ledgerCode, pDate, paymentId, accountId, amount,
        enrollment.cohort_id, enrollment.teacher_id, enrollment.student_id,
        `دفعة من الطالب: ${enrollment.student_name} - فوج: ${enrollment.cohort_name}`,
        userId || 1
      ]);

      // 6. Teacher Compensation Accrual (if percentage compensation)
      let teacherShare = 0;
      if (enrollment.compensation_type === 'PERCENTAGE') {
        const rate = parseFloat(enrollment.compensation_value);
        teacherShare = parseFloat(((amount * rate) / 100).toFixed(2));
        await tx.execute(`
          INSERT INTO teacher_compensations (
            cohort_id, teacher_id, payment_id, entry_type, amount, calculation_basis, entry_date, status
          ) VALUES (?, ?, ?, 'ACCRUAL', ?, ?, ?, 'active')
        `, [
          enrollment.cohort_id, enrollment.teacher_id, paymentId, teacherShare,
          `استحقاق بنسبة ${rate}% من دفعة الطالب (${amount} دج)`,
          pDate
        ]);
      }

      // 7. Record Audit Log
      await FinancialLedgerService.recordAudit(tx, {
        userId,
        username,
        actionType: 'CREATE',
        entityName: 'payments',
        entityId: paymentId,
        newValues: { paymentCode, amount, student: enrollment.student_name, cohort: enrollment.cohort_name, teacherShare },
        details: `تسجيل دفعة إيراد جديدة بقيمة ${amount} دج`
      });

      return {
        paymentId,
        paymentCode,
        amount,
        newPaid,
        newRemaining,
        newPaymentStatus,
        teacherShare
      };
    });
  }

  /**
   * 2. Record Operating Expense / Teacher Payout
   */
  static async recordExpense({
    categoryId,
    amount,
    expenseDate,
    description,
    paymentMethodId,
    cohortId,
    teacherId,
    referenceNo,
    notes,
    userId,
    username
  }) {
    amount = parseFloat(amount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error('مبلغ المصروف يجب أن يكون أكبر من الصفر');
    }
    if (!description || description.trim() === '') {
      throw new Error('يرجى كتابة وصف المصروف');
    }

    return await db.transaction(async (tx) => {
      const category = await tx.getOne(`SELECT * FROM expense_categories WHERE id = ?`, [categoryId]);
      if (!category) {
        throw new Error('تصنيف المصروف غير صالح');
      }

      const method = await tx.getOne(`SELECT * FROM payment_methods WHERE id = ?`, [paymentMethodId]);
      if (!method) {
        throw new Error('طريقة الدفع غير صالحة');
      }
      const accountId = method.default_account_id || 1;

      // Check financial account balance (prevent negative safe if configured)
      const account = await tx.getOne(`SELECT balance, name_ar FROM financial_accounts WHERE id = ?`, [accountId]);

      const expenseCode = FinancialLedgerService.generateCode('EXP');
      const eDate = expenseDate || new Date().toISOString().slice(0, 10);
      const isTeacherWage = category.name.includes('أجور الأساتذة') || category.name.includes('أجور') || !!teacherId;

      // 1. Insert into expenses
      const expenseRes = await tx.execute(`
        INSERT INTO expenses (
          expense_code, category_id, financial_account_id, payment_method_id,
          cohort_id, teacher_id, amount, expense_date, description, reference_no, notes,
          status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)
      `, [
        expenseCode, categoryId, accountId, paymentMethodId,
        cohortId || null, teacherId || null, amount, eDate, description, referenceNo || null, notes || null, userId || 1
      ]);
      const expenseId = expenseRes.insertId;

      // 2. Reduce Financial Account Balance
      await tx.execute(`
        UPDATE financial_accounts
        SET balance = balance - ?, updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `, [amount, accountId]);

      // 3. Insert into Financial Ledger (Operating Expense & Cash Out)
      const ledgerCode = FinancialLedgerService.generateCode('LDG-EXP');
      await tx.execute(`
        INSERT INTO financial_ledger (
          entry_code, entry_date, ledger_category, source_table, source_id,
          financial_account_id, debit_amount, credit_amount, cohort_id, teacher_id,
          is_operating_revenue, is_operating_expense, is_owner_equity, is_voided,
          description, created_by
        ) VALUES (?, ?, ?, 'expenses', ?, ?, 0.00, ?, ?, ?, 0, 1, 0, 0, ?, ?)
      `, [
        ledgerCode, eDate, isTeacherWage ? 'TEACHER_PAYOUT' : 'OPERATING_EXPENSE',
        expenseId, accountId, amount, cohortId || null, teacherId || null,
        `مصروف: [${category.name}] ${description}`, userId || 1
      ]);

      // 4. If this is a teacher payout, record settlement in teacher_compensations
      if (isTeacherWage && teacherId) {
        await tx.execute(`
          INSERT INTO teacher_compensations (
            cohort_id, teacher_id, expense_id, entry_type, amount, calculation_basis, entry_date, status
          ) VALUES (?, ?, ?, 'PAYOUT', ?, ?, ?, 'active')
        `, [
          cohortId || 1, teacherId, expenseId, amount,
          `صرف أجر/مستحقات أستاذ: ${description}`, eDate
        ]);
      }

      // 5. Audit Log
      await FinancialLedgerService.recordAudit(tx, {
        userId,
        username,
        actionType: 'CREATE',
        entityName: 'expenses',
        entityId: expenseId,
        newValues: { expenseCode, category: category.name, amount, description },
        details: `تسجيل مصروف جديد بقيمة ${amount} دج`
      });

      return { expenseId, expenseCode, amount, category: category.name };
    });
  }

  /**
   * 3. Record Owner Transaction (Contribution or Withdrawal)
   * STRICT SEPARATION: Owner contributions are NEVER revenue.
   * Owner withdrawals are NEVER operating expenses.
   */
  static async recordOwnerTransaction({
    transactionType, // 'CONTRIBUTION' or 'WITHDRAWAL'
    amount,
    transactionDate,
    paymentMethodId,
    referenceNo,
    notes,
    userId,
    username
  }) {
    amount = parseFloat(amount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error('مبلغ العملية يجب أن يكون أكبر من الصفر');
    }
    if (!['CONTRIBUTION', 'WITHDRAWAL'].includes(transactionType)) {
      throw new Error('نوع معاملة المالك غير صالح (يجب أن يكون ضخ CONTRIBUTION أو سحب WITHDRAWAL)');
    }

    return await db.transaction(async (tx) => {
      const method = await tx.getOne(`SELECT * FROM payment_methods WHERE id = ?`, [paymentMethodId]);
      if (!method) {
        throw new Error('طريقة الدفع غير صالحة');
      }
      const accountId = method.default_account_id || 1;

      const txCode = FinancialLedgerService.generateCode(transactionType === 'CONTRIBUTION' ? 'OWN-IN' : 'OWN-OUT');
      const tDate = transactionDate || new Date().toISOString().slice(0, 10);

      // 1. Insert into owner_transactions
      const ownerRes = await tx.execute(`
        INSERT INTO owner_transactions (
          transaction_code, transaction_type, financial_account_id, payment_method_id,
          amount, transaction_date, reference_no, notes, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)
      `, [
        txCode, transactionType, accountId, paymentMethodId,
        amount, tDate, referenceNo || null, notes || null, userId || 1
      ]);
      const ownerTxId = ownerRes.insertId;

      // 2. Adjust Financial Account & Ledger
      const ledgerCode = FinancialLedgerService.generateCode('LDG-OWN');

      if (transactionType === 'CONTRIBUTION') {
        // Owner injected liquidity: Safe/Bank increases
        await tx.execute(`
          UPDATE financial_accounts
          SET balance = balance + ?, updated_at = datetime('now', 'localtime')
          WHERE id = ?
        `, [amount, accountId]);

        // In ledger: Cash In (debit), but is_operating_revenue = 0 (Equity Financing)
        await tx.execute(`
          INSERT INTO financial_ledger (
            entry_code, entry_date, ledger_category, source_table, source_id,
            financial_account_id, debit_amount, credit_amount,
            is_operating_revenue, is_operating_expense, is_owner_equity, is_voided,
            description, created_by
          ) VALUES (?, ?, 'OWNER_CONTRIBUTION', 'owner_transactions', ?, ?, ?, 0.00, 0, 0, 1, 0, ?, ?)
        `, [
          ledgerCode, tDate, ownerTxId, accountId, amount,
          `ضخ سيولة شخصية من المالك (Owner -> Academy): ${notes || ''}`, userId || 1
        ]);
      } else {
        // Owner withdrew personal money: Safe/Bank decreases
        await tx.execute(`
          UPDATE financial_accounts
          SET balance = balance - ?, updated_at = datetime('now', 'localtime')
          WHERE id = ?
        `, [amount, accountId]);

        // In ledger: Cash Out (credit), but is_operating_expense = 0 (Personal Drawings)
        await tx.execute(`
          INSERT INTO financial_ledger (
            entry_code, entry_date, ledger_category, source_table, source_id,
            financial_account_id, debit_amount, credit_amount,
            is_operating_revenue, is_operating_expense, is_owner_equity, is_voided,
            description, created_by
          ) VALUES (?, ?, 'OWNER_WITHDRAWAL', 'owner_transactions', ?, ?, 0.00, ?, 0, 0, 1, 0, ?, ?)
        `, [
          ledgerCode, tDate, ownerTxId, accountId, amount,
          `سحب شخصي للمالك (Academy -> Owner): ${notes || ''}`, userId || 1
        ]);
      }

      // 3. Record Audit Log
      await FinancialLedgerService.recordAudit(tx, {
        userId,
        username,
        actionType: 'CREATE',
        entityName: 'owner_transactions',
        entityId: ownerTxId,
        newValues: { txCode, transactionType, amount },
        details: transactionType === 'CONTRIBUTION'
          ? `ضخ سيولة من المالك بقيمة ${amount} دج`
          : `سحب شخصي للمالك بقيمة ${amount} دج`
      });

      return { ownerTxId, txCode, transactionType, amount };
    });
  }

  /**
   * 4. Void / Reverse Transaction (Prevents hard deletes and maintains audit integrity)
   */
  static async voidTransaction({ type, id, reason, userId, username }) {
    if (!reason || reason.trim() === '') {
      throw new Error('يرجى توضيح سبب إلغاء المعاملة');
    }

    return await db.transaction(async (tx) => {
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const today = new Date().toISOString().slice(0, 10);

      if (type === 'payment') {
        const payment = await tx.getOne(`SELECT * FROM payments WHERE id = ?`, [id]);
        if (!payment) throw new Error('الدفعة غير موجودة');
        if (payment.status === 'voided') throw new Error('هذه الدفعة ملغاة بالفعل');

        // Mark payment voided
        await tx.execute(`
          UPDATE payments
          SET status = 'voided', void_reason = ?, voided_at = datetime('now', 'localtime'), voided_by = ?
          WHERE id = ?
        `, [reason, userId || 1, id]);

        // Reverse enrollment paid & remaining
        const enrollment = await tx.getOne(`SELECT * FROM enrollments WHERE id = ?`, [payment.enrollment_id]);
        if (enrollment) {
          const newPaid = Math.max(0, parseFloat(enrollment.paid_amount) - parseFloat(payment.amount));
          const newRemaining = Math.max(0, parseFloat(enrollment.net_price) - newPaid);
          const newStatus = newRemaining <= 0 ? 'PAID' : (newPaid > 0 ? 'PARTIAL' : 'UNPAID');
          await tx.execute(`
            UPDATE enrollments
            SET paid_amount = ?, remaining_amount = ?, payment_status = ?
            WHERE id = ?
          `, [newPaid, newRemaining, newStatus, enrollment.id]);
        }

        // Reverse financial account cash balance
        await tx.execute(`
          UPDATE financial_accounts
          SET balance = balance - ?
          WHERE id = ?
        `, [payment.amount, payment.financial_account_id]);

        // Void original ledger entry and create a reversal entry
        const origLedger = await tx.getOne(`
          SELECT * FROM financial_ledger
          WHERE source_table = 'payments' AND source_id = ? AND is_voided = 0
        `, [id]);

        if (origLedger) {
          await tx.execute(`UPDATE financial_ledger SET is_voided = 1 WHERE id = ?`, [origLedger.id]);

          const revCode = FinancialLedgerService.generateCode('REV-PAY');
          await tx.execute(`
            INSERT INTO financial_ledger (
              entry_code, entry_date, ledger_category, source_table, source_id,
              financial_account_id, debit_amount, credit_amount, cohort_id, teacher_id, student_id,
              is_operating_revenue, is_operating_expense, is_owner_equity, is_voided,
              reversal_entry_id, description, created_by
            ) VALUES (?, ?, 'VOID_REVERSAL', 'payments', ?, ?, 0.00, ?, ?, ?, ?, 0, 0, 0, 1, ?, ?, ?)
          `, [
            revCode, today, id, payment.financial_account_id, payment.amount,
            payment.cohort_id, origLedger.teacher_id, payment.student_id,
            origLedger.id, `إلغاء دفعة (${payment.payment_code}): ${reason}`, userId || 1
          ]);
        }

        // Void associated teacher compensation accrual
        await tx.execute(`
          UPDATE teacher_compensations
          SET status = 'voided'
          WHERE payment_id = ?
        `, [id]);

        // Audit Log
        await FinancialLedgerService.recordAudit(tx, {
          userId,
          username,
          actionType: 'VOID',
          entityName: 'payments',
          entityId: id,
          oldValues: payment,
          newValues: { status: 'voided', reason },
          details: `إلغاء وعكس دفعة مالية بقيمة ${payment.amount} دج`
        });

        return { success: true, message: 'تم إلغاء الدفعة وعكس أثرها المالي بنجاح' };

      } else if (type === 'expense') {
        const expense = await tx.getOne(`SELECT * FROM expenses WHERE id = ?`, [id]);
        if (!expense) throw new Error('المصروف غير موجود');
        if (expense.status === 'voided') throw new Error('هذا المصروف ملغى بالفعل');

        await tx.execute(`
          UPDATE expenses
          SET status = 'voided', void_reason = ?, voided_at = datetime('now', 'localtime'), voided_by = ?
          WHERE id = ?
        `, [reason, userId || 1, id]);

        // Restore financial account cash balance
        await tx.execute(`
          UPDATE financial_accounts
          SET balance = balance + ?
          WHERE id = ?
        `, [expense.amount, expense.financial_account_id]);

        // Void original ledger entry
        const origLedger = await tx.getOne(`
          SELECT * FROM financial_ledger
          WHERE source_table = 'expenses' AND source_id = ? AND is_voided = 0
        `, [id]);

        if (origLedger) {
          await tx.execute(`UPDATE financial_ledger SET is_voided = 1 WHERE id = ?`, [origLedger.id]);

          const revCode = FinancialLedgerService.generateCode('REV-EXP');
          await tx.execute(`
            INSERT INTO financial_ledger (
              entry_code, entry_date, ledger_category, source_table, source_id,
              financial_account_id, debit_amount, credit_amount, cohort_id, teacher_id,
              is_operating_revenue, is_operating_expense, is_owner_equity, is_voided,
              reversal_entry_id, description, created_by
            ) VALUES (?, ?, 'VOID_REVERSAL', 'expenses', ?, ?, ?, 0.00, ?, ?, 0, 0, 0, 1, ?, ?, ?)
          `, [
            revCode, today, id, expense.financial_account_id, expense.amount,
            expense.cohort_id, expense.teacher_id, origLedger.id,
            `إلغاء مصروف (${expense.expense_code}): ${reason}`, userId || 1
          ]);
        }

        // Void associated teacher payout if any
        await tx.execute(`
          UPDATE teacher_compensations
          SET status = 'voided'
          WHERE expense_id = ?
        `, [id]);

        await FinancialLedgerService.recordAudit(tx, {
          userId,
          username,
          actionType: 'VOID',
          entityName: 'expenses',
          entityId: id,
          oldValues: expense,
          newValues: { status: 'voided', reason },
          details: `إلغاء وعكس مصروف بقيمة ${expense.amount} دج`
        });

        return { success: true, message: 'تم إلغاء المصروف واستعادة الرصيد بنجاح' };

      } else if (type === 'owner_transaction') {
        const ownerTx = await tx.getOne(`SELECT * FROM owner_transactions WHERE id = ?`, [id]);
        if (!ownerTx) throw new Error('معاملة المالك غير موجودة');
        if (ownerTx.status === 'voided') throw new Error('هذه المعاملة ملغاة بالفعل');

        await tx.execute(`
          UPDATE owner_transactions
          SET status = 'voided', void_reason = ?, voided_at = datetime('now', 'localtime'), voided_by = ?
          WHERE id = ?
        `, [reason, userId || 1, id]);

        if (ownerTx.transaction_type === 'CONTRIBUTION') {
          await tx.execute(`UPDATE financial_accounts SET balance = balance - ? WHERE id = ?`, [ownerTx.amount, ownerTx.financial_account_id]);
        } else {
          await tx.execute(`UPDATE financial_accounts SET balance = balance + ? WHERE id = ?`, [ownerTx.amount, ownerTx.financial_account_id]);
        }

        const origLedger = await tx.getOne(`
          SELECT * FROM financial_ledger
          WHERE source_table = 'owner_transactions' AND source_id = ? AND is_voided = 0
        `, [id]);

        if (origLedger) {
          await tx.execute(`UPDATE financial_ledger SET is_voided = 1 WHERE id = ?`, [origLedger.id]);
        }

        await FinancialLedgerService.recordAudit(tx, {
          userId,
          username,
          actionType: 'VOID',
          entityName: 'owner_transactions',
          entityId: id,
          oldValues: ownerTx,
          newValues: { status: 'voided', reason },
          details: `إلغاء معاملة مالك (${ownerTx.transaction_type}) بقيمة ${ownerTx.amount} دج`
        });

        return { success: true, message: 'تم إلغاء معاملة المالك بنجاح' };
      }

      throw new Error('نوع العملية المراد إلغاؤها غير معروف');
    });
  }

  /**
   * 5. Get Complete Dashboard Financial Statistics
   */
  static async getDashboardMetrics() {
    // Total Revenue (Only valid student payments / operating revenues)
    const revRow = await db.getOne(`
      SELECT COALESCE(SUM(debit_amount), 0) as total
      FROM financial_ledger
      WHERE is_operating_revenue = 1 AND is_voided = 0
    `);
    const totalRevenue = parseFloat(revRow?.total || 0);

    // Total Operating Expenses (Only valid operating expenses and teacher payouts)
    const expRow = await db.getOne(`
      SELECT COALESCE(SUM(credit_amount), 0) as total
      FROM financial_ledger
      WHERE is_operating_expense = 1 AND is_voided = 0
    `);
    const totalExpenses = parseFloat(expRow?.total || 0);

    // Net Operating Profit
    const netProfit = totalRevenue - totalExpenses;

    // Current Cash Balance (Sum of balances across all active financial accounts)
    const cashRow = await db.getOne(`
      SELECT COALESCE(SUM(balance), 0) as total
      FROM financial_accounts
      WHERE is_active = 1
    `);
    const currentCashBalance = parseFloat(cashRow?.total || 0);

    // Owner Balance = Total Contributions - Total Withdrawals
    const ownerContRow = await db.getOne(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM owner_transactions
      WHERE transaction_type = 'CONTRIBUTION' AND status = 'completed'
    `);
    const totalOwnerContributions = parseFloat(ownerContRow?.total || 0);

    const ownerWithRow = await db.getOne(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM owner_transactions
      WHERE transaction_type = 'WITHDRAWAL' AND status = 'completed'
    `);
    const totalOwnerWithdrawals = parseFloat(ownerWithRow?.total || 0);

    const ownerBalance = totalOwnerContributions - totalOwnerWithdrawals;

    // Teacher Payables (Accruals - Payouts)
    const accruedRow = await db.getOne(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM teacher_compensations
      WHERE entry_type = 'ACCRUAL' AND status = 'active'
    `);
    const totalAccrued = parseFloat(accruedRow?.total || 0);

    const paidTeacherRow = await db.getOne(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM teacher_compensations
      WHERE entry_type = 'PAYOUT' AND status = 'active'
    `);
    const totalPaidTeacher = parseFloat(paidTeacherRow?.total || 0);

    const teacherPayables = Math.max(0, totalAccrued - totalPaidTeacher);

    // Outstanding Student Payments (Accounts Receivable)
    const studentDebtRow = await db.getOne(`
      SELECT COALESCE(SUM(remaining_amount), 0) as total
      FROM enrollments
      WHERE status != 'dropped'
    `);
    const studentOutstanding = parseFloat(studentDebtRow?.total || 0);

    return {
      totalRevenue,
      totalExpenses,
      netProfit,
      currentCashBalance,
      ownerBalance,
      totalOwnerContributions,
      totalOwnerWithdrawals,
      teacherPayables,
      studentOutstanding
    };
  }
}

module.exports = FinancialLedgerService;
