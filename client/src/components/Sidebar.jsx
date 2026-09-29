import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Receipt,
  Users,
  GraduationCap,
  Layers,
  Wallet,
  FileBarChart,
  History,
  Settings,
  Database,
  LogOut,
  Sparkles,
  ArrowRightLeft
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';

export default function Sidebar({ activeTab, setActiveTab }) {
  const { user, logout } = useAuth();
  const [dbStatus, setDbStatus] = useState({ engine: 'sqlite', version: '1.0.0' });

  useEffect(() => {
    apiRequest('/status')
      .then(data => setDbStatus(data))
      .catch(() => {});
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
    { id: 'transactions', label: 'المعاملات المالية', icon: ArrowRightLeft },
    { id: 'students', label: 'الطلاب والمستحقات', icon: Users },
    { id: 'teachers', label: 'الأساتذة والأجور', icon: GraduationCap },
    { id: 'cohorts', label: 'الدورات والأفواج', icon: Layers },
    { id: 'owner', label: 'حساب المالك', icon: Wallet },
    { id: 'reports', label: 'التقارير المالية', icon: FileBarChart },
    { id: 'audit', label: 'سجل التدقيق', icon: History, adminOnly: true },
    { id: 'settings', label: 'الإعدادات والبيانات', icon: Settings }
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-200 flex flex-col shrink-0 select-none border-l border-slate-800 h-screen sticky top-0 shadow-xl">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0BAAFF] to-[#38B6FF] flex items-center justify-center shadow-lg shadow-[#38B6FF]/20 text-white font-extrabold text-lg">
            NG
          </div>
          <div>
            <h1 className="font-bold text-white text-base tracking-wide flex items-center gap-1.5">
              NG Financial
              <span className="text-[10px] font-semibold bg-[#38B6FF]/20 text-[#38B6FF] px-1.5 py-0.5 rounded-sm">
                Pro
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">نظام الإدارة المالية للأكاديمية</p>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map((item) => {
          if (item.adminOnly && user?.role !== 'admin') return null;
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 cursor-pointer text-right ${
                isActive
                  ? 'bg-gradient-to-r from-[#38B6FF] to-[#0BAAFF] text-white shadow-md shadow-[#38B6FF]/25 font-semibold'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Database Engine Status Banner */}
      <div className="p-3 mx-3 mb-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-slate-400 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-[#38B6FF]" />
            محرك البيانات:
          </span>
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
            dbStatus.engine === 'mariadb'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${dbStatus.engine === 'mariadb' ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
            {dbStatus.engine === 'mariadb' ? 'MariaDB 10.11' : 'معاينة مدمجة'}
          </span>
        </div>
        <div className="text-[11px] text-slate-400 flex items-center justify-between mt-1">
          <span>الحالة: متصل محلياً</span>
          <span className="text-[10px] text-slate-400">Offline Ready</span>
        </div>
      </div>

      {/* User Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/30 flex items-center justify-between">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {user?.fullName?.charAt(0) || 'U'}
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-semibold text-white truncate">{user?.fullName || 'مدير'}</p>
            <p className="text-[11px] text-slate-400 uppercase tracking-wider">{user?.role || 'admin'}</p>
          </div>
        </div>
        <button
          onClick={logout}
          title="تسجيل الخروج"
          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
