import React, { useState, useEffect } from 'react';
import {
  Database,
  Save,
  Download,
  Upload,
  RefreshCw,
  AlertTriangle,
  PlusCircle,
  Users,
  CheckCircle2,
  Server,
  ShieldCheck
} from 'lucide-react';
import { apiRequest } from '../utils/api';
import Modal from '../components/Modal';

export default function Settings() {
  const [settings, setSettings] = useState({});
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [dbEngine, setDbEngine] = useState('sqlite');
  const [loading, setLoading] = useState(true);

  // Active settings subtab
  const [settingsTab, setSettingsTab] = useState('general'); // 'general', 'database', 'backup', 'categories', 'users'

  // MariaDB Connection Test
  const [mariaConfig, setMariaConfig] = useState({
    host: 'localhost',
    port: '3306',
    database: 'ng_financial',
    user: 'root',
    password: ''
  });
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  // Modals
  const [isAddCatOpen, setIsAddCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', fullName: '', role: 'viewer' });
  const [isRestoreOpen, setIsRestoreOpen] = useState(false);
  const [restoreFile, setRestoreFile] = useState(null);
  const [restoring, setRestoring] = useState(false);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/settings');
      setSettings(res.settings || {});
      setCategories(res.categories || []);
      setDbEngine(res.currentDbEngine || 'sqlite');

      if (res.settings?.mariadb_host) {
        setMariaConfig({
          host: res.settings.mariadb_host,
          port: res.settings.mariadb_port || '3306',
          database: res.settings.mariadb_database || 'ng_financial',
          user: res.settings.mariadb_user || 'root',
          password: ''
        });
      }

      const usersRes = await apiRequest('/auth/users').catch(() => ({ users: [] }));
      setUsers(usersRes.users || []);
    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSettings = async () => {
    try {
      await apiRequest('/settings', {
        method: 'POST',
        body: JSON.stringify({
          settings: {
            ...settings,
            mariadb_host: mariaConfig.host,
            mariadb_port: mariaConfig.port,
            mariadb_database: mariaConfig.database,
            mariadb_user: mariaConfig.user
          }
        })
      });
      alert('تم حفظ إعدادات النظام بنجاح');
      fetchSettings();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleTestMariaConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiRequest('/settings/test-connection', {
        method: 'POST',
        body: JSON.stringify(mariaConfig)
      });
      setTestResult({ success: true, message: res.message });
    } catch (err) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleBackupDownload = () => {
    window.location.href = '/api/backup/export';
  };

  const handleRestoreSubmit = async (e) => {
    e.preventDefault();
    if (!restoreFile) return;

    setRestoring(true);
    try {
      const text = await restoreFile.text();
      const json = JSON.parse(text);
      await apiRequest('/backup/restore', {
        method: 'POST',
        body: JSON.stringify(json)
      });
      alert('تمت استعادة قاعدة البيانات بنجاح!');
      setIsRestoreOpen(false);
      window.location.reload();
    } catch (err) {
      alert('خطأ أثناء الاستعادة: ' + err.message);
    } finally {
      setRestoring(false);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName) return;
    try {
      await apiRequest('/settings/categories', {
        method: 'POST',
        body: JSON.stringify({ name: newCatName })
      });
      setIsAddCatOpen(false);
      setNewCatName('');
      fetchSettings();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password || !newUser.fullName) return;
    try {
      await apiRequest('/auth/users', {
        method: 'POST',
        body: JSON.stringify(newUser)
      });
      setIsAddUserOpen(false);
      setNewUser({ username: '', password: '', fullName: '', role: 'viewer' });
      fetchSettings();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-slate-800 text-base">إعدادات النظام وقاعدة البيانات</h3>
          <p className="text-xs text-slate-500">تهيئة خادم MariaDB 10.11.7 المحلي، العملة، والنسخ الاحتياطي</p>
        </div>

        <button
          onClick={handleSaveSettings}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0BAAFF] hover:bg-[#0099FF] text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>حفظ التغييرات</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1 bg-slate-200/70 rounded-xl text-xs font-bold w-fit">
        <button
          onClick={() => setSettingsTab('general')}
          className={`px-4 py-2 rounded-lg transition cursor-pointer ${settingsTab === 'general' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600'}`}
        >
          الإعدادات العامة والعملة
        </button>
        <button
          onClick={() => setSettingsTab('database')}
          className={`px-4 py-2 rounded-lg transition cursor-pointer ${settingsTab === 'database' ? 'bg-white shadow-xs text-[#0BAAFF]' : 'text-slate-600'}`}
        >
          خادم MariaDB 10.11.7
        </button>
        <button
          onClick={() => setSettingsTab('backup')}
          className={`px-4 py-2 rounded-lg transition cursor-pointer ${settingsTab === 'backup' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600'}`}
        >
          النسخ الاحتياطي والاستعادة
        </button>
        <button
          onClick={() => setSettingsTab('categories')}
          className={`px-4 py-2 rounded-lg transition cursor-pointer ${settingsTab === 'categories' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600'}`}
        >
          تصنيفات المصروفات
        </button>
        <button
          onClick={() => setSettingsTab('users')}
          className={`px-4 py-2 rounded-lg transition cursor-pointer ${settingsTab === 'users' ? 'bg-white shadow-xs text-purple-700' : 'text-slate-600'}`}
        >
          المستخدمون والصلاحيات
        </button>
      </div>

      {/* TAB 1: General Preferences */}
      {settingsTab === 'general' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 max-w-2xl">
          <h4 className="font-bold text-slate-800 text-sm pb-2 border-b border-slate-100">
            تفضيلات الأكاديمية والعملة
          </h4>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">اسم الأكاديمية الرسمي</label>
              <input
                type="text"
                value={settings.academy_name || 'NG Academy'}
                onChange={(e) => setSettings({ ...settings, academy_name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">رمز العملة الرسمية</label>
              <input
                type="text"
                value={settings.currency_code || 'DZD'}
                onChange={(e) => setSettings({ ...settings, currency_code: e.target.value })}
                placeholder="DZD"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">العملة الافتراضية المعتمدة لجميع القيود والتقارير</p>
            </div>

            <div className="pt-2 flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="font-bold text-slate-800 block text-xs">السماح بالدفع الزائد (Overpayment Policy)</span>
                <span className="text-[11px] text-slate-400">السماح بتسجيل دفعات تتجاوز السعر المتفق عليه للطالب</span>
              </div>
              <input
                type="checkbox"
                checked={settings.allow_overpayment === 'true'}
                onChange={(e) => setSettings({ ...settings, allow_overpayment: e.target.checked ? 'true' : 'false' })}
                className="w-5 h-5 rounded-md accent-[#0BAAFF] cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MariaDB 10.11.7 Local Server */}
      {settingsTab === 'database' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 max-w-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-[#0BAAFF]" />
              <h4 className="font-bold text-slate-800 text-sm">إعدادات خادم MariaDB 10.11.7 المحلي</h4>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              dbEngine === 'mariadb' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {dbEngine === 'mariadb' ? 'متصل بـ MariaDB محلياً' : 'وضع المعاينة المدمج'}
            </span>
          </div>

          <p className="text-xs text-slate-500">
            يعمل النظام أوفلاين بالكامل مع قاعدة بيانات MariaDB المثبتة محليًا على جهاز Windows بدون الحاجة للإنترنت.
          </p>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">اسم المضيف (Host)</label>
              <input
                type="text"
                value={mariaConfig.host}
                onChange={(e) => setMariaConfig({ ...mariaConfig, host: e.target.value })}
                placeholder="localhost"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white focus:border-[#0BAAFF] focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">المنفذ (Port)</label>
              <input
                type="text"
                value={mariaConfig.port}
                onChange={(e) => setMariaConfig({ ...mariaConfig, port: e.target.value })}
                placeholder="3306"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white focus:border-[#0BAAFF] focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">اسم قاعدة البيانات</label>
              <input
                type="text"
                value={mariaConfig.database}
                onChange={(e) => setMariaConfig({ ...mariaConfig, database: e.target.value })}
                placeholder="ng_financial"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white focus:border-[#0BAAFF] focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">اسم المستخدم</label>
              <input
                type="text"
                value={mariaConfig.user}
                onChange={(e) => setMariaConfig({ ...mariaConfig, user: e.target.value })}
                placeholder="root"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white focus:border-[#0BAAFF] focus:outline-hidden"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="block font-bold text-slate-700 mb-1">كلمة المرور (Password)</label>
            <input
              type="password"
              value={mariaConfig.password}
              onChange={(e) => setMariaConfig({ ...mariaConfig, password: e.target.value })}
              placeholder="••••••••"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white focus:border-[#0BAAFF] focus:outline-hidden"
            />
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={handleTestMariaConnection}
              disabled={testing}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              <span>{testing ? 'جاري الفحص...' : 'فحص الاتصال (Test Connection)'}</span>
            </button>
          </div>

          {testResult && (
            <div className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
              testResult.success
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {testResult.success ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{testResult.message}</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{testResult.error}</span>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Backup & Restore */}
      {settingsTab === 'backup' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 max-w-2xl">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Database className="w-5 h-5 text-indigo-600" />
            <h4 className="font-bold text-slate-800 text-sm">النسخ الاحتياطي والاستعادة (Backup & Restore)</h4>
          </div>

          <p className="text-xs text-slate-500">
            احفظ نسخة كاملة من جميع الحسابات والمعاملات والدورات في ملف آمن، أو استرجع نسخة سابقة عند الحاجة.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-between">
              <div>
                <span className="font-bold text-slate-800 text-xs block mb-1">تصدير نسخة احتياطية</span>
                <p className="text-[11px] text-slate-400">ينشئ ملفًا شاملاً يحتوي على كل جداول النظام</p>
              </div>
              <button
                onClick={handleBackupDownload}
                className="mt-4 inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Backup Database</span>
              </button>
            </div>

            <div className="p-4 bg-rose-50/50 rounded-2xl border border-rose-200 flex flex-col justify-between">
              <div>
                <span className="font-bold text-rose-900 text-xs block mb-1">استعادة قاعدة البيانات</span>
                <p className="text-[11px] text-rose-600">استبدال البيانات الحالية بنسخة محفوظة سابقة</p>
              </div>
              <button
                onClick={() => setIsRestoreOpen(true)}
                className="mt-4 inline-flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Restore Database</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Categories */}
      {settingsTab === 'categories' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 max-w-2xl">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h4 className="font-bold text-slate-800 text-sm">تصنيفات المصروفات التشغيلية</h4>
            <button
              onClick={() => setIsAddCatOpen(true)}
              className="px-2.5 py-1 text-xs bg-[#0BAAFF]/10 text-[#0BAAFF] hover:bg-[#0BAAFF]/20 font-bold rounded-lg cursor-pointer"
            >
              + إضافة تصنيف
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map(c => (
              <span
                key={c.id}
                className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200 flex items-center gap-1.5"
              >
                <span>{c.name}</span>
                {c.is_system === 1 && (
                  <span className="text-[9px] bg-slate-200 px-1 py-0.2 rounded text-slate-500 font-normal">نظام</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: Users */}
      {settingsTab === 'users' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 max-w-3xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-purple-600" />
              <h4 className="font-bold text-slate-800 text-sm">المستخدمون والصلاحيات (Admin, Manager, Viewer)</h4>
            </div>
            <button
              onClick={() => setIsAddUserOpen(true)}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition cursor-pointer"
            >
              + إضافة مستخدم جديد
            </button>
          </div>

          <div className="overflow-x-auto text-xs">
            <table className="w-full text-right">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <th className="p-3">اسم المستخدم</th>
                  <th className="p-3">الاسم الكامل</th>
                  <th className="p-3">الدور / الصلاحية</th>
                  <th className="p-3">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(u => (
                  <tr key={u.id}>
                    <td className="p-3 font-mono font-bold text-slate-900">{u.username}</td>
                    <td className="p-3">{u.full_name}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        u.role === 'admin'
                          ? 'bg-purple-100 text-purple-800'
                          : (u.role === 'manager' ? 'bg-sky-100 text-[#0BAAFF]' : 'bg-slate-100 text-slate-700')
                      }`}>
                        {u.role === 'admin' ? 'مدير نظام (Admin)' : (u.role === 'manager' ? 'مدير مالي (Manager)' : 'مشاهد فقط (Viewer)')}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">نشط</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      <Modal isOpen={isAddCatOpen} onClose={() => setIsAddCatOpen(false)} title="إضافة تصنيف مصروفات جديد">
        <form onSubmit={handleAddCategory} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">اسم التصنيف الجديد *</label>
            <input
              type="text"
              required
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="مثال: اشتراكات أدوات الذكاء الاصطناعي"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#0BAAFF]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setIsAddCatOpen(false)} className="px-4 py-2 bg-slate-100 rounded-xl font-bold cursor-pointer">إلغاء</button>
            <button type="submit" className="px-5 py-2 bg-[#0BAAFF] text-white rounded-xl font-bold cursor-pointer">إضافة</button>
          </div>
        </form>
      </Modal>

      {/* Add User Modal */}
      <Modal isOpen={isAddUserOpen} onClose={() => setIsAddUserOpen(false)} title="إضافة مستخدم جديد للنظام">
        <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">اسم الدخول (Username) *</label>
            <input
              type="text"
              required
              value={newUser.username}
              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">الاسم الكامل *</label>
            <input
              type="text"
              required
              value={newUser.fullName}
              onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">كلمة المرور *</label>
            <input
              type="password"
              required
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">الدور والصلاحية *</label>
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
            >
              <option value="admin">مدير نظام كامل (Admin) - كل الصلاحيات</option>
              <option value="manager">مدير مالي (Manager) - إدارة المعاملات والتقارير</option>
              <option value="viewer">مشاهد فقط (Viewer) - استعراض بدون تعديل</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setIsAddUserOpen(false)} className="px-4 py-2 bg-slate-100 rounded-xl font-bold cursor-pointer">إلغاء</button>
            <button type="submit" className="px-5 py-2 bg-purple-600 text-white rounded-xl font-bold cursor-pointer">إنشاء المستخدم</button>
          </div>
        </form>
      </Modal>

      {/* Restore Warning Modal */}
      <Modal isOpen={isRestoreOpen} onClose={() => setIsRestoreOpen(false)} title="استعادة قاعدة البيانات من ملف">
        <form onSubmit={handleRestoreSubmit} className="space-y-4 text-xs">
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-rose-900 leading-relaxed">
              <p className="font-bold mb-1">تحذير أمان عالي الأهمية:</p>
              <p>
                استعادة قاعدة البيانات ستؤدي إلى مسح وتحديث كافة الجداول الحالية واستبدالها بالبيانات الموجودة
                في الملف المرفوع. تأكد من أخذ نسخة احتياطية أولاً قبل المتابعة.
              </p>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">اختر ملف النسخة الاحتياطية (.json) *</label>
            <input
              type="file"
              accept=".json"
              required
              onChange={(e) => setRestoreFile(e.target.files[0])}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setIsRestoreOpen(false)} className="px-4 py-2 bg-slate-100 rounded-xl font-bold cursor-pointer">إلغاء</button>
            <button
              type="submit"
              disabled={restoring || !restoreFile}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition disabled:opacity-50 cursor-pointer"
            >
              {restoring ? 'جاري الاستعادة...' : 'تأكيد الاستعادة واستبدال البيانات'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
