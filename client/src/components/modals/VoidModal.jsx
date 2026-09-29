import React, { useState } from 'react';
import Modal from '../Modal';
import { apiRequest } from '../../utils/api';
import { AlertTriangle } from 'lucide-react';

export default function VoidModal({ isOpen, onClose, onSuccess, targetTransaction }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!targetTransaction) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason || reason.trim() === '') {
      setError('يرجى ذكر سبب الإلغاء بدقة للتوثيق والتدقيق');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await apiRequest('/transactions/void', {
        method: 'POST',
        body: JSON.stringify({
          type: targetTransaction.type, // 'payment', 'expense', 'owner_transaction'
          id: targetTransaction.id,
          reason: reason.trim()
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
    <Modal isOpen={isOpen} onClose={onClose} title="إلغاء وعكس المعاملة المالية (Void / Reverse)">
      <form onSubmit={handleSubmit} className="space-y-4 text-slate-700">
        {error && (
          <div className="p-3 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-xl">
            {error}
          </div>
        )}

        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 leading-relaxed">
            <p className="font-bold mb-1">تنبيه أمان ومطابقة محاسبية:</p>
            <p>
              لن يتم حذف هذه المعاملة نهائيًا لضمان سلامة التقارير وسجل التدقيق. بل سيتم وسمها كمعاملة ملغاة
              وتوليد قيد عكسي يعيد الأرصدة إلى حالتها السابقة تمامًا.
            </p>
          </div>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
          <p><strong>كود المعاملة:</strong> {targetTransaction.code || `#${targetTransaction.id}`}</p>
          <p><strong>الوصف / البيان:</strong> {targetTransaction.description}</p>
          <p><strong>المبلغ:</strong> {targetTransaction.amount} دج</p>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">سبب الإلغاء (إلزامي للتدقيق) *</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            required
            placeholder="اكتب هنا سبب إلغاء هذه المعاملة بدقة..."
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            تراجع
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'جاري الإلغاء...' : 'تأكيد إلغاء وعكس المعاملة'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
