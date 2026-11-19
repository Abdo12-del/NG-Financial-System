const assert = require('assert');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');

const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ng-mcp-readonly-test-'));
const dbConfigFile = path.join(testDataDir, 'db_config.json');
const sqliteFile = path.join(testDataDir, 'ng_financial.db');
fs.writeFileSync(dbConfigFile, JSON.stringify({ engine: 'sqlite' }));
process.env.DB_CONFIG_FILE = dbConfigFile;
process.env.SQLITE_FILE = sqliteFile;

const db = require('../db/connection');
const mcpServerPath = path.join(__dirname, '..', 'mcp', 'readOnlyServer.js');

function createResponseReader(child) {
  const lines = readline.createInterface({ input: child.stdout });
  const waiting = [];
  const queued = [];
  let processError = null;

  lines.on('line', line => {
    let response;
    try {
      response = JSON.parse(line);
    } catch (error) {
      processError = new Error(`MCP stdout contained non-JSON output: ${line}`);
      while (waiting.length) waiting.shift().reject(processError);
      return;
    }
    if (waiting.length) waiting.shift().resolve(response);
    else queued.push(response);
  });
  child.once('error', error => {
    processError = error;
    while (waiting.length) waiting.shift().reject(error);
  });
  child.once('exit', (code, signal) => {
    processError = new Error(`MCP server exited before the test completed (code=${code}, signal=${signal})`);
    while (waiting.length) waiting.shift().reject(processError);
  });

  return {
    next: () => {
      if (processError) return Promise.reject(processError);
      if (queued.length) return Promise.resolve(queued.shift());
      return new Promise((resolve, reject) => waiting.push({ resolve, reject }));
    },
    close: () => lines.close()
  };
}

async function runMcpReadOnlyTest() {
  await db.initDb();
  const user = await db.execute(`
    INSERT INTO users (username, password_hash, full_name, role)
    VALUES ('mcp-read-test', 'test-hash', 'MCP Read Test', 'admin')
  `);
  const course = await db.execute(`INSERT INTO courses (name, default_price) VALUES ('MCP Read Course', 5000)`);
  const teacher = await db.execute(`INSERT INTO teachers (full_name) VALUES ('MCP Read Teacher')`);
  const cohort = await db.execute(`
    INSERT INTO cohorts (course_id, teacher_id, name, status)
    VALUES (?, ?, 'MCP Read Cohort', 'active')
  `, [course.insertId, teacher.insertId]);
  const student = await db.execute(`
    INSERT INTO students (full_name, phone, guardian_phone)
    VALUES ('MCP Read Student', '0555555555', '0666666666')
  `);
  const enrollment = await db.execute(`
    INSERT INTO enrollments
      (student_id, cohort_id, agreed_price, net_price, paid_amount, remaining_amount,
       payment_status, confirmation_status, billing_start_month, enrollment_date)
    VALUES (?, ?, 5000, 5000, 500, 4500, 'PARTIAL', 'confirmed', '2026-11', date('now'))
  `, [student.insertId, cohort.insertId]);
  const pendingStudent = await db.execute(`INSERT INTO students (full_name) VALUES ('MCP Pending Student')`);
  await db.execute(`
    INSERT INTO enrollments
      (student_id, cohort_id, agreed_price, net_price, remaining_amount, confirmation_status, enrollment_date)
    VALUES (?, ?, 8000, 8000, 8000, 'pending', date('now'))
  `, [pendingStudent.insertId, cohort.insertId]);

  await db.closeDb();

  const child = spawn(process.execPath, [mcpServerPath], {
    cwd: path.join(__dirname, '..', '..'),
    env: { ...process.env, DB_CONFIG_FILE: dbConfigFile, SQLITE_FILE: sqliteFile },
    stdio: ['pipe', 'pipe', 'pipe']
  });
  const reader = createResponseReader(child);
  let nextId = 1;
  const request = async (method, params = {}) => {
    const id = nextId++;
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    const response = await reader.next();
    assert.strictEqual(response.id, id, `response id for ${method}`);
    return response;
  };

  try {
    const initialize = await request('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'ng-mcp-readonly-test', version: '1.0.0' }
    });
    assert.strictEqual(initialize.result.protocolVersion, '2025-03-26');
    assert.ok(initialize.result.capabilities.tools);
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);

    const listed = await request('tools/list');
    const tools = listed.result.tools;
    const toolNames = tools.map(tool => tool.name);
    assert.deepStrictEqual(toolNames, [
      'get_financial_summary',
      'list_cohorts',
      'get_cohort_outstanding',
      'search_student_enrollments',
      'list_student_payments'
    ]);

    const callTool = async (name, args) => request('tools/call', { name, arguments: args });
    const summaryResponse = await callTool('get_financial_summary', {});
    assert.strictEqual(summaryResponse.result.isError, undefined);
    const summary = JSON.parse(summaryResponse.result.content[0].text);
    assert.deepStrictEqual(summary.confirmedStudentDues, { amount: 4500, enrollments: 1 });

    const cohortResponse = await callTool('get_cohort_outstanding', {
      cohortId: cohort.insertId,
      includeStudents: true
    });
    const cohortSummary = JSON.parse(cohortResponse.result.content[0].text);
    assert.strictEqual(cohortSummary.outstandingAmount, 4500);
    assert.strictEqual(cohortSummary.students.length, 1);
    assert.strictEqual(cohortSummary.students[0].student, 'MCP Read Student');

    const searchResponse = await callTool('search_student_enrollments', { search: 'MCP Read Student' });
    const searchResult = JSON.parse(searchResponse.result.content[0].text);
    assert.strictEqual(searchResult.length, 1);
    assert.strictEqual(searchResult[0].studentId, student.insertId);
    assert.strictEqual(searchResult[0].outstandingAmount, 4500);
    assert.ok(!Object.hasOwn(searchResult[0], 'phone'));

    assert.ok(!toolNames.some(name => /(^|_)(write|update|delete|create|charge)(_|$)/i.test(name)));
  } finally {
    await new Promise(resolve => {
      if (child.exitCode !== null || child.signalCode !== null) {
        resolve();
        return;
      }
      child.once('exit', resolve);
      child.kill('SIGTERM');
    });
    reader.close();
    await db.initDb();
    assert.strictEqual(
      Number((await db.getOne(`SELECT remaining_amount FROM enrollments WHERE id = ?`, [enrollment.insertId])).remaining_amount),
      4500
    );
    assert.strictEqual(
      Number((await db.getOne(`SELECT remaining_amount FROM enrollments WHERE student_id = ?`, [pendingStudent.insertId])).remaining_amount),
      8000
    );
    await db.closeDb();
    fs.rmSync(testDataDir, { recursive: true, force: true });
  }
}

runMcpReadOnlyTest()
  .then(() => console.log('Read-only MCP protocol tests passed.'))
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
