import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase/config';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { LoginScreen } from './components/LoginScreen';
import { PendingApprovalView } from './components/PendingApprovalView';
import { Dashboard } from './components/Dashboard';
import { FinancialModule } from './components/FinancialModule';
import { LessonsModule } from './components/LessonsModule';
import { UsersManagementModule } from './components/UsersManagementModule';
import { FinancialTransaction, LessonOrder } from './types';
import { BookOpen, WifiOff } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { currentUser, userProfile, loading: authLoading, isMaster, isApproved } = useAuth();
  
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'financeiro' | 'licoes' | 'usuarios'>('dashboard');
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [lessonOrders, setLessonOrders] = useState<LessonOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Monitor online/offline status for church users with variable connectivity
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Real-time synchronization of transactions and lesson orders
  useEffect(() => {
    if (!currentUser || !isApproved) {
      setTransactions([]);
      setLessonOrders([]);
      setLoadingTransactions(false);
      setLoadingOrders(false);
      return;
    }

    setLoadingTransactions(true);
    setLoadingOrders(true);

    // 1. Transactions listener
    const transQuery = query(collection(db, 'transactions'));
    const unsubscribeTrans = onSnapshot(
      transQuery,
      (snapshot) => {
        const list: FinancialTransaction[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...docSnap.data() as FinancialTransaction, id: docSnap.id });
        });
        setTransactions(list);
        setLoadingTransactions(false);
      },
      (error) => {
        console.error("Erro ao sincronizar transações:", error);
        handleFirestoreError(error, OperationType.LIST, 'transactions');
        setLoadingTransactions(false);
      }
    );

    // 2. Lesson Orders listener
    const ordersQuery = query(collection(db, 'lessonOrders'));
    const unsubscribeOrders = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const list: LessonOrder[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...docSnap.data() as LessonOrder, id: docSnap.id });
        });
        setLessonOrders(list);
        setLoadingOrders(false);
      },
      (error) => {
        console.error("Erro ao sincronizar lições:", error);
        handleFirestoreError(error, OperationType.LIST, 'lessonOrders');
        setLoadingOrders(false);
      }
    );

    return () => {
      unsubscribeTrans();
      unsubscribeOrders();
    };
  }, [currentUser, isApproved]);

  // Auth Loading State
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200 animate-bounce mb-4">
          <BookOpen className="w-6 h-6" />
        </div>
        <p className="text-sm font-bold text-slate-800">Carregando Gestão EBD...</p>
        <p className="text-xs text-slate-500 mt-1">Conectando ao banco de dados</p>
      </div>
    );
  }

  // Not Logged In
  if (!currentUser) {
    return <LoginScreen />;
  }

  // Logged in but not yet approved by Master
  if (!isApproved && userProfile?.role === 'PENDING') {
    return <PendingApprovalView />;
  }

  const pendingCount = transactions.filter(t => t.status === 'pending').length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      
      {/* Offline banner */}
      {isOffline && (
        <div className="bg-amber-600 text-white text-xs py-1.5 px-4 text-center flex items-center justify-center gap-2 font-medium">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Você está no modo offline. As alterações serão salvas localmente e sincronizadas quando a conexão for restabelecida.</span>
        </div>
      )}

      {/* Main Navigation */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        pendingCount={pendingCount}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {currentTab === 'dashboard' && (
          <Dashboard
            transactions={transactions}
            orders={lessonOrders}
            onNavigate={setCurrentTab}
            onOpenNewTransaction={() => setCurrentTab('financeiro')}
          />
        )}

        {currentTab === 'financeiro' && (
          <FinancialModule
            transactions={transactions}
            loading={loadingTransactions}
          />
        )}

        {currentTab === 'licoes' && (
          <LessonsModule
            orders={lessonOrders}
            loading={loadingOrders}
          />
        )}

        {currentTab === 'usuarios' && (
          isMaster ? (
            <UsersManagementModule />
          ) : (
            <Dashboard
              transactions={transactions}
              orders={lessonOrders}
              onNavigate={setCurrentTab}
              onOpenNewTransaction={() => setCurrentTab('financeiro')}
            />
          )
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-400">
          <p>© {new Date().getFullYear()} Gestão EBD — Escola Bíblica Dominical. Sistema integrado de gestão eclesiástica.</p>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}
