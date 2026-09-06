import { AccountType, TransactionStatus, TransactionType, UserRole } from '../types';

export const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2
  }).format(val || 0);
};

export const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(d);
  } catch {
    return dateStr;
  }
};

export const formatDateTime = (dateStr?: string): string => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  } catch {
    return dateStr;
  }
};

export const getAccountName = (account: AccountType): string => {
  return account === 'caixa_5' ? 'Caixa 5%' : 'Caixa de Lições';
};

export const getRoleBadge = (role: UserRole): { label: string; color: string; bg: string; border: string } => {
  switch (role) {
    case 'MASTER':
      return { label: 'MASTER', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' };
    case 'DIRIGENTE':
      return { label: 'DIRIGENTE', color: 'text-amber-800', bg: 'bg-amber-50', border: 'border-amber-200' };
    case 'SECRETARIA':
      return { label: 'SECRETARIA', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' };
    case 'TESOURARIA':
      return { label: 'TESOURARIA', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' };
    case 'PENDING':
    default:
      return { label: 'PENDENTE', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' };
  }
};

export const getStatusBadge = (status: TransactionStatus): { label: string; color: string; bg: string; border: string } => {
  switch (status) {
    case 'approved':
      return { label: 'Aprovado', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' };
    case 'pending':
      return { label: 'Pendente', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' };
    case 'rejected':
      return { label: 'Rejeitado', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' };
    default:
      return { label: status, color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' };
  }
};
