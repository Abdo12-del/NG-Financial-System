const db = require('../db/connection');
const FinancialLedger = require('../ledger/financialLedger');

async function testVoidMechanism() {
  console.log('\n--- Testing Void / Reversal Transaction Mechanism ---');
  await db.initDb();
  // Find the expense created in previous step
  const expense = await db.getOne(`SELECT * FROM expenses WHERE status = 'completed' LIMIT 1`);
  if (!expense) throw new Error('No expense to void');

  console.log(`Voiding Expense #${expense.id} (${expense.amount} DZD)...`);
  await FinancialLedger.voidTransaction({
    type: 'expense',
    id: expense.id,
    reason: 'خطأ في إدخال المصروف التجريبي',
    userId: 1,
    username: 'admin'
  });

  const metrics = await FinancialLedger.getDashboardMetrics();
  console.log(`After Voiding Expense:`);
  console.log(`Expenses: ${metrics.totalExpenses} DZD (Expected: 0 DZD)`);
  console.log(`Net Profit: ${metrics.netProfit} DZD (Expected: 4000 DZD)`);
  console.log(`Cash Balance: ${metrics.currentCashBalance} DZD (Expected: 44000 DZD)`);

  if (metrics.totalExpenses === 0 && metrics.netProfit === 4000 && metrics.currentCashBalance === 44000) {
    console.log('✅ [PASS] Void and Reversal Mechanism working perfectly with full ledger integrity!');
  } else {
    throw new Error('Void calculation discrepancy!');
  }
}

testVoidMechanism().catch(console.error);
