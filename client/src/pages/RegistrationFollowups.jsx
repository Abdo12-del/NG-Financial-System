import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  CalendarClock,
  Check,
  Clock3,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Search,
  Send,
  UserRoundPlus,
  UsersRound,
  X
} from 'lucide-react';
import { apiRequest, formatDate } from '../utils/api';
import Modal from '../components/Modal';

const statusOptions = [
  { value: 'new', label: 'جديد', style: 'bg-slate-100 text-slate-700' },
  { value: 'callback', label: 'إعادة الاتصال', style: 'bg-blue-50 text-blue-700' },
  { value: 'no_answer', label: 'لم يرد', style: 'bg-amber-50 text-amber-700' },
  { value: 'interested', label: 'مهتم / تأكيد مبدئي', style: 'bg-violet-50 text-violet-700' },
  { value: 'awaiting_payment', label: 'بانتظار المستحقات', style: 'bg-orange-50 text-orange-700' },
  { value: 'enrolled', label: 'تم التسجيل', style: 'bg-emerald-50 text-emerald-700' },
  { value: 'not_interested', label: 'غير مهتم', style: 'bg-rose-50 text-rose-700' }
];

const contactOptions = [
  { value: 'phone', label: 'مكالمة هاتفية' },
  { value: 'whatsapp', label: 'واتساب' },
  { value: 'telegram', label: 'تلغرام' },
  { value: 'in_person', label: 'حضوري' },
  { value: 'other', label: 'أخرى' }
];

const emptyLead = {
  guardianName: '',
  phone: '',
  telegramUsername: '',
  studentName: '',
  courseInterest: '',
  nextFollowupDate: '',
  notes: ''
};

function localToday() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function telegramUrl(username) {
  const handle = String(username || '').trim().replace(/^@/, '');
  return /^[A-Za-z0-9_]{5,32}$/.test(handle) ? `https://t.me/${handle}` : null;
}

function statusFor(value) {
  return statusOptions.find(status => status.value === value) || statusOptions[0];
}

function whatsappUrl(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = `213${digits.slice(1)}`;
  return digits ? `https://wa.me/${digits}` : null;
}

function formatContactDate(value) {
  if (!value) return '—';
  const parsed = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('ar-DZ', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function RegistrationFollowups() {
  const [leads, setLeads] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeStatus, setActiveStatus] = useState('all');
  const [pageError, setPageError] = useState('');
  const [modalError, setModalError] = useState('');
  const [saving, setSaving] = useState(false);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [leadForm, setLeadForm] = useState(emptyLead);
  const [followupLead, setFollowupLead] = useState(null);
  const [conversionLead, setConversionLead] = useState(null);
  const [cohorts, setCohorts] = useState([]);
  const [conversionForm, setConversionForm] = useState({
    studentName: '',
    cohortId: '',
    agreedPrice: '',
    discountAmount: '0'
  });
  const [followupForm, setFollowupForm] = useState({
    contactMethod: 'phone',
    status: 'callback',
    note: '',
    nextFollowupDate: ''
  });
  const [historyLead, setHistoryLead] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const loading = leads === null;

  const loadLeads = useCallback(() => apiRequest('/registration-leads'), []);
  const fetchLeads = useCallback(async () => {
    try {
      const result = await loadLeads();
      setPageError('');
      setLeads(result.leads || []);
    } catch (err) {
      setPageError(err.message || 'تعذر تحميل قائمة الأولياء');
    }
  }, [loadLeads]);

  useEffect(() => {
    let active = true;
    loadLeads()
      .then(result => {
        if (!active) return;
        setPageError('');
        setLeads(result.leads || []);
      })
      .catch(err => {
        if (!active) return;
        setPageError(err.message || 'تعذر تحميل قائمة الأولياء');
        setLeads([]);
      });
    return () => {
      active = false;
    };
  }, [loadLeads]);

  const counts = useMemo(() => {
    const rows = leads || [];
    const today = localToday();
    return {
      total: rows.length,
      due: rows.filter(lead => lead.next_followup_date && lead.next_followup_date.slice(0, 10) <= today
        && !['enrolled', 'not_interested'].includes(lead.status)).length,
      awaiting: rows.filter(lead => lead.status === 'awaiting_payment').length,
      active: rows.filter(lead => !['enrolled', 'not_interested'].includes(lead.status)).length
    };
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const rows = leads || [];
    const term = searchTerm.trim().toLocaleLowerCase();
    return rows.filter(lead => {
      if (activeStatus !== 'all' && lead.status !== activeStatus) return false;
      if (!term) return true;
      return [lead.guardian_name, lead.phone, lead.student_name, lead.course_interest]
        .some(value => String(value || '').toLocaleLowerCase().includes(term));
    });
  }, [leads, searchTerm, activeStatus]);

  const openNewLead = () => {
    setEditingLead(null);
    setLeadForm(emptyLead);
    setModalError('');
    setLeadModalOpen(true);
  };

  const openEditLead = lead => {
    setEditingLead(lead);
    setLeadForm({
      guardianName: lead.guardian_name || '',
      phone: lead.phone || '',
      telegramUsername: lead.telegram_username || '',
      studentName: lead.student_name || '',
      courseInterest: lead.course_interest || '',
      nextFollowupDate: lead.next_followup_date?.slice(0, 10) || '',
      notes: lead.notes || ''
    });
    setModalError('');
    setLeadModalOpen(true);
  };

  const saveLead = async event => {
    event.preventDefault();
    setSaving(true);
    setModalError('');
    try {
      await apiRequest(editingLead
        ? `/registration-leads/${editingLead.id}`
        : '/registration-leads', {
        method: editingLead ? 'PUT' : 'POST',
        body: JSON.stringify(leadForm)
      });
      setLeadModalOpen(false);
      await fetchLeads();
    } catch (err) {
      setModalError(err.message || 'تعذر حفظ بيانات الولي');
    } finally {
      setSaving(false);
    }
  };

  const openFollowup = lead => {
    setFollowupLead(lead);
    setFollowupForm({
      contactMethod: 'phone',
      status: lead.status === 'new' ? 'callback' : lead.status,
      note: '',
      nextFollowupDate: ''
    });
    setModalError('');
  };

  const saveFollowup = async event => {
    event.preventDefault();
    setSaving(true);
    setModalError('');
    try {
      await apiRequest(`/registration-leads/${followupLead.id}/followups`, {
        method: 'POST',
        body: JSON.stringify(followupForm)
      });
      setFollowupLead(null);
      await fetchLeads();
    } catch (err) {
      setModalError(err.message || 'تعذر تسجيل المتابعة');
    } finally {
      setSaving(false);
    }
  };

  const openConversion = async lead => {
    setConversionLead(lead);
    setConversionForm({
      studentName: lead.student_name || '',
      cohortId: '',
      agreedPrice: '',
      discountAmount: '0'
    });
    setModalError('');
    try {
      const result = await apiRequest('/cohorts/cohorts');
      setCohorts((result.cohorts || []).filter(cohort => ['active', 'upcoming'].includes(cohort.status)));
    } catch (err) {
      setModalError(err.message || 'تعذر تحميل الأفواج المتاحة');
    }
  };

  const saveConversion = async event => {
    event.preventDefault();
    setSaving(true);
    setModalError('');
    try {
      await apiRequest(`/registration-leads/${conversionLead.id}/convert`, {
        method: 'POST',
        body: JSON.stringify(conversionForm)
      });
      setConversionLead(null);
      await fetchLeads();
    } catch (err) {
      setModalError(err.message || 'تعذر تسجيل الطالب');
    } finally {
      setSaving(false);
    }
  };

  const openHistory = async lead => {
    setHistoryLead(lead);
    setHistory([]);
    setHistoryLoading(true);
    try {
      const result = await apiRequest(`/registration-leads/${lead.id}/followups`);
      setHistory(result.followups || []);
    } catch (err) {
      setModalError(err.message || 'تعذر تحميل سجل المتابعة');
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="p-5 md:p-8 space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">متابعة التسجيلات</h1>
          <p className="mt-1 text-sm text-slate-500">اجمع بيانات الأولياء ومواعيد التواصل ونتيجة كل متابعة في مكان واحد.</p>
        </div>
        <button
          onClick={openNewLead}
          className="inline-flex items-center gap-2 rounded-xl bg-[#0BAAFF] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-sky-600"
        >
          <Plus className="h-4 w-4" />
          إضافة وليّ مهتم
        </button>
      </div>

      {pageError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {pageError}
          <button onClick={fetchLeads} className="mr-3 underline">إعادة المحاولة</button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={UsersRound} title="كل الأولياء" value={counts.total} tone="sky" />
        <SummaryCard icon={BellRing} title="متابعات مستحقة" value={counts.due} tone="rose" />
        <SummaryCard icon={Clock3} title="بانتظار المستحقات" value={counts.awaiting} tone="amber" />
        <SummaryCard icon={MessageCircle} title="ملفات قيد المتابعة" value={counts.active} tone="violet" />
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4">
          <div className="relative">
            <Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
            <input
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="ابحث باسم الولي أو الطالب أو الهاتف أو الدورة..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-10 pl-3 text-sm outline-none focus:border-sky-400 focus:bg-white"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <StatusFilter value="all" active={activeStatus} onSelect={setActiveStatus} label={`الكل (${(leads || []).length})`} />
            {statusOptions.map(status => (
              <StatusFilter
                key={status.value}
                value={status.value}
                active={activeStatus}
                onSelect={setActiveStatus}
                label={`${status.label} (${(leads || []).filter(lead => lead.status === status.value).length})`}
              />
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-right text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-500">
              <tr>
                <th className="px-4 py-3">الولي / الطالب</th>
                <th className="px-4 py-3">الدورة المهتم بها</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3">موعد المتابعة</th>
                <th className="px-4 py-3">آخر تواصل</th>
                <th className="px-4 py-3">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="6" className="p-12 text-center text-slate-400">جارٍ تحميل سجلات المتابعة...</td></tr>
              ) : filteredLeads.length === 0 ? (
                <tr><td colSpan="6" className="p-12 text-center text-slate-400">لا توجد سجلات مطابقة. أضف وليًّا مهتمًا لبدء المتابعة.</td></tr>
              ) : filteredLeads.map(lead => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  onEdit={() => openEditLead(lead)}
                  onFollowup={() => openFollowup(lead)}
                  onHistory={() => openHistory(lead)}
                  onConvert={() => openConversion(lead)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        isOpen={leadModalOpen}
        onClose={() => setLeadModalOpen(false)}
        title={editingLead ? 'تعديل بيانات الولي' : 'إضافة وليّ مهتم'}
      >
        <form onSubmit={saveLead} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="اسم الولي *" value={leadForm.guardianName} onChange={value => setLeadForm({ ...leadForm, guardianName: value })} required />
            <FormField label="رقم الهاتف *" value={leadForm.phone} onChange={value => setLeadForm({ ...leadForm, phone: value })} required type="tel" />
            <FormField label="اسم المستخدم على تلغرام" value={leadForm.telegramUsername} onChange={value => setLeadForm({ ...leadForm, telegramUsername: value })} />
            <FormField label="اسم الطالب" value={leadForm.studentName} onChange={value => setLeadForm({ ...leadForm, studentName: value })} />
            <FormField label="الدورة المهتم بها" value={leadForm.courseInterest} onChange={value => setLeadForm({ ...leadForm, courseInterest: value })} />
            <FormField label="موعد المتابعة القادم" value={leadForm.nextFollowupDate} onChange={value => setLeadForm({ ...leadForm, nextFollowupDate: value })} type="date" />
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-slate-600">ملاحظات</span>
            <textarea
              value={leadForm.notes}
              onChange={event => setLeadForm({ ...leadForm, notes: event.target.value })}
              rows="3"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400"
            />
          </label>
          {modalError && <p role="alert" className="text-sm font-semibold text-rose-600">{modalError}</p>}
          <ModalActions onCancel={() => setLeadModalOpen(false)} saving={saving} label={editingLead ? 'حفظ التعديلات' : 'إضافة للسجل'} />
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(conversionLead)}
        onClose={() => setConversionLead(null)}
        title={`تسجيل الطالب${conversionLead ? ` — ${conversionLead.guardian_name}` : ''}`}
      >
        <form onSubmit={saveConversion} className="space-y-4">
          <p className="rounded-xl bg-sky-50 p-3 text-xs leading-6 text-sky-800">
            سيُنشأ ملف طالب مع تسجيل مالي غير مدفوع في الفوج المختار، ويُربط بسجل الولي. لا يُسجل أي مبلغ مدفوع هنا.
          </p>
          <FormField
            label="اسم الطالب *"
            value={conversionForm.studentName}
            onChange={value => setConversionForm({ ...conversionForm, studentName: value })}
            required
          />
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-slate-600">الفوج والدورة *</span>
            <select
              required
              value={conversionForm.cohortId}
              onChange={event => {
                const cohort = cohorts.find(item => String(item.id) === event.target.value);
                setConversionForm({
                  ...conversionForm,
                  cohortId: event.target.value,
                  agreedPrice: cohort ? String(cohort.course_default_price ?? 0) : ''
                });
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
            >
              <option value="">اختر فوجًا متاحًا</option>
              {cohorts.map(cohort => (
                <option key={cohort.id} value={cohort.id}>
                  {cohort.course_name} — {cohort.name}{cohort.status === 'upcoming' ? ' (قادم)' : ''}
                </option>
              ))}
            </select>
            {cohorts.length === 0 && <span className="mt-1 block text-xs text-amber-700">لا توجد أفواج متاحة. أضف فوجًا نشطًا أو قادمًا أولًا.</span>}
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="السعر المتفق عليه"
              value={conversionForm.agreedPrice}
              onChange={value => setConversionForm({ ...conversionForm, agreedPrice: value })}
              type="number"
              required
            />
            <FormField
              label="الخصم"
              value={conversionForm.discountAmount}
              onChange={value => setConversionForm({ ...conversionForm, discountAmount: value })}
              type="number"
              required
            />
          </div>
          {modalError && <p role="alert" className="text-sm font-semibold text-rose-600">{modalError}</p>}
          <ModalActions onCancel={() => setConversionLead(null)} saving={saving} label="تأكيد التسجيل" />
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(followupLead)}
        onClose={() => setFollowupLead(null)}
        title={`تسجيل متابعة${followupLead ? ` — ${followupLead.guardian_name}` : ''}`}
      >
        <form onSubmit={saveFollowup} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="mb-1.5 block text-xs font-bold text-slate-600">وسيلة التواصل</span>
              <select value={followupForm.contactMethod} onChange={event => setFollowupForm({ ...followupForm, contactMethod: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                {contactOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label>
              <span className="mb-1.5 block text-xs font-bold text-slate-600">نتيجة التواصل</span>
              <select value={followupForm.status} onChange={event => setFollowupForm({ ...followupForm, status: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                {statusOptions.filter(option => option.value !== 'new').map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <FormField label="موعد المتابعة القادم" value={followupForm.nextFollowupDate} onChange={value => setFollowupForm({ ...followupForm, nextFollowupDate: value })} type="date" />
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-slate-600">ملخص المكالمة أو المحادثة</span>
            <textarea value={followupForm.note} onChange={event => setFollowupForm({ ...followupForm, note: event.target.value })} rows="3" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400" placeholder="مثال: طلب الاتصال به مساء الخميس..." />
          </label>
          {modalError && <p role="alert" className="text-sm font-semibold text-rose-600">{modalError}</p>}
          <ModalActions onCancel={() => setFollowupLead(null)} saving={saving} label="حفظ المتابعة" />
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(historyLead)}
        onClose={() => setHistoryLead(null)}
        title={`سجل التواصل${historyLead ? ` — ${historyLead.guardian_name}` : ''}`}
      >
        {historyLoading ? (
          <p className="py-8 text-center text-sm text-slate-400">جارٍ تحميل سجل التواصل...</p>
        ) : history.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">لم تسجل أي متابعة لهذا الولي بعد.</p>
        ) : (
          <ol className="space-y-4">
            {history.map(item => (
              <li key={item.id} className="relative border-r-2 border-sky-100 pr-4">
                <span className="absolute -right-[5px] top-1 h-2 w-2 rounded-full bg-sky-500" />
                <p className="text-xs font-bold text-slate-500">{formatContactDate(item.contacted_at)} · {contactOptions.find(option => option.value === item.contact_method)?.label || item.contact_method}</p>
                <p className="mt-1 text-sm font-bold text-slate-800">{statusFor(item.status).label}</p>
                {item.note && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{item.note}</p>}
                {item.next_followup_date && <p className="mt-1 text-xs text-sky-700">المتابعة القادمة: {formatDate(`${item.next_followup_date.slice(0, 10)}T00:00:00`)}</p>}
                {item.user_name && <p className="mt-1 text-[11px] text-slate-400">سجلها: {item.user_name}</p>}
              </li>
            ))}
          </ol>
        )}
      </Modal>
    </div>
  );
}

function SummaryCard({ icon: Icon, title, value, tone }) {
  const tones = {
    sky: 'bg-sky-50 text-sky-600',
    rose: 'bg-rose-50 text-rose-600',
    amber: 'bg-amber-50 text-amber-600',
    violet: 'bg-violet-50 text-violet-600'
  };
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></span>
      <div><p className="text-xs font-semibold text-slate-500">{title}</p><p className="mt-0.5 text-xl font-black text-slate-900">{value}</p></div>
    </div>
  );
}

function StatusFilter({ value, active, onSelect, label }) {
  return (
    <button
      onClick={() => onSelect(value)}
      className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition ${active === value ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
    >
      {label}
    </button>
  );
}

function LeadRow({ lead, onEdit, onFollowup, onHistory, onConvert }) {
  const status = statusFor(lead.status);
  const today = localToday();
  const followupDate = lead.next_followup_date?.slice(0, 10);
  const isDue = followupDate && followupDate <= today && !['enrolled', 'not_interested'].includes(lead.status);
  const chatUrl = whatsappUrl(lead.phone);
  const telegramLink = telegramUrl(lead.telegram_username);
  return (
    <tr className={isDue ? 'bg-rose-50/30' : 'hover:bg-slate-50/60'}>
      <td className="px-4 py-3">
        <p className="font-bold text-slate-900">{lead.guardian_name}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {lead.student_id
            ? `طالب مسجل: ${lead.converted_student_name || lead.student_name}`
            : lead.student_name || 'لم يحدد اسم الطالب'}
          {' · '}<span dir="ltr">{lead.phone}</span>
        </p>
      </td>
      <td className="px-4 py-3 text-slate-600">{lead.course_interest || '—'}</td>
      <td className="px-4 py-3"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${status.style}`}>{status.label}</span></td>
      <td className={`px-4 py-3 text-xs font-semibold ${isDue ? 'text-rose-700' : 'text-slate-600'}`}>
        <span className="inline-flex items-center gap-1.5">
          {isDue ? <BellRing className="h-3.5 w-3.5" /> : <CalendarClock className="h-3.5 w-3.5 text-slate-400" />}
          {followupDate ? formatDate(`${followupDate}T00:00:00`) : 'غير محدد'}
          {isDue && <span className="font-black">{followupDate === today ? 'اليوم' : 'متأخرة'}</span>}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">{formatContactDate(lead.last_contact_at)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <a href={`tel:${lead.phone}`} title="اتصال هاتفي" className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"><Phone className="h-4 w-4" /></a>
          {chatUrl && <a href={chatUrl} target="_blank" rel="noreferrer" title="فتح واتساب" className="rounded-lg border border-emerald-200 p-2 text-emerald-700 hover:bg-emerald-50"><MessageCircle className="h-4 w-4" /></a>}
          {telegramLink && <a href={telegramLink} target="_blank" rel="noreferrer" title="فتح تلغرام" className="rounded-lg border border-sky-200 p-2 text-sky-700 hover:bg-sky-50"><Send className="h-4 w-4" /></a>}
          {!lead.student_id && <button onClick={onFollowup} title="تسجيل متابعة" className="rounded-lg border border-sky-200 p-2 text-sky-700 hover:bg-sky-50"><Send className="h-4 w-4" /></button>}
          <button onClick={onHistory} title={`سجل التواصل (${lead.followup_count || 0})`} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"><Clock3 className="h-4 w-4" /></button>
          {!lead.student_id && <button onClick={onConvert} title="تحويل الولي إلى طالب مسجل" className="rounded-lg border border-violet-200 p-2 text-violet-700 hover:bg-violet-50"><UserRoundPlus className="h-4 w-4" /></button>}
          {!lead.student_id && <button onClick={onEdit} title="تعديل البيانات" className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>}
        </div>
      </td>
    </tr>
  );
}

function FormField({ label, value, onChange, type = 'text', required = false }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span>
      <input
        type={type}
        value={value}
        onChange={event => onChange(event.target.value)}
        required={required}
        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
      />
    </label>
  );
}

function ModalActions({ onCancel, saving, label }) {
  return (
    <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
      <button type="button" onClick={onCancel} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
        <X className="h-4 w-4" /> إلغاء
      </button>
      <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500 px-4 py-2 text-sm font-bold text-white hover:bg-sky-600 disabled:opacity-60">
        <Check className="h-4 w-4" /> {saving ? 'جارٍ الحفظ...' : label}
      </button>
    </div>
  );
}
