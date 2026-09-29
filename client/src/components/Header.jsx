import React from 'react';
import { PlusCircle, ArrowDownCircle, ArrowUpCircle, Calendar } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Header({
  title,
  subtitle,
  onOpenAddRevenue,
  onOpenAddExpense,
  onOpenOwnerModal
}) {
  const { canManage } = useAuth();
  const todayStr = new Intl.DateTimeFormat('ar-DZ', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(new Date());

  return (
    <header className="bg-white border-b border-slate-200/80 px-8 py-4.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30 shadow-xs">
      <div>
        <h2 className="text-xl font-black text-slate-800 tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 font-medium mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* Date Display */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 bg-slate-100/80 px-3 py-1.5 rounded-lg border border-slate-200/60 font-medium">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{todayStr}</span>
        </div>

        {/* Quick Actions */}
        {canManage && (
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenAddRevenue}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
            >
              <ArrowDownCircle className="w-4 h-4" />
              <span>+ إضافة إيراد</span>
            </button>

            <button
              onClick={onOpenAddExpense}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
            >
              <ArrowUpCircle className="w-4 h-4" />
              <span>+ إضافة مصروف</span>
            </button>

            <button
              onClick={onOpenOwnerModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-300 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-[#38B6FF]" />
              <span>حركة مالك</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
