import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Shield, 
  UserCheck, 
  Clock, 
  Search, 
  CheckCircle, 
  AlertCircle, 
  Crown, 
  X,
  Mail,
  Calendar,
  Lock
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { useAuth, MASTER_EMAIL } from '../context/AuthContext';
import { UserProfile, UserRole } from '../types';
import { getRoleBadge, formatDate } from '../utils/formatters';

export const UsersManagementModule: React.FC = () => {
  const { isMaster, currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | UserRole>('all');
  
  // Pending changes per user: { [uid]: selectedRole }
  const [pendingRoles, setPendingRoles] = useState<{ [uid: string]: UserRole }>({});
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!isMaster) return;

    setLoading(true);
    const usersCol = collection(db, 'users');
    const unsubscribe = onSnapshot(usersCol, (snapshot) => {
      const list: UserProfile[] = [];
      snapshot.forEach(docSnap => {
        list.push({ ...docSnap.data() as UserProfile, uid: docSnap.id });
      });
      setUsers(list);
      setLoading(false);
    }, (err) => {
      console.error("Erro ao listar usuários:", err);
      handleFirestoreError(err, OperationType.LIST, 'users');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isMaster]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (filterRole !== 'all' && u.role !== filterRole) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (u.displayName || '').toLowerCase().includes(q);
        const matchesEmail = (u.email || '').toLowerCase().includes(q);
        if (!matchesName && !matchesEmail) return false;
      }
      return true;
    }).sort((a, b) => {
      // Pending first, then Master, then alphabetically
      if (a.role === 'PENDING' && b.role !== 'PENDING') return -1;
      if (b.role === 'PENDING' && a.role !== 'PENDING') return 1;
      if (a.role === 'MASTER' && b.role !== 'MASTER') return -1;
      return (a.displayName || '').localeCompare(b.displayName || '');
    });
  }, [users, filterRole, searchQuery]);

  const pendingApprovalsCount = useMemo(() => {
    return users.filter(u => u.role === 'PENDING').length;
  }, [users]);

  // Handle local role selection
  const handleSelectRole = (uid: string, newRole: UserRole) => {
    setPendingRoles(prev => ({
      ...prev,
      [uid]: newRole
    }));
  };

  // Save / Apply role change to Firestore
  const handleSaveRole = async (user: UserProfile) => {
    const newRole = pendingRoles[user.uid] || user.role;
    if (newRole === user.role) return;

    setSavingUid(user.uid);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        role: newRole,
        updatedAt: new Date().toISOString()
      });

      setPendingRoles(prev => {
        const updated = { ...prev };
        delete updated[user.uid];
        return updated;
      });

      setToastMessage({
        type: 'success',
        text: `Perfil de ${user.displayName || user.email} atualizado para ${newRole} com sucesso!`
      });
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: unknown) {
      console.error("Erro ao atualizar perfil:", err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      setToastMessage({
        type: 'error',
        text: 'Não foi possível atualizar o perfil do usuário.'
      });
    } finally {
      setSavingUid(null);
    }
  };

  if (!isMaster) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <Lock className="w-10 h-10 text-rose-500 mx-auto" />
        <h3 className="text-base font-bold text-slate-900">Acesso Restrito ao Perfil MASTER</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Apenas o administrador MASTER da EBD possui permissão para visualizar e alterar os perfis de usuários.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`p-4 rounded-xl flex items-center justify-between text-sm shadow-xs transition-all ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' 
            : 'bg-rose-50 text-rose-900 border border-rose-200'
        }`}>
          <div className="flex items-center gap-2.5">
            {toastMessage.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600" />
            )}
            <span className="font-medium">{toastMessage.text}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Gestão de Usuários & Perfis</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
              Apenas MASTER
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Defina e aprove permissões para Dirigentes, Secretaria e Tesouraria
          </p>
        </div>

        {pendingApprovalsCount > 0 && (
          <div className="px-3.5 py-2 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 animate-pulse">
            <Clock className="w-4 h-4" />
            <span>{pendingApprovalsCount} usuário{pendingApprovalsCount > 1 ? 's' : ''} aguardando aprovação</span>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as 'all' | UserRole)}
            className="w-full sm:w-auto px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Todos os Perfis ({users.length})</option>
            <option value="PENDING">Apenas Pendentes ({pendingApprovalsCount})</option>
            <option value="MASTER">Apenas MASTER</option>
            <option value="DIRIGENTE">Apenas DIRIGENTE</option>
            <option value="SECRETARIA">Apenas SECRETARIA</option>
            <option value="TESOURARIA">Apenas TESOURARIA</option>
          </select>
        </div>
      </div>

      {/* Users List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs">Carregando usuários cadastrados...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <Users className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold">Nenhum usuário encontrado</p>
          </div>
        ) : (
          filteredUsers.map(user => {
            const isPrimaryMaster = (user.email || '').toLowerCase() === MASTER_EMAIL.toLowerCase();
            const currentSelectedRole = pendingRoles[user.uid] || user.role;
            const hasUnsavedChange = currentSelectedRole !== user.role;
            const badge = getRoleBadge(user.role);
            const isSelf = user.uid === currentUser?.uid;

            return (
              <div 
                key={user.uid} 
                className={`p-4 sm:p-5 hover:bg-slate-50/70 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  user.role === 'PENDING' ? 'bg-amber-50/20' : ''
                }`}
              >
                {/* User details */}
                <div className="flex items-start gap-3.5">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Avatar'}
                      className="w-11 h-11 rounded-full border border-slate-300 object-cover shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-base border border-indigo-200 shrink-0">
                      {user.displayName ? user.displayName[0].toUpperCase() : 'U'}
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{user.displayName || 'Sem nome'}</span>
                      
                      {isPrimaryMaster ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-300">
                          <Crown className="w-3 h-3 text-indigo-600" />
                          <span>MASTER PRINCIPAL</span>
                        </span>
                      ) : (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.bg} ${badge.color} ${badge.border}`}>
                          {badge.label}
                        </span>
                      )}

                      {isSelf && (
                        <span className="text-[10px] font-medium text-slate-400">
                          (Você)
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3 text-slate-400" />
                        <span>{user.email}</span>
                      </span>
                      <span>•</span>
                      <span>Cadastrado em: {formatDate(user.createdAt)}</span>
                    </div>

                    {user.role === 'PENDING' && (
                      <p className="text-xs text-amber-700 font-semibold flex items-center gap-1 mt-0.5">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>Aguardando definição de perfil para acessar o sistema</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Role Selector & Save Action */}
                <div className="flex flex-wrap items-center gap-2.5 pl-14 md:pl-0">
                  {isPrimaryMaster ? (
                    <div className="text-xs font-semibold text-slate-500 italic px-3 py-1.5 bg-slate-100 rounded-lg">
                      Conta permanente do Master
                    </div>
                  ) : (
                    <>
                      <select
                        value={currentSelectedRole}
                        disabled={savingUid === user.uid}
                        onChange={(e) => handleSelectRole(user.uid, e.target.value as UserRole)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                          user.role === 'PENDING' 
                            ? 'bg-amber-50 border-amber-300 text-amber-900' 
                            : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      >
                        <option value="PENDING">PENDENTE (Sem acesso)</option>
                        <option value="DIRIGENTE">DIRIGENTE (Aprovações & Lições)</option>
                        <option value="SECRETARIA">SECRETARIA (Controle de Lições)</option>
                        <option value="TESOURARIA">TESOURARIA (Lançamentos de Caixa)</option>
                        <option value="MASTER">MASTER (Acesso Total)</option>
                      </select>

                      {hasUnsavedChange && (
                        <button
                          disabled={savingUid === user.uid}
                          onClick={() => handleSaveRole(user)}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {savingUid === user.uid ? (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5" />
                          )}
                          <span>Aplicar Perfil</span>
                        </button>
                      )}
                    </>
                  )}
                </div>

              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
