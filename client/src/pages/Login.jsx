import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, User, ArrowLeft, ShieldCheck } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message || 'بيانات الدخول غير صحيحة');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (u, p) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="p-8 text-center bg-gradient-to-b from-sky-50/80 to-white border-b border-slate-100">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#0BAAFF] to-[#38B6FF] mx-auto flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-[#38B6FF]/30 mb-3">
            NG
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">NG Financial System</h1>
          <p className="text-xs text-slate-500 font-semibold mt-1">نظام الإدارة المالية لأكاديمية NG Academy</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-5 text-right">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم المستخدم</label>
            <div className="relative">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-[#38B6FF] focus:outline-hidden transition"
              />
              <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">كلمة المرور</label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-[#38B6FF] focus:outline-hidden transition"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-[#38B6FF] to-[#0BAAFF] hover:from-[#0BAAFF] hover:to-[#0288d1] text-white rounded-xl font-bold text-sm shadow-md shadow-[#38B6FF]/25 transition disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'جاري التحقق...' : 'تسجيل الدخول للنظام'}
          </button>

          {/* Quick Demo Credentials */}
          <div className="pt-4 border-t border-slate-100 text-center">
            <span className="text-[11px] text-slate-400 block mb-2 font-medium">حساب المدير الافتراضي للتجربة:</span>
            <button
              type="button"
              onClick={() => handleQuickLogin('admin', 'admin123')}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-mono font-bold transition cursor-pointer"
            >
              admin / admin123
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
