const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const db = require('../db/connection');

const server = new McpServer({
  name: 'ng-financial-system-readonly',
  version: '1.0.0'
});

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM');
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

function registerReadTool(name, config, handler) {
  server.registerTool(name, config, async args => {
    try {
      const result = await handler(args);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      };
    } catch (error) {
      console.error(`Read-only MCP tool "${name}" failed:`, error);
      return {
        isError: true,
        content: [{ type: 'text', text: 'تعذر تنفيذ الاستعلام. راجع سجل التطبيق المحلي.' }]
      };
    }
  });
}

registerReadTool(
  'get_financial_summary',
  {
    description: 'Read-only totals for operating income, expenses, current account balances, and confirmed student dues. Optional dates filter cash-flow totals; dues show current balances.',
    inputSchema: z.object({
      startDate: dateSchema.optional(),
      endDate: dateSchema.optional()
    }).refine(
      input => !input.startDate || !input.endDate || input.startDate <= input.endDate,
      'startDate must be on or before endDate'
    )
  },
  async ({ startDate, endDate }) => {
    const ledgerFilters = ['is_voided = 0'];
    const params = [];
    if (startDate) {
      ledgerFilters.push('entry_date >= ?');
      params.push(startDate);
    }
    if (endDate) {
      ledgerFilters.push('entry_date <= ?');
      params.push(endDate);
    }
    const ledger = await db.getOne(`
      SELECT
        COALESCE(SUM(CASE WHEN is_operating_revenue = 1 THEN debit_amount ELSE 0 END), 0) AS operating_income,
        COALESCE(SUM(CASE WHEN is_operating_expense = 1 THEN credit_amount ELSE 0 END), 0) AS operating_expenses,
        COALESCE(SUM(debit_amount), 0) AS cash_in,
        COALESCE(SUM(credit_amount), 0) AS cash_out
      FROM financial_ledger
      WHERE ${ledgerFilters.join(' AND ')}
    `, params);
    const accounts = await db.query(`
      SELECT name_ar AS account, balance
      FROM financial_accounts
      WHERE is_active = 1
      ORDER BY id
    `);
    const dues = await db.getOne(`
      SELECT
        COALESCE(SUM(e.remaining_amount), 0) AS outstanding_amount,
        COUNT(*) AS enrollment_count
      FROM enrollments e
      WHERE e.remaining_amount > 0
        AND e.status != 'dropped'
        AND e.confirmation_status != 'pending'
    `);
    return {
      period: { startDate: startDate || null, endDate: endDate || null },
      operatingIncome: Number(ledger.operating_income),
      operatingExpenses: Number(ledger.operating_expenses),
      operatingProfit: Number(ledger.operating_income) - Number(ledger.operating_expenses),
      cashIn: Number(ledger.cash_in),
      cashOut: Number(ledger.cash_out),
      accountBalances: accounts.map(account => ({ account: account.account, balance: Number(account.balance) })),
      confirmedStudentDues: {
        amount: Number(dues.outstanding_amount),
        enrollments: Number(dues.enrollment_count)
      }
    };
  }
);

registerReadTool(
  'list_cohorts',
  {
    description: 'List cohorts with course and teacher names, enrollment counts by confirmation state, and confirmed outstanding dues.',
    inputSchema: z.object({
      status: z.string().trim().min(1).max(30).optional()
    })
  },
  async ({ status }) => {
    const filters = [];
    const params = [];
    if (status) {
      filters.push('c.status = ?');
      params.push(status);
    }
    const cohorts = await db.query(`
      SELECT
        c.id AS cohortId,
        c.name AS cohort,
        crs.name AS course,
        t.full_name AS teacher,
        c.status,
        COUNT(CASE WHEN e.status != 'dropped' THEN 1 END) AS enrolled,
        COUNT(CASE WHEN e.status != 'dropped' AND e.confirmation_status = 'confirmed' THEN 1 END) AS confirmed,
        COUNT(CASE WHEN e.status != 'dropped' AND e.confirmation_status = 'pending' THEN 1 END) AS awaitingConfirmation,
        COUNT(CASE WHEN e.status != 'dropped' AND e.confirmation_status = 'frozen' THEN 1 END) AS frozen,
        COALESCE(SUM(CASE
          WHEN e.status != 'dropped' AND e.confirmation_status != 'pending'
          THEN e.remaining_amount ELSE 0
        END), 0) AS confirmedOutstanding
      FROM cohorts c
      JOIN courses crs ON crs.id = c.course_id
      JOIN teachers t ON t.id = c.teacher_id
      LEFT JOIN enrollments e ON e.cohort_id = c.id
      ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
      GROUP BY c.id
      ORDER BY c.id DESC
      LIMIT 200
    `, params);
    return cohorts.map(cohort => ({
      ...cohort,
      cohortId: Number(cohort.cohortId),
      enrolled: Number(cohort.enrolled),
      confirmed: Number(cohort.confirmed),
      awaitingConfirmation: Number(cohort.awaitingConfirmation),
      frozen: Number(cohort.frozen),
      confirmedOutstanding: Number(cohort.confirmedOutstanding)
    }));
  }
);

registerReadTool(
  'get_cohort_outstanding',
  {
    description: 'Read confirmed/frozen outstanding balance for one cohort. Student names are only included when explicitly requested.',
    inputSchema: z.object({
      cohortId: z.number().int().positive(),
      includeStudents: z.boolean().default(false)
    })
  },
  async ({ cohortId, includeStudents }) => {
    const cohort = await db.getOne(`
      SELECT c.id AS cohortId, c.name AS cohort, crs.name AS course
      FROM cohorts c
      JOIN courses crs ON crs.id = c.course_id
      WHERE c.id = ?
    `, [cohortId]);
    if (!cohort) return { error: 'الفوج غير موجود' };

    const summary = await db.getOne(`
      SELECT
        COALESCE(SUM(e.remaining_amount), 0) AS outstandingAmount,
        COUNT(CASE WHEN e.remaining_amount > 0 THEN 1 END) AS studentsOwing
      FROM enrollments e
      WHERE e.cohort_id = ?
        AND e.status != 'dropped'
        AND e.confirmation_status != 'pending'
    `, [cohortId]);
    const result = {
      cohortId: Number(cohort.cohortId),
      cohort: cohort.cohort,
      course: cohort.course,
      outstandingAmount: Number(summary.outstandingAmount),
      studentsOwing: Number(summary.studentsOwing)
    };
    if (includeStudents) {
      const students = await db.query(`
        SELECT
          s.full_name AS student,
          e.confirmation_status AS confirmationStatus,
          e.remaining_amount AS outstandingAmount
        FROM enrollments e
        JOIN students s ON s.id = e.student_id
        WHERE e.cohort_id = ?
          AND e.status != 'dropped'
          AND e.confirmation_status != 'pending'
          AND e.remaining_amount > 0
        ORDER BY e.remaining_amount DESC, s.full_name
        LIMIT 100
      `, [cohortId]);
      result.students = students.map(student => ({
        ...student,
        outstandingAmount: Number(student.outstandingAmount)
      }));
    }
    return result;
  }
);

registerReadTool(
  'search_student_enrollments',
  {
    description: 'Search student names and list their cohort enrollment status and balances. Does not expose phone numbers or guardian contacts.',
    inputSchema: z.object({
      search: z.string().trim().min(2).max(100)
    })
  },
  async ({ search }) => {
    const term = `%${search}%`;
    const students = await db.query(`
      SELECT
        s.id AS studentId,
        s.full_name AS student,
        c.name AS cohort,
        crs.name AS course,
        e.confirmation_status AS confirmationStatus,
        e.billing_start_month AS billingStartMonth,
        CASE WHEN e.confirmation_status = 'pending' THEN 0 ELSE e.net_price END AS amountDue,
        e.paid_amount AS paidAmount,
        CASE WHEN e.confirmation_status = 'pending' THEN 0 ELSE e.remaining_amount END AS outstandingAmount
      FROM students s
      JOIN enrollments e ON e.student_id = s.id
      JOIN cohorts c ON c.id = e.cohort_id
      JOIN courses crs ON crs.id = c.course_id
      WHERE s.full_name LIKE ?
        AND e.status != 'dropped'
      ORDER BY s.full_name, c.name
      LIMIT 50
    `, [term]);
    return students.map(student => ({
      ...student,
      studentId: Number(student.studentId),
      amountDue: Number(student.amountDue),
      paidAmount: Number(student.paidAmount),
      outstandingAmount: Number(student.outstandingAmount)
    }));
  }
);

registerReadTool(
  'list_student_payments',
  {
    description: 'Read completed payments for one student. Does not expose payment references, notes, or account details.',
    inputSchema: z.object({
      studentId: z.number().int().positive(),
      limit: z.number().int().min(1).max(50).default(20)
    })
  },
  async ({ studentId, limit }) => {
    const student = await db.getOne('SELECT id, full_name FROM students WHERE id = ?', [studentId]);
    if (!student) return { error: 'الطالب غير موجود' };
    const payments = await db.query(`
      SELECT p.payment_date AS paymentDate, p.amount,
        c.name AS cohort, pm.name_ar AS paymentMethod
      FROM payments p
      JOIN cohorts c ON c.id = p.cohort_id
      JOIN payment_methods pm ON pm.id = p.payment_method_id
      WHERE p.student_id = ? AND p.status = 'completed'
      ORDER BY p.payment_date DESC, p.id DESC
      LIMIT ?
    `, [studentId, limit]);
    return {
      student: student.full_name,
      payments: payments.map(payment => ({ ...payment, amount: Number(payment.amount) }))
    };
  }
);

let shutdownStarted = false;
async function shutdown() {
  if (shutdownStarted) return;
  shutdownStarted = true;
  await db.closeDb();
}

async function start() {
  console.log = (...args) => console.error(...args);
  await db.initDb();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (require.main === module) {
  start().catch(error => {
    console.error('Failed to start read-only NG Financial System MCP server:', error);
    shutdown().finally(() => {
      process.exitCode = 1;
    });
  });
  process.once('SIGINT', () => shutdown().finally(() => process.exit(0)));
  process.once('SIGTERM', () => shutdown().finally(() => process.exit(0)));
}

module.exports = { server, start, shutdown };
