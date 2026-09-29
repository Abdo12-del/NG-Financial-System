import React, { useState, useEffect } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Search,
  Filter,
  Download,
  Eye,
  Ban,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet
} from 'lucide-react';
import { apiRequest, formatCurrency, formatDate, exportToCsv } from '../utils/api';
import VoidModal from '../components/modals/VoidModal';
import Modal from '../components/Modal';

export default function Transactions({ onOpenAddRevenue, onOpenAddExpense }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all'); // all, revenue, expense
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ totalPages: 1, total: 0 });

  const [selectedTx, setSelectedTx] = useState(null);
  const [voidTarget, setVoidTarget] = useState(null);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: '25'
      });
      if (typeFilter !== 'all') params.append('type', typeFilter);
      if (searchTerm) params.append('search', searchTerm);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await apiRequest(`/transactions?${params.toString()}`);
      setTransactions(res.transactions || []);
      setPagination(res.pagination || { totalPages: 1, total: 0 });
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [typeFilter, startDate, endDate, page]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchTransactions();
  };

  const handleExport = () => {
    const headers = ['كود القيد', 'التاريخ', 'التصنيف', 'البيان', 'الدورة / الفوج', 'المبلغ', 'الحساب', 'الحالة'];
    const rows = transactions.map(t => [
      t.entry_code,
      t.entry_date,
      t.ledger_category,
      t.description,
      t.cohort_name || t.course_name || '-',
      t.debit_amount > 0 ? t.debit_amount : t.credit_amount,
      t.account_name || 'الخزينة',
      t.is_voided ? 'ملغاة' : 'مكتملة'
    ]);
    exportToCsv(`transactions_${Date.now()}`, headers, rows);
  };

  return (
    <div className="p-8 space-y-6">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Filter Tabs */}
        <div className="flex items-center gap-2 p-1 bg-slate-200/70 rounded-xl">
          <button
            onClick={() => { setTypeFilter('all'); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              typeFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            جميع المعاملات
          </button>
          <button
            onClick={() => { setTypeFilter('revenue'); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              typeFilter === 'revenue' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الإيرادات فقط
          </button>
          <button
            onClick={() => { setTypeFilter('expense'); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              typeFilter === 'expense' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            المصروفات فقط
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>تصدير Excel (CSV)</span>
          </button>

          <button
            onClick={onOpenAddRevenue}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <ArrowDownCircle className="w-4 h-4" />
            <span>+ إضافة إيراد</span>
          </button>

          <button
            onClick={onOpenAddExpense}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <ArrowUpCircle className="w-4 h-4" />
            <span>+ إضافة مصروف</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <form onSubmit={handleSearch} className="flex-1 min-w-[260px] relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث بالكود، البيان، أو اسم الطالب..."
            className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
        </form>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">من:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
          />
          <span className="text-xs text-slate-500 font-medium">إلى:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
          />
          {(startDate || endDate || searchTerm) && (
            <button
              onClick={() => { setStartDate(''); setEndDate(''); setSearchTerm(''); setPage(1); }}
              className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1"
            >
              إعادة تعيين
            </button>
          )}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-bold">
                <th className="py-3 px-4">كود القيد</th>
                <th className="py-3 px-4">التاريخ</th>
                <th className="py-3 px-4">النوع</th>
                <th className="py-3 px-4">البيان والوصف</th>
                <th className="py-3 px-4">الدورة / الفوج</th>
                <th className="py-3 px-4">المبلغ</th>
                <th className="py-3 px-4">الحساب</th>
                <th className="py-3 px-4">الحالة</th>
                <th className="py-3 px-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="9" className="text-center py-12 text-slate-400">
                    جاري تحميل المعاملات...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-12 text-slate-400">
                    لا توجد معاملات تطابق شروط البحث
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const isRev = tx.is_operating_revenue === 1;
                  const isExp = tx.is_operating_expense === 1;
                  const isOwner = tx.ledger_category.includes('OWNER');

                  let badge = (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700">
                      قيد
                    </span>
                  );
                  if (isRev) {
                    badge = (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <ArrowDownLeft className="w-3 h-3" /> إيراد
                      </span>
                    );
                  } else if (isExp) {
                    badge = (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        <ArrowUpRight className="w-3 h-3" /> مصروف
                      </span>
                    );
                  } else if (isOwner) {
                    badge = (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                        <Wallet className="w-3 h-3" /> حركة مالك
                      </span>
                    );
                  }

                  const amount = tx.debit_amount > 0 ? tx.debit_amount : tx.credit_amount;

                  return (
                    <tr
                      key={tx.ledger_id}
                      className={`hover:bg-sky-50/30 transition-colors ${tx.is_voided ? 'bg-slate-50/80 opacity-60' : ''}`}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">{tx.entry_code}</td>
                      <td className="py-3 px-4 text-slate-600 font-semibold">{tx.entry_date}</td>
                      <td className="py-3 px-4">{badge}</td>
                      <td className="py-3 px-4 font-medium max-w-[280px] truncate" title={tx.description}>
                        {tx.description}
                      </td>
                      <td className="py-3 px-4 text-slate-500 truncate max-w-[150px]">
                        {tx.cohort_name || tx.course_name || '-'}
                      </td>
                      <td className="py-3 px-4 font-black text-slate-900 text-sm">
                        {formatCurrency(amount)}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{tx.account_name || 'الخزينة'}</td>
                      <td className="py-3 px-4">
                        {tx.is_voided ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-700">
                            ملغاة
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700">
                            مكتملة
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelectedTx(tx)}
                            title="عرض التفاصيل"
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {!tx.is_voided && (
                            <button
                              onClick={() => setVoidTarget({
                                type: tx.source_table === 'payments' ? 'payment' : (tx.source_table === 'expenses' ? 'expense' : 'owner_transaction'),
                                id: tx.source_id,
                                code: tx.entry_code,
                                description: tx.description,
                                amount: amount
                              })}
                              title="إلغاء وعكس العملية (Void)"
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>إجمالي المعاملات: {pagination.total}</span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-3 py-1 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-40 cursor-pointer"
              >
                السابق
              </button>
              <span className="font-bold">صفحة {page} من {pagination.totalPages}</span>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                className="px-3 py-1 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-40 cursor-pointer"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedTx && (
        <Modal
          isOpen={!!selectedTx}
          onClose={() => setSelectedTx(null)}
          title={`تفاصيل المعاملة (${selectedTx.entry_code})`}
        >
          <div className="space-y-4 text-xs text-slate-700">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-400 block font-medium">كود القيد</span>
                <span className="font-bold text-slate-800">{selectedTx.entry_code}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">تاريخ المعاملة</span>
                <span className="font-bold text-slate-800">{selectedTx.entry_date}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">الحساب المالي</span>
                <span className="font-bold text-slate-800">{selectedTx.account_name}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">المسجل بواسطة</span>
                <span className="font-bold text-slate-800">{selectedTx.creator_name || 'admin'}</span>
              </div>
            </div>

            <div>
              <span className="text-slate-400 block font-medium mb-1">البيان التفصيلي</span>
              <p className="p-3 bg-white rounded-xl border border-slate-200 font-semibold">{selectedTx.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 block font-medium">تدفق وارد (Cash In)</span>
                <span className="font-bold text-emerald-600 text-sm">{formatCurrency(selectedTx.debit_amount)}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">تدفق خارج (Cash Out)</span>
                <span className="font-bold text-rose-600 text-sm">{formatCurrency(selectedTx.credit_amount)}</span>
              </div>
            </div>

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

      {/* Void Modal */}
      {voidTarget && (
        <VoidModal
          isOpen={!!voidTarget}
          onClose={() => setVoidTarget(null)}
          onSuccess={() => {
            fetchTransactions();
          }}
          targetTransaction={voidTarget}
        />
      )}
    </div>
  );
}
