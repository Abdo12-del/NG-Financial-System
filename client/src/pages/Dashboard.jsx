import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  GraduationCap,
  Users,
  Award,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Eye,
  CheckCircle2,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { apiRequest, formatCurrency, formatDate } from '../utils/api';
import Modal from '../components/Modal';

export default function Dashboard({ onOpenAddRevenue, onOpenAddExpense, onOpenOwnerModal }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState(null);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/dashboard/stats');
      setData(res);
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading || !data) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#38B6FF] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-slate-500 font-medium">جاري تحميل بيانات لوحة التحكم المالية...</p>
        </div>
      </div>
    );
  }

  const { metrics, charts, recentTransactions } = data;

  const statCards = [
    {
      title: 'إجمالي الإيرادات التشغيلية',
      amount: metrics.totalRevenue,
      subtext: 'مدفوعات واشتراكات الطلاب',
      icon: TrendingUp,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50 border-emerald-100',
      iconBg: 'bg-emerald-500 text-white'
    },
    {
      title: 'إجمالي المصروفات التشغيلية',
      amount: metrics.totalExpenses,
      subtext: 'أجور، إعلانات، ومصاريف إدارية',
      icon: TrendingDown,
      color: 'text-rose-600',
      bgColor: 'bg-rose-50 border-rose-100',
      iconBg: 'bg-rose-500 text-white'
    },
    {
      title: 'صافي الربح التشغيلي',
      amount: metrics.netProfit,
      subtext: 'الإيرادات التشغيلية - المصروفات',
      icon: DollarSign,
      color: metrics.netProfit >= 0 ? 'text-[#0BAAFF]' : 'text-amber-600',
      bgColor: metrics.netProfit >= 0 ? 'bg-sky-50 border-sky-100' : 'bg-amber-50 border-amber-100',
      iconBg: metrics.netProfit >= 0 ? 'bg-[#38B6FF] text-white' : 'bg-amber-500 text-white'
    },
    {
      title: 'الرصيد النقدي الحالي',
      amount: metrics.currentCashBalance,
      subtext: 'السيولة المتاحة في الصندوق والبنك',
      icon: Wallet,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50 border-indigo-100',
      iconBg: 'bg-indigo-500 text-white'
    },
    {
      title: 'مستحقات الأساتذة',
      amount: metrics.teacherPayables,
      subtext: 'أجور غير مدفوعة للمؤطرين',
      icon: GraduationCap,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 border-amber-100',
      iconBg: 'bg-amber-500 text-white'
    },
    {
      title: 'رصيد المالك المستحق',
      amount: metrics.ownerBalance,
      subtext: metrics.ownerBalance >= 0 ? 'الأكاديمية مدينة للمالك' : 'المالك مدين للأكاديمية',
      icon: Award,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 border-purple-100',
      iconBg: 'bg-purple-500 text-white'
    },
    {
      title: 'المبالغ المستحقة من الطلاب',
      amount: metrics.studentOutstanding,
      subtext: 'أقساط ورسوم متبقية للتحصيل',
      icon: Users,
      color: 'text-slate-700',
      bgColor: 'bg-slate-100/70 border-slate-200',
      iconBg: 'bg-slate-700 text-white'
    }
  ];

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-300">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className={`p-5 rounded-2xl border transition-all duration-200 hover:shadow-md ${card.bgColor}`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-600 tracking-tight">{card.title}</span>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-xs ${card.iconBg}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className={`text-2xl font-black tracking-tight ${card.color}`}>
                {formatCurrency(card.amount)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1 font-medium">{card.subtext}</div>
            </div>
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Comparison */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">الإيرادات والمصروفات حسب الشهر</h3>
              <p className="text-xs text-slate-400">تتبع الأداء الشهري للعام الحالي</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-emerald-600">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> إيرادات
              </span>
              <span className="flex items-center gap-1.5 text-rose-600">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> مصروفات
              </span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {charts.monthlyComparison.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">لا توجد بيانات شهرية كافية بعد</p>
            ) : (
              charts.monthlyComparison.map((m) => {
                const maxVal = Math.max(
                  ...charts.monthlyComparison.map(x => Math.max(x.revenue, x.expenses)),
                  1
                );
                const revPct = Math.min(100, (m.revenue / maxVal) * 100);
                const expPct = Math.min(100, (m.expenses / maxVal) * 100);

                return (
                  <div key={m.month} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span className="font-bold">{m.month}</span>
                      <span className="text-[11px] font-semibold text-slate-500">
                        صافي: <strong className={m.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                          {formatCurrency(m.netProfit)}
                        </strong>
                      </span>
                    </div>
                    {/* Bars */}
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex flex-col gap-0.5">
                      <div
                        className="h-1 bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${revPct}%` }}
                        title={`إيراد: ${m.revenue} دج`}
                      />
                      <div
                        className="h-1 bg-rose-500 rounded-full transition-all duration-500"
                        style={{ width: `${expPct}%` }}
                        title={`مصروف: ${m.expenses} دج`}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Breakdown: Revenue By Course & Expenses By Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Revenue By Course */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
            <h3 className="font-bold text-slate-800 text-sm mb-1">الإيرادات حسب الدورة</h3>
            <p className="text-xs text-slate-400 mb-3">الدورات الأكثر تحقيقاً للمداخيل</p>

            <div className="space-y-3 flex-1">
              {charts.revenueByCourse.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">لا توجد إيرادات مسجلة</p>
              ) : (
                charts.revenueByCourse.map((c, i) => {
                  const total = charts.revenueByCourse.reduce((acc, x) => acc + parseFloat(x.total_revenue), 0) || 1;
                  const pct = Math.round((parseFloat(c.total_revenue) / total) * 100);
                  return (
                    <div key={i} className="text-xs">
                      <div className="flex justify-between font-semibold text-slate-700 mb-1">
                        <span className="truncate max-w-[140px]">{c.course_name}</span>
                        <span>{formatCurrency(c.total_revenue)}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-[#38B6FF] h-full rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Expenses By Category */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
            <h3 className="font-bold text-slate-800 text-sm mb-1">المصروفات حسب التصنيف</h3>
            <p className="text-xs text-slate-400 mb-3">توزيع التكاليف التشغيلية</p>

            <div className="space-y-3 flex-1">
              {charts.expensesByCategory.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">لا توجد مصروفات مسجلة</p>
              ) : (
                charts.expensesByCategory.map((c, i) => {
                  const total = charts.expensesByCategory.reduce((acc, x) => acc + parseFloat(x.total_expense), 0) || 1;
                  const pct = Math.round((parseFloat(c.total_expense) / total) * 100);
                  return (
                    <div key={i} className="text-xs">
                      <div className="flex justify-between font-semibold text-slate-700 mb-1">
                        <span className="truncate max-w-[140px]">{c.category_name}</span>
                        <span>{formatCurrency(c.total_expense)}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-rose-500 h-full rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">آخر العمليات والمعاملات المالية</h3>
            <p className="text-xs text-slate-400 mt-0.5">اضغط على أي عملية لعرض كامل تفاصيل القيد المحاسبي</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-bold">
                <th className="py-3 px-4">التاريخ</th>
                <th className="py-3 px-4">النوع</th>
                <th className="py-3 px-4">الوصف / البيان</th>
                <th className="py-3 px-4">الدورة / الفوج</th>
                <th className="py-3 px-4">المبلغ</th>
                <th className="py-3 px-4">الحساب / الخزينة</th>
                <th className="py-3 px-4">الحالة</th>
                <th className="py-3 px-4 text-center">تفاصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {recentTransactions.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-slate-400">
                    لا توجد معاملات مسجلة بعد
                  </td>
                </tr>
              ) : (
                recentTransactions.map((tx) => {
                  const isRev = tx.debit_amount > 0 && tx.is_operating_revenue;
                  const isExp = tx.credit_amount > 0 && tx.is_operating_expense;
                  const isOwner = tx.ledger_category.includes('OWNER');

                  let typeBadge = (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700">
                      معاملة
                    </span>
                  );
                  if (isRev) {
                    typeBadge = (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <ArrowDownLeft className="w-3 h-3" /> إيراد
                      </span>
                    );
                  } else if (isExp) {
                    typeBadge = (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        <ArrowUpRight className="w-3 h-3" /> مصروف
                      </span>
                    );
                  } else if (isOwner) {
                    typeBadge = (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                        <Wallet className="w-3 h-3" /> حساب المالك
                      </span>
                    );
                  }

                  const amount = tx.debit_amount > 0 ? tx.debit_amount : tx.credit_amount;

                  return (
                    <tr
                      key={tx.ledger_id}
                      onClick={() => setSelectedTx(tx)}
                      className={`hover:bg-sky-50/40 cursor-pointer transition-colors ${tx.is_voided ? 'opacity-60 bg-slate-50' : ''}`}
                    >
                      <td className="py-3 px-4 font-semibold text-slate-600">{tx.entry_date}</td>
                      <td className="py-3 px-4">{typeBadge}</td>
                      <td className="py-3 px-4 font-medium max-w-[240px] truncate" title={tx.description}>
                        {tx.description}
                      </td>
                      <td className="py-3 px-4 text-slate-500 truncate max-w-[150px]">
                        {tx.cohort_name || tx.course_name || '-'}
                      </td>
                      <td className="py-3 px-4 font-extrabold text-slate-900">
                        {formatCurrency(amount)}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{tx.account_name || 'الخزينة'}</td>
                      <td className="py-3 px-4">
                        {tx.is_voided ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-700">
                            ملغاة (Void)
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700">
                            مكتملة
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTx(tx);
                          }}
                          className="p-1 hover:bg-slate-200 rounded-md text-slate-500 hover:text-slate-800 transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {selectedTx && (
        <Modal
          isOpen={!!selectedTx}
          onClose={() => setSelectedTx(null)}
          title={`تفاصيل القيد المحاسبي (${selectedTx.entry_code || `#${selectedTx.ledger_id}`})`}
        >
          <div className="space-y-4 text-xs text-slate-700">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-400 block font-medium">كود القيد</span>
                <span className="font-bold text-slate-800">{selectedTx.entry_code || selectedTx.ledger_id}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">تاريخ المعاملة</span>
                <span className="font-bold text-slate-800">{selectedTx.entry_date}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">تصنيف دفتر الأستاذ</span>
                <span className="font-bold text-slate-800">{selectedTx.ledger_category}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">الحساب المالي</span>
                <span className="font-bold text-slate-800">{selectedTx.account_name}</span>
              </div>
            </div>

            <div>
              <span className="text-slate-400 block font-medium mb-1">البيان والوصف</span>
              <p className="p-3 bg-white rounded-xl border border-slate-200 font-semibold">{selectedTx.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 block font-medium">تدفق وارد (Cash In / Debit)</span>
                <span className="font-bold text-emerald-600 text-sm">{formatCurrency(selectedTx.debit_amount)}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">تدفق خارج (Cash Out / Credit)</span>
                <span className="font-bold text-rose-600 text-sm">{formatCurrency(selectedTx.credit_amount)}</span>
              </div>
            </div>

            {selectedTx.student_name && (
              <p><strong>الطالب:</strong> {selectedTx.student_name}</p>
            )}
            {selectedTx.teacher_name && (
              <p><strong>الأستاذ:</strong> {selectedTx.teacher_name}</p>
            )}
            {selectedTx.cohort_name && (
              <p><strong>الفوج:</strong> {selectedTx.cohort_name}</p>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedTx(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 font-bold rounded-xl text-slate-700 cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
