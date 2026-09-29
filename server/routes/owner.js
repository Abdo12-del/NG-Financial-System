const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const FinancialLedger = require('../ledger/financialLedger');
const { authenticate, requireRole } = require('./auth');

// Owner summary and transactions
router.get('/', authenticate, async (req, res) => {
  try {
    const contRow = await db.getOne(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM owner_transactions
      WHERE transaction_type = 'CONTRIBUTION' AND status = 'completed'
    `);
    const totalContributions = parseFloat(contRow?.total || 0);

    const withRow = await db.getOne(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM owner_transactions
      WHERE transaction_type = 'WITHDRAWAL' AND status = 'completed'
    `);
    const totalWithdrawals = parseFloat(withRow?.total || 0);

    const ownerBalance = totalContributions - totalWithdrawals;

    const transactions = await db.query(`
      SELECT
        ot.*,
        fa.name_ar as account_name,
        pm.name_ar as method_name,
        u.username as creator_name
      FROM owner_transactions ot
      JOIN financial_accounts fa ON ot.financial_account_id = fa.id
      JOIN payment_methods pm ON ot.payment_method_id = pm.id
      JOIN users u ON ot.created_by = u.id
      ORDER BY ot.transaction_date DESC, ot.id DESC
    `);

    // Calculate running balance chronologically
    let running = 0;
    const chronological = [...transactions].reverse().map(tx => {
      if (tx.status === 'completed') {
        if (tx.transaction_type === 'CONTRIBUTION') {
          running += parseFloat(tx.amount);
        } else {
          running -= parseFloat(tx.amount);
        }
      }
      return { ...tx, running_balance: running };
    });
    const withRunning = chronological.reverse();

    res.json({
      summary: {
        totalContributions,
        totalWithdrawals,
        ownerBalance,
        statusText: ownerBalance >= 0
          ? `الأكاديمية مدينة للمالك بمبلغ ${ownerBalance.toLocaleString()} دج`
          : `المالك مدين للأكاديمية بمبلغ ${Math.abs(ownerBalance).toLocaleString()} دج`
      },
      transactions: withRunning
    });
  } catch (err) {
    console.error('Error fetching owner data:', err);
    res.status(500).json({ error: err.message });
  }
});

// Record Owner Contribution (ضخ سيولة شخصية)
router.post('/contribution', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { amount, transactionDate, paymentMethodId, referenceNo, notes } = req.body;

    const result = await FinancialLedger.recordOwnerTransaction({
      transactionType: 'CONTRIBUTION',
      amount,
      transactionDate,
      paymentMethodId: paymentMethodId || 1,
      referenceNo,
      notes: notes || 'ضخ سيولة شخصية لتمويل الأكاديمية',
      userId: req.user.id,
      username: req.user.username
    });

    res.json({ success: true, message: 'تم تسجيل ضخ السيولة بنجاح (لا يعتبر إيرادًا تشغيليًا)', data: result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Record Owner Withdrawal (سحب شخصي)
router.post('/withdrawal', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { amount, transactionDate, paymentMethodId, referenceNo, notes } = req.body;

    const result = await FinancialLedger.recordOwnerTransaction({
      transactionType: 'WITHDRAWAL',
      amount,
      transactionDate,
      paymentMethodId: paymentMethodId || 1,
      referenceNo,
      notes: notes || 'سحب شخصي للمالك',
      userId: req.user.id,
      username: req.user.username
    });

    res.json({ success: true, message: 'تم تسجيل السحب الشخصي بنجاح (لا يعتبر مصروفًا تشغيليًا)', data: result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
