import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  PlusCircle,
  CreditCard,
  FileText,
  Search,
  Download,
  Phone,
  Layers,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { apiRequest, formatCurrency, formatDate, exportToCsv } from '../utils/api';
import Modal from '../components/Modal';

export default function Teachers() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Add Teacher Modal
  const [isAddTeacherOpen, setIsAddTeacherOpen] = useState(false);
  const [newTeacher, setNewTeacher] = useState({ fullName: '', phone: '', email: '', specialty: '', notes: '' });

  // Payout Modal
  const [payoutTarget, setPayoutTarget] = useState(null);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMethodId, setPayoutMethodId] = useState(1);
  const [payoutNotes, setPayoutNotes] = useState('');
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [payoutLoading, setPayoutLoading] = useState(false);

  // Statement Modal
  const [selectedStatement, setSelectedStatement] = useState(null);

  const fetchTeachers = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/teachers');
      setTeachers(res.teachers || []);
      const setRes = await apiRequest('/settings');
      setPaymentMethods(setRes.paymentMethods || []);
    } catch (err) {
      console.error('Error fetching teachers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const handleCreateTeacher = async (e) => {
    e.preventDefault();
    if (!newTeacher.fullName) return;

    try {
      await apiRequest('/teachers', {
        method: 'POST',
        body: JSON.stringify(newTeacher)
      });
      setIsAddTeacherOpen(false);
      setNewTeacher({ fullName: '', phone: '', email: '', specialty: '', notes: '' });
      fetchTeachers();
    } catch (err) {
      alert(err.message);
    }
  };

  const handlePayoutSubmit = async (e) => {
    e.preventDefault();
    if (!payoutTarget || !payoutAmount || parseFloat(payoutAmount) <= 0) return;

    setPayoutLoading(true);
    try {
      await apiRequest('/teachers/payout', {
        method: 'POST',
        body: JSON.stringify({
          teacherId: payoutTarget.id,
          amount: parseFloat(payoutAmount),
          paymentMethodId: parseInt(payoutMethodId),
          description: payoutNotes || `صرف أجر ومستحقات للأستاذ: ${payoutTarget.full_name}`
        })
      });
      setPayoutTarget(null);
      setPayoutAmount('');
      setPayoutNotes('');
      fetchTeachers();
    } catch (err) {
      alert(err.message);
    } finally {
      setPayoutLoading(false);
    }
  };

  const openTeacherStatement = async (teacherId) => {
    try {
      const data = await apiRequest(`/teachers/${teacherId}/statement`);
      setSelectedStatement(data);
    } catch (err) {
      alert(err.message);
    }
  };

  const filteredTeachers = teachers.filter(t => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return t.full_name?.toLowerCase().includes(term) || t.phone?.includes(term) || t.specialty?.toLowerCase().includes(term);
  });

  const totalTeacherPayables = teachers.reduce((sum, t) => sum + parseFloat(t.remaining_balance || 0), 0);

  return (
    <div className="p-8 space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-slate-800 text-base">إدارة مستحقات وأجور الأساتذة</h3>
          <p className="text-xs text-slate-500">حساب حصص المؤطرين ومتابعة المدفوع والمتبقي</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 px-3.5 py-2 rounded-xl">
            إجمالي المستحقات غير المدفوعة: <span className="font-black text-rose-600">{formatCurrency(totalTeacherPayables)}</span>
          </div>

          <button
            onClick={() => setIsAddTeacherOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#38B6FF] hover:bg-[#0BAAFF] text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ إضافة أستاذ جديد</span>
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث باسم الأستاذ، التخصص، أو الهاتف..."
            className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
        </div>
      </div>

      {/* Teachers Grid / Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-bold">
                <th className="py-3 px-4">الأستاذ</th>
                <th className="py-3 px-4">التخصص</th>
                <th className="py-3 px-4">رقم الهاتف</th>
                <th className="py-3 px-4">الأفواج المؤطرة</th>
                <th className="py-3 px-4">إجمالي المستحقات</th>
                <th className="py-3 px-4">المدفوع له</th>
                <th className="py-3 px-4">الرصيد المتبقي له</th>
                <th className="py-3 px-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-slate-400">
                    جاري تحميل بيانات الأساتذة...
                  </td>
                </tr>
              ) : filteredTeachers.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-slate-400">
                    لا يوجد أساتذة مسجلين بعد
                  </td>
                </tr>
              ) : (
                filteredTeachers.map((t) => {
                  return (
                    <tr key={t.id} className="hover:bg-sky-50/30 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{t.full_name}</td>
                      <td className="py-3 px-4 text-slate-600">{t.specialty || '-'}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{t.phone || '-'}</td>
                      <td className="py-3 px-4 font-semibold text-slate-700">{t.cohort_count || 0} فوج</td>
                      <td className="py-3 px-4 font-bold text-slate-800">{formatCurrency(t.total_accrued)}</td>
                      <td className="py-3 px-4 font-bold text-emerald-600">{formatCurrency(t.total_paid)}</td>
                      <td className="py-3 px-4 font-black text-rose-600 text-sm">
                        {formatCurrency(t.remaining_balance)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setPayoutTarget(t);
                              setPayoutAmount(t.remaining_balance > 0 ? t.remaining_balance : '');
                            }}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-xs transition cursor-pointer"
                          >
                            صرف أجر
                          </button>
                          <button
                            onClick={() => openTeacherStatement(t.id)}
                            title="كشف حساب الأستاذ"
                            className="p-1 hover:bg-slate-100 rounded-md text-slate-500 hover:text-slate-800 transition cursor-pointer"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Teacher Modal */}
      <Modal
        isOpen={isAddTeacherOpen}
        onClose={() => setIsAddTeacherOpen(false)}
        title="إضافة أستاذ / مدرب جديد"
      >
        <form onSubmit={handleCreateTeacher} className="space-y-4 text-xs text-slate-700">
          <div>
            <label className="block font-bold text-slate-700 mb-1">الاسم الكامل للأستاذ *</label>
            <input
              type="text"
              required
              value={newTeacher.fullName}
              onChange={(e) => setNewTeacher({ ...newTeacher, fullName: e.target.value })}
              placeholder="مثال: الأستاذ كمال الدين"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">التخصص / المادة</label>
              <input
                type="text"
                value={newTeacher.specialty}
                onChange={(e) => setNewTeacher({ ...newTeacher, specialty: e.target.value })}
                placeholder="مثال: ذكاء اصطناعي، لغات..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">رقم الهاتف</label>
              <input
                type="text"
                value={newTeacher.phone}
                onChange={(e) => setNewTeacher({ ...newTeacher, phone: e.target.value })}
                placeholder="05 / 06 / 07..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">البريد الإلكتروني</label>
            <input
              type="email"
              value={newTeacher.email}
              onChange={(e) => setNewTeacher({ ...newTeacher, email: e.target.value })}
              placeholder="teacher@example.com"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddTeacherOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#38B6FF] hover:bg-[#0BAAFF] text-white font-bold rounded-xl shadow-xs cursor-pointer"
            >
              حفظ الأستاذ
            </button>
          </div>
        </form>
      </Modal>

      {/* Payout Modal */}
      {payoutTarget && (
        <Modal
          isOpen={!!payoutTarget}
          onClose={() => setPayoutTarget(null)}
          title={`صرف مستحقات / أجر للأستاذ: ${payoutTarget.full_name}`}
        >
          <form onSubmit={handlePayoutSubmit} className="space-y-4 text-xs text-slate-700">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
              <div>
                <span className="text-slate-400 block font-medium">الرصيد المستحق الحالي للأستاذ:</span>
                <span className="text-base font-black text-rose-600">{formatCurrency(payoutTarget.remaining_balance)}</span>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">المبلغ المراد صرفه (دج) *</label>
              <input
                type="number"
                step="any"
                min="1"
                required
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                placeholder="أدخل مبلغ الصرف..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">طريقة الصرف / الحساب المسحوب منه *</label>
              <select
                value={payoutMethodId}
                onChange={(e) => setPayoutMethodId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
              >
                {paymentMethods.map(pm => (
                  <option key={pm.id} value={pm.id}>{pm.name_ar}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">البيان / ملاحظات</label>
              <input
                type="text"
                value={payoutNotes}
                onChange={(e) => setPayoutNotes(e.target.value)}
                placeholder={`أجر تدريب الأستاذ ${payoutTarget.full_name}`}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPayoutTarget(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={payoutLoading}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs cursor-pointer"
              >
                {payoutLoading ? 'جاري الصرف...' : 'تأكيد صرف الأجر'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Teacher Statement Modal */}
      {selectedStatement && (
        <Modal
          isOpen={!!selectedStatement}
          onClose={() => setSelectedStatement(null)}
          title={`كشف حساب الأستاذ: ${selectedStatement.teacher.full_name}`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4 text-xs text-slate-700">
            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 block font-medium">إجمالي الاستحقاقات</span>
                <span className="font-bold text-slate-800">{formatCurrency(selectedStatement.summary.totalAccrued)}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">إجمالي المدفوع</span>
                <span className="font-bold text-emerald-600">{formatCurrency(selectedStatement.summary.totalPaid)}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">الرصيد المتبقي له</span>
                <span className="font-black text-rose-600">{formatCurrency(selectedStatement.summary.balanceDue)}</span>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-slate-800 text-sm mb-2">حركات الاستحقاق والصرف</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {selectedStatement.entries.map(e => (
                  <div key={e.id} className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        e.entry_type === 'ACCRUAL' ? 'bg-sky-100 text-sky-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {e.entry_type === 'ACCRUAL' ? 'استحقاق حصة' : 'صرف أجر'}
                      </span>
                      <p className="font-semibold text-slate-800 mt-1">{e.calculation_basis}</p>
                      <p className="text-[10px] text-slate-400">{e.entry_date} {e.cohort_name ? `• ${e.cohort_name}` : ''}</p>
                    </div>
                    <div className="font-black text-sm">
                      {formatCurrency(e.amount)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedStatement(null)}
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
