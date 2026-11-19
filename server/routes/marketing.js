const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { authenticate, requireRole } = require('./auth');

const allowedStatuses = new Set(['active', 'paused', 'completed']);
const allowedBudgetTypes = new Set(['daily', 'total']);
const allowedDurationTypes = new Set(['fixed', 'ongoing']);
const metricFields = [
  ['budget', 'الميزانية', false],
  ['spentAmount', 'الإنفاق الفعلي', false],
  ['conversationCount', 'عدد المحادثات', true],
  ['registrationCount', 'عدد التسجيلات', true],
  ['confirmedCount', 'عدد المؤكدين', true],
  ['attendedCount', 'عدد الحاضرين', true]
];

function dateOnly(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return typeof value === 'string' ? value.slice(0, 10) : value;
}

function localDateToday() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function validateCampaign(body, existing = null) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return { error: 'اسم الحملة مطلوب' };
  if (name.length > 150) return { error: 'اسم الحملة يجب ألا يتجاوز 150 حرفاً' };

  const metrics = {};
  for (const [field, label, integer] of metricFields) {
    const existingField = {
      spentAmount: 'spent_amount',
      conversationCount: 'conversation_count',
      registrationCount: 'registration_count',
      confirmedCount: 'confirmed_count',
      attendedCount: 'attended_count'
    }[field] || field;
    const rawValue = body[field] === undefined && existing
      ? existing[existingField]
      : body[field];
    const value = rawValue === '' || rawValue === null || rawValue === undefined ? 0 : Number(rawValue);
    if (!Number.isFinite(value) || value < 0 || (integer && !Number.isInteger(value))) {
      return { error: `${label} يجب أن يكون ${integer ? 'عدداً صحيحاً' : 'رقماً'} غير سالب` };
    }
    metrics[field] = value;
  }

  const durationType = body.durationType === undefined && existing ? existing.duration_type || 'fixed' : body.durationType || 'fixed';
  if (!allowedDurationTypes.has(durationType)) return { error: 'مدة الحملة غير صحيحة' };
  const status = body.status || (existing && existing.status) || 'active';
  if (!allowedStatuses.has(status)) return { error: 'حالة الحملة غير صحيحة' };

  const startDate = dateOnly(body.startDate === undefined && existing ? existing.start_date : body.startDate || null);
  let endDate = dateOnly(body.endDate === undefined && existing ? existing.end_date : body.endDate || null);
  const isDate = value => {
    if (!value) return true;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  if (!isDate(startDate) || !isDate(endDate)) return { error: 'صيغة تاريخ الحملة غير صحيحة' };
  if (!startDate) return { error: 'تاريخ بداية الحملة مطلوب' };
  if (durationType === 'fixed' && !endDate) return { error: 'تاريخ نهاية الحملة مطلوب للحملة محددة المدة' };
  if (durationType === 'ongoing' && status === 'active') endDate = null;
  if (durationType === 'ongoing' && status === 'completed' && !endDate) {
    endDate = localDateToday();
  }
  if (endDate && startDate > endDate) return { error: 'تاريخ البداية يجب أن يسبق تاريخ النهاية' };

  const budgetType = body.budgetType === undefined && existing ? existing.budget_type || 'total' : body.budgetType || 'total';
  if (!allowedBudgetTypes.has(budgetType)) return { error: 'نوع الميزانية غير صحيح' };

  return {
    campaign: {
      name,
      platform: typeof body.platform === 'string' ? body.platform.trim().slice(0, 100) || null : null,
      ...metrics,
      budgetType,
      durationType,
      startDate,
      endDate,
      status,
      notes: typeof body.notes === 'string' ? body.notes.trim() || null : null
    }
  };
}

function campaignValues(campaign) {
  return [
    campaign.name,
    campaign.platform,
    campaign.budget,
    campaign.budgetType,
    campaign.durationType,
    campaign.spentAmount,
    campaign.conversationCount,
    campaign.registrationCount,
    campaign.confirmedCount,
    campaign.attendedCount,
    campaign.startDate,
    campaign.endDate,
    campaign.status,
    campaign.notes
  ];
}

function getCampaignTotalBudget(campaign) {
  const budget = Number(campaign.budget) || 0;
  if ((campaign.budget_type || campaign.budgetType || 'total') !== 'daily') return budget;
  if ((campaign.duration_type || campaign.durationType || 'fixed') === 'ongoing' && campaign.status !== 'completed') return null;

  const startDate = dateOnly(campaign.start_date || campaign.startDate);
  const endDate = dateOnly(campaign.end_date || campaign.endDate);
  if (!startDate || !endDate) return 0;

  const start = Date.parse(`${String(startDate).slice(0, 10)}T00:00:00Z`);
  const end = Date.parse(`${String(endDate).slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  const days = Math.floor((end - start) / 86400000) + 1;
  return budget * days;
}

router.get('/summary', authenticate, async (req, res) => {
  try {
    const campaigns = await db.query(`
      SELECT *
      FROM marketing_campaigns
      ORDER BY
        CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,
        COALESCE(start_date, created_at) DESC,
        id DESC
    `);

    const campaignsWithTotalBudget = campaigns.map(campaign => ({
      ...campaign,
      effective_budget: getCampaignTotalBudget(campaign)
    }));
    const totals = campaignsWithTotalBudget.reduce((summary, campaign) => {
      summary.budget += Number(campaign.effective_budget) || 0;
      summary.spentAmount += Number(campaign.spent_amount) || 0;
      summary.conversationCount += Number(campaign.conversation_count) || 0;
      summary.registrationCount += Number(campaign.registration_count) || 0;
      summary.confirmedCount += Number(campaign.confirmed_count) || 0;
      summary.attendedCount += Number(campaign.attended_count) || 0;
      return summary;
    }, {
      campaignCount: campaigns.length,
      activeCampaignCount: campaigns.filter(campaign => campaign.status === 'active').length,
      budget: 0,
      spentAmount: 0,
      conversationCount: 0,
      registrationCount: 0,
      confirmedCount: 0,
      attendedCount: 0
    });

    res.json({
      totals: {
        ...totals,
        costPerConversation: totals.conversationCount ? totals.spentAmount / totals.conversationCount : 0,
        costPerRegistration: totals.registrationCount ? totals.spentAmount / totals.registrationCount : 0,
        costPerAttendee: totals.attendedCount ? totals.spentAmount / totals.attendedCount : 0
      },
      campaigns: campaignsWithTotalBudget
    });
  } catch (err) {
    console.error('Error fetching marketing summary:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/campaigns/:id', authenticate, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'رقم الحملة غير صحيح' });

  try {
    const campaign = await db.getOne('SELECT * FROM marketing_campaigns WHERE id = ?', [id]);
    if (!campaign) return res.status(404).json({ error: 'الحملة غير موجودة' });
    const followups = await db.query(`
      SELECT f.*, u.full_name AS user_name
      FROM marketing_campaign_followups f
      LEFT JOIN users u ON u.id = f.user_id
      WHERE f.campaign_id = ?
      ORDER BY f.followup_date DESC, f.id DESC
    `, [id]);
    res.json({ campaign: { ...campaign, effective_budget: getCampaignTotalBudget(campaign) }, followups });
  } catch (err) {
    console.error('Error fetching marketing campaign details:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/campaigns', authenticate, requireRole(['admin', 'manager']), async (req, res) => {
  const result = validateCampaign(req.body);
  if (result.error) return res.status(400).json({ error: result.error });

  try {
    const campaign = result.campaign;
    const inserted = await db.execute(`
      INSERT INTO marketing_campaigns (
        name, platform, budget, budget_type, duration_type, spent_amount, conversation_count,
        registration_count, confirmed_count, attended_count, start_date,
        end_date, status, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
    `, campaignValues(campaign));
    await db.execute(`
      INSERT INTO audit_logs (user_id, username, action_type, entity_name, entity_id, details, created_at)
      VALUES (?, ?, 'CREATE', 'marketing_campaigns', ?, ?, datetime('now', 'localtime'))
    `, [req.user.id, req.user.username, inserted.insertId, `إضافة حملة تسويقية: ${campaign.name}`]);

    res.status(201).json({ success: true, campaignId: inserted.insertId });
  } catch (err) {
    console.error('Error creating marketing campaign:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/campaigns/:id', authenticate, requireRole(['admin', 'manager']), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'رقم الحملة غير صحيح' });

  try {
    const existing = await db.getOne('SELECT * FROM marketing_campaigns WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'الحملة غير موجودة' });
    const result = validateCampaign(req.body, existing);
    if (result.error) return res.status(400).json({ error: result.error });
    const campaign = result.campaign;
    await db.execute(`
      UPDATE marketing_campaigns
      SET name = ?, platform = ?, budget = ?, budget_type = ?, duration_type = ?, spent_amount = ?,
          conversation_count = ?, registration_count = ?, confirmed_count = ?,
          attended_count = ?, start_date = ?, end_date = ?, status = ?,
          notes = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `, [...campaignValues(campaign), id]);

    await db.execute(`
      INSERT INTO audit_logs (user_id, username, action_type, entity_name, entity_id, details, created_at)
      VALUES (?, ?, 'UPDATE', 'marketing_campaigns', ?, ?, datetime('now', 'localtime'))
    `, [req.user.id, req.user.username, id, `تحديث حملة تسويقية: ${campaign.name}`]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating marketing campaign:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/campaigns/:id/followups', authenticate, requireRole(['admin', 'manager']), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'رقم الحملة غير صحيح' });

  const followup = {};
  const totalSpentAmount = req.body.spentAmount === '' || req.body.spentAmount === null || req.body.spentAmount === undefined
    ? null
    : Number(req.body.spentAmount);
  if (totalSpentAmount !== null && (!Number.isFinite(totalSpentAmount) || totalSpentAmount < 0)) {
    return res.status(400).json({ error: 'إجمالي الإنفاق يجب أن يكون رقماً غير سالب' });
  }
  for (const [field, label, integer] of metricFields.slice(2)) {
    const followupField = field;
    const value = req.body[followupField] === '' || req.body[followupField] === null || req.body[followupField] === undefined
      ? 0
      : Number(req.body[followupField]);
    if (!Number.isFinite(value) || value < 0 || (integer && !Number.isInteger(value))) {
      return res.status(400).json({ error: `${label} في المتابعة يجب أن يكون ${integer ? 'عدداً صحيحاً' : 'رقماً'} غير سالب` });
    }
    followup[followupField] = value;
  }

  const followupDate = req.body.followupDate || new Date().toISOString().slice(0, 10);
  if (typeof followupDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(followupDate)) {
    return res.status(400).json({ error: 'تاريخ المتابعة غير صحيح' });
  }
  const notes = typeof req.body.notes === 'string' ? req.body.notes.trim() || null : null;

  try {
    const created = await db.transaction(async tx => {
      const campaign = await tx.getOne('SELECT id, name, status, spent_amount FROM marketing_campaigns WHERE id = ?', [id]);
      if (!campaign) return { notFound: true };
      if (
        campaign.status !== 'completed' &&
        (followup.confirmedCount > 0 || followup.attendedCount > 0)
      ) {
        return { finalMetricsRequired: true };
      }

      const previousSpentCents = Math.round(Number(campaign.spent_amount || 0) * 100);
      const totalSpentCents = totalSpentAmount === null ? previousSpentCents : Math.round(totalSpentAmount * 100);
      if (totalSpentCents < previousSpentCents) {
        return { invalidTotal: true, previousTotal: previousSpentCents / 100 };
      }
      const totalSpent = totalSpentCents / 100;
      const addedSpent = (totalSpentCents - previousSpentCents) / 100;

      if (addedSpent > 0) {
        const updated = await tx.execute(`
          UPDATE marketing_campaigns
          SET spent_amount = ?, updated_at = datetime('now', 'localtime')
          WHERE id = ? AND spent_amount = ?
        `, [totalSpent, id, campaign.spent_amount]);
        if (updated.affectedRows !== 1) throw new Error('تغير إجمالي إنفاق الحملة أثناء تسجيل المتابعة؛ أعد المحاولة');
      }

      const inserted = await tx.execute(`
        INSERT INTO marketing_campaign_followups (
          campaign_id, user_id, followup_date, spent_amount, conversation_count,
          registration_count, confirmed_count, attended_count, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
      `, [
        id,
        req.user.id,
        followupDate,
        addedSpent,
        followup.conversationCount,
        followup.registrationCount,
        followup.confirmedCount,
        followup.attendedCount,
        notes
      ]);
      await tx.execute(`
        UPDATE marketing_campaigns
        SET conversation_count = conversation_count + ?,
            registration_count = registration_count + ?,
            confirmed_count = confirmed_count + ?,
            attended_count = attended_count + ?,
            updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `, [
        followup.conversationCount,
        followup.registrationCount,
        followup.confirmedCount,
        followup.attendedCount,
        id
      ]);
      return { ...inserted, campaignName: campaign.name, totalSpent, addedSpent };
    });

    if (created.notFound) return res.status(404).json({ error: 'الحملة غير موجودة' });
    if (created.finalMetricsRequired) {
      return res.status(400).json({ error: 'تُسجّل التأكيدات والحضور بعد إيقاف الحملة فقط' });
    }
    if (created.invalidTotal) {
      return res.status(400).json({
        error: `إجمالي الإنفاق لا يمكن أن يقل عن الإجمالي المسجل سابقاً (${created.previousTotal} دج)`
      });
    }
    await db.execute(`
      INSERT INTO audit_logs (user_id, username, action_type, entity_name, entity_id, details, created_at)
      VALUES (?, ?, 'UPDATE', 'marketing_campaigns', ?, ?, datetime('now', 'localtime'))
    `, [req.user.id, req.user.username, id, `إضافة متابعة للحملة: ${created.campaignName}، زيادة الإنفاق ${created.addedSpent} دج`]);
    res.status(201).json({
      success: true,
      followupId: created.insertId,
      addedSpentAmount: created.addedSpent,
      totalSpentAmount: created.totalSpent
    });
  } catch (err) {
    console.error('Error recording marketing campaign follow-up:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/campaigns/:id', authenticate, requireRole(['admin', 'manager']), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'رقم الحملة غير صحيح' });

  try {
    const campaign = await db.getOne('SELECT name FROM marketing_campaigns WHERE id = ?', [id]);
    if (!campaign) return res.status(404).json({ error: 'الحملة غير موجودة' });
    await db.execute('DELETE FROM marketing_campaigns WHERE id = ?', [id]);
    await db.execute(`
      INSERT INTO audit_logs (user_id, username, action_type, entity_name, entity_id, details, created_at)
      VALUES (?, ?, 'DELETE', 'marketing_campaigns', ?, ?, datetime('now', 'localtime'))
    `, [req.user.id, req.user.username, id, `حذف حملة تسويقية: ${campaign.name}`]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting marketing campaign:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
