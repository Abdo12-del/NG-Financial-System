import React, { useState, useEffect, useCallback } from 'react';
import {
  FileBarChart,
  Printer,
  Download,
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react';
import { apiRequest, formatCurrency, formatDate, exportToCsv } from '../utils/api';

export default function Reports() {
  const [activeReport, setActiveReport] = useState('pnl'); // 'pnl', 'cashflow', 'cohorts'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportDateLabel] = useState(() => new Date().toLocaleDateString('ar-DZ'));

  const [pnlData, setPnlData] = useState(null);
  const [cashFlowData, setCashFlowData] = useState(null);
  const [cohortsData, setCohortsData] = useState(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    try {
      if (activeReport === 'pnl') {
        const data = await apiRequest(`/reports/profit-loss?${params.toString()}`);
        setPnlData(data);
      } else if (activeReport === 'cashflow') {
        const data = await apiRequest(`/reports/cash-flow?${params.toString()}`);
        setCashFlowData(data);
      } else if (activeReport === 'cohorts') {
        const data = await apiRequest(`/reports/cohorts-profitability?${params.toString()}`);
        setCohortsData(data.cohorts || []);
      }
    } catch (err) {
      console.error('Error fetching report:', err);
    } finally {
      setLoading(false);
    }
  }, [activeReport, startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    if (activeReport === 'pnl' && pnlData) {
      const headers = ['البند', 'النوع', 'المبلغ (دج)'];
      const rows = [
        ...pnlData.revenue.items.map(r => [r.item_name, 'إيراد تشغيلي', r.amount]),
        ['إجمالي الإيرادات التشغيلية', 'مجموع الإيراد', pnlData.revenue.total],
        ...pnlData.expenses.items.map(e => [e.item_name, 'مصروف تشغيلي', e.amount]),
        ['إجمالي المصروفات التشغيلية', 'مجموع المصروفات', pnlData.expenses.total],
        ['صافي الربح التشغيلي', 'Net Profit', pnlData.netProfit]
      ];
      exportToCsv(`profit_and_loss_${Date.now()}`, headers, rows);
    } else if (activeReport === 'cashflow' && cashFlowData) {
      const headers = ['البند', 'التصنيف', 'المبلغ (دج)'];
      const rows = [
        ['الرصيد الافتتاحي (Opening Balance)', 'افتتاحي', cashFlowData.openingBalance],
        ['مدفوعات واشتراكات الطلاب', 'تدفق وارد (تشغيلي)', cashFlowData.cashIn.studentPayments],
        ['ضخ سيولة من المالك', 'تدفق وارد (تمويلي)', cashFlowData.cashIn.ownerContributions],
        ['إيرادات أخرى', 'تدفق وارد', cashFlowData.cashIn.otherIncome],
        ['إجمالي التدفقات النقدية الواردة (Total Cash In)', 'مجموع وارد', cashFlowData.cashIn.total],
        ['أجور مستحقة ومصروفة للأساتذة', 'تدفق خارج', cashFlowData.cashOut.teacherPayments],
        ['مصروفات تشغيلية وإدارية وإعلانات', 'تدفق خارج', cashFlowData.cashOut.operatingExpenses],
        ['سحوبات شخصية للمالك', 'تدفق خارج (تمويلي)', cashFlowData.cashOut.ownerWithdrawals],
        ['إجمالي التدفقات النقدية الخارجة (Total Cash Out)', 'مجموع خارج', cashFlowData.cashOut.total],
        ['صافي التدفق النقدي (Net Cash Flow)', 'صافي التدفق', cashFlowData.netCashFlow],
        ['الرصيد الختامي للصندوق (Closing Balance)', 'ختامي', cashFlowData.closingBalance]
      ];
      exportToCsv(`cash_flow_statement_${Date.now()}`, headers, rows);
    } else if (activeReport === 'cohorts' && cohortsData) {
      const headers = ['الفوج', 'الدورة', 'الأستاذ', 'عدد الطلاب', 'قيمة التسجيلات', 'المحصل فعلياً', 'المبلغ المستحق', 'حصة الأستاذ الفعلية', 'المصاريف المباشرة', 'الربح الفعلي', 'هامش الربح الفعلي', 'الربح المتوقع بعد التحصيل', 'هامش الربح المتوقع'];
      const rows = cohortsData.map(c => [
        c.cohort_name,
        c.course_name,
        c.teacher_name,
        c.student_count,
        c.total_enrollment_value,
        c.total_collected,
        c.total_outstanding,
        c.teacher_share,
        c.direct_expenses,
        c.academy_net_profit,
        c.profit_margin,
        c.expected_academy_net_profit,
        c.expected_profit_margin
      ]);
      exportToCsv(`cohorts_profitability_${Date.now()}`, headers, rows);
    }
  };

  const renderStatCard = (label, value, tone, hint) => {
    const tones = {
      emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
      rose: 'border-rose-200 bg-rose-50 text-rose-900',
      sky: 'border-sky-200 bg-sky-50 text-sky-900',
      slate: 'border-slate-200 bg-slate-50 text-slate-900',
      amber: 'border-amber-200 bg-amber-50 text-amber-900'
    };

    return (
      <div className={`rounded-2xl border p-4 ${tones[tone] || tones.slate}`}>
        <div className="text-[11px] font-bold text-slate-500">{label}</div>
        <div className="mt-2 text-xl md:text-2xl font-black font-mono tracking-tight">{value}</div>
        {hint && <div className="mt-1 text-[10px] font-semibold text-slate-500">{hint}</div>}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-5">
      <div className="no-print bg-white/90 backdrop-blur-sm border border-slate-200 rounded-3xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
              <FileBarChart className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-black text-slate-900">تقارير المركز المالي</div>
              <div className="text-xs text-slate-500">لوحة تحكم مالية واضحة وسريعة</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>تصدير Excel</span>
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة PDF</span>
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
          <button
            onClick={() => setActiveReport('pnl')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeReport === 'pnl' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الأرباح والخسائر
          </button>

          <button
            onClick={() => setActiveReport('cashflow')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeReport === 'cashflow' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            التدفق النقدي
          </button>

          <button
            onClick={() => setActiveReport('cohorts')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeReport === 'cohorts' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ربحية الأفواج
          </button>
        </div>
      </div>

      <div className="bg-white p-4 md:p-5 rounded-3xl border border-slate-200 shadow-sm no-print">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-600">الفترة الزمنية:</span>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span>من:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#38B6FF] focus:outline-none"
              />
              <span>إلى:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#38B6FF] focus:outline-none"
              />
              {(startDate || endDate) && (
                <button
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className="text-xs text-slate-400 hover:text-slate-700 px-2"
                >
                  مسح التحديد
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const now = new Date();
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
                const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
                setStartDate(startOfMonth);
                setEndDate(endOfMonth);
              }}
              className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded-lg font-medium cursor-pointer"
            >
              هذا الشهر
            </button>
            <button
              onClick={() => {
                const now = new Date();
                const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
                setStartDate(startOfYear);
                setEndDate(now.toISOString().slice(0, 10));
              }}
              className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded-lg font-medium cursor-pointer"
            >
              العام الحالي
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white p-5 md:p-8 rounded-3xl border border-slate-200 shadow-sm print:shadow-none print:border-none print:p-0">
        <div className="border-b border-slate-200 pb-5 mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between print:block">
          <div>
            <h2 className="text-2xl font-black text-slate-900">NG Academy - المركز المالي</h2>
            <p className="text-sm font-bold text-[#0BAAFF] mt-1">
              {activeReport === 'pnl' && 'قائمة الأرباح والخسائر التشغيلية'}
              {activeReport === 'cashflow' && 'قائمة التدفقات النقدية'}
              {activeReport === 'cohorts' && 'تقرير ربحية الأفواج التدريبية'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              الفترة: {startDate ? formatDate(startDate) : 'البداية'} حتى {endDate ? formatDate(endDate) : 'اليوم'}
            </p>
          </div>
          <div className="text-left font-mono text-xs text-slate-400">
            <div className="text-lg font-black text-slate-900 tracking-wider">NG ACADEMY</div>
            <div>نظام مالي محلي معتمد</div>
            <div>تاريخ الاستخراج: {reportDateLabel}</div>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-4 border-[#38B6FF] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-xs text-slate-400">جاري إعداد التقرير المالي...</p>
          </div>
        ) : (
          <>
            {activeReport === 'pnl' && pnlData && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  {renderStatCard('إجمالي الإيرادات', formatCurrency(pnlData.revenue.total), 'emerald', 'إيرادات التشغيل')}
                  {renderStatCard('إجمالي المصروفات', formatCurrency(pnlData.expenses.total), 'rose', 'مصروفات التشغيل')}
                  {renderStatCard('صافي الربح', formatCurrency(pnlData.netProfit), 'sky', `هامش: ${pnlData.profitMargin}`)}
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between pb-2 border-b border-emerald-200 mb-3">
                      <span className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                        الإيرادات التشغيلية
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">حسب الدورات</span>
                    </div>
                    <div className="space-y-2 text-xs">
                      {pnlData.revenue.items.length === 0 ? (
                        <p className="text-slate-400 py-2">لا توجد إيرادات مسجلة خلال هذه الفترة</p>
                      ) : (
                        pnlData.revenue.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between py-1.5 border-b border-slate-100">
                            <span className="text-slate-700 font-medium">{item.item_name}</span>
                            <span className="font-bold text-slate-900 font-mono">{formatCurrency(item.amount)}</span>
                          </div>
                        ))
                      )}
                      <div className="flex justify-between pt-3 font-black text-sm text-emerald-700 bg-emerald-100/50 p-3 rounded-xl border border-emerald-200">
                        <span>الإجمالي:</span>
                        <span className="font-mono">{formatCurrency(pnlData.revenue.total)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between pb-2 border-b border-rose-200 mb-3">
                      <span className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-rose-600" />
                        المصروفات التشغيلية
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">حسب التصنيفات</span>
                    </div>
                    <div className="space-y-2 text-xs">
                      {pnlData.expenses.items.length === 0 ? (
                        <p className="text-slate-400 py-2">لا توجد مصروفات مسجلة خلال هذه الفترة</p>
                      ) : (
                        pnlData.expenses.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between py-1.5 border-b border-slate-100">
                            <span className="text-slate-700 font-medium">{item.item_name}</span>
                            <span className="font-bold text-slate-900 font-mono">{formatCurrency(item.amount)}</span>
                          </div>
                        ))
                      )}
                      <div className="flex justify-between pt-3 font-black text-sm text-rose-700 bg-rose-100/50 p-3 rounded-xl border border-rose-200">
                        <span>الإجمالي:</span>
                        <span className="font-mono">{formatCurrency(pnlData.expenses.total)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5 rounded-2xl border-2 border-slate-900 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-black">صافي الربح التشغيلي</h3>
                    <p className="text-xs text-slate-400 mt-0.5">الإيرادات التشغيلية - المصروفات التشغيلية</p>
                  </div>
                  <div className="text-left font-mono">
                    <div className="text-3xl font-black text-[#38B6FF]">{formatCurrency(pnlData.netProfit)}</div>
                    <div className="text-xs text-slate-300 font-semibold mt-1">هامش الربح التشغيلي: {pnlData.profitMargin}</div>
                  </div>
                </div>
              </div>
            )}

            {activeReport === 'cashflow' && cashFlowData && (
              <div className="space-y-6 text-xs">
                <div className="grid gap-4 md:grid-cols-4">
                  {renderStatCard('الرصيد الافتتاحي', formatCurrency(cashFlowData.openingBalance), 'slate', 'مفتاح التقرير')}
                  {renderStatCard('إجمالي الوارد', formatCurrency(cashFlowData.cashIn.total), 'emerald', 'الوارد النقدي')}
                  {renderStatCard('إجمالي الخارج', formatCurrency(cashFlowData.cashOut.total), 'rose', 'الخارج النقدي')}
                  {renderStatCard('الرصيد الختامي', formatCurrency(cashFlowData.closingBalance), 'sky', 'حالة الصندوق')}
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h4 className="font-bold text-emerald-800 text-sm mb-3 pb-2 border-b border-emerald-200 flex items-center gap-1.5">
                      <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                      التدفقات النقدية الداخلة
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span>متحصلات الطلاب</span>
                        <strong className="font-mono text-slate-900">{formatCurrency(cashFlowData.cashIn.studentPayments)}</strong>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-100 bg-sky-50/60 px-2 rounded">
                        <span className="font-semibold text-sky-900">ضخ المالك</span>
                        <strong className="font-mono text-sky-800">{formatCurrency(cashFlowData.cashIn.ownerContributions)}</strong>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span>إيرادات أخرى</span>
                        <strong className="font-mono text-slate-900">{formatCurrency(cashFlowData.cashIn.otherIncome)}</strong>
                      </div>
                      <div className="flex justify-between font-black text-sm text-emerald-700 pt-2">
                        <span>إجمالي الداخل:</span>
                        <span className="font-mono">+{formatCurrency(cashFlowData.cashIn.total)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h4 className="font-bold text-rose-800 text-sm mb-3 pb-2 border-b border-rose-200 flex items-center gap-1.5">
                      <ArrowUpRight className="w-4 h-4 text-rose-600" />
                      التدفقات النقدية الخارجة
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span>أجور الأساتذة</span>
                        <strong className="font-mono text-slate-900">{formatCurrency(cashFlowData.cashOut.teacherPayments)}</strong>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span>مصروفات تشغيلية</span>
                        <strong className="font-mono text-slate-900">{formatCurrency(cashFlowData.cashOut.operatingExpenses)}</strong>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-100 bg-amber-50/60 px-2 rounded">
                        <span className="font-semibold text-amber-900">سحب المالك</span>
                        <strong className="font-mono text-amber-800">{formatCurrency(cashFlowData.cashOut.ownerWithdrawals)}</strong>
                      </div>
                      <div className="flex justify-between font-black text-sm text-rose-700 pt-2">
                        <span>إجمالي الخارج:</span>
                        <span className="font-mono">-{formatCurrency(cashFlowData.cashOut.total)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t-2 border-slate-200">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <span className="text-slate-500 block font-bold mb-1">صافي التدفق النقدي:</span>
                    <span className={`text-xl font-black font-mono ${cashFlowData.netCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {formatCurrency(cashFlowData.netCashFlow)}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-1">التدفقات الداخلة - التدفقات الخارجة</p>
                  </div>

                  <div className="p-4 bg-sky-50 rounded-2xl border border-sky-200">
                    <span className="text-[#0BAAFF] block font-bold mb-1">الرصيد الختامي:</span>
                    <span className="text-xl font-black text-slate-900 font-mono">{formatCurrency(cashFlowData.closingBalance)}</span>
                    <p className="text-[11px] text-slate-500 mt-1">الرصيد الافتتاحي + صافي التدفق</p>
                  </div>
                </div>
              </div>
            )}

            {activeReport === 'cohorts' && cohortsData && (
              <div className="space-y-5 text-xs">
                <div className="grid gap-4 md:grid-cols-4">
                  {renderStatCard('عدد الطلاب', cohortsData.reduce((sum, c) => sum + Number(c.student_count || 0), 0).toString(), 'slate', 'إجمالي الطلاب')}
                  {renderStatCard('المحصل فعلياً', formatCurrency(cohortsData.reduce((sum, c) => sum + Number(c.total_collected || 0), 0)), 'emerald', 'مجموع المقبوضات')}
                  {renderStatCard('الربح الفعلي', formatCurrency(cohortsData.reduce((sum, c) => sum + Number(c.academy_net_profit || 0), 0)), 'sky', 'بعد المصاريف')}
                  {renderStatCard('الهامش المتوسط', `${(cohortsData.reduce((sum, c) => sum + Number(c.profit_margin?.replace('%', '') || 0), 0) / (cohortsData.length || 1)).toFixed(1)}%`, 'amber', 'على مستوى الأفواج')}
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-700">
                          <th className="p-3">الفوج</th>
                          <th className="p-3">الدورة</th>
                          <th className="p-3">الأستاذ</th>
                          <th className="p-3 text-center">الطلاب</th>
                          <th className="p-3">المحصل</th>
                          <th className="p-3">المستحق</th>
                          <th className="p-3">حصة الأستاذ</th>
                          <th className="p-3">المصاريف</th>
                          <th className="p-3">الربح</th>
                          <th className="p-3 text-center">هامش</th>
                          <th className="p-3">متوقع</th>
                          <th className="p-3 text-center">هامش متوقع</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {cohortsData.length === 0 ? (
                          <tr>
                            <td colSpan="12" className="text-center py-8 text-slate-400">لا توجد بيانات أفواج</td>
                          </tr>
                        ) : (
                          cohortsData.map((c, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="p-3 font-bold text-slate-900">{c.cohort_name}</td>
                              <td className="p-3 text-slate-600">{c.course_name}</td>
                              <td className="p-3 text-slate-600">{c.teacher_name}</td>
                              <td className="p-3 text-center font-semibold">{c.student_count}</td>
                              <td className="p-3 font-bold text-emerald-600">{formatCurrency(c.total_collected)}</td>
                              <td className="p-3 font-bold text-amber-600">{formatCurrency(c.total_outstanding)}</td>
                              <td className="p-3 font-semibold text-rose-600">{formatCurrency(c.teacher_share)}</td>
                              <td className="p-3 text-slate-600">{formatCurrency(c.direct_expenses)}</td>
                              <td className="p-3 font-black text-slate-900">{formatCurrency(c.academy_net_profit)}</td>
                              <td className="p-3 text-center font-bold text-[#0BAAFF]">{c.profit_margin}</td>
                              <td className="p-3 font-black text-emerald-700">{formatCurrency(c.expected_academy_net_profit)}</td>
                              <td className="p-3 text-center font-bold text-emerald-700">{c.expected_profit_margin}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
