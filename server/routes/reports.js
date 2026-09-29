const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { authenticate } = require('./auth');

// 1. Profit & Loss Report
router.get('/profit-loss', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let revWhere = ['l.is_operating_revenue = 1', 'l.is_voided = 0'];
    let expWhere = ["e.status = 'completed'"];
    let revParams = [];
    let expParams = [];

    if (startDate) {
      revWhere.push('l.entry_date >= ?');
      expWhere.push('e.expense_date >= ?');
      revParams.push(startDate);
      expParams.push(startDate);
    }
    if (endDate) {
      revWhere.push('l.entry_date <= ?');
      expWhere.push('e.expense_date <= ?');
      revParams.push(endDate);
      expParams.push(endDate);
    }

    // Revenue breakdown by course
    const revenueItems = await db.query(`
      SELECT
        crs.name as item_name,
        COALESCE(SUM(l.debit_amount), 0) as amount
      FROM financial_ledger l
      JOIN cohorts c ON l.cohort_id = c.id
      JOIN courses crs ON c.course_id = crs.id
      WHERE ${revWhere.join(' AND ')}
      GROUP BY crs.id
      ORDER BY amount DESC
    `, revParams);

    const totalRevenue = revenueItems.reduce((sum, item) => sum + parseFloat(item.amount), 0);

    // Expenses breakdown by category
    const expenseItems = await db.query(`
      SELECT
        ec.name as item_name,
        COALESCE(SUM(e.amount), 0) as amount
      FROM expenses e
      JOIN expense_categories ec ON e.category_id = ec.id
      WHERE ${expWhere.join(' AND ')}
      GROUP BY ec.id
      ORDER BY amount DESC
    `, expParams);

    const totalExpenses = expenseItems.reduce((sum, item) => sum + parseFloat(item.amount), 0);
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0;

    res.json({
      period: {
        startDate: startDate || 'البداية',
        endDate: endDate || 'اليوم'
      },
      revenue: {
        items: revenueItems,
        total: totalRevenue
      },
      expenses: {
        items: expenseItems,
        total: totalExpenses
      },
      netProfit,
      profitMargin: `${profitMargin}%`,
      isProfitable: netProfit >= 0
    });
  } catch (err) {
    console.error('Error in P&L report:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Cash Flow Statement
router.get('/cash-flow', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Opening Balance (all net cash movements before startDate)
    let openingBalance = 0;
    if (startDate) {
      const openRow = await db.getOne(`
        SELECT
          COALESCE(SUM(debit_amount), 0) - COALESCE(SUM(credit_amount), 0) as opening
        FROM financial_ledger
        WHERE entry_date < ? AND is_voided = 0
      `, [startDate]);
      openingBalance = parseFloat(openRow?.opening || 0);
    }

    let dateFilter = ['is_voided = 0'];
    let params = [];
    if (startDate) {
      dateFilter.push('entry_date >= ?');
      params.push(startDate);
    }
    if (endDate) {
      dateFilter.push('entry_date <= ?');
      params.push(endDate);
    }
    const dateWhere = dateFilter.join(' AND ');

    // Cash In items
    const studentPaymentsRow = await db.getOne(`
      SELECT COALESCE(SUM(debit_amount), 0) as total
      FROM financial_ledger
      WHERE ${dateWhere} AND ledger_category = 'STUDENT_PAYMENT'
    `, params);
    const studentPayments = parseFloat(studentPaymentsRow?.total || 0);

    const ownerContRow = await db.getOne(`
      SELECT COALESCE(SUM(debit_amount), 0) as total
      FROM financial_ledger
      WHERE ${dateWhere} AND ledger_category = 'OWNER_CONTRIBUTION'
    `, params);
    const ownerContributions = parseFloat(ownerContRow?.total || 0);

    const otherInRow = await db.getOne(`
      SELECT COALESCE(SUM(debit_amount), 0) as total
      FROM financial_ledger
      WHERE ${dateWhere} AND ledger_category NOT IN ('STUDENT_PAYMENT', 'OWNER_CONTRIBUTION') AND debit_amount > 0
    `, params);
    const otherIn = parseFloat(otherInRow?.total || 0);

    const totalCashIn = studentPayments + ownerContributions + otherIn;

    // Cash Out items
    const teacherPaymentsRow = await db.getOne(`
      SELECT COALESCE(SUM(credit_amount), 0) as total
      FROM financial_ledger
      WHERE ${dateWhere} AND ledger_category = 'TEACHER_PAYOUT'
    `, params);
    const teacherPayments = parseFloat(teacherPaymentsRow?.total || 0);

    const operatingExpensesRow = await db.getOne(`
      SELECT COALESCE(SUM(credit_amount), 0) as total
      FROM financial_ledger
      WHERE ${dateWhere} AND ledger_category = 'OPERATING_EXPENSE'
    `, params);
    const operatingExpenses = parseFloat(operatingExpensesRow?.total || 0);

    const ownerWithdrawalsRow = await db.getOne(`
      SELECT COALESCE(SUM(credit_amount), 0) as total
      FROM financial_ledger
      WHERE ${dateWhere} AND ledger_category = 'OWNER_WITHDRAWAL'
    `, params);
    const ownerWithdrawals = parseFloat(ownerWithdrawalsRow?.total || 0);

    const totalCashOut = teacherPayments + operatingExpenses + ownerWithdrawals;
    const netCashFlow = totalCashIn - totalCashOut;
    const closingBalance = openingBalance + netCashFlow;

    res.json({
      period: {
        startDate: startDate || 'البداية',
        endDate: endDate || 'اليوم'
      },
      openingBalance,
      cashIn: {
        studentPayments,
        ownerContributions,
        otherIncome: otherIn,
        total: totalCashIn
      },
      cashOut: {
        teacherPayments,
        operatingExpenses,
        ownerWithdrawals,
        total: totalCashOut
      },
      netCashFlow,
      closingBalance
    });
  } catch (err) {
    console.error('Error in cash flow report:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3. Cohort Profitability Report
router.get('/cohorts-profitability', authenticate, async (req, res) => {
  try {
    const cohorts = await db.query(`
      SELECT
        c.id as cohort_id,
        c.name as cohort_name,
        c.compensation_type,
        c.compensation_value,
        c.status,
        crs.name as course_name,
        t.full_name as teacher_name,
        COUNT(e.id) as student_count,
        COALESCE(SUM(e.net_price), 0) as total_enrollment_value,
        COALESCE(SUM(e.paid_amount), 0) as total_collected,
        COALESCE(SUM(e.remaining_amount), 0) as total_outstanding
      FROM cohorts c
      JOIN courses crs ON c.course_id = crs.id
      JOIN teachers t ON c.teacher_id = t.id
      LEFT JOIN enrollments e ON c.id = e.cohort_id AND e.status != 'dropped'
      GROUP BY c.id
      ORDER BY c.id DESC
    `);

    const result = [];
    for (const c of cohorts) {
      const collected = parseFloat(c.total_collected || 0);
      let teacherShare = 0;
      if (c.compensation_type === 'PERCENTAGE') {
        teacherShare = parseFloat(((collected * parseFloat(c.compensation_value)) / 100).toFixed(2));
      } else {
        teacherShare = parseFloat(c.compensation_value || 0);
      }

      // Direct expenses
      const expRow = await db.getOne(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM expenses
        WHERE cohort_id = ? AND status = 'completed' AND category_id != 1
      `, [c.cohort_id]);
      const directExpenses = parseFloat(expRow?.total || 0);

      const netProfit = collected - teacherShare - directExpenses;
      const margin = collected > 0 ? ((netProfit / collected) * 100).toFixed(1) : 0;

      result.push({
        ...c,
        total_enrollment_value: parseFloat(c.total_enrollment_value || 0),
        total_collected: collected,
        total_outstanding: parseFloat(c.total_outstanding || 0),
        teacher_share: teacherShare,
        direct_expenses: directExpenses,
        academy_net_profit: netProfit,
        profit_margin: `${margin}%`
      });
    }

    res.json({ cohorts: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
