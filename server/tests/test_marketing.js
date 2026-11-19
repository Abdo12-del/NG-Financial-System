const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const jwt = require('jsonwebtoken');

const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ng-marketing-test-'));
process.env.DB_CONFIG_FILE = path.join(testDataDir, 'db_config.json');
process.env.SQLITE_FILE = path.join(testDataDir, 'ng_financial.db');
process.env.JWT_SECRET = 'ng-marketing-test-secret';
fs.writeFileSync(process.env.DB_CONFIG_FILE, JSON.stringify({ engine: 'sqlite' }));

const db = require('../db/connection');
const app = express();
app.use(express.json());
app.use('/api/marketing', require('../routes/marketing'));

const token = jwt.sign({ id: 1, username: 'test-admin', role: 'admin' }, process.env.JWT_SECRET);
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

async function runMarketingTest() {
  await db.initDb();
  db.getSqliteDb().exec('ALTER TABLE marketing_campaigns DROP COLUMN duration_type');
  db.getSqliteDb().exec('ALTER TABLE marketing_campaigns DROP COLUMN budget_type');
  await db.closeDb();
  await db.initDb();
  assert(
    db.getSqliteDb().pragma('table_info(marketing_campaigns)').some(column => column.name === 'budget_type'),
    'Existing campaign tables should be upgraded with a total-budget default'
  );
  assert(
    db.getSqliteDb().pragma('table_info(marketing_campaigns)').some(column => column.name === 'duration_type'),
    'Existing campaign tables should be upgraded with a fixed-duration default'
  );
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/marketing`;

  try {
    let response = await fetch(`${baseUrl}/summary`, { headers });
    assert.strictEqual(response.status, 200);
    let summary = await response.json();
    assert.strictEqual(summary.totals.campaignCount, 0);

    response = await fetch(`${baseUrl}/campaigns`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'حملة تجريبية',
        platform: 'Instagram',
        budget: 20000,
        startDate: '2026-10-01',
        endDate: '2026-10-31'
      })
    });
    assert.strictEqual(response.status, 201);
    const { campaignId } = await response.json();

    response = await fetch(`${baseUrl}/summary`, { headers });
    summary = await response.json();
    assert.strictEqual(summary.totals.campaignCount, 1);
    assert.strictEqual(summary.totals.spentAmount, 0);
    assert.strictEqual(summary.totals.budget, 20000);

    response = await fetch(`${baseUrl}/campaigns/${campaignId}`, { headers });
    let details = await response.json();
    assert.strictEqual(response.status, 200);
    assert.strictEqual(details.followups.length, 0);

    response = await fetch(`${baseUrl}/campaigns/${campaignId}/followups`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        followupDate: '2026-10-05',
        spentAmount: 12000,
        conversationCount: 120,
        registrationCount: 30,
        confirmedCount: 0,
        attendedCount: 0,
        notes: 'متابعة أول أسبوع'
      })
    });
    assert.strictEqual(response.status, 201);
    let followupResult = await response.json();
    assert.strictEqual(followupResult.addedSpentAmount, 12000);
    assert.strictEqual(followupResult.totalSpentAmount, 12000);
    details = await (await fetch(`${baseUrl}/campaigns/${campaignId}`, { headers })).json();
    assert.strictEqual(details.followups.length, 1);
    assert.strictEqual(details.followups[0].notes, 'متابعة أول أسبوع');
    assert.strictEqual(Number(details.followups[0].spent_amount), 12000);

    response = await fetch(`${baseUrl}/campaigns/${campaignId}/followups`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ spentAmount: 13000, conversationCount: 10, registrationCount: 5 })
    });
    assert.strictEqual(response.status, 201);
    followupResult = await response.json();
    assert.strictEqual(followupResult.addedSpentAmount, 1000);
    assert.strictEqual(followupResult.totalSpentAmount, 13000);

    response = await fetch(`${baseUrl}/campaigns/${campaignId}/followups`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ confirmedCount: 20, attendedCount: 15 })
    });
    assert.strictEqual(response.status, 400);

    response = await fetch(`${baseUrl}/campaigns/${campaignId}/followups`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ spentAmount: 13000 })
    });
    assert.strictEqual(response.status, 201);
    followupResult = await response.json();
    assert.strictEqual(followupResult.addedSpentAmount, 0);

    response = await fetch(`${baseUrl}/campaigns/${campaignId}/followups`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ spentAmount: 12000 })
    });
    assert.strictEqual(response.status, 400);

    response = await fetch(`${baseUrl}/summary`, { headers });
    summary = await response.json();
    assert.strictEqual(summary.totals.spentAmount, 13000);
    assert.strictEqual(summary.totals.costPerConversation, 100);
    assert.strictEqual(summary.totals.costPerRegistration, 13000 / 35);
    assert.strictEqual(summary.totals.costPerAttendee, 0);

    response = await fetch(`${baseUrl}/campaigns/${campaignId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        name: 'حملة تجريبية بعد التعديل',
        budget: 25000,
      })
    });
    assert.strictEqual(response.status, 200);

    details = await (await fetch(`${baseUrl}/campaigns/${campaignId}`, { headers })).json();
    assert.strictEqual(Number(details.campaign.spent_amount), 13000);
    assert.strictEqual(Number(details.campaign.conversation_count), 130);

    response = await fetch(`${baseUrl}/campaigns/${campaignId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ name: 'حملة تجريبية بعد التعديل', status: 'completed' })
    });
    assert.strictEqual(response.status, 200);

    response = await fetch(`${baseUrl}/campaigns/${campaignId}/followups`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ confirmedCount: 20, attendedCount: 15 })
    });
    assert.strictEqual(response.status, 201);
    details = await (await fetch(`${baseUrl}/campaigns/${campaignId}`, { headers })).json();
    assert.strictEqual(Number(details.campaign.confirmed_count), 20);
    assert.strictEqual(Number(details.campaign.attended_count), 15);
    response = await fetch(`${baseUrl}/summary`, { headers });
    summary = await response.json();
    assert.strictEqual(summary.totals.confirmedCount, 20);
    assert.strictEqual(summary.totals.attendedCount, 15);
    assert.strictEqual(summary.totals.costPerAttendee, 13000 / 15);

    response = await fetch(`${baseUrl}/campaigns`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'حملة بميزانية يومية',
        budget: 1000,
        budgetType: 'daily',
        durationType: 'fixed',
        startDate: '2026-10-01',
        endDate: '2026-10-03'
      })
    });
    assert.strictEqual(response.status, 201);
    const { campaignId: dailyCampaignId } = await response.json();

    response = await fetch(`${baseUrl}/campaigns/${dailyCampaignId}`, { headers });
    details = await response.json();
    assert.strictEqual(details.campaign.budget_type, 'daily');
    assert.strictEqual(details.campaign.duration_type, 'fixed');
    assert.strictEqual(Number(details.campaign.effective_budget), 3000);

    response = await fetch(`${baseUrl}/campaigns/${dailyCampaignId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ name: 'حملة بميزانية يومية بعد التعديل' })
    });
    assert.strictEqual(response.status, 200);
    details = await (await fetch(`${baseUrl}/campaigns/${dailyCampaignId}`, { headers })).json();
    assert.strictEqual(details.campaign.budget_type, 'daily');
    assert.strictEqual(details.campaign.start_date.slice(0, 10), '2026-10-01');
    assert.strictEqual(Number(details.campaign.effective_budget), 3000);

    response = await fetch(`${baseUrl}/campaigns`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'حملة مستمرة بميزانية يومية',
        budget: 500,
        budgetType: 'daily',
        durationType: 'ongoing',
        startDate: '2026-10-01'
      })
    });
    assert.strictEqual(response.status, 201);
    const { campaignId: ongoingCampaignId } = await response.json();

    response = await fetch(`${baseUrl}/campaigns/${ongoingCampaignId}`, { headers });
    details = await response.json();
    assert.strictEqual(details.campaign.duration_type, 'ongoing');
    assert.strictEqual(details.campaign.end_date, null);
    assert.strictEqual(details.campaign.effective_budget, null);

    response = await fetch(`${baseUrl}/campaigns/${ongoingCampaignId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ name: 'حملة مستمرة بميزانية يومية', status: 'completed' })
    });
    assert.strictEqual(response.status, 200);
    details = await (await fetch(`${baseUrl}/campaigns/${ongoingCampaignId}`, { headers })).json();
    assert.strictEqual(details.campaign.status, 'completed');
    assert(details.campaign.end_date, 'Stopping the ongoing campaign should record its end date');
    const start = Date.parse('2026-10-01T00:00:00Z');
    const end = Date.parse(`${String(details.campaign.end_date).slice(0, 10)}T00:00:00Z`);
    const campaignDays = Math.floor((end - start) / 86400000) + 1;
    assert.strictEqual(Number(details.campaign.effective_budget), 500 * campaignDays);

    response = await fetch(`${baseUrl}/summary`, { headers });
    summary = await response.json();
    assert.strictEqual(summary.totals.budget, 28000 + 500 * campaignDays);

    response = await fetch(`${baseUrl}/campaigns`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'حملة محددة المدة بلا نهاية', budget: 1000, durationType: 'fixed', startDate: '2026-10-01' })
    });
    assert.strictEqual(response.status, 400);

    response = await fetch(`${baseUrl}/campaigns`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'حملة مستمرة بلا بداية', budget: 1000, durationType: 'ongoing' })
    });
    assert.strictEqual(response.status, 400);

    response = await fetch(`${baseUrl}/campaigns`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'مدخل غير صالح', conversationCount: 2.5 })
    });
    assert.strictEqual(response.status, 400);

    response = await fetch(`${baseUrl}/campaigns/${campaignId}/followups`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ conversationCount: 2.5 })
    });
    assert.strictEqual(response.status, 400);

    response = await fetch(`${baseUrl}/campaigns/${campaignId}`, { method: 'DELETE', headers });
    assert.strictEqual(response.status, 200);
    response = await fetch(`${baseUrl}/campaigns/${dailyCampaignId}`, { method: 'DELETE', headers });
    assert.strictEqual(response.status, 200);
    response = await fetch(`${baseUrl}/campaigns/${ongoingCampaignId}`, { method: 'DELETE', headers });
    assert.strictEqual(response.status, 200);
    response = await fetch(`${baseUrl}/summary`, { headers });
    summary = await response.json();
    assert.strictEqual(summary.totals.campaignCount, 0);
    console.log('Marketing CRUD, fixed/ongoing campaigns, cumulative spend, migrations, and metrics passed.');
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

runMarketingTest()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.closeDb();
    fs.rmSync(testDataDir, { recursive: true, force: true });
  });
