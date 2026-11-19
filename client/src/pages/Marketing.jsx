import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  ChartNoAxesCombined,
  CircleDollarSign,
  ClipboardList,
  MessageCircle,
  Pencil,
  Plus,
  Target,
  Trash2,
  UsersRound
} from 'lucide-react';
import { apiRequest, formatCurrency, formatDate } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

const blankCampaign = { name: '', platform: '', budget: '', budgetType: 'total', durationType: 'fixed', startDate: '', endDate: '', status: 'active' };
const blankFollowup = {
  followupDate: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10),
  spentAmount: '',
  conversationCount: '',
  registrationCount: '',
  confirmedCount: '',
  attendedCount: '',
  notes: ''
};
const statusLabels = { active: 'نشطة', paused: 'متوقفة مؤقتاً', completed: 'مكتملة' };

function costPer(spent, count) {
  return Number(count) > 0 ? formatCurrency(Number(spent || 0) / Number(count)) : '—';
}

function StatCard({ label, value, detail, icon: Icon, color }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-slate-500">{label}</p>
          <p className="mt-3 text-2xl font-black text-slate-900">{value}</p>
          <p className="mt-1 text-[11px] text-slate-400">{detail}</p>
        </div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </article>
  );
}

function Field({ label, children, className = '' }) {
  return (
    <label className={`block text-xs font-bold text-slate-600 ${className}`}>
      {label}
      {children}
    </label>
  );
}

function inputClass() {
  return 'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-violet-400';
}

function dateInputValue(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value ? String(value).slice(0, 10) : '';
}

function campaignFormValues(campaign) {
  return campaign ? {
    name: campaign.name || '',
    platform: campaign.platform || '',
    budget: campaign.budget ?? '',
    budgetType: campaign.budget_type || 'total',
    durationType: campaign.duration_type || 'fixed',
    startDate: dateInputValue(campaign.start_date),
    endDate: dateInputValue(campaign.end_date),
    status: campaign.status || 'active'
  } : blankCampaign;
}

function CampaignFormModal({ open, onClose, campaign, onSaved }) {
  const [form, setForm] = useState(() => campaignFormValues(campaign));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const editing = Boolean(campaign);

  const save = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, budget: Number(form.budget || 0) };
      await apiRequest(editing ? `/marketing/campaigns/${campaign.id}` : '/marketing/campaigns', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      });
      onClose();
      await onSaved();
    } catch (saveError) {
      setError(saveError.message || 'تعذر حفظ بيانات الحملة');
    } finally {
      setSaving(false);
    }
  };

  const setField = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={editing ? 'تعديل بيانات الحملة' : 'إنشاء حملة إعلانية'}
      maxWidth="max-w-xl"
    >
      <form onSubmit={save} className="space-y-4">
        <p className="rounded-xl bg-violet-50 p-3 text-xs leading-6 text-violet-800">
          أدخل معلومات الحملة الأساسية فقط. أرقام النتائج والإنفاق تُسجّل لاحقاً من صفحة متابعة الحملة.
        </p>
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</p>}
        <Field label="اسم الحملة *">
          <input required maxLength="150" name="name" value={form.name} onChange={setField} className={inputClass()} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="المنصة">
            <input name="platform" value={form.platform} onChange={setField} placeholder="فيسبوك، إنستغرام..." className={inputClass()} />
          </Field>
          <Field label="نوع الميزانية">
            <select name="budgetType" value={form.budgetType} onChange={setField} className={inputClass()}>
              <option value="total">ميزانية كلية للحملة</option>
              <option value="daily">ميزانية يومية</option>
            </select>
          </Field>
          <Field label={`${form.budgetType === 'daily' ? 'الميزانية اليومية' : 'الميزانية الكلية'} (دج)`}>
            <input type="number" min="0" step="0.01" name="budget" value={form.budget} onChange={setField} className={inputClass()} />
          </Field>
          <Field label="مدة الحملة">
            <select name="durationType" value={form.durationType} onChange={setField} className={inputClass()}>
              <option value="fixed">محددة المدة</option>
              <option value="ongoing">مستمرة حتى إيقافها</option>
            </select>
          </Field>
          <Field label="تاريخ البداية">
            <input required type="date" name="startDate" value={form.startDate} onChange={setField} className={inputClass()} />
          </Field>
          {form.durationType === 'fixed' && (
            <Field label="تاريخ النهاية">
              <input required type="date" name="endDate" value={form.endDate} onChange={setField} className={inputClass()} />
            </Field>
          )}
          {editing && (
            <Field label="حالة الحملة">
              <select name="status" value={form.status} onChange={setField} className={inputClass()}>
                <option value="active">نشطة</option>
                <option value="paused">متوقفة مؤقتاً</option>
                <option value="completed">إيقاف الحملة واحتساب الميزانية النهائية</option>
              </select>
            </Field>
          )}
        </div>
        {form.budgetType === 'daily' && (
          <p className="rounded-xl bg-sky-50 p-3 text-xs leading-6 text-sky-800">
            {form.durationType === 'fixed'
              ? 'تُحسب الميزانية الكلية بضرب الميزانية اليومية في عدد أيام الحملة، مع احتساب يوم البداية والنهاية.'
              : 'تُحسب الميزانية الكلية عند إيقاف الحملة، بضرب الميزانية اليومية في عدد أيام تشغيلها.'}
          </p>
        )}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600">إلغاء</button>
          <button disabled={saving} type="submit" className="rounded-xl bg-violet-600 px-5 py-2 text-xs font-bold text-white disabled:opacity-60">
            {saving ? 'جاري الحفظ...' : editing ? 'حفظ التعديلات' : 'إنشاء الحملة'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FollowupForm({ campaignId, currentSpent, campaignCompleted, onSaved }) {
  const [form, setForm] = useState(() => ({ ...blankFollowup, spentAmount: String(currentSpent) }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const enteredSpentCents = Math.round(Number(form.spentAmount || 0) * 100);
  const currentSpentCents = Math.round(Number(currentSpent || 0) * 100);
  const addedSpent = (enteredSpentCents - currentSpentCents) / 100;

  const save = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = await apiRequest(`/marketing/campaigns/${campaignId}/followups`, {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          spentAmount: Number(form.spentAmount || 0),
          conversationCount: Number(form.conversationCount || 0),
          registrationCount: Number(form.registrationCount || 0),
          confirmedCount: Number(form.confirmedCount || 0),
          attendedCount: Number(form.attendedCount || 0)
        })
      });
      setForm({
        ...blankFollowup,
        spentAmount: String(result.totalSpentAmount),
        followupDate: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
      });
      await onSaved();
    } catch (saveError) {
      setError(saveError.message || 'تعذر تسجيل المتابعة');
    } finally {
      setSaving(false);
    }
  };

  const setField = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));

  return (
    <section className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><ClipboardList className="h-5 w-5" /></span>
        <div>
          <h3 className="font-black text-slate-900">تسجيل متابعة جديدة</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">أدخل إجمالي الإنفاق المسجل حتى الآن، وستُضاف أعداد النتائج الجديدة إلى الإجمالي التراكمي.</p>
          {!campaignCompleted && (
            <p className="mt-1 text-xs leading-5 text-amber-700">تُسجّل التأكيدات والحضور بعد إيقاف الحملة فقط.</p>
          )}
        </div>
      </div>
      <form onSubmit={save} className="space-y-4">
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</p>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="تاريخ المتابعة">
            <input required type="date" name="followupDate" value={form.followupDate} onChange={setField} className={inputClass()} />
          </Field>
          <Field label="إجمالي الإنفاق حتى الآن (دج)">
            <input required type="number" min={Number(currentSpent || 0)} step="0.01" name="spentAmount" value={form.spentAmount} onChange={setField} className={inputClass()} />
            <span className={`mt-1 block text-[11px] ${addedSpent < 0 ? 'text-rose-600' : 'text-slate-500'}`}>
              {addedSpent < 0
                ? `لا يمكن أن يقل الإجمالي عن ${formatCurrency(currentSpent)}`
                : `الزيادة منذ آخر متابعة: ${formatCurrency(addedSpent)}`}
            </span>
          </Field>
          {[
            ['conversationCount', 'محادثات جديدة', false],
            ['registrationCount', 'تسجيلات جديدة', false],
            ['confirmedCount', campaignCompleted ? 'التأكيدات النهائية' : 'التأكيدات (بعد إيقاف الحملة)', true],
            ['attendedCount', campaignCompleted ? 'الحضور النهائي' : 'الحضور (بعد إيقاف الحملة)', true]
          ].map(([name, label, finalOnly]) => (
            <Field key={name} label={label}>
              <input disabled={finalOnly && !campaignCompleted} type="number" min="0" step="1" name={name} value={form[name]} onChange={setField} placeholder="0" className={`${inputClass()} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`} />
            </Field>
          ))}
          <Field label="ملاحظات المتابعة" className="sm:col-span-2 lg:col-span-3">
            <textarea rows="2" name="notes" value={form.notes} onChange={setField} placeholder="ما الذي تغيّر؟ ما الخطوة القادمة؟" className={inputClass()} />
          </Field>
        </div>
        <div className="flex justify-end">
          <button disabled={saving || addedSpent < 0} type="submit" className="rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white disabled:opacity-60">
            {saving ? 'جاري تسجيل المتابعة...' : 'حفظ المتابعة'}
          </button>
        </div>
      </form>
    </section>
  );
}

export default function Marketing({
  view = 'dashboard',
  campaignId,
  onViewCampaigns,
  onViewDashboard,
  onOpenCampaign
}) {
  const { user } = useAuth();
  const canManage = ['admin', 'manager'].includes(user?.role);
  const [summary, setSummary] = useState(null);
  const [campaignDetails, setCampaignDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);

  const loadSummary = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      setSummary(await apiRequest('/marketing/summary'));
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'تعذر تحميل بيانات الحملات');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetails = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      setCampaignDetails(await apiRequest(`/marketing/campaigns/${campaignId}`));
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'تعذر تحميل صفحة الحملة');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  // Fetch campaign data as an external side effect when the selected marketing view changes.
  useEffect(() => {
    if (view === 'detail') loadDetails();
    else loadSummary();
  }, [loadDetails, loadSummary, view]);

  const campaigns = summary?.campaigns || [];
  const totals = summary?.totals || {};
  const campaign = campaignDetails?.campaign;
  const followups = campaignDetails?.followups || [];
  const dashboardCards = [
    { label: 'الحملات النشطة', value: Number(totals.activeCampaignCount || 0).toLocaleString('ar-DZ'), detail: `${totals.campaignCount || 0} حملة إجمالاً`, icon: Target, color: 'bg-violet-100 text-violet-700' },
    { label: 'إجمالي الإنفاق', value: formatCurrency(totals.spentAmount), detail: `من ميزانية ${formatCurrency(totals.budget)}`, icon: CircleDollarSign, color: 'bg-sky-100 text-sky-700' },
    { label: 'المحادثات', value: Number(totals.conversationCount || 0).toLocaleString('ar-DZ'), detail: `تكلفة المحادثة ${costPer(totals.spentAmount, totals.conversationCount)}`, icon: MessageCircle, color: 'bg-indigo-100 text-indigo-700' },
    { label: 'التسجيلات', value: Number(totals.registrationCount || 0).toLocaleString('ar-DZ'), detail: `تكلفة التسجيل ${costPer(totals.spentAmount, totals.registrationCount)}`, icon: UsersRound, color: 'bg-emerald-100 text-emerald-700' },
    { label: 'التسجيلات المؤكدة', value: Number(totals.confirmedCount || 0).toLocaleString('ar-DZ'), detail: 'تأكيدات التسجيل', icon: BadgeCheck, color: 'bg-amber-100 text-amber-700' },
    { label: 'حضروا فعلياً', value: Number(totals.attendedCount || 0).toLocaleString('ar-DZ'), detail: `تكلفة الحاضر ${costPer(totals.spentAmount, totals.attendedCount)}`, icon: ChartNoAxesCombined, color: 'bg-rose-100 text-rose-700' }
  ];

  const openCreate = () => {
    setEditingCampaign(null);
    setFormOpen(true);
  };
  const openEdit = current => {
    setEditingCampaign(current);
    setFormOpen(true);
  };
  const deleteCampaign = async current => {
    if (!window.confirm(`هل تريد حذف الحملة «${current.name}» وكل سجلات متابعتها؟`)) return;
    try {
      await apiRequest(`/marketing/campaigns/${current.id}`, { method: 'DELETE' });
      if (view === 'detail') onViewCampaigns();
      else await loadSummary(true);
    } catch (deleteError) {
      setError(deleteError.message || 'تعذر حذف الحملة');
    }
  };

  const headerTitle = view === 'detail' ? campaign?.name || 'تفاصيل الحملة' : view === 'campaigns' ? 'الحملات الإعلانية' : 'لوحة متابعة التسويق';
  const headerDescription = view === 'detail'
    ? 'صفحة الحملة وسجل المتابعة الزمني'
    : view === 'campaigns'
      ? 'افتح أي حملة لمتابعة نتائجها وتسجيل التحديثات'
      : 'نظرة عامة على الإنفاق ومراحل التحويل لكل الحملات';

  return (
    <div className="min-h-full space-y-5 bg-[#F4F9FD]/60 p-4 md:p-7">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-bold text-violet-600">
            <ChartNoAxesCombined className="h-4 w-4" />
            التسويق {view !== 'dashboard' && <><span className="text-slate-300">/</span><span>{view === 'detail' ? 'متابعة الحملة' : 'قائمة الحملات'}</span></>}
          </div>
          <h2 className="text-xl font-black text-slate-900">{headerTitle}</h2>
          <p className="mt-1 text-xs text-slate-500">{headerDescription}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {view !== 'dashboard' && (
            <button
              onClick={view === 'detail' ? onViewCampaigns : onViewDashboard}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              <ArrowRight className="h-4 w-4" />
              {view === 'detail' ? 'العودة للحملات' : 'لوحة التسويق'}
            </button>
          )}
          {view === 'dashboard' && (
            <button onClick={onViewCampaigns} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">
              كل الحملات
            </button>
          )}
          {view !== 'detail' && canManage && (
            <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-violet-700">
              <Plus className="h-4 w-4" />
              حملة جديدة
            </button>
          )}
        </div>
      </header>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <span>{error}</span>
          <button onClick={() => (view === 'detail' ? loadDetails(true) : loadSummary(true))} className="font-bold underline">إعادة المحاولة</button>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">جاري تحميل بيانات التسويق...</div>
      ) : view === 'dashboard' ? (
        <DashboardView cards={dashboardCards} campaigns={campaigns} onOpenCampaign={onOpenCampaign} onViewCampaigns={onViewCampaigns} />
      ) : view === 'campaigns' ? (
        <CampaignList campaigns={campaigns} canManage={canManage} onOpenCampaign={onOpenCampaign} onEdit={openEdit} onDelete={deleteCampaign} onCreate={openCreate} />
      ) : campaign ? (
        <CampaignDetail
          campaign={campaign}
          followups={followups}
          canManage={canManage}
          onEdit={() => openEdit(campaign)}
          onDelete={() => deleteCampaign(campaign)}
          onFollowupSaved={() => loadDetails(true)}
        />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <p className="font-bold text-slate-700">لم يتم العثور على الحملة</p>
          <button onClick={onViewCampaigns} className="mt-4 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white">العودة إلى الحملات</button>
        </div>
      )}

      <CampaignFormModal
        key={`${formOpen}-${editingCampaign?.id ?? 'new'}`}
        open={formOpen}
        campaign={editingCampaign}
        onClose={() => setFormOpen(false)}
        onSaved={view === 'detail' ? () => loadDetails(true) : () => loadSummary(true)}
      />
    </div>
  );
}

function DashboardView({ cards, campaigns, onOpenCampaign, onViewCampaigns }) {
  const totals = campaigns.reduce((result, campaign) => {
    result.conversations += Number(campaign.conversation_count) || 0;
    result.registrations += Number(campaign.registration_count) || 0;
    result.confirmed += Number(campaign.confirmed_count) || 0;
    result.attended += Number(campaign.attended_count) || 0;
    return result;
  }, { conversations: 0, registrations: 0, confirmed: 0, attended: 0 });

  const funnel = [
    { label: 'محادثات', value: totals.conversations, color: 'bg-violet-500' },
    { label: 'تسجيلات', value: totals.registrations, color: 'bg-sky-500' },
    { label: 'مؤكدون', value: totals.confirmed, color: 'bg-amber-500' },
    { label: 'حضور فعلي', value: totals.attended, color: 'bg-emerald-500' }
  ];
  const maxFunnel = Math.max(1, ...funnel.map(step => step.value));

  return (
    <>
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="مؤشرات أداء التسويق">
        {cards.map(card => <StatCard key={card.label} {...card} />)}
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.85fr_1.4fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-black text-slate-900">مسار التحويل</h3>
          <p className="mt-1 text-xs text-slate-500">من أول محادثة حتى حضور الدورة</p>
          <div className="mt-5 space-y-4">
            {funnel.map((step, index) => (
              <div key={step.label}>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600">{index + 1}. {step.label}</span>
                  <span className="font-black text-slate-900">{step.value.toLocaleString('ar-DZ')}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${step.color}`} style={{ width: `${step.value / maxFunnel * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
            <div>
              <h3 className="font-black text-slate-900">الحملات الأخيرة</h3>
              <p className="mt-1 text-xs text-slate-500">افتح الحملة للوصول إلى سجل المتابعة الخاص بها</p>
            </div>
            <button onClick={onViewCampaigns} className="text-xs font-bold text-violet-700">عرض الكل</button>
          </div>
          {campaigns.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">لا توجد حملات مسجلة بعد</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {campaigns.slice(0, 5).map(campaign => (
                <button key={campaign.id} onClick={() => onOpenCampaign(campaign.id)} className="grid w-full gap-2 px-5 py-3 text-right transition hover:bg-slate-50 sm:grid-cols-[1.3fr_1fr_1fr_auto] sm:items-center">
                  <span>
                    <span className="block text-sm font-bold text-slate-900">{campaign.name}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-400">{campaign.platform || 'منصة غير محددة'}</span>
                  </span>
                  <span className="text-xs text-slate-600">إنفاق {formatCurrency(campaign.spent_amount)}</span>
                  <span className="text-xs text-slate-600">{campaign.registration_count} تسجيل · {campaign.attended_count} حضور</span>
                  <span className="text-xs font-bold text-violet-700">فتح المتابعة ←</span>
                </button>
              ))}
            </div>
          )}
        </article>
      </section>
    </>
  );
}

function CampaignList({ campaigns, canManage, onOpenCampaign, onEdit, onDelete, onCreate }) {
  if (!campaigns.length) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <Target className="mx-auto h-8 w-8 text-violet-400" />
        <h3 className="mt-3 font-black text-slate-800">لا توجد حملات إعلانية</h3>
        <p className="mt-1 text-xs text-slate-500">أنشئ حملة بمعلوماتها الأساسية، ثم سجّل نتائجها من صفحة المتابعة.</p>
        {canManage && <button onClick={onCreate} className="mt-4 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white">إنشاء حملة</button>}
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-4">
        <h3 className="font-black text-slate-900">كل الحملات</h3>
        <p className="mt-1 text-xs text-slate-500">اختر «فتح المتابعة» لعرض صفحة الحملة وسجل تحديثاتها.</p>
      </div>
      <div className="divide-y divide-slate-100">
        {campaigns.map(campaign => {
          const spent = Number(campaign.spent_amount) || 0;
          const budgetPending = campaign.effective_budget === null;
          const budget = Number(campaign.effective_budget ?? campaign.budget) || 0;
          const dailyBudget = campaign.budget_type === 'daily';
          const ongoing = campaign.duration_type === 'ongoing';
          const progress = budget > 0 ? Math.min(100, spent / budget * 100) : 0;
          return (
            <article key={campaign.id} className="grid gap-4 p-4 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-black text-slate-900">{campaign.name}</h4>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${campaign.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {statusLabels[campaign.status] || campaign.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{campaign.platform || 'منصة غير محددة'}{campaign.start_date ? ` · بدأت ${formatDate(campaign.start_date)}` : ''}</p>
              </div>
              <div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-500">{dailyBudget ? 'الميزانية اليومية' : 'الميزانية الكلية'}</span><b className="text-slate-800">{formatCurrency(campaign.budget)}</b></div>
                {dailyBudget && !budgetPending && <p className="mt-1 text-[10px] text-slate-500">إجمالي مدة الحملة: {formatCurrency(budget)}</p>}
                {budgetPending && <p className="mt-1 text-[10px] text-slate-500">{ongoing ? 'يُحسب الإجمالي عند إيقافها' : 'لم تُحدد الميزانية الكلية'}</p>}
                {!budgetPending && <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-500" style={{ width: `${progress}%` }} /></div>}
                <p className="mt-1 text-[10px] text-slate-400">الإنفاق: {formatCurrency(spent)}</p>
              </div>
              <div className="text-xs text-slate-600">
                <b>{campaign.conversation_count}</b> محادثة
                <span className="mx-1 text-slate-300">·</span>
                <b>{campaign.registration_count}</b> تسجيل
                <span className="mx-1 text-slate-300">·</span>
                <b>{campaign.attended_count}</b> حضور
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => onOpenCampaign(campaign.id)} className="whitespace-nowrap rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-700">
                  فتح المتابعة
                </button>
                {canManage && (
                  <>
                    <button aria-label={`تعديل بيانات ${campaign.name}`} onClick={() => onEdit(campaign)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
                    <button aria-label={`حذف ${campaign.name}`} onClick={() => onDelete(campaign)} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700"><Trash2 className="h-4 w-4" /></button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function CampaignDetail({ campaign, followups, canManage, onEdit, onDelete, onFollowupSaved }) {
  const spent = Number(campaign.spent_amount) || 0;
  const budgetPending = campaign.effective_budget === null;
  const budget = Number(campaign.effective_budget ?? campaign.budget) || 0;
  const dailyBudget = campaign.budget_type === 'daily';
  const ongoing = campaign.duration_type === 'ongoing';
  const progress = budget > 0 ? Math.min(100, spent / budget * 100) : 0;
  const registrationRate = Number(campaign.conversation_count) > 0
    ? (Number(campaign.registration_count) / Number(campaign.conversation_count) * 100).toFixed(1)
    : '0.0';
  const attendedRate = Number(campaign.registration_count) > 0
    ? (Number(campaign.attended_count) / Number(campaign.registration_count) * 100).toFixed(1)
    : '0.0';

  const metrics = useMemo(() => [
    { label: 'الإنفاق الفعلي', value: formatCurrency(spent), detail: budgetPending ? 'الإجمالي النهائي للميزانية عند الإيقاف' : `من ميزانية ${formatCurrency(budget)}`, icon: CircleDollarSign, color: 'bg-rose-100 text-rose-700' },
    { label: 'المحادثات', value: Number(campaign.conversation_count).toLocaleString('ar-DZ'), detail: `تكلفة المحادثة ${costPer(spent, campaign.conversation_count)}`, icon: MessageCircle, color: 'bg-violet-100 text-violet-700' },
    { label: 'التسجيلات', value: Number(campaign.registration_count).toLocaleString('ar-DZ'), detail: `تكلفة التسجيل ${costPer(spent, campaign.registration_count)}`, icon: UsersRound, color: 'bg-sky-100 text-sky-700' },
    { label: 'التأكيدات', value: Number(campaign.confirmed_count).toLocaleString('ar-DZ'), detail: `${registrationRate}% من المحادثات تحولت لتسجيل`, icon: BadgeCheck, color: 'bg-amber-100 text-amber-700' },
    { label: 'الحضور الفعلي', value: Number(campaign.attended_count).toLocaleString('ar-DZ'), detail: `تكلفة الحاضر ${costPer(spent, campaign.attended_count)}`, icon: Target, color: 'bg-emerald-100 text-emerald-700' },
    { label: 'نسبة الحضور', value: `${attendedRate}%`, detail: 'من إجمالي المسجلين', icon: ChartNoAxesCombined, color: 'bg-indigo-100 text-indigo-700' }
  ], [attendedRate, budget, budgetPending, campaign.attended_count, campaign.confirmed_count, campaign.conversation_count, campaign.registration_count, registrationRate, spent]);

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${campaign.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                {statusLabels[campaign.status] || campaign.status}
              </span>
              <span className="text-xs text-slate-500">{campaign.platform || 'منصة غير محددة'}</span>
              {campaign.start_date && <span className="inline-flex items-center gap-1 text-xs text-slate-400"><CalendarDays className="h-3.5 w-3.5" />{formatDate(campaign.start_date)}{campaign.end_date ? ` – ${formatDate(campaign.end_date)}` : ''}</span>}
            </div>
            <h3 className="mt-3 text-lg font-black text-slate-900">ملخص أداء الحملة</h3>
            <p className="mt-1 text-xs text-slate-500">
              {dailyBudget && budgetPending
                ? `الميزانية اليومية ${formatCurrency(campaign.budget)} · يُحسب الإجمالي عند إيقاف الحملة`
                : dailyBudget
                  ? `الميزانية اليومية ${formatCurrency(campaign.budget)} · إجمالي ميزانية مدة الحملة ${formatCurrency(budget)}`
                : `الميزانية الكلية ${formatCurrency(budget)}`}
            </p>
          </div>
          {canManage && (
            <div className="flex gap-2">
              <button onClick={onEdit} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"><Pencil className="h-3.5 w-3.5" />تعديل بيانات الحملة</button>
              <button onClick={onDelete} className="rounded-xl border border-rose-100 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50">حذف الحملة</button>
            </div>
          )}
        </div>
        <div className="mt-5 flex items-center justify-between gap-3 text-xs">
          <span className="font-bold text-slate-600">استهلاك الميزانية</span>
          <span className="font-black text-slate-900">
            {budgetPending
              ? `الإنفاق ${formatCurrency(spent)} · ${ongoing ? 'حملة مستمرة' : 'حدد الميزانية لحساب النسبة'}`
              : `${formatCurrency(spent)} من ${formatCurrency(budget)} · ${progress.toFixed(0)}%`}
          </span>
        </div>
        {!budgetPending && <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${progress}%` }} /></div>}
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="مؤشرات الحملة">
        {metrics.map(metric => <StatCard key={metric.label} {...metric} />)}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          {canManage && (
            <FollowupForm
              campaignId={campaign.id}
              currentSpent={spent}
              campaignCompleted={campaign.status === 'completed'}
              onSaved={onFollowupSaved}
            />
          )}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <h3 className="font-black text-slate-900">سجل المتابعة</h3>
              <p className="mt-1 text-xs text-slate-500">كل إدخال محفوظ كتحديث مستقل، مع إبقاء أرقام الحملة تراكمية.</p>
            </div>
            {!followups.length ? (
              <div className="p-8 text-center text-sm text-slate-400">لا توجد متابعات مسجلة لهذه الحملة بعد.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {followups.map(entry => (
                  <article key={entry.id} className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-bold text-slate-800">{formatDate(entry.followup_date)}</div>
                      <div className="text-[11px] text-slate-400">{entry.user_name || 'مستخدم النظام'}</div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                      <FollowupValue label="زيادة الإنفاق" value={`+${formatCurrency(entry.spent_amount)}`} />
                      <FollowupValue label="محادثات +" value={`+${entry.conversation_count}`} />
                      <FollowupValue label="تسجيلات +" value={`+${entry.registration_count}`} />
                      <FollowupValue label="تأكيدات +" value={`+${entry.confirmed_count}`} />
                      <FollowupValue label="حضور +" value={`+${entry.attended_count}`} />
                    </div>
                    {entry.notes && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">{entry.notes}</p>}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-black text-slate-900">مسار تحويل هذه الحملة</h3>
          <p className="mt-1 text-xs text-slate-500">الأعداد التراكمية المسجلة حتى الآن</p>
          <div className="mt-5 space-y-4">
            {[
              ['محادثات', campaign.conversation_count, 'bg-violet-500'],
              ['تسجيلات', campaign.registration_count, 'bg-sky-500'],
              ['مؤكدون', campaign.confirmed_count, 'bg-amber-500'],
              ['حضور فعلي', campaign.attended_count, 'bg-emerald-500']
            ].map(([label, value, color]) => {
              const max = Math.max(1, Number(campaign.conversation_count) || 0);
              return (
                <div key={label}>
                  <div className="mb-1.5 flex justify-between text-xs"><span className="text-slate-600">{label}</span><b>{Number(value).toLocaleString('ar-DZ')}</b></div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${Number(value) / max * 100}%` }} /></div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-xs">
            <div className="flex justify-between"><span className="text-slate-500">تكلفة المحادثة</span><b>{costPer(spent, campaign.conversation_count)}</b></div>
            <div className="flex justify-between"><span className="text-slate-500">تكلفة التسجيل</span><b>{costPer(spent, campaign.registration_count)}</b></div>
            <div className="flex justify-between"><span className="text-slate-500">تكلفة الحضور</span><b>{costPer(spent, campaign.attended_count)}</b></div>
          </div>
        </aside>
      </section>
    </>
  );
}

function FollowupValue({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2.5 py-2">
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className="mt-1 text-xs font-black text-slate-800">{value}</div>
    </div>
  );
}
