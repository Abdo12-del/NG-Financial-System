import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  AlertCircle,
  Download,
  Ban,
  ShieldCheck,
  Scale
} from 'lucide-react';
import { apiRequest, formatCurrency, formatDate, exportToCsv } from '../utils/api';
import VoidModal from '../components/modals/VoidModal';

export default function OwnerAccount({ onOpenContribution, onOpenWithdrawal }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voidTarget, setVoidTarget] = useState(null);

  const fetchOwnerData = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/owner');
      setData(res);
    } catch (err) {
      console.error('Error fetching owner data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOwnerData();
  }, []);

  const handleExport = () => {
    if (!data?.transactions) return;
    const headers = ['كود المعاملة', 'التاريخ', 'نوع الحركة', 'المبلغ', 'الحساب المالي', 'الرصيد التراكمي للمالك', 'البيان', 'الحالة'];
    const rows = data.transactions.map(t => [
      t.transaction_code,
      t.transaction_date,
      t.transaction_type === 'CONTRIBUTION' ? 'ضخ سيولة شخصية' : 'سحب شخصي',
      t.amount,
      t.account_name,
      t.running_balance,
      t.notes || '',
      t.status === 'completed' ? 'مكتملة' : 'ملغاة'
    ]);
    exportToCsv(`owner_account_${Date.now()}`, headers, rows);
  };

  if (loading || !data) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-[#38B6FF] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const { summary, transactions } = data;

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-300">
      {/* Top Banner & Important Accounting Rule */}
      <div className="p-4 bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-100 rounded-2xl flex items-start gap-4 shadow-xs">
        <div className="p-2.5 bg-white rounded-xl shadow-xs text-[#0BAAFF]">
          <Scale className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-extrabold text-slate-900 text-sm">الحساب الجاري للمالك (Owner's Capital & Drawings)</h3>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            تم تصميم هذا الحساب وفق معايير المحاسبة المالية المستقلة: أموال ضخ المالك لا تُعد إيرادات تشغيلية للأكاديمية،
            وسحوبات المالك لا تُعد مصروفات تشغيلية. رصيد المالك = إجمالي ما ضخه المالك - إجمالي ما سحبه.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">إجمالي ما ضخه المالك (Contributions)</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600">
            {formatCurrency(summary.totalContributions)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">تمويل شخصي لسيولة الأكاديمية</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">إجمالي ما سحبه المالك (Withdrawals)</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600">
            {formatCurrency(summary.totalWithdrawals)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">سحوبات شخصية من الصندوق</p>
        </div>

        <div className={`p-5 rounded-2xl border shadow-xs ${
          summary.ownerBalance >= 0 ? 'bg-purple-50/70 border-purple-100' : 'bg-rose-50/70 border-rose-100'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-600">الرصيد المستحق للمالك (Owner Balance)</span>
            <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-xs">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-700">
            {formatCurrency(summary.ownerBalance)}
          </div>
          <p className="text-xs font-bold text-purple-900 mt-1">{summary.statusText}</p>
        </div>
      </div>

      {/* Action Buttons & Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h4 className="font-bold text-slate-800 text-sm">سجل حركات الحساب الجاري للمالك</h4>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>تصدير Excel (CSV)</span>
          </button>

          <button
            onClick={onOpenContribution}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>+ ضخ سيولة شخصية</span>
          </button>

          <button
            onClick={onOpenWithdrawal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>- سحب شخصي للمالك</span>
          </button>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-bold">
                <th className="py-3 px-4">كود العملية</th>
                <th className="py-3 px-4">التاريخ</th>
                <th className="py-3 px-4">نوع الحركة</th>
                <th className="py-3 px-4">المبلغ</th>
                <th className="py-3 px-4">طريقة المعاملة / الحساب</th>
                <th className="py-3 px-4">البيان والملاحظات</th>
                <th className="py-3 px-4">الرصيد التراكمي للمالك</th>
                <th className="py-3 px-4">الحالة</th>
                <th className="py-3 px-4 text-center">إلغاء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-12 text-slate-400">
                    لا توجد حركات مسجلة في حساب المالك حتى الآن
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const isCont = tx.transaction_type === 'CONTRIBUTION';
                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-sky-50/30 transition-colors ${tx.status === 'voided' ? 'bg-slate-50 opacity-60' : ''}`}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">{tx.transaction_code}</td>
                      <td className="py-3 px-4 font-semibold text-slate-600">{tx.transaction_date}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                          isCont
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {isCont ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                          {isCont ? 'ضخ سيولة شخصية' : 'سحب شخصي'}
                        </span>
                      </td>
                      <td className={`py-3 px-4 font-black text-sm ${isCont ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{tx.account_name} ({tx.method_name})</td>
                      <td className="py-3 px-4 font-medium text-slate-600 max-w-[240px] truncate">{tx.notes || '-'}</td>
                      <td className="py-3 px-4 font-extrabold text-purple-700 font-mono">
                        {formatCurrency(tx.running_balance)}
                      </td>
                      <td className="py-3 px-4">
                        {tx.status === 'voided' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-700">
                            ملغاة
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
                            مكتملة
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {tx.status !== 'voided' && (
                          <button
                            onClick={() => setVoidTarget({
                              type: 'owner_transaction',
                              id: tx.id,
                              code: tx.transaction_code,
                              description: `${isCont ? 'ضخ سيولة' : 'سحب شخصي'}: ${tx.notes || ''}`,
                              amount: tx.amount
                            })}
                            title="إلغاء وعكس العملية"
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Void Modal */}
      {voidTarget && (
        <VoidModal
          isOpen={!!voidTarget}
          onClose={() => setVoidTarget(null)}
          onSuccess={fetchOwnerData}
          targetTransaction={voidTarget}
        />
      )}
    </div>
  );
}
