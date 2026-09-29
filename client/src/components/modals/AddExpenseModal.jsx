import React, { useState, useEffect } from 'react';
import Modal from '../Modal';
import { apiRequest } from '../../utils/api';

export default function AddExpenseModal({ isOpen, onClose, onSuccess }) {
  const [categories, setCategories] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [teachers, setTeachers] = useState([]);

  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState(1);
  const [cohortId, setCohortId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError('');
      apiRequest('/settings').then(res => {
        setCategories(res.categories || []);
        if (res.categories?.length > 0) setCategoryId(res.categories[0].id);
        setPaymentMethods(res.paymentMethods || []);
        if (res.paymentMethods?.length > 0) setPaymentMethodId(res.paymentMethods[0].id);
      });
      apiRequest('/cohorts/cohorts').then(res => setCohorts(res.cohorts || []));
      apiRequest('/teachers').then(res => setTeachers(res.teachers || []));
    }
  }, [isOpen]);

  const selectedCategory = categories.find(c => String(c.id) === String(categoryId));
  const isTeacherWage = selectedCategory?.name?.includes('أجور الأساتذة') || selectedCategory?.name?.includes('أجور');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!categoryId || !amount || parseFloat(amount) <= 0 || !description) {
      setError('يرجى اختيار التصنيف وإدخال المبلغ والوصف');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await apiRequest('/transactions/expense', {
        method: 'POST',
        body: JSON.stringify({
          categoryId: parseInt(categoryId),
          amount: parseFloat(amount),
          expenseDate,
          description,
          paymentMethodId: parseInt(paymentMethodId),
          cohortId: cohortId ? parseInt(cohortId) : null,
          teacherId: teacherId ? parseInt(teacherId) : null,
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
    <Modal isOpen={isOpen} onClose={onClose} title="تسجيل مصروف تشغيلي جديد">
      <form onSubmit={handleSubmit} className="space-y-4 text-slate-700">
        {error && (
          <div className="p-3 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-xl">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">تصنيف المصروف *</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">المبلغ (دج) *</label>
            <input
              type="number"
              step="any"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="مثال: 5000"
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">وصف المصروف *</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="مثال: إعلانات ممولة فيسبوك، فاتورة إنترنت، صيانة..."
            required
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ المصروف *</label>
            <input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">طريقة الدفع *</label>
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {isTeacherWage ? 'الأستاذ المستفيد *' : 'الأستاذ (اختياري)'}
            </label>
            <select
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              required={isTeacherWage}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
            >
              <option value="">-- اختر الأستاذ إن وجد --</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.full_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">الفوج المرتبط (اختياري)</label>
            <select
              value={cohortId}
              onChange={(e) => setCohortId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
            >
              <option value="">-- غير مرتبط بفوج محدد --</option>
              {cohorts.map(c => (
                <option key={c.id} value={c.id}>{c.name} - {c.course_name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات / رقم الفاتورة</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="ملاحظات أو رقم المرجع..."
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
            className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'جاري الحفظ...' : 'تأكيد تسجيل المصروف'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
