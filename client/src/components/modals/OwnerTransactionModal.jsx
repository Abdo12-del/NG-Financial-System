import React, { useState, useEffect } from 'react';
import Modal from '../Modal';
import { apiRequest } from '../../utils/api';
import { ArrowDownLeft, ArrowUpRight, AlertCircle } from 'lucide-react';

export default function OwnerTransactionModal({ isOpen, onClose, onSuccess, initialType = 'CONTRIBUTION' }) {
  const [transactionType, setTransactionType] = useState(initialType);
  const [amount, setAmount] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethodId, setPaymentMethodId] = useState(1);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [notes, setNotes] = useState('');
  const [referenceNo, setReferenceNo] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError('');
      setTransactionType(initialType);
      apiRequest('/settings').then(res => {
        setPaymentMethods(res.paymentMethods || []);
        if (res.paymentMethods?.length > 0) setPaymentMethodId(res.paymentMethods[0].id);
      });
    }
  }, [isOpen, initialType]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      setError('يرجى إدخال مبلغ صالح أكبر من الصفر');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const endpoint = transactionType === 'CONTRIBUTION' ? '/owner/contribution' : '/owner/withdrawal';
      await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          amount: parseFloat(amount),
          transactionDate,
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

  const isContribution = transactionType === 'CONTRIBUTION';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="حركة الحساب الجاري للمالك">
      <form onSubmit={handleSubmit} className="space-y-4 text-slate-700">
        {error && (
          <div className="p-3 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-xl">
            {error}
          </div>
        )}

        {/* Type Toggle */}
        <div className="grid grid-cols-2 gap-3 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setTransactionType('CONTRIBUTION')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              isContribution
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>ضخ سيولة شخصية (Owner → Academy)</span>
          </button>

          <button
            type="button"
            onClick={() => setTransactionType('WITHDRAWAL')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              !isContribution
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>سحب شخصي للمالك (Academy → Owner)</span>
          </button>
        </div>

        {/* Accounting Rule Notice */}
        <div className="flex items-start gap-2.5 p-3 bg-sky-50 border border-sky-100 rounded-xl text-xs text-sky-900">
          <AlertCircle className="w-4 h-4 text-[#38B6FF] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            {isContribution ? (
              <span><strong>قاعدة محاسبية صارمة:</strong> ضخ المالك للأموال يزيد من سيولة الصندوق ويرفع الرصيد المستحق للمالك على الأكاديمية، ولا يُعتبر إيرادًا تشغيليًا بأي شكل.</span>
            ) : (
              <span><strong>قاعدة محاسبية صارمة:</strong> سحب المالك للأموال يخفّض من سيولة الصندوق ويخفّض الرصيد المستحق للمالك، ولا يُعتبر مصروفًا تشغيليًا في قائمة الأرباح والخسائر.</span>
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">المبلغ (دج) *</label>
            <input
              type="number"
              step="any"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="مثال: 50000"
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ المعاملة *</label>
            <input
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">طريقة المعاملة / الحساب *</label>
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
            <label className="block text-xs font-bold text-slate-700 mb-1">رقم المرجع / الإيصال</label>
            <input
              type="text"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder="رقم الوصل البنكي أو المرجع..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-[#38B6FF] focus:outline-hidden"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">البيان / ملاحظات</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={isContribution ? 'مثال: تمويل سيولة لشراء معدات أو تشغيل الأكاديمية' : 'مثال: سحب أرباح شخصي للمالك'}
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
            className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer ${
              isContribution
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {loading ? 'جاري الحفظ...' : (isContribution ? 'تأكيد ضخ السيولة' : 'تأكيد السحب الشخصي')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
