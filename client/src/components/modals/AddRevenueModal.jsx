import React, { useState, useEffect } from 'react';
import Modal from '../Modal';
import { apiRequest } from '../../utils/api';

export default function AddRevenueModal({ isOpen, onClose, onSuccess, preselectedStudentId, preselectedCohortId }) {
  const [students, setStudents] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);

  const [studentId, setStudentId] = useState(preselectedStudentId || '');
  const [cohortId, setCohortId] = useState(preselectedCohortId || '');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethodId, setPaymentMethodId] = useState(1);
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError('');
      apiRequest('/students').then(res => setStudents(res.students || []));
      apiRequest('/cohorts/cohorts').then(res => setCohorts(res.cohorts || []));
      apiRequest('/settings').then(res => {
        setPaymentMethods(res.paymentMethods || []);
        if (res.paymentMethods?.length > 0) setPaymentMethodId(res.paymentMethods[0].id);
      });
      if (preselectedStudentId) setStudentId(preselectedStudentId);
      if (preselectedCohortId) setCohortId(preselectedCohortId);
    }
  }, [isOpen, preselectedStudentId, preselectedCohortId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!studentId || !cohortId || !amount || parseFloat(amount) <= 0) {
      setError('يرجى تحديد الطالب والفوج وإدخال مبلغ صالح أكبر من الصفر');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await apiRequest('/transactions/revenue', {
        method: 'POST',
        body: JSON.stringify({
          studentId: parseInt(studentId),
          cohortId: parseInt(cohortId),
          amount: parseFloat(amount),
          paymentDate,
          paymentMethodId: parseInt(paymentMethodId),
          referenceNo,
          notes
        })
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="تسجيل دفعة إيراد جديدة">
      <form onSubmit={handleSubmit} className="space-y-4 text-slate-700">
        {error && (
          <div className="p-3 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-xl">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">الطالب *</label>
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
            >
              <option value="">-- اختر الطالب --</option>
              {students.map(s => (
                <option key={s.student_id} value={s.student_id}>
                  {s.full_name} {s.phone ? `(${s.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">الفوج / الدورة *</label>
            <select
              value={cohortId}
              onChange={(e) => setCohortId(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
            >
              <option value="">-- اختر الفوج --</option>
              {cohorts.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} - {c.course_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">المبلغ المدفوع (دج) *</label>
            <input
              type="number"
              step="any"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="مثال: 4000"
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
            />
            <p className="text-[11px] text-slate-500 mt-1">يدعم الدفع الكامل أو الجزئي</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ الدفع *</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">وسيلة الدفع *</label>
            <select
              value={paymentMethodId}
              onChange={(e) => setPaymentMethodId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
            >
              {paymentMethods.map(pm => (
                <option key={pm.id} value={pm.id}>{pm.name_ar}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">رقم الوصل / المرجع</label>
            <input
              type="text"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder="رقم العملية أو المرجع (اختياري)"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="ملاحظات إضافية حول الدفعة..."
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'جاري الحفظ...' : 'تأكيد تسجيل الدفعة'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
