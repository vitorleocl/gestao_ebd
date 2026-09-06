import React, { useState } from 'react';
import { 
  DollarSign, 
  BookMarked, 
  Users, 
  LogOut, 
  Menu, 
  X, 
  ShieldCheck,
  TrendingUp
} from 'lucide-react';
import { BibleFlameIcon } from './BibleFlameIcon';
import { useAuth } from '../context/AuthContext';
import { getRoleBadge } from '../utils/formatters';

interface NavbarProps {
  currentTab: 'dashboard' | 'financeiro' | 'licoes' | 'usuarios';
  setCurrentTab: (tab: 'dashboard' | 'financeiro' | 'licoes' | 'usuarios') => void;
  pendingCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  currentTab, 
  setCurrentTab,
  pendingCount = 0
}) => {
  const { userProfile, currentUser, signOutUser, isMaster } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const role = userProfile?.role || 'PENDING';
  const roleBadge = getRoleBadge(role);

  const navItems = [
    {
      id: 'dashboard' as const,
      label: 'Visão Geral',
      icon: TrendingUp,
      show: true
    },
    {
      id: 'financeiro' as const,
      label: 'Financeiro',
      icon: DollarSign,
      show: true,
      badge: pendingCount > 0 ? pendingCount : null
    },
    {
      id: 'licoes' as const,
      label: 'Lições EBD',
      icon: BookMarked,
      show: true
    },
    {
      id: 'usuarios' as const,
      label: 'Gestão de Usuários',
      icon: Users,
      show: isMaster,
      badge: isMaster && role === 'MASTER' ? null : null
    }
  ];

  const handleTabClick = (tabId: 'dashboard' | 'financeiro' | 'licoes' | 'usuarios') => {
    setCurrentTab(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo / Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 flex items-center justify-center p-1.5 shadow-sm shadow-indigo-200/50 border border-indigo-700/40">
              <BibleFlameIcon className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-slate-900">Gestão EBD</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600 border border-slate-200">
                  Igreja
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">Escola Bíblica Dominical</p>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.filter(item => item.show).map(item => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-tab-${item.id}`}
                  onClick={() => handleTabClick(item.id)}
                  className={`relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  {item.badge ? (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-xs font-bold bg-amber-500 text-white animate-pulse">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          {/* User Profile & Actions */}
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
              {currentUser?.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || 'Avatar'}
                  className="w-9 h-9 rounded-full border border-slate-200 object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm border border-indigo-200">
                  {currentUser?.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
                </div>
              )}
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-slate-800 line-clamp-1 max-w-[130px]">
                    {currentUser?.displayName || currentUser?.email?.split('@')[0]}
                  </span>
                  <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${roleBadge.bg} ${roleBadge.color} ${roleBadge.border}`}>
                    {roleBadge.label}
                  </span>
                </div>
                <span className="text-xs text-slate-500 line-clamp-1 max-w-[160px]">
                  {currentUser?.email}
                </span>
              </div>
            </div>

            <button
              id="btn-signout"
              onClick={signOutUser}
              title="Encerrar Sessão"
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center md:hidden gap-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${roleBadge.bg} ${roleBadge.color} ${roleBadge.border}`}>
              {roleBadge.label}
            </span>
            <button
              id="btn-mobile-menu"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              aria-label="Abrir menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-5 space-y-3 shadow-lg">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
            {currentUser?.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt="Avatar"
                className="w-10 h-10 rounded-full border border-slate-200 object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">
                {currentUser?.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {currentUser?.displayName || 'Usuário'}
              </p>
              <p className="text-xs text-slate-500 truncate">{currentUser?.email}</p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${roleBadge.bg} ${roleBadge.color} ${roleBadge.border}`}>
              {roleBadge.label}
            </span>
          </div>

          <div className="space-y-1">
            {navItems.filter(item => item.show).map(item => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-mobile-${item.id}`}
                  onClick={() => handleTabClick(item.id)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-100">
            <button
              id="btn-mobile-signout"
              onClick={signOutUser}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-rose-600 hover:bg-rose-50 rounded-lg text-sm font-medium transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Sair do Sistema</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
