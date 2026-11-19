import React, { useEffect, useState } from 'react';
import { ArrowDownRight, ArrowLeft, ArrowUpRight, History, RotateCcw } from 'lucide-react';
import { apiRequest, formatCurrency, formatDate } from '../utils/api';

export default function ProfitHistory({ onBack }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadHistory() {
    const response = await apiRequest('/transactions/profit-history');
    return response.entries || [];
  }

  useEffect(() => {
    let isCurrent = true;
    loadHistory()
      .then((history) => {
        if (isCurrent) setEntries(history);
      })
      .catch((loadError) => {
        if (isCurrent) setError(loadError.message || 'تعذر تحميل سجل تطور الربح');
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  function handleRetry() {
    setLoading(true);
    setError('');
    loadHistory()
      .then(setEntries)
      .catch((loadError) => setError(loadError.message || 'تعذر تحميل سجل تطور الربح'))
      .finally(() => setLoading(false));
  }

  const timeline = [];
  let runningProfit = 0;
  let totalRevenue = 0;
  let totalExpenses = 0;

  entries.forEach((entry) => {
    const isRevenue = Number(entry.is_operating_revenue) === 1;
    const amount = Number(isRevenue ? entry.debit_amount : entry.credit_amount) || 0;
    const change = isRevenue ? amount : -amount;
    runningProfit += change;
    if (isRevenue) totalRevenue += amount;
    else totalExpenses += amount;
    timeline.push({ ...entry, isRevenue, amount, change, runningProfit });
  });

  return (
    <div className="min-h-screen space-y-6 bg-[#F4F9FD]/60 p-5 md:p-7">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="العودة إلى لوحة التحكم"
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-900">سجل تطور صافي الربح</h2>
            <p className="mt-1 text-xs font-medium text-slate-500">تتبّع أثر كل دفعة ومصروف حتى الرصيد النهائي</p>
          </div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
          <History className="h-5 w-5" />
        </div>
      </header>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          جاري تحميل سجل الربح...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-white p-8 text-center" role="alert">
          <p className="mb-3 text-sm text-rose-600">{error}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-bold text-white"
          >
            <RotateCcw className="h-4 w-4" />
            إعادة المحاولة
          </button>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="ملخص الربح">
            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-xs font-bold text-slate-500">إجمالي الدفعات والإيرادات</h3>
              <p className="mt-3 text-lg font-black text-emerald-700">{formatCurrency(totalRevenue)}</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-xs font-bold text-slate-500">إجمالي المصروفات</h3>
              <p className="mt-3 text-lg font-black text-rose-700">{formatCurrency(totalExpenses)}</p>
            </article>
            <article className="rounded-xl border border-sky-200 bg-sky-50 p-4">
              <h3 className="text-xs font-bold text-sky-700">صافي الربح النهائي</h3>
              <p className="mt-3 text-lg font-black text-sky-900">{formatCurrency(runningProfit)}</p>
            </article>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label="التسلسل الزمني للربح">
            <div className="border-b border-slate-100 p-4 md:px-6">
              <h3 className="text-sm font-bold text-slate-800">تسلسل الدفعات والمصروفات</h3>
            </div>
            {timeline.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">لا توجد دفعات أو مصروفات مسجلة بعد.</p>
            ) : (
              <ol className="divide-y divide-slate-100">
                {timeline.map((entry) => (
                  <li key={entry.ledger_id} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center md:px-6">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${entry.isRevenue ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {entry.isRevenue ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className={`text-xs font-bold ${entry.isRevenue ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {entry.isRevenue ? 'دفعة / إيراد' : 'مصروف'}
                          </span>
                          <span className="text-[11px] text-slate-400">{formatDate(entry.entry_date)}</span>
                          {entry.entry_code && <span className="text-[11px] text-slate-400">{entry.entry_code}</span>}
                        </div>
                        <p className="mt-1 truncate text-sm font-semibold text-slate-800">
                          {entry.description || (entry.isRevenue ? 'دفعة إيراد' : 'مصروف')}
                        </p>
                        {(entry.student_name || entry.cohort_name || entry.course_name) && (
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {[entry.student_name, entry.cohort_name || entry.course_name].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className={`text-sm font-bold md:text-left ${entry.isRevenue ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {entry.change > 0 ? '+' : '−'} {formatCurrency(entry.amount)}
                    </p>
                    <p className="text-xs text-slate-500 md:min-w-40 md:text-left">
                      الرصيد بعد الحركة: <span className="font-bold text-slate-800">{formatCurrency(entry.runningProfit)}</span>
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </div>
  );
}
