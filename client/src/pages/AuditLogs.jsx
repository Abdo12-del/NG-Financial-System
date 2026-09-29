import React, { useState, useEffect } from 'react';
import { History, Search, Filter, ShieldCheck, User, Clock, FileCode } from 'lucide-react';
import { apiRequest, formatDate } from '../utils/api';
import Modal from '../components/Modal';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ totalPages: 1, total: 0 });
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '30' });
      if (searchTerm) params.append('search', searchTerm);
      if (actionFilter) params.append('actionType', actionFilter);

      const res = await apiRequest(`/audit?${params.toString()}`);
      setLogs(res.logs || []);
      setPagination(res.pagination || { totalPages: 1, total: 0 });
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-slate-800 text-base">سجل التدقيق والمراقبة (Audit Trail)</h3>
          <p className="text-xs text-slate-500">تتبع غير قابل للتعديل لجميع العمليات المالية وحركات النظام</p>
        </div>

        <div className="flex items-center gap-2 p-1 bg-slate-200/70 rounded-xl text-xs font-bold">
          <button
            onClick={() => { setActionFilter(''); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${!actionFilter ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600'}`}
          >
            الكل
          </button>
          <button
            onClick={() => { setActionFilter('CREATE'); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${actionFilter === 'CREATE' ? 'bg-white shadow-xs text-emerald-700' : 'text-slate-600'}`}
          >
            إنشاء (CREATE)
          </button>
          <button
            onClick={() => { setActionFilter('VOID'); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${actionFilter === 'VOID' ? 'bg-white shadow-xs text-rose-700' : 'text-slate-600'}`}
          >
            إلغاء وعكس (VOID)
          </button>
          <button
            onClick={() => { setActionFilter('LOGIN'); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${actionFilter === 'LOGIN' ? 'bg-white shadow-xs text-[#0BAAFF]' : 'text-slate-600'}`}
          >
            دخول (LOGIN)
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <form onSubmit={handleSearch} className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث باسم المستخدم أو تفاصيل العملية..."
            className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
        </form>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-bold">
                <th className="py-3 px-4">رقم القيد</th>
                <th className="py-3 px-4">التاريخ والوقت</th>
                <th className="py-3 px-4">المستخدم</th>
                <th className="py-3 px-4">نوع العملية</th>
                <th className="py-3 px-4">الجدول / الكيان</th>
                <th className="py-3 px-4">البيان والتفاصيل</th>
                <th className="py-3 px-4 text-center">البيانات الفنية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-slate-400">
                    جاري تحميل سجل التدقيق...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-slate-400">
                    لا توجد سجلات تدقيق
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  let badge = 'bg-slate-100 text-slate-700';
                  if (log.action_type === 'CREATE') badge = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
                  if (log.action_type === 'VOID') badge = 'bg-rose-50 text-rose-700 border border-rose-200';
                  if (log.action_type === 'LOGIN') badge = 'bg-sky-50 text-sky-700 border border-sky-200';
                  if (log.action_type === 'BACKUP') badge = 'bg-purple-50 text-purple-700 border border-purple-200';

                  return (
                    <tr key={log.id} className="hover:bg-sky-50/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-500">#{log.id}</td>
                      <td className="py-3 px-4 font-semibold text-slate-600">{log.created_at}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{log.username}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badge}`}>
                          {log.action_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">{log.entity_name}</td>
                      <td className="py-3 px-4 font-medium text-slate-700 max-w-[280px] truncate" title={log.details}>
                        {log.details || '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {(log.old_values || log.new_values) && (
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-900 transition cursor-pointer"
                            title="عرض التغييرات السابقة والجديدة"
                          >
                            <FileCode className="w-4 h-4" />
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

        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>إجمالي السجلات: {pagination.total}</span>
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

      {/* Log Details Modal */}
      {selectedLog && (
        <Modal
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title={`تفاصيل سجل التدقيق #${selectedLog.id} (${selectedLog.action_type})`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <p><strong>المستخدم:</strong> {selectedLog.username}</p>
              <p><strong>الكيان:</strong> {selectedLog.entity_name} #{selectedLog.entity_id || ''}</p>
              <p><strong>التفاصيل:</strong> {selectedLog.details}</p>
              <p><strong>التاريخ:</strong> {selectedLog.created_at}</p>
            </div>

            {selectedLog.old_values && (
              <div>
                <span className="font-bold text-slate-700 block mb-1">البيانات السابقة (Before):</span>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl overflow-x-auto text-[11px] font-mono">
                  {JSON.stringify(JSON.parse(selectedLog.old_values), null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.new_values && (
              <div>
                <span className="font-bold text-slate-700 block mb-1">البيانات الجديدة (After):</span>
                <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl overflow-x-auto text-[11px] font-mono">
                  {JSON.stringify(JSON.parse(selectedLog.new_values), null, 2)}
                </pre>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-100 font-bold rounded-xl text-slate-700 cursor-pointer"
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
