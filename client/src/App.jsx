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
import Settings from './pages/Settings';
import Login from './pages/Login';

// Modals
import AddRevenueModal from './components/modals/AddRevenueModal';
import AddExpenseModal from './components/modals/AddExpenseModal';
import OwnerTransactionModal from './components/modals/OwnerTransactionModal';

function MainApp() {
  const { isAuthenticated, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');

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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-800">
        <div className="w-10 h-10 border-4 border-[#0BAAFF] border-t-transparent rounded-full animate-spin"></div>
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

  return (
    <div className="flex min-h-screen bg-[#F4F9FD]/60 text-slate-800 font-sans">
      {/* Fixed Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
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
              onViewAllTransactions={() => setActiveTab('transactions')}
            />
          )}

          {activeTab === 'transactions' && (
            <Transactions
              key={refreshKey}
              searchTerm={searchTerm}
              onOpenAddRevenue={() => handleOpenAddRevenue()}
              onOpenAddExpense={() => setIsAddExpenseOpen(true)}
            />
          )}

          {activeTab === 'students' && (
            <Students
              key={refreshKey}
              searchTerm={searchTerm}
              onOpenAddPaymentForStudent={(studentId, cohortId) => handleOpenAddRevenue(studentId, cohortId)}
            />
          )}

          {activeTab === 'teachers' && (
            <Teachers key={refreshKey} searchTerm={searchTerm} />
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
