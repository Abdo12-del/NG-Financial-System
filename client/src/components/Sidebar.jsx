import React, { useState, useEffect } from 'react';
import {
  Home,
  Receipt,
  Users,
  UserCheck,
  Layers,
  Wallet,
  FileBarChart,
  Megaphone,
  Target,
  Settings,
  ClipboardList,
} from 'lucide-react';
import { apiRequest } from '../utils/api';

export default function Sidebar({ activeTab, setActiveTab }) {
  const [dbStatus, setDbStatus] = useState({ status: 'checking', engine: 'mariadb', version: '10.11.7' });

  useEffect(() => {
    apiRequest('/status')
      .then(data => setDbStatus(data))
      .catch(() => {});
  }, []);

  const navSections = [
    {
      label: 'المحاسبة',
      items: [
        { id: 'dashboard', label: 'لوحة التحكم', icon: Home },
        { id: 'transactions', label: 'المعاملات اليومية', icon: Receipt },
        { id: 'students', label: 'الطلاب', icon: Users },
        { id: 'teachers', label: 'الأساتذة', icon: UserCheck },
        { id: 'cohorts', label: 'الدورات والأفواج', icon: Layers },
        { id: 'owner', label: 'حساب المالك', icon: Wallet },
        { id: 'reports', label: 'التقارير المالية', icon: FileBarChart },
        { id: 'settings', label: 'الإعدادات', icon: Settings }
      ]
    },
    {
      label: 'التسويق',
      items: [
        { id: 'registration-followups', label: 'متابعة التسجيلات', icon: ClipboardList },
        { id: 'marketing-dashboard', label: 'لوحة تحكم التسويق', icon: Megaphone },
        { id: 'marketing-campaigns', label: 'الحملات الإعلانية', icon: Target }
      ]
    }
  ];

  return (
    <aside className="w-60 bg-white text-slate-700 flex flex-col shrink-0 select-none border-l border-slate-200/90 h-screen sticky top-0 shadow-xs z-20">
      {/* Brand Header */}
      <div className="p-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 shrink-0">
            <img src="/logo.svg" alt="NG Financial" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="font-extrabold text-[#0BAAFF] text-lg leading-tight tracking-tight">
              NG Academy
            </h1>
            <p className="text-[11px] text-slate-400 font-semibold">Financial System</p>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-3.5 py-3 space-y-1.5">
        {navSections.map(section => (
          <div key={section.label} className="space-y-1.5">
            <h2 className="px-4 pb-1 pt-3 text-[10px] font-black tracking-wide text-slate-400">{section.label}</h2>
            {section.items.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id || (activeTab === 'marketing-detail' && item.id === 'marketing-campaigns');
              const isMarketing = item.id.startsWith('marketing-');
              const isActiveMarketing = isActive && (isMarketing || item.id === 'registration-followups');

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-bold text-xs transition-all duration-150 cursor-pointer text-right ${
                    isActive
                      ? isActiveMarketing
                        ? 'bg-gradient-to-r from-violet-500 to-violet-700 text-white shadow-md shadow-violet-500/25'
                        : 'bg-gradient-to-r from-[#17BBFF] to-[#0BAAFF] text-white shadow-md shadow-[#0BAAFF]/30'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-100 space-y-2">
        <div className="flex items-center gap-2 text-[11px] text-slate-600 font-medium">
          <span className={`w-2 h-2 rounded-full ${dbStatus.status === 'online' ? 'bg-emerald-500 shadow-xs shadow-emerald-400' : 'bg-amber-400'} animate-pulse`}></span>
          <span>{dbStatus.status === 'online' ? 'قاعدة البيانات متصلة' : 'جارٍ التحقق من الاتصال...'}</span>
        </div>
        <p className="text-[10px] text-slate-400 font-mono pr-4">{String(dbStatus.engine || 'mariadb').toUpperCase()} {dbStatus.version || ''}</p>
        <p className="text-[10px] text-slate-400 font-mono pt-1">NG Financial System v1.0.0</p>
      </div>
    </aside>
  );
}
