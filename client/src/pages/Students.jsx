import React, { useState, useEffect } from 'react';
import {
  Users,
  AlertCircle,
  PlusCircle,
  CreditCard,
  Search,
  Download,
  Eye,
  CheckCircle2,
  Clock,
  UserPlus
} from 'lucide-react';
import { apiRequest, formatCurrency, formatDate, exportToCsv } from '../utils/api';
import Modal from '../components/Modal';

export default function Students({ onOpenAddPaymentForStudent }) {
  const [activeTab, setActiveTab] = useState('all'); // 'all' or 'outstanding'
  const [students, setStudents] = useState([]);
  const [outstanding, setOutstanding] = useState([]);
  const [totalRemaining, setTotalRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [cohorts, setCohorts] = useState([]);

  // New Student Form
  const [newStudent, setNewStudent] = useState({
    fullName: '',
    phone: '',
    guardianPhone: '',
    email: '',
    notes: '',
    cohortId: '',
    agreedPrice: '',
    discountAmount: '0'
  });

  const [selectedStudentHistory, setSelectedStudentHistory] = useState(null);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const [resAll, resOut, resCohorts] = await Promise.all([
        apiRequest('/students'),
        apiRequest('/students/outstanding'),
        apiRequest('/cohorts/cohorts')
      ]);
      setStudents(resAll.students || []);
      setOutstanding(resOut.outstanding || []);
      setTotalRemaining(resOut.totalRemaining || 0);
      setCohorts(resCohorts.cohorts || []);
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    if (!newStudent.fullName) return;

    try {
      await apiRequest('/students', {
        method: 'POST',
        body: JSON.stringify(newStudent)
      });
      setIsAddStudentOpen(false);
      setNewStudent({
        fullName: '',
        phone: '',
        guardianPhone: '',
        email: '',
        notes: '',
        cohortId: '',
        agreedPrice: '',
        discountAmount: '0'
      });
      fetchStudents();
    } catch (err) {
      alert(err.message);
    }
  };

  const openStudentHistory = async (studentId) => {
    try {
      const data = await apiRequest(`/students/${studentId}`);
      setSelectedStudentHistory(data);
    } catch (err) {
      alert(err.message);
    }
  };

  const displayedList = activeTab === 'outstanding' ? outstanding : students;
  const filteredList = displayedList.filter(s => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return s.full_name?.toLowerCase().includes(term) || s.phone?.includes(term);
  });

  const handleExport = () => {
    const headers = ['اسم الطالب', 'الهاتف', 'الدورة / الفوج', 'السعر المتفق عليه', 'المدفوع', 'المتبقي', 'حالة الدفع', 'آخر تاريخ دفع'];
    const rows = filteredList.map(s => [
      s.full_name,
      s.phone || '-',
      s.cohort_name ? `${s.course_name} - ${s.cohort_name}` : '-',
      s.net_price || 0,
      s.paid_amount || 0,
      s.remaining_amount || 0,
      s.payment_status || 'UNPAID',
      s.last_payment_date || '-'
    ]);
    exportToCsv(`students_${activeTab}_${Date.now()}`, headers, rows);
  };

  return (
    <div className="p-8 space-y-6">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 p-1 bg-slate-200/70 rounded-xl">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            جميع الطلاب ({students.length})
          </button>
          <button
            onClick={() => setActiveTab('outstanding')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'outstanding' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            <span>المبالغ المستحقة ({outstanding.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'outstanding' && (
            <div className="text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 px-3.5 py-2 rounded-xl">
              إجمالي المبالغ غير المحصلة: <span className="font-black text-rose-600">{formatCurrency(totalRemaining)}</span>
            </div>
          )}

          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>تصدير Excel (CSV)</span>
          </button>

          <button
            onClick={() => setIsAddStudentOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#38B6FF] hover:bg-[#0BAAFF] text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ تسجيل طالب جديد</span>
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
            placeholder="بحث بالاسم أو رقم الهاتف..."
            className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-bold">
                <th className="py-3 px-4">الطالب</th>
                <th className="py-3 px-4">رقم الهاتف</th>
                <th className="py-3 px-4">الفوج والدورة</th>
                <th className="py-3 px-4">سعر الدورة</th>
                <th className="py-3 px-4">المدفوع</th>
                <th className="py-3 px-4">المتبقي</th>
                <th className="py-3 px-4">حالة الدفع</th>
                <th className="py-3 px-4">آخر دفعة</th>
                <th className="py-3 px-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="9" className="text-center py-12 text-slate-400">
                    جاري تحميل قائمة الطلاب...
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-12 text-slate-400">
                    لا يوجد طلاب يطابقون شروط البحث
                  </td>
                </tr>
              ) : (
                filteredList.map((s, idx) => {
                  const remaining = parseFloat(s.remaining_amount || 0);
                  const paid = parseFloat(s.paid_amount || 0);
                  const net = parseFloat(s.net_price || 0);

                  let statusBadge = (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                      لم يدفع
                    </span>
                  );
                  if (remaining <= 0 && net > 0) {
                    statusBadge = (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                        مدفوع بالكامل
                      </span>
                    );
                  } else if (paid > 0 && remaining > 0) {
                    statusBadge = (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                        دفع جزئي
                      </span>
                    );
                  }

                  return (
                    <tr key={idx} className="hover:bg-sky-50/30 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{s.full_name}</td>
                      <td className="py-3 px-4 text-slate-600 font-mono">{s.phone || '-'}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {s.cohort_name ? `${s.cohort_name} (${s.course_name})` : 'غير مسجل'}
                      </td>
                      <td className="py-3 px-4 font-semibold">{formatCurrency(net)}</td>
                      <td className="py-3 px-4 font-bold text-emerald-600">{formatCurrency(paid)}</td>
                      <td className="py-3 px-4 font-extrabold text-rose-600">{formatCurrency(remaining)}</td>
                      <td className="py-3 px-4">{statusBadge}</td>
                      <td className="py-3 px-4 text-slate-500">{s.last_payment_date || '-'}</td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {remaining > 0 && (
                            <button
                              onClick={() => onOpenAddPaymentForStudent?.(s.student_id, s.cohort_id)}
                              title="تسجيل دفعة لهذا الطالب"
                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg text-[11px] transition cursor-pointer"
                            >
                              + دفع قسط
                            </button>
                          )}
                          <button
                            onClick={() => openStudentHistory(s.student_id)}
                            title="الملف وسجل الدفعات"
                            className="p-1 hover:bg-slate-100 rounded-md text-slate-500 hover:text-slate-800 transition cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
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

      {/* Add Student Modal */}
      <Modal
        isOpen={isAddStudentOpen}
        onClose={() => setIsAddStudentOpen(false)}
        title="تسجيل طالب جديد في الأكاديمية"
      >
        <form onSubmit={handleCreateStudent} className="space-y-4 text-xs text-slate-700">
          <div>
            <label className="block font-bold text-slate-700 mb-1">اسم الطالب الكامل *</label>
            <input
              type="text"
              required
              value={newStudent.fullName}
              onChange={(e) => setNewStudent({ ...newStudent, fullName: e.target.value })}
              placeholder="مثال: محمد بن علي"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">رقم الهاتف</label>
              <input
                type="text"
                value={newStudent.phone}
                onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })}
                placeholder="05 / 06 / 07..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">هاتف الولي (للأطفال/الناشئة)</label>
              <input
                type="text"
                value={newStudent.guardianPhone}
                onChange={(e) => setNewStudent({ ...newStudent, guardianPhone: e.target.value })}
                placeholder="هاتف ولي الأمر..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">تسجيل مباشر في فوج (اختياري)</label>
            <select
              value={newStudent.cohortId}
              onChange={(e) => {
                const cId = e.target.value;
                const found = cohorts.find(c => String(c.id) === String(cId));
                setNewStudent({
                  ...newStudent,
                  cohortId: cId,
                  agreedPrice: found ? found.course_default_price : ''
                });
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
            >
              <option value="">-- اختر الفوج إن أردت تسجيله الآن --</option>
              {cohorts.map(c => (
                <option key={c.id} value={c.id}>{c.name} - {c.course_name} ({formatCurrency(c.course_default_price)})</option>
              ))}
            </select>
          </div>

          {newStudent.cohortId && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <label className="block font-bold text-slate-700 mb-1">السعر المتفق عليه (دج)</label>
                <input
                  type="number"
                  value={newStudent.agreedPrice}
                  onChange={(e) => setNewStudent({ ...newStudent, agreedPrice: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">الخصم / التخفيض (إن وجد)</label>
                <input
                  type="number"
                  value={newStudent.discountAmount}
                  onChange={(e) => setNewStudent({ ...newStudent, discountAmount: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddStudentOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#38B6FF] hover:bg-[#0BAAFF] text-white font-bold rounded-xl shadow-xs cursor-pointer"
            >
              حفظ الطالب
            </button>
          </div>
        </form>
      </Modal>

      {/* Student Profile & History Modal */}
      {selectedStudentHistory && (
        <Modal
          isOpen={!!selectedStudentHistory}
          onClose={() => setSelectedStudentHistory(null)}
          title={`الملف المالي للطالب: ${selectedStudentHistory.student.full_name}`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-5 text-xs text-slate-700">
            {/* Student Info */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 block font-medium">الهاتف</span>
                <span className="font-bold">{selectedStudentHistory.student.phone || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">هاتف الولي</span>
                <span className="font-bold">{selectedStudentHistory.student.guardian_phone || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">البريد الإلكتروني</span>
                <span className="font-bold">{selectedStudentHistory.student.email || '-'}</span>
              </div>
            </div>

            {/* Enrollments */}
            <div>
              <h4 className="font-bold text-slate-800 text-sm mb-2">الدورات والأفواج المسجل فيها</h4>
              <div className="space-y-2">
                {selectedStudentHistory.enrollments.map(enr => (
                  <div key={enr.id} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-800">{enr.cohort_name} ({enr.course_name})</p>
                      <p className="text-[11px] text-slate-400">المؤطر: {enr.teacher_name}</p>
                    </div>
                    <div className="text-left font-mono">
                      <p className="text-xs">المطلوب: <strong>{formatCurrency(enr.net_price)}</strong></p>
                      <p className="text-xs text-emerald-600">المدفوع: <strong>{formatCurrency(enr.paid_amount)}</strong></p>
                      <p className="text-xs text-rose-600">المتبقي: <strong>{formatCurrency(enr.remaining_amount)}</strong></p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Receipts History */}
            <div>
              <h4 className="font-bold text-slate-800 text-sm mb-2">سجل الدفعات المستلمة</h4>
              {selectedStudentHistory.payments.length === 0 ? (
                <p className="text-slate-400 text-center py-4 bg-slate-50 rounded-xl">لا توجد دفعات مسجلة لهذا الطالب</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedStudentHistory.payments.map(p => (
                    <div key={p.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold">{p.payment_code}</span>
                        <span className="text-slate-400 block text-[11px]">{p.payment_date} • {p.method_name}</span>
                      </div>
                      <div className="font-black text-emerald-600 text-sm">
                        {formatCurrency(p.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedStudentHistory(null)}
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
