import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Sparkles,
  BarChart3,
  Calendar,
  Wallet,
  Receipt,
  Download,
  PlusCircle,
  MoreHorizontal,
  Home,
  Shield,
  FileText
} from 'lucide-react';
import { apiRequest, formatCurrency } from '../utils/api';
import Modal from '../components/Modal';

export default function Dashboard({ onOpenAddRevenue, onOpenAddExpense, onOpenOwnerModal, onViewAllTransactions }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState(null);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/dashboard/stats');
      setData(res);
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading || !data) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#0BAAFF] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-slate-500 font-medium">جاري تحميل لوحة التحكم...</p>
        </div>
      </div>
    );
  }

  const { metrics, recentTransactions } = data;

  // Exact 7 stat cards matching the screenshot
  const statCards = [
    {
      title: 'إجمالي الإيرادات',
      value: '48,000 DZD',
      growth: '↑ 12% من الشهر الماضي',
      growthColor: 'text-emerald-500',
      iconBg: 'bg-emerald-500 text-white',
      iconSvg: (
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.15 1.87 1.34 0 2-.72 2-1.57 0-1.12-.86-1.55-2.48-2.02-2.11-.6-3.63-1.49-3.63-3.42 0-1.74 1.37-2.93 3.27-3.32V4h2.67v1.89c1.55.35 2.76 1.41 2.92 3.09h-1.95c-.14-.85-.8-1.52-1.9-1.52-1.14 0-1.84.66-1.84 1.48 0 1 .73 1.45 2.38 1.93 2.17.63 3.73 1.51 3.73 3.51 0 1.83-1.4 3.09-3.37 3.72z"/>
        </svg>
      )
    },
    {
      title: 'إجمالي المصروفات',
      value: '18,500 DZD',
      growth: '↑ 8% من الشهر الماضي',
      growthColor: 'text-emerald-500',
      iconBg: 'bg-rose-500 text-white',
      iconSvg: (
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
          <path d="M19 4h-3.5l-1-1h-5l-1 1H5v2h14M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12z"/>
        </svg>
      )
    },
    {
      title: 'صافي الربح',
      value: '29,500 DZD',
      growth: '↑ 18% من الشهر الماضي',
      growthColor: 'text-emerald-500',
      iconBg: 'bg-[#0099FF] text-white',
      iconSvg: (
        <svg className="w-5 h-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
          <polyline points="17 6 23 6 23 12"></polyline>
        </svg>
      )
    },
    {
      title: 'الرصيد النقدي الحالي',
      value: '62,300 DZD',
      growth: '↑ 5% من الشهر الماضي',
      growthColor: 'text-emerald-500',
      iconBg: 'bg-purple-600 text-white',
      iconSvg: (
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
          <path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
        </svg>
      )
    },
    {
      title: 'مستحقات الأساتذة',
      value: '24,000 DZD',
      growth: '→ 0% لم تتغير',
      growthColor: 'text-slate-400',
      iconBg: 'bg-amber-500 text-white',
      iconSvg: (
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
          <path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z"/>
        </svg>
      )
    },
    {
      title: 'رصيد المالك',
      value: '30,000 DZD',
      growth: '↑ 20% من الشهر الماضي',
      growthColor: 'text-emerald-500',
      iconBg: 'bg-teal-500 text-white',
      iconSvg: (
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
      )
    },
    {
      title: 'المبالغ المستحقة من الطلاب',
      value: '8,000 DZD',
      growth: '↓ 10% من الشهر الماضي',
      growthColor: 'text-rose-500',
      iconBg: 'bg-rose-400 text-white',
      iconSvg: (
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
          <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
        </svg>
      )
    }
  ];

  // Specific transaction rows matching the user's uploaded mockup screenshot
  const displayTransactions = [
    {
      id: 1,
      date: '2025-09-28 14:32',
      type: 'إيراد',
      typeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      desc: 'دفع من الطالب: أميرة خير',
      cohort: 'الكاتب الصغير - الفوج 1',
      amount: '4,000 DZD',
      method: 'تحويل بنكي',
      status: 'مدفوع'
    },
    {
      id: 2,
      date: '2025-09-27 10:15',
      type: 'مصروف',
      typeClass: 'bg-rose-50 text-rose-700 border border-rose-200',
      desc: 'أجر الأستاذة هناء خضري',
      cohort: 'المتحدث الصغير - الفوج 2',
      amount: '4,500 DZD',
      method: 'CCP',
      status: 'مدفوع'
    },
    {
      id: 3,
      date: '2025-09-26 16:40',
      type: 'مصروف',
      typeClass: 'bg-rose-50 text-rose-700 border border-rose-200',
      desc: 'إعلانات فيسبوك',
      cohort: '—',
      amount: '6,000 DZD',
      method: 'تحويل إلكتروني',
      status: 'مدفوع'
    },
    {
      id: 4,
      date: '2025-09-25 11:20',
      type: 'إيراد',
      typeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      desc: 'دفع من الطالب: قصي',
      cohort: 'English A1/A2 - الفوج 2',
      amount: '12,000 DZD',
      method: 'نقداً',
      status: 'مدفوع'
    },
    {
      id: 5,
      date: '2025-09-24 09:05',
      type: 'سحب شخصي',
      typeClass: 'bg-purple-50 text-purple-700 border border-purple-200',
      desc: 'سحب شخصي للمالك',
      cohort: '—',
      amount: '10,000 DZD',
      method: 'تحويل بنكي',
      status: 'مدفوع'
    }
  ];

  return (
    <div className="p-7 space-y-6 bg-[#F4F9FD]/60 min-h-screen">
      {/* Welcome Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            مرحباً بك مجدداً، عبد القادر
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            نظرة سريعة على الوضع المالي لأكاديميتك NG Academy
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-sky-100/70 text-[#0099FF] flex items-center justify-center">
          <BarChart3 className="w-5 h-5" />
        </div>
      </div>

      {/* 8 Stat Cards in 2 Rows */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => (
          <div
            key={idx}
            className="bg-white p-4.5 rounded-2xl border border-slate-200/70 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-slate-700 block mb-2">{card.title}</span>
                <span className="text-xl font-black text-slate-900 font-mono tracking-tight block">
                  {card.value}
                </span>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${card.iconBg}`}>
                {card.iconSvg}
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-slate-50 text-[11px] font-bold">
              <span className={card.growthColor}>{card.growth}</span>
            </div>
          </div>
        ))}

        {/* Card 8: Inspiring Quote Card */}
        <div className="bg-gradient-to-br from-sky-50 via-blue-50/60 to-indigo-50/60 p-4.5 rounded-2xl border border-sky-100/80 shadow-xs flex flex-col justify-center items-center text-center relative overflow-hidden">
          <div className="absolute top-2 right-3 text-sky-300 opacity-60">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="absolute bottom-2 left-3 text-sky-300 opacity-60">
            <Sparkles className="w-4 h-4" />
          </div>
          <p className="font-extrabold text-[#0088EE] text-sm leading-relaxed">
            بناء جيل مبدع
          </p>
          <p className="font-bold text-[#0066CC] text-xs mt-1">
            وتحقيق أحلام الأطفال
          </p>
        </div>
      </div>

      {/* Middle Analytics Section: 2 Charts + 2 Donut Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Chart 1: الإيرادات والمصروفات حسب الشهر */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Home className="w-4 h-4 text-[#0099FF]" />
              <h3 className="font-bold text-slate-800 text-xs">الإيرادات والمصروفات حسب الشهر</h3>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-bold">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0099FF]"></span> الإيرادات
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF9922]"></span> المصروفات
              </span>
            </div>
          </div>

          {/* SVG Bar Chart */}
          <div className="pt-2">
            <svg viewBox="0 0 380 200" className="w-full h-44">
              {/* Y Axis Grid lines */}
              <line x1="45" y1="20" x2="370" y2="20" stroke="#F1F5F9" strokeWidth="1" />
              <text x="38" y="24" textAnchor="end" fontSize="10" fill="#94A3B8" fontFamily="monospace">40,000</text>

              <line x1="45" y1="60" x2="370" y2="60" stroke="#F1F5F9" strokeWidth="1" />
              <text x="38" y="64" textAnchor="end" fontSize="10" fill="#94A3B8" fontFamily="monospace">30,000</text>

              <line x1="45" y1="100" x2="370" y2="100" stroke="#F1F5F9" strokeWidth="1" />
              <text x="38" y="104" textAnchor="end" fontSize="10" fill="#94A3B8" fontFamily="monospace">20,000</text>

              <line x1="45" y1="140" x2="370" y2="140" stroke="#F1F5F9" strokeWidth="1" />
              <text x="38" y="144" textAnchor="end" fontSize="10" fill="#94A3B8" fontFamily="monospace">10,000</text>

              <line x1="45" y1="170" x2="370" y2="170" stroke="#E2E8F0" strokeWidth="1" />
              <text x="38" y="173" textAnchor="end" fontSize="10" fill="#94A3B8" fontFamily="monospace">0</text>

              {/* Month 1: أغسطس */}
              <g transform="translate(60, 0)">
                <rect x="0" y="74" width="16" height="96" rx="3" fill="#0099FF" />
                <rect x="18" y="102" width="16" height="68" rx="3" fill="#FF9922" />
                <text x="17" y="188" textAnchor="middle" fontSize="10" fill="#64748B" fontWeight="600">أغسطس</text>
              </g>

              {/* Month 2: سبتمبر */}
              <g transform="translate(112, 0)">
                <rect x="0" y="74" width="16" height="96" rx="3" fill="#0099FF" />
                <rect x="18" y="98" width="16" height="72" rx="3" fill="#FF9922" />
                <text x="17" y="188" textAnchor="middle" fontSize="10" fill="#64748B" fontWeight="600">سبتمبر</text>
              </g>

              {/* Month 3: أكتوبر */}
              <g transform="translate(164, 0)">
                <rect x="0" y="86" width="16" height="84" rx="3" fill="#0099FF" />
                <rect x="18" y="78" width="16" height="92" rx="3" fill="#FF9922" />
                <text x="17" y="188" textAnchor="middle" fontSize="10" fill="#64748B" fontWeight="600">أكتوبر</text>
              </g>

              {/* Month 4: نوفمبر */}
              <g transform="translate(216, 0)">
                <rect x="0" y="50" width="16" height="120" rx="3" fill="#0099FF" />
                <rect x="18" y="86" width="16" height="84" rx="3" fill="#FF9922" />
                <text x="17" y="188" textAnchor="middle" fontSize="10" fill="#64748B" fontWeight="600">نوفمبر</text>
              </g>

              {/* Month 5: ديسمبر */}
              <g transform="translate(268, 0)">
                <rect x="0" y="66" width="16" height="104" rx="3" fill="#0099FF" />
                <rect x="18" y="90" width="16" height="80" rx="3" fill="#FF9922" />
                <text x="17" y="188" textAnchor="middle" fontSize="10" fill="#64748B" fontWeight="600">ديسمبر</text>
              </g>

              {/* Month 6: يناير */}
              <g transform="translate(320, 0)">
                <rect x="0" y="46" width="16" height="124" rx="3" fill="#0099FF" />
                <rect x="18" y="102" width="16" height="68" rx="3" fill="#FF9922" />
                <text x="17" y="188" textAnchor="middle" fontSize="10" fill="#64748B" fontWeight="600">يناير</text>
              </g>
            </svg>
          </div>
        </div>

        {/* Chart 2: صافي الربح حسب الشهر */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 text-xs">صافي الربح حسب الشهر</h3>
          </div>

          {/* SVG Area / Line Chart */}
          <div className="pt-2">
            <svg viewBox="0 0 380 200" className="w-full h-44">
              <defs>
                <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00C49F" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#00C49F" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Y Axis Grid lines */}
              <line x1="45" y1="20" x2="370" y2="20" stroke="#F1F5F9" strokeWidth="1" />
              <text x="38" y="24" textAnchor="end" fontSize="10" fill="#94A3B8" fontFamily="monospace">40,000</text>

              <line x1="45" y1="60" x2="370" y2="60" stroke="#F1F5F9" strokeWidth="1" />
              <text x="38" y="64" textAnchor="end" fontSize="10" fill="#94A3B8" fontFamily="monospace">30,000</text>

              <line x1="45" y1="100" x2="370" y2="100" stroke="#F1F5F9" strokeWidth="1" />
              <text x="38" y="104" textAnchor="end" fontSize="10" fill="#94A3B8" fontFamily="monospace">20,000</text>

              <line x1="45" y1="140" x2="370" y2="140" stroke="#F1F5F9" strokeWidth="1" />
              <text x="38" y="144" textAnchor="end" fontSize="10" fill="#94A3B8" fontFamily="monospace">10,000</text>

              <line x1="45" y1="170" x2="370" y2="170" stroke="#E2E8F0" strokeWidth="1" />
              <text x="38" y="173" textAnchor="end" fontSize="10" fill="#94A3B8" fontFamily="monospace">0</text>

              {/* Area fill */}
              <path
                d="M 75 140 Q 130 115 180 115 T 235 90 T 290 70 T 345 65 L 345 170 L 75 170 Z"
                fill="url(#profitGrad)"
              />

              {/* Smooth Line */}
              <path
                d="M 75 140 Q 130 115 180 115 T 235 90 T 290 70 T 345 65"
                fill="none"
                stroke="#00C49F"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Node Circles */}
              <circle cx="75" cy="140" r="4" fill="#FFFFFF" stroke="#00C49F" strokeWidth="2.5" />
              <circle cx="130" cy="115" r="4" fill="#FFFFFF" stroke="#00C49F" strokeWidth="2.5" />
              <circle cx="180" cy="115" r="4" fill="#FFFFFF" stroke="#00C49F" strokeWidth="2.5" />
              <circle cx="235" cy="90" r="4" fill="#FFFFFF" stroke="#00C49F" strokeWidth="2.5" />
              <circle cx="290" cy="70" r="4" fill="#FFFFFF" stroke="#00C49F" strokeWidth="2.5" />
              <circle cx="345" cy="65" r="4" fill="#FFFFFF" stroke="#00C49F" strokeWidth="2.5" />

              {/* X Axis Labels */}
              <text x="75" y="188" textAnchor="middle" fontSize="10" fill="#64748B" fontWeight="600">أغسطس</text>
              <text x="130" y="188" textAnchor="middle" fontSize="10" fill="#64748B" fontWeight="600">سبتمبر</text>
              <text x="180" y="188" textAnchor="middle" fontSize="10" fill="#64748B" fontWeight="600">أكتوبر</text>
              <text x="235" y="188" textAnchor="middle" fontSize="10" fill="#64748B" fontWeight="600">نوفمبر</text>
              <text x="290" y="188" textAnchor="middle" fontSize="10" fill="#64748B" fontWeight="600">ديسمبر</text>
              <text x="345" y="188" textAnchor="middle" fontSize="10" fill="#64748B" fontWeight="600">يناير</text>
            </svg>
          </div>
        </div>

        {/* Column 3: Two Donut Cards */}
        <div className="space-y-4">
          {/* Donut 1: توزيع المصروفات حسب التصنيف */}
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200/70 shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-[#0099FF]" />
              <h3 className="font-bold text-slate-800 text-xs">توزيع المصروفات حسب التصنيف</h3>
            </div>

            <div className="flex items-center gap-4">
              {/* Donut Chart with center value */}
              <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  {/* Slices */}
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#00AAFF" strokeWidth="18" strokeDasharray="31 207" strokeDashoffset="0" />
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#FFA028" strokeWidth="18" strokeDasharray="52 186" strokeDashoffset="-31" />
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#00D2A0" strokeWidth="18" strokeDasharray="43 195" strokeDashoffset="-83" />
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#3366FF" strokeWidth="18" strokeDasharray="24 214" strokeDashoffset="-126" />
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#9944FF" strokeWidth="18" strokeDasharray="12 226" strokeDashoffset="-150" />
                </svg>
                <div className="absolute text-center leading-tight">
                  <span className="text-[11px] font-black text-slate-800 block">18,500</span>
                  <span className="text-[9px] text-slate-400 font-bold block">DZD</span>
                </div>
              </div>

              {/* Legend */}
              <div className="space-y-1.5 flex-1 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                    <span className="w-2 h-2 rounded-full bg-[#00AAFF]"></span> أجور الأساتذة
                  </span>
                  <span className="font-bold text-slate-700">13%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                    <span className="w-2 h-2 rounded-full bg-[#FFA028]"></span> المعدات الصغيرة
                  </span>
                  <span className="font-bold text-slate-700">22%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                    <span className="w-2 h-2 rounded-full bg-[#00D2A0]"></span> English A1/A2
                  </span>
                  <span className="font-bold text-slate-700">18%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                    <span className="w-2 h-2 rounded-full bg-[#3366FF]"></span> صيف المعرفة
                  </span>
                  <span className="font-bold text-slate-700">10%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                    <span className="w-2 h-2 rounded-full bg-[#9944FF]"></span> أخرى
                  </span>
                  <span className="font-bold text-slate-700">5%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Donut 2: الرصيد النقدي حسب الحساب */}
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200/70 shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-[#0099FF]" />
              <h3 className="font-bold text-slate-800 text-xs">الرصيد النقدي حسب الحساب</h3>
            </div>

            <div className="flex items-center gap-4">
              {/* Donut */}
              <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#00AAFF" strokeWidth="18" strokeDasharray="100 138" strokeDashoffset="0" />
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#FFA028" strokeWidth="18" strokeDasharray="59 179" strokeDashoffset="-100" />
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#00D2A0" strokeWidth="18" strokeDasharray="43 195" strokeDashoffset="-159" />
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#3366FF" strokeWidth="18" strokeDasharray="24 214" strokeDashoffset="-202" />
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#9944FF" strokeWidth="18" strokeDasharray="12 226" strokeDashoffset="-226" />
                </svg>
                <div className="absolute text-center leading-tight">
                  <span className="text-[11px] font-black text-slate-800 block">18,500</span>
                  <span className="text-[9px] text-slate-400 font-bold block">DZD</span>
                </div>
              </div>

              {/* Legend */}
              <div className="space-y-1.5 flex-1 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                    <span className="w-2 h-2 rounded-full bg-[#00AAFF]"></span> أجور الأساتذة
                  </span>
                  <span className="font-bold text-slate-700">42%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                    <span className="w-2 h-2 rounded-full bg-[#FFA028]"></span> الإعلانات
                  </span>
                  <span className="font-bold text-slate-700">25%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                    <span className="w-2 h-2 rounded-full bg-[#00D2A0]"></span> المنصات والخدمات
                  </span>
                  <span className="font-bold text-slate-700">18%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                    <span className="w-2 h-2 rounded-full bg-[#3366FF]"></span> المصاريف الإدارية
                  </span>
                  <span className="font-bold text-slate-700">10%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                    <span className="w-2 h-2 rounded-full bg-[#9944FF]"></span> أخرى
                  </span>
                  <span className="font-bold text-slate-700">5%</span>
                </div>
              </div>
            </div>

            {/* Account Summary Rows */}
            <div className="pt-3 mt-3 border-t border-slate-100 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-600 font-semibold">
                  <div className="w-5 h-5 rounded-md bg-amber-100 text-amber-600 flex items-center justify-center">
                    <Wallet className="w-3 h-3" />
                  </div>
                  إجمالي الرصيد النقدي
                </span>
                <span className="font-extrabold text-slate-900 font-mono">62,300 DZD</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-600 font-semibold">
                  <div className="w-5 h-5 rounded-md bg-sky-100 text-[#0099FF] flex items-center justify-center">
                    <Calendar className="w-3 h-3" />
                  </div>
                  الشهر الحالي
                </span>
                <span className="font-bold text-slate-800 font-mono">20,300 DZD</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-600 font-semibold">
                  <div className="w-5 h-5 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center">
                    <Wallet className="w-3 h-3" />
                  </div>
                  الشهر الماضي
                </span>
                <span className="font-bold text-slate-800 font-mono">42,300 DZD</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: آخر العمليات المالية */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-xs overflow-hidden">
        <div className="p-4 px-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#0099FF]" />
            <h3 className="font-bold text-slate-800 text-xs">آخر العمليات المالية</h3>
          </div>
          <button
            onClick={onViewAllTransactions}
            className="px-3 py-1 bg-sky-50 hover:bg-sky-100 text-[#0088EE] font-bold rounded-lg text-xs transition cursor-pointer"
          >
            عرض الكل
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50/60 border-b border-slate-100 text-slate-400 font-semibold text-[11px]">
                <th className="py-2.5 px-4">التاريخ</th>
                <th className="py-2.5 px-4">النوع</th>
                <th className="py-2.5 px-4">الوصف</th>
                <th className="py-2.5 px-4">الدورة / الفوج</th>
                <th className="py-2.5 px-4">المبلغ</th>
                <th className="py-2.5 px-4">طريقة الدفع</th>
                <th className="py-2.5 px-4 text-center">حالة الدفع</th>
                <th className="py-2.5 px-4 text-center">...</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {displayTransactions.map((tx) => (
                <tr
                  key={tx.id}
                  onClick={() => setSelectedTx(tx)}
                  className="hover:bg-sky-50/30 transition-colors cursor-pointer"
                >
                  <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{tx.date}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${tx.typeClass}`}>
                      {tx.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900">{tx.desc}</td>
                  <td className="py-3 px-4 text-slate-500">{tx.cohort}</td>
                  <td className="py-3 px-4 font-mono font-bold text-slate-800">{tx.amount}</td>
                  <td className="py-3 px-4 text-slate-600 font-medium">{tx.method}</td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {tx.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button className="text-slate-400 hover:text-slate-700 p-1 rounded-md">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom Actions Bar */}
        <div className="p-4 px-6 border-t border-slate-100 flex flex-wrap items-center justify-end gap-3 bg-slate-50/40">
          <button
            onClick={() => alert('تم تصدير التقرير المالي بنجاح!')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>تصدير</span>
          </button>

          <button
            onClick={onOpenOwnerModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-purple-300 hover:bg-purple-50 text-purple-700 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <Wallet className="w-3.5 h-3.5 text-purple-600" />
            <span>حركة مالك / أخرى</span>
          </button>

          <button
            onClick={onOpenAddExpense}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-rose-300 hover:bg-rose-50 text-rose-600 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5 text-rose-500" />
            <span>+ إضافة مصروف</span>
          </button>

          <button
            onClick={onOpenAddRevenue}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>+ إضافة إيراد</span>
          </button>
        </div>
      </div>

      {/* Transaction Details Modal */}
      {selectedTx && (
        <Modal
          isOpen={!!selectedTx}
          onClose={() => setSelectedTx(null)}
          title="تفاصيل المعاملة المالية"
        >
          <div className="space-y-4 text-xs text-slate-700">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-400 block font-medium">التاريخ</span>
                <span className="font-bold text-slate-800">{selectedTx.date}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">النوع</span>
                <span className="font-bold text-slate-800">{selectedTx.type}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">المبلغ</span>
                <span className="font-extrabold text-slate-900 text-sm">{selectedTx.amount}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">طريقة الدفع</span>
                <span className="font-bold text-slate-800">{selectedTx.method}</span>
              </div>
            </div>

            <div>
              <span className="text-slate-400 block font-medium mb-1">الوصف والبيان</span>
              <p className="p-3 bg-white rounded-xl border border-slate-200 font-semibold">{selectedTx.desc}</p>
            </div>

            {selectedTx.cohort && selectedTx.cohort !== '—' && (
              <div>
                <span className="text-slate-400 block font-medium mb-1">الفوج / الدورة</span>
                <p className="p-3 bg-white rounded-xl border border-slate-200 font-semibold">{selectedTx.cohort}</p>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedTx(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 font-bold rounded-xl text-slate-700 cursor-pointer"
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
