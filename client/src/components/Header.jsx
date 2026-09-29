import React from 'react';
import { Search, Calendar, ChevronDown, Minus, Square, X, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Header({ searchTerm, setSearchTerm, onSearchSubmit }) {
  const { user, logout } = useAuth();

  return (
    <div className="bg-white border-b border-slate-200/90 px-6 py-2.5 flex items-center justify-between gap-4 sticky top-0 z-30 select-none">
      {/* Top Left: Logo & Window Title */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-5 h-5 shrink-0">
          <img src="/logo.svg" alt="logo" className="w-full h-full object-contain" />
        </div>
        <span className="text-xs font-bold text-slate-700 tracking-tight">NG Financial System</span>
      </div>

      {/* Center: Universal Search Bar */}
      <div className="flex-1 max-w-xl mx-4">
        <div className="relative">
          <input
            type="text"
            value={searchTerm || ''}
            onChange={(e) => setSearchTerm?.(e.target.value)}
            placeholder="ابحث عن طالب، دورة، أستاذ، أو معاملة ..."
            className="w-full pl-4 pr-10 py-1.5 bg-slate-50/80 border border-slate-200 rounded-full text-xs text-slate-700 placeholder-slate-400 focus:bg-white focus:border-[#0BAAFF] focus:ring-1 focus:ring-[#0BAAFF] focus:outline-hidden transition"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-2" />
        </div>
      </div>

      {/* Right: Date Range, User Profile, Window Buttons */}
      <div className="flex items-center gap-4 shrink-0">
        {/* Date Range Badge */}
        <div className="flex items-center gap-2 text-xs text-slate-600 bg-white border border-slate-200/80 px-3 py-1 rounded-xl shadow-2xs">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block font-medium leading-none">الفترة الحالية</span>
            <span className="font-bold text-[11px] text-slate-700">01/09/2025 - 30/09/2025</span>
          </div>
          <Calendar className="w-4 h-4 text-[#0BAAFF]" />
        </div>

        {/* User Profile */}
        <div className="flex items-center gap-2 pl-2">
          <div className="w-8 h-8 rounded-full bg-[#0BAAFF] text-white flex items-center justify-center font-bold text-xs shadow-xs">
            <User className="w-4 h-4" />
          </div>
          <div className="text-right hidden sm:block">
            <span className="text-xs font-bold text-slate-800 block leading-tight">
              {user?.fullName || 'Abdelkader Ammari'}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">مدير النظام</span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </div>

        {/* Simulated Windows Window Controls */}
        <div className="flex items-center gap-2 text-slate-400 border-r border-slate-200 pr-3 mr-1">
          <button className="hover:text-slate-600 p-1 transition cursor-pointer" title="تصغير">
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button className="hover:text-slate-600 p-1 transition cursor-pointer" title="تكبير">
            <Square className="w-3 h-3" />
          </button>
          <button className="hover:text-rose-600 p-1 transition cursor-pointer" title="إغلاق">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
