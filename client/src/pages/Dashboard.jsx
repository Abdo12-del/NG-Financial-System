import React, { useEffect, useState } from 'react';
import { BarChart3, Download, FileText, History, PlusCircle, Wallet } from 'lucide-react';
import { apiRequest, formatCurrency, formatDate } from '../utils/api';
import Modal from '../components/Modal';

const statDefinitions = [
  { key: 'totalRevenue', title: 'إجمالي الإيرادات', color: 'bg-emerald-500' },
  { key: 'totalExpenses', title: 'إجمالي المصروفات', color: 'bg-rose-500' },
  { key: 'netProfit', title: 'صافي الربح التشغيلي', color: 'bg-sky-500' },
  { key: 'currentCashBalance', title: 'الرصيد النقدي الحالي', color: 'bg-cyan-600' },
  { key: 'teacherPayables', title: 'مستحقات الأساتذة', color: 'bg-amber-500' },
  { key: 'ownerBalance', title: 'رصيد المالك', color: 'bg-teal-500' },
  { key: 'studentOutstanding', title: 'المبالغ المستحقة من الطلاب', color: 'bg-pink-500' },
  { key: 'expectedNetProfit', title: 'صافي الربح المتوقع', color: 'bg-indigo-500' }
];

function EmptyState() {
  return <p className="py-8 text-center text-sm text-slate-400">لا توجد بيانات مالية لعرضها.</p>;
}

export default function Dashboard({ onOpenAddRevenue, onOpenAddExpense, onOpenOwnerModal, onViewAllTransactions, onViewProfitHistory }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTx, setSelectedTx] = useState(null);

  async function loadDashboard() {
    setLoading(true);
    setError('');
    try {
      setData(await apiRequest('/dashboard/stats'));
    } catch (loadError) {
      setError(loadError.message || 'تعذر تحميل بيانات لوحة التحكم');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-sm text-slate-500">جاري تحميل لوحة التحكم...</div>;
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center" role="alert">
        <p className="mb-3 text-sm text-rose-600">{error || 'لا تتوفر بيانات لوحة التحكم'}</p>
        <button onClick={loadDashboard} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-bold text-white">إعادة المحاولة</button>
      </div>
    );
  }

  const metrics = data.metrics || {};
  const charts = data.charts || {};
  const monthly = (charts.monthlyComparison || []).slice(-6);
  const expenseCategories = charts.expensesByCategory || [];
  const revenueCourses = charts.revenueByCourse || [];
  const transactions = (data.recentTransactions || []).map((entry) => {
    const amount = Number(entry.debit_amount || entry.credit_amount || 0);
    const isVoid = Boolean(entry.is_voided);
    const isRevenue = Number(entry.debit_amount || 0) > 0;
    const isOwner = entry.ledger_category === 'OWNER';
    return {
      id: entry.ledger_id,
      date: entry.entry_date,
      type: isVoid ? 'ملغاة' : isOwner ? 'حركة مالك' : isRevenue ? 'إيراد' : 'مصروف',
      description: entry.description || entry.entry_code || 'عملية مالية',
      cohort: entry.cohort_name || entry.course_name || '—',
      amount: formatCurrency(amount),
      account: entry.account_name || '—',
      status: isVoid ? 'ملغاة' : 'مسجلة'
    };
  });
  const maxMonthlyValue = Math.max(1, ...monthly.flatMap((month) => [Number(month.revenue) || 0, Number(month.expenses) || 0]));
  const totalExpensesByCategory = expenseCategories.reduce((sum, category) => sum + Number(category.total_expense || 0), 0);

  return (
    <div className="min-h-screen space-y-6 bg-[#F4F9FD]/60 p-5 md:p-7">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">لوحة التحكم المالية</h2>
          <p className="mt-1 text-xs font-medium text-slate-500">ملخص مباشر من دفتر الأستاذ</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-600"><BarChart3 className="h-5 w-5" /></div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="المؤشرات المالية">
        {statDefinitions.map((stat) => (
          <article key={stat.key} className="flex min-h-32 flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-bold text-slate-600">{stat.title}</h3>
              {stat.key === 'netProfit' ? (
                <button
                  type="button"
                  onClick={onViewProfitHistory}
                  title="عرض سجل تطور الربح"
                  aria-label="عرض سجل تطور الربح"
                  className="rounded-lg p-1.5 text-sky-600 transition hover:bg-sky-50 hover:text-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-300"
                >
                  <History className="h-4 w-4" />
                </button>
              ) : (
                <span className={`h-3 w-3 rounded-full ${stat.color}`} aria-hidden="true" />
              )}
            </div>
            <p className="mt-4 text-xl font-black text-slate-900">{formatCurrency(metrics[stat.key])}</p>
            <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] text-slate-400">
              {stat.key === 'expectedNetProfit' ? 'الربح الفعلي + مستحقات الطلاب - مستحقات الأساتذة' : 'حسب السجلات الحالية'}
            </p>
          </article>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-3" aria-label="الملخصات والتحليلات">
        <article className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <h3 className="mb-5 text-sm font-bold text-slate-800">الإيرادات والمصروفات حسب الشهر</h3>
          {monthly.length === 0 ? <EmptyState /> : (
            <div className="grid min-h-48 grid-cols-3 items-end gap-3 sm:grid-cols-6">
              {monthly.map((month) => (
                <div key={month.month} className="flex h-48 flex-col items-center justify-end gap-2">
                  <div className="flex h-36 w-full items-end justify-center gap-1">
                    <div title={`الإيرادات: ${formatCurrency(month.revenue)}`} className="w-4 rounded-t bg-sky-500" style={{ height: `${Math.max(2, Number(month.revenue || 0) / maxMonthlyValue * 100)}%` }} />
                    <div title={`المصروفات: ${formatCurrency(month.expenses)}`} className="w-4 rounded-t bg-orange-400" style={{ height: `${Math.max(2, Number(month.expenses || 0) / maxMonthlyValue * 100)}%` }} />
                  </div>
                  <span className="text-[10px] text-slate-500">{month.month}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex gap-4 text-xs text-slate-500"><span>الإيرادات</span><span>المصروفات</span></div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-bold text-slate-800">المصروفات حسب التصنيف</h3>
          {expenseCategories.length === 0 ? <EmptyState /> : (
            <ul className="space-y-4">
              {expenseCategories.map((category) => {
                const amount = Number(category.total_expense || 0);
                const share = totalExpensesByCategory ? amount / totalExpensesByCategory * 100 : 0;
                return (
                  <li key={category.category_name}>
                    <div className="mb-1 flex justify-between gap-3 text-xs"><span className="truncate text-slate-600">{category.category_name}</span><span className="font-bold text-slate-800">{formatCurrency(amount)}</span></div>
                    <div className="h-2 overflow-hidden rounded bg-slate-100"><div className="h-full rounded bg-orange-400" style={{ width: `${share}%` }} /></div>
                  </li>
                );
              })}
            </ul>
          )}
          <h3 className="mb-3 mt-6 border-t border-slate-100 pt-4 text-sm font-bold text-slate-800">الإيرادات حسب الدورة</h3>
          {revenueCourses.length === 0 ? <EmptyState /> : (
            <ul className="space-y-2">
              {revenueCourses.map((course) => <li key={course.course_name} className="flex justify-between gap-3 text-xs"><span className="truncate text-slate-600">{course.course_name}</span><span className="font-bold text-slate-800">{formatCurrency(course.total_revenue)}</span></li>)}
            </ul>
          )}
        </article>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 p-4 md:px-6">
          <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-sky-600" /><h3 className="text-sm font-bold text-slate-800">آخر العمليات المالية</h3></div>
          <button onClick={onViewAllTransactions} className="rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700">عرض الكل</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-right text-xs">
            <thead><tr className="border-b border-slate-100 bg-slate-50 text-[11px] text-slate-500"><th className="px-4 py-3">التاريخ</th><th className="px-4 py-3">النوع</th><th className="px-4 py-3">الوصف</th><th className="px-4 py-3">الدورة / الفوج</th><th className="px-4 py-3">المبلغ</th><th className="px-4 py-3">الحساب</th><th className="px-4 py-3">الحالة</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.length === 0 ? <tr><td colSpan="7"><EmptyState /></td></tr> : transactions.map((tx) => (
                <tr key={tx.id} onClick={() => setSelectedTx(tx)} className="cursor-pointer hover:bg-sky-50/40">
                  <td className="px-4 py-3 text-slate-500">{formatDate(tx.date)}</td><td className="px-4 py-3">{tx.type}</td><td className="px-4 py-3 font-semibold text-slate-800">{tx.description}</td><td className="px-4 py-3 text-slate-500">{tx.cohort}</td><td className="px-4 py-3 font-bold">{tx.amount}</td><td className="px-4 py-3">{tx.account}</td><td className="px-4 py-3">{tx.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/50 p-4">
          <button onClick={onOpenOwnerModal} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"><Wallet className="h-4 w-4" />حركة مالك</button>
          <button onClick={onOpenAddExpense} className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700"><PlusCircle className="h-4 w-4" />إضافة مصروف</button>
          <button onClick={onOpenAddRevenue} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"><PlusCircle className="h-4 w-4" />إضافة إيراد</button>
        </div>
      </section>

      {selectedTx && <Modal isOpen onClose={() => setSelectedTx(null)} title="تفاصيل المعاملة المالية"><div className="space-y-3 p-1 text-sm"><p><strong>التاريخ:</strong> {formatDate(selectedTx.date)}</p><p><strong>النوع:</strong> {selectedTx.type}</p><p><strong>المبلغ:</strong> {selectedTx.amount}</p><p><strong>الحساب:</strong> {selectedTx.account}</p><p><strong>الوصف:</strong> {selectedTx.description}</p>{selectedTx.cohort !== '—' && <p><strong>الدورة / الفوج:</strong> {selectedTx.cohort}</p>}</div></Modal>}
    </div>
  );
}
