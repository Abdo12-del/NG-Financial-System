const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const FinancialLedger = require('../ledger/financialLedger');
const { authenticate } = require('./auth');

router.get('/stats', authenticate, async (req, res) => {
  try {
    const metrics = await FinancialLedger.getDashboardMetrics();

    // 1. Monthly Revenue & Expenses (Past 6 to 12 months)
    const monthlyData = await db.query(`
      SELECT
        substr(entry_date, 1, 7) as month,
        SUM(CASE WHEN is_operating_revenue = 1 AND is_voided = 0 THEN debit_amount ELSE 0 END) as revenue,
        SUM(CASE WHEN is_operating_expense = 1 AND is_voided = 0 THEN credit_amount ELSE 0 END) as expenses
      FROM financial_ledger
      WHERE entry_date >= date('now', '-11 months', 'start of month')
      GROUP BY substr(entry_date, 1, 7)
      ORDER BY month ASC
    `);

    // Calculate net profit per month
    const monthlyComparison = monthlyData.map(m => ({
      month: m.month,
      revenue: parseFloat(m.revenue || 0),
      expenses: parseFloat(m.expenses || 0),
      netProfit: parseFloat(m.revenue || 0) - parseFloat(m.expenses || 0)
    }));

    // 2. Revenue By Course
    const revenueByCourse = await db.query(`
      SELECT
        crs.name as course_name,
        COALESCE(SUM(l.debit_amount), 0) as total_revenue
      FROM financial_ledger l
      JOIN cohorts c ON l.cohort_id = c.id
      JOIN courses crs ON c.course_id = crs.id
      WHERE l.is_operating_revenue = 1 AND l.is_voided = 0
      GROUP BY crs.id
      ORDER BY total_revenue DESC
      LIMIT 6
    `);

    // 3. Expenses By Category
    const expensesByCategory = await db.query(`
      SELECT
        ec.name as category_name,
        COALESCE(SUM(e.amount), 0) as total_expense
      FROM expenses e
      JOIN expense_categories ec ON e.category_id = ec.id
      WHERE e.status = 'completed'
      GROUP BY ec.id
      ORDER BY total_expense DESC
    `);

    // 4. Recent 10 Transactions
    const recentTransactions = await db.query(`
      SELECT
        l.id as ledger_id,
        l.entry_code,
        l.entry_date,
        l.ledger_category,
        l.source_table,
        l.source_id,
        l.debit_amount,
        l.credit_amount,
        l.description,
        l.is_voided,
        fa.name_ar as account_name,
        crs.name as course_name,
        c.name as cohort_name,
        t.full_name as teacher_name,
        s.full_name as student_name
      FROM financial_ledger l
      LEFT JOIN financial_accounts fa ON l.financial_account_id = fa.id
      LEFT JOIN cohorts c ON l.cohort_id = c.id
      LEFT JOIN courses crs ON c.course_id = crs.id
      LEFT JOIN teachers t ON l.teacher_id = t.id
      LEFT JOIN students s ON l.student_id = s.id
      ORDER BY l.id DESC
      LIMIT 10
    `);

    res.json({
      metrics,
      charts: {
        monthlyComparison,
        revenueByCourse,
        expensesByCategory
      },
      recentTransactions
    });
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
