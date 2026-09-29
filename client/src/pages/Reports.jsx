import React, { useState, useEffect } from 'react';
import {
  FileBarChart,
  Printer,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight,
  PieChart,
  Layers,
  Scale
} from 'lucide-react';
import { apiRequest, formatCurrency, formatDate, exportToCsv } from '../utils/api';

export default function Reports() {
  const [activeReport, setActiveReport] = useState('pnl'); // 'pnl', 'cashflow', 'cohorts'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  const [pnlData, setPnlData] = useState(null);
  const [cashFlowData, setCashFlowData] = useState(null);
  const [cohortsData, setCohortsData] = useState(null);

  const fetchReport = async () => {
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
  };

  useEffect(() => {
    fetchReport();
  }, [activeReport, startDate, endDate]);

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
      const headers = ['الفوج', 'الدورة', 'الأستاذ', 'عدد الطلاب', 'قيمة التسجيلات', 'المدفوع فعلياً', 'المتبقي', 'حصة الأستاذ', 'المصاريف المباشرة', 'صافي ربح الأكاديمية', 'هامش الربح'];
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
        c.profit_margin
      ]);
      exportToCsv(`cohorts_profitability_${Date.now()}`, headers, rows);
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Top Header & Report Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-2 p-1 bg-slate-200/70 rounded-xl">
          <button
            onClick={() => setActiveReport('pnl')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeReport === 'pnl' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الأرباح والخسائر (P&L)
          </button>

          <button
            onClick={() => setActiveReport('cashflow')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeReport === 'cashflow' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            التدفق النقدي (Cash Flow)
          </button>

          <button
            onClick={() => setActiveReport('cohorts')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeReport === 'cohorts' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ربحية الأفواج (Cohorts Profitability)
          </button>
        </div>

        <div className="flex items-center gap-3">
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
            <span>طباعة التقرير (PDF)</span>
          </button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-600">الفترة الزمنية:</span>
          <div className="flex items-center gap-2 text-xs">
            <span>من:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
            />
            <span>إلى:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
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

      {/* Report Container (Formatted for screen and clean PDF printing) */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm print:shadow-none print:border-none print:p-0">
        {/* Printable Header */}
        <div className="border-b border-slate-200 pb-6 mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900">NG Academy - المركز المالي</h2>
            <p className="text-sm font-bold text-[#0BAAFF] mt-1">
              {activeReport === 'pnl' && 'قائمة الأرباح والخسائر التشغيلية (Profit & Loss Statement)'}
              {activeReport === 'cashflow' && 'قائمة التدفقات النقدية (Cash Flow Statement)'}
              {activeReport === 'cohorts' && 'تقرير ربحية وهوامش الأفواج التدريبية (Cohort Margin Analysis)'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              الفترة: {startDate ? formatDate(startDate) : 'البداية'} حتى {endDate ? formatDate(endDate) : 'اليوم'}
            </p>
          </div>
          <div className="text-left font-mono text-xs text-slate-400">
            <div className="text-lg font-black text-slate-900 tracking-wider">NG ACADEMY</div>
            <div>نظام مالي محلي معتمد</div>
            <div>تاريخ الاستخراج: {new Date().toLocaleDateString('ar-DZ')}</div>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-4 border-[#38B6FF] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-xs text-slate-400">جاري إعداد التقرير المالي...</p>
          </div>
        ) : (
          <>
            {/* 1. Profit & Loss Statement */}
            {activeReport === 'pnl' && pnlData && (
              <div className="space-y-6">
                {/* Revenue Section */}
                <div>
                  <div className="flex items-center justify-between pb-2 border-b-2 border-emerald-500 mb-3">
                    <span className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                      الإيرادات التشغيلية (Operating Revenue)
                    </span>
                    <span className="font-mono text-xs text-slate-400">حسب الدورات</span>
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
                    <div className="flex justify-between pt-3 font-black text-sm text-emerald-700 bg-emerald-50/60 p-3 rounded-xl border border-emerald-100">
                      <span>إجمالي الإيرادات التشغيلية:</span>
                      <span className="font-mono">{formatCurrency(pnlData.revenue.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Operating Expenses Section */}
                <div>
                  <div className="flex items-center justify-between pb-2 border-b-2 border-rose-500 mb-3">
                    <span className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-rose-600" />
                      المصروفات التشغيلية (Operating Expenses)
                    </span>
                    <span className="font-mono text-xs text-slate-400">حسب التصنيفات المعتمدة</span>
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
                    <div className="flex justify-between pt-3 font-black text-sm text-rose-700 bg-rose-50/60 p-3 rounded-xl border border-rose-100">
                      <span>إجمالي المصروفات التشغيلية:</span>
                      <span className="font-mono">{formatCurrency(pnlData.expenses.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Net Profit Summary Box */}
                <div className="p-5 rounded-2xl border-2 border-slate-900 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-black">صافي الربح التشغيلي (Net Operating Profit)</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      الإيرادات التشغيلية - المصروفات التشغيلية (مفصول تماماً عن سحوبات وضخ المالك)
                    </p>
                  </div>
                  <div className="text-left font-mono">
                    <div className="text-3xl font-black text-[#38B6FF]">
                      {formatCurrency(pnlData.netProfit)}
                    </div>
                    <div className="text-xs text-slate-300 font-semibold mt-1">
                      هامش الربح التشغيلي: {pnlData.profitMargin}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Cash Flow Statement */}
            {activeReport === 'cashflow' && cashFlowData && (
              <div className="space-y-6 text-xs">
                {/* Opening Balance */}
                <div className="p-4 bg-slate-100 rounded-2xl flex items-center justify-between font-bold text-slate-800">
                  <span className="text-sm">الرصيد النقدي الافتتاحي (Opening Cash Balance):</span>
                  <span className="text-base font-mono">{formatCurrency(cashFlowData.openingBalance)}</span>
                </div>

                {/* Cash In */}
                <div>
                  <h4 className="font-bold text-emerald-800 text-sm mb-2 pb-1 border-b border-emerald-300 flex items-center gap-1.5">
                    <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                    التدفقات النقدية الداخلة (Cash Inflow)
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span>متحصلات اشتراكات ورسوم الطلاب (Operating Cash In):</span>
                      <strong className="font-mono text-slate-900">{formatCurrency(cashFlowData.cashIn.studentPayments)}</strong>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100 bg-sky-50/40 px-2 rounded">
                      <span className="font-semibold text-sky-900">ضخ سيولة من المالك (Owner Contributions - Financing Cash In):</span>
                      <strong className="font-mono text-sky-800">{formatCurrency(cashFlowData.cashIn.ownerContributions)}</strong>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span>إيرادات ومقبوضات نقدية أخرى:</span>
                      <strong className="font-mono text-slate-900">{formatCurrency(cashFlowData.cashIn.otherIncome)}</strong>
                    </div>
                    <div className="flex justify-between font-black text-sm text-emerald-700 pt-2">
                      <span>إجمالي التدفقات النقدية الداخلة:</span>
                      <span className="font-mono">+{formatCurrency(cashFlowData.cashIn.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Cash Out */}
                <div>
                  <h4 className="font-bold text-rose-800 text-sm mb-2 pb-1 border-b border-rose-300 flex items-center gap-1.5">
                    <ArrowUpRight className="w-4 h-4 text-rose-600" />
                    التدفقات النقدية الخارجة (Cash Outflow)
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span>مدفوعات أجور الأساتذة الفعلية (Teacher Wage Payments):</span>
                      <strong className="font-mono text-slate-900">{formatCurrency(cashFlowData.cashOut.teacherPayments)}</strong>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span>المصروفات التشغيلية والإعلانات والخدمات (Operating Cash Out):</span>
                      <strong className="font-mono text-slate-900">{formatCurrency(cashFlowData.cashOut.operatingExpenses)}</strong>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100 bg-amber-50/40 px-2 rounded">
                      <span className="font-semibold text-amber-900">سحوبات شخصية للمالك (Owner Withdrawals - Financing Cash Out):</span>
                      <strong className="font-mono text-amber-800">{formatCurrency(cashFlowData.cashOut.ownerWithdrawals)}</strong>
                    </div>
                    <div className="flex justify-between font-black text-sm text-rose-700 pt-2">
                      <span>إجمالي التدفقات النقدية الخارجة:</span>
                      <span className="font-mono">-{formatCurrency(cashFlowData.cashOut.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Net Flow & Closing Balance */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t-2 border-slate-200">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <span className="text-slate-500 block font-bold mb-1">صافي التدفق النقدي (Net Cash Flow):</span>
                    <span className={`text-xl font-black font-mono ${
                      cashFlowData.netCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {formatCurrency(cashFlowData.netCashFlow)}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-1">التدفقات الداخلة - التدفقات الخارجة</p>
                  </div>

                  <div className="p-4 bg-sky-50 rounded-2xl border border-sky-200">
                    <span className="text-[#0BAAFF] block font-bold mb-1">الرصيد النقدي الختامي للصندوق (Closing Cash Balance):</span>
                    <span className="text-xl font-black text-slate-900 font-mono">
                      {formatCurrency(cashFlowData.closingBalance)}
                    </span>
                    <p className="text-[11px] text-slate-500 mt-1">الرصيد الافتتاحي + صافي التدفق النقدي</p>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Cohorts Profitability */}
            {activeReport === 'cohorts' && cohortsData && (
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-700">
                      <th className="p-3">الفوج</th>
                      <th className="p-3">الدورة</th>
                      <th className="p-3">الأستاذ</th>
                      <th className="p-3 text-center">الطلاب</th>
                      <th className="p-3">المحصل (Revenue)</th>
                      <th className="p-3">حصة الأستاذ</th>
                      <th className="p-3">المصاريف المباشرة</th>
                      <th className="p-3">صافي ربح الأكاديمية</th>
                      <th className="p-3 text-center">هامش الربح</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {cohortsData.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="text-center py-8 text-slate-400">
                          لا توجد بيانات أفواج
                        </td>
                      </tr>
                    ) : (
                      cohortsData.map((c, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-3 font-bold text-slate-900">{c.cohort_name}</td>
                          <td className="p-3 text-slate-600">{c.course_name}</td>
                          <td className="p-3 text-slate-600">{c.teacher_name}</td>
                          <td className="p-3 text-center font-semibold">{c.student_count}</td>
                          <td className="p-3 font-bold text-emerald-600">{formatCurrency(c.total_collected)}</td>
                          <td className="p-3 font-semibold text-rose-600">{formatCurrency(c.teacher_share)}</td>
                          <td className="p-3 text-slate-600">{formatCurrency(c.direct_expenses)}</td>
                          <td className="p-3 font-black text-slate-900">
                            {formatCurrency(c.academy_net_profit)}
                          </td>
                          <td className="p-3 text-center font-bold text-[#0BAAFF]">
                            {c.profit_margin}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
