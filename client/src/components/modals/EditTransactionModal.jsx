import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import Modal from '../Modal';
import { apiRequest } from '../../utils/api';

function toInputDate(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Algiers',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

const typeLabels = {
  payment: 'دفعة طالب',
  expense: 'مصروف',
  owner_transaction: 'حركة مالك'
};

export default function EditTransactionModal({ isOpen, onClose, onSuccess, targetTransaction }) {
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [form, setForm] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !targetTransaction) return;

    let active = true;
    setLoadingData(true);
    setError('');
    Promise.all([
      apiRequest(`/transactions/${targetTransaction.ledgerId}`),
      apiRequest('/settings')
    ]).then(([transaction, settings]) => {
      if (!active) return;
      const record = transaction.sourceRecord || {};
      const dateValue = targetTransaction.type === 'payment'
        ? record.payment_date
        : targetTransaction.type === 'expense'
          ? record.expense_date
          : record.transaction_date;
      setPaymentMethods(settings.paymentMethods || []);
      setForm({
        amount: String(record.amount ?? targetTransaction.amount ?? ''),
        transactionDate: toInputDate(dateValue),
        paymentMethodId: String(record.payment_method_id || settings.paymentMethods?.[0]?.id || ''),
        referenceNo: record.reference_no || '',
        notes: record.notes || '',
        description: record.description || '',
        reason: ''
      });
    }).catch((loadError) => {
      if (active) setError(loadError.message || 'تعذر تحميل بيانات المعاملة');
    }).finally(() => {
      if (active) setLoadingData(false);
    });

    return () => { active = false; };
  }, [isOpen, targetTransaction]);

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form || !form.reason.trim()) {
      setError('يرجى كتابة سبب التعديل للتوثيق');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await apiRequest('/transactions/edit', {
        method: 'PUT',
        body: JSON.stringify({
          type: targetTransaction.type,
          id: targetTransaction.id,
          amount: Number(form.amount),
          transactionDate: form.transactionDate,
          paymentMethodId: Number(form.paymentMethodId),
          referenceNo: form.referenceNo,
          notes: form.notes,
          description: form.description,
          reason: form.reason
        })
      });
      onSuccess?.();
      onClose();
    } catch (submitError) {
      setError(submitError.message || 'تعذر تعديل المعاملة');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`تعديل ${typeLabels[targetTransaction?.type] || 'معاملة'}`}>
      {loadingData || !form ? (
        <p className="py-8 text-center text-sm text-slate-500">جاري تحميل بيانات المعاملة...</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-700">
          {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-700">{error}</div>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block font-bold">
              المبلغ (دج) *
              <input
                type="number"
                min="0.01"
                step="any"
                required
                value={form.amount}
                onChange={(event) => updateField('amount', event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold focus:border-sky-400 focus:bg-white focus:outline-none"
              />
            </label>
            <label className="block font-bold">
              التاريخ *
              <input
                type="date"
                required
                value={form.transactionDate}
                onChange={(event) => updateField('transactionDate', event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-sky-400 focus:bg-white focus:outline-none"
              />
            </label>
          </div>

          <label className="block font-bold">
            طريقة الدفع *
            <select
              required
              value={form.paymentMethodId}
              onChange={(event) => updateField('paymentMethodId', event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-sky-400 focus:bg-white focus:outline-none"
            >
              {paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.name_ar}</option>)}
            </select>
          </label>

          {targetTransaction.type === 'expense' && (
            <label className="block font-bold">
              وصف المصروف *
              <input
                required
                value={form.description}
                onChange={(event) => updateField('description', event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-sky-400 focus:bg-white focus:outline-none"
              />
            </label>
          )}

          <label className="block font-bold">
            رقم المرجع
            <input
              value={form.referenceNo}
              onChange={(event) => updateField('referenceNo', event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-sky-400 focus:bg-white focus:outline-none"
            />
          </label>

          <label className="block font-bold">
            ملاحظات
            <textarea
              rows={2}
              value={form.notes}
              onChange={(event) => updateField('notes', event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-sky-400 focus:bg-white focus:outline-none"
            />
          </label>

          <label className="block font-bold">
            سبب التعديل (للتدقيق) *
            <textarea
              rows={2}
              required
              value={form.reason}
              onChange={(event) => updateField('reason', event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-sky-400 focus:bg-white focus:outline-none"
            />
          </label>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 font-bold text-slate-600 hover:bg-slate-100">إلغاء</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 font-bold text-white hover:bg-sky-700 disabled:opacity-50">
              <Save className="h-4 w-4" />
              {saving ? 'جارٍ الحفظ...' : 'حفظ التعديل'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}