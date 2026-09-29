import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Students from './pages/Students';
import Teachers from './pages/Teachers';
import Cohorts from './pages/Cohorts';
import OwnerAccount from './pages/OwnerAccount';
import Reports from './pages/Reports';
import AuditLogs from './pages/AuditLogs';
import Settings from './pages/Settings';
import Login from './pages/Login';

// Modals
import AddRevenueModal from './components/modals/AddRevenueModal';
import AddExpenseModal from './components/modals/AddExpenseModal';
import OwnerTransactionModal from './components/modals/OwnerTransactionModal';

function MainApp() {
  const { isAuthenticated, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  // Modals state
  const [isAddRevenueOpen, setIsAddRevenueOpen] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false);
  const [ownerInitialType, setOwnerInitialType] = useState('CONTRIBUTION');

  // Preselected student/cohort for revenue modal
  const [preselectedStudentId, setPreselectedStudentId] = useState(null);
  const [preselectedCohortId, setPreselectedCohortId] = useState(null);

  // Key to force refresh active view on new transaction
  const [refreshKey, setRefreshKey] = useState(0);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="w-10 h-10 border-4 border-[#38B6FF] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  const handleOpenAddRevenue = (studentId = null, cohortId = null) => {
    setPreselectedStudentId(studentId);
    setPreselectedCohortId(cohortId);
    setIsAddRevenueOpen(true);
  };

  const handleTransactionSuccess = () => {
    setRefreshKey(k => k + 1);
  };

  const getPageTitle = () => {
    switch (activeTab) {
      case 'dashboard': return { title: 'لوحة التحكم المالية', subtitle: 'نظرة شاملة ومؤشرات حية للأكاديمية' };
      case 'transactions': return { title: 'المعاملات المالية اليومية', subtitle: 'دفتر القيود المالية للإيرادات والمصروفات' };
      case 'students': return { title: 'الطلاب والتحصيلات', subtitle: 'سجل الاشتراكات والمبالغ المستحقة' };
      case 'teachers': return { title: 'الأساتذة ومستحقات الأجور', subtitle: 'حساب حصص المؤطرين والمدفوعات' };
      case 'cohorts': return { title: 'الدورات والأفواج', subtitle: 'هيكلة الدورات ونظام الأجور المخصص لكل فوج' };
      case 'owner': return { title: 'الحساب الجاري للمالك', subtitle: 'ضخ وسحب السيولة الشخصية مفصولاً عن التشغيل' };
      case 'reports': return { title: 'التقارير المالية المعتمدة', subtitle: 'قائمة الدخل، التدفق النقدي، وهوامش الربحية' };
      case 'audit': return { title: 'سجل التدقيق والمراقبة', subtitle: 'تتبع العمليات والمطابقة المحاسبية' };
      case 'settings': return { title: 'الإعدادات والبيانات المحلية', subtitle: 'تهيئة MariaDB 10.11.7 والنسخ الاحتياطي' };
      default: return { title: 'NG Financial System', subtitle: '' };
    }
  };

  const { title, subtitle } = getPageTitle();

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      {/* Fixed Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title={title}
          subtitle={subtitle}
          onOpenAddRevenue={() => handleOpenAddRevenue()}
          onOpenAddExpense={() => setIsAddExpenseOpen(true)}
          onOpenOwnerModal={() => {
            setOwnerInitialType('CONTRIBUTION');
            setIsOwnerModalOpen(true);
          }}
        />

        <main className="flex-1 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <Dashboard
              key={refreshKey}
              onOpenAddRevenue={() => handleOpenAddRevenue()}
              onOpenAddExpense={() => setIsAddExpenseOpen(true)}
              onOpenOwnerModal={() => {
                setOwnerInitialType('CONTRIBUTION');
                setIsOwnerModalOpen(true);
              }}
            />
          )}

          {activeTab === 'transactions' && (
            <Transactions
              key={refreshKey}
              onOpenAddRevenue={() => handleOpenAddRevenue()}
              onOpenAddExpense={() => setIsAddExpenseOpen(true)}
            />
          )}

          {activeTab === 'students' && (
            <Students
              key={refreshKey}
              onOpenAddPaymentForStudent={(studentId, cohortId) => handleOpenAddRevenue(studentId, cohortId)}
            />
          )}

          {activeTab === 'teachers' && (
            <Teachers key={refreshKey} />
          )}

          {activeTab === 'cohorts' && (
            <Cohorts key={refreshKey} />
          )}

          {activeTab === 'owner' && (
            <OwnerAccount
              key={refreshKey}
              onOpenContribution={() => {
                setOwnerInitialType('CONTRIBUTION');
                setIsOwnerModalOpen(true);
              }}
              onOpenWithdrawal={() => {
                setOwnerInitialType('WITHDRAWAL');
                setIsOwnerModalOpen(true);
              }}
            />
          )}

          {activeTab === 'reports' && (
            <Reports key={refreshKey} />
          )}

          {activeTab === 'audit' && (
            <AuditLogs key={refreshKey} />
          )}

          {activeTab === 'settings' && (
            <Settings key={refreshKey} />
          )}
        </main>
      </div>

      {/* Global Quick Action Modals */}
      <AddRevenueModal
        isOpen={isAddRevenueOpen}
        onClose={() => setIsAddRevenueOpen(false)}
        onSuccess={handleTransactionSuccess}
        preselectedStudentId={preselectedStudentId}
        preselectedCohortId={preselectedCohortId}
      />

      <AddExpenseModal
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        onSuccess={handleTransactionSuccess}
      />

      <OwnerTransactionModal
        isOpen={isOwnerModalOpen}
        onClose={() => setIsOwnerModalOpen(false)}
        onSuccess={handleTransactionSuccess}
        initialType={ownerInitialType}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
