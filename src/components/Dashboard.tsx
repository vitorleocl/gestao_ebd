import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  ArrowDownRight, 
  ArrowUpRight, 
  BookMarked, 
  Clock, 
  ShieldCheck, 
  PlusCircle, 
  DollarSign, 
  FileText,
  ChevronRight,
  AlertTriangle,
  Wallet
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { FinancialTransaction, LessonOrder } from '../types';
import { formatCurrency, formatDate, getAccountName, getStatusBadge } from '../utils/formatters';

interface DashboardProps {
  transactions: FinancialTransaction[];
  orders: LessonOrder[];
  onNavigate: (tab: 'dashboard' | 'financeiro' | 'licoes' | 'usuarios') => void;
  onOpenNewTransaction: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  transactions,
  orders,
  onNavigate,
  onOpenNewTransaction
}) => {
  const { userProfile, isMaster, isDirigente, isSecretaria, isTesouraria } = useAuth();

  // Financial metrics
  const financialSummary = useMemo(() => {
    let incomeCaixa5 = 0;
    let expenseCaixa5 = 0;
    let incomeLicoes = 0;
    let expenseLicoes = 0;
    let pendingCount = 0;
    let pendingAmount = 0;

    transactions.forEach(t => {
      if (t.status === 'pending') {
        pendingCount++;
        pendingAmount += t.amount;
        return;
      }
      if (t.status !== 'approved') return;

      if (t.account === 'caixa_5') {
        if (t.type === 'income') incomeCaixa5 += t.amount;
        else expenseCaixa5 += t.amount;
      } else if (t.account === 'caixa_licoes') {
        if (t.type === 'income') incomeLicoes += t.amount;
        else expenseLicoes += t.amount;
      }
    });

    const balanceCaixa5 = incomeCaixa5 - expenseCaixa5;
    const balanceLicoes = incomeLicoes - expenseLicoes;

    return {
      balanceCaixa5,
      incomeCaixa5,
      expenseCaixa5,
      balanceLicoes,
      incomeLicoes,
      expenseLicoes,
      totalBalance: balanceCaixa5 + balanceLicoes,
      pendingCount,
      pendingAmount
    };
  }, [transactions]);

  // Lessons summary
  const lessonsSummary = useMemo(() => {
    let totalRequested = 0;
    let totalPaid = 0;
    let totalDelivered = 0;

    orders.forEach(o => {
      totalRequested += o.quantity;
      if (o.paymentStatus === 'pago') totalPaid += o.quantity;
      if (o.deliveryStatus === 'retirado') totalDelivered += o.quantity;
    });

    const pendingPayment = totalRequested - totalPaid;
    const pendingDelivery = totalRequested - totalDelivered;

    return {
      totalRequested,
      totalPaid,
      totalDelivered,
      pendingPayment,
      pendingDelivery
    };
  }, [orders]);

  // Recent transactions (last 5)
  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [transactions]);

  return (
    <div className="space-y-6">
      
      {/* Welcome & Role Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 sm:p-7 shadow-sm relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 uppercase tracking-wider">
                Perfil {userProfile?.role}
              </span>
              <span className="text-xs text-indigo-300">Escola Bíblica Dominical</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
              Paz do Senhor, {userProfile?.displayName || 'Irmão(ã)'}!
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              Acompanhe os caixas, saldos e pedidos de lições da EBD em tempo real.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onNavigate('financeiro')}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl backdrop-blur-md transition-colors border border-white/20 cursor-pointer"
            >
              Ver Extratos
            </button>
            <button
              onClick={() => onNavigate('licoes')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Ver Lições
            </button>
          </div>
        </div>
      </div>

      {/* Pending Validation Alert (for Master & Dirigente) */}
      {(isMaster || isDirigente) && financialSummary.pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500 text-white shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-900">
                Lançamentos aguardando validação ({financialSummary.pendingCount})
              </h3>
              <p className="text-xs text-amber-700 mt-0.5">
                Existem lançamentos feitos pela Tesouraria somando <strong className="font-bold">{formatCurrency(financialSummary.pendingAmount)}</strong> que precisam de aprovação do Dirigente ou Master.
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('financeiro')}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>Validar no Financeiro</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Primary Financial Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Caixa 5% Card */}
        <div 
          onClick={() => onNavigate('financeiro')}
          className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-indigo-300 transition-all cursor-pointer group space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                5%
              </div>
              <span className="font-bold text-slate-800 text-sm">Caixa 5%</span>
            </div>
            <span className="text-xs text-slate-400 group-hover:text-indigo-600 flex items-center gap-0.5">
              <span>Extrato</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>

          <div>
            <div className="text-xs text-slate-500 font-medium">Saldo em Caixa</div>
            <div className={`text-2xl font-black tracking-tight ${
              financialSummary.balanceCaixa5 >= 0 ? 'text-slate-900' : 'text-rose-600'
            }`}>
              {formatCurrency(financialSummary.balanceCaixa5)}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-emerald-700 font-semibold">+{formatCurrency(financialSummary.incomeCaixa5)}</span>
            <span className="text-rose-600 font-semibold">-{formatCurrency(financialSummary.expenseCaixa5)}</span>
          </div>
        </div>

        {/* Caixa de Lições Card */}
        <div 
          onClick={() => onNavigate('financeiro')}
          className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-emerald-300 transition-all cursor-pointer group space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                📖
              </div>
              <span className="font-bold text-slate-800 text-sm">Caixa de Lições</span>
            </div>
            <span className="text-xs text-slate-400 group-hover:text-emerald-600 flex items-center gap-0.5">
              <span>Extrato</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>

          <div>
            <div className="text-xs text-slate-500 font-medium">Saldo em Caixa</div>
            <div className={`text-2xl font-black tracking-tight ${
              financialSummary.balanceLicoes >= 0 ? 'text-slate-900' : 'text-rose-600'
            }`}>
              {formatCurrency(financialSummary.balanceLicoes)}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-emerald-700 font-semibold">+{formatCurrency(financialSummary.incomeLicoes)}</span>
            <span className="text-rose-600 font-semibold">-{formatCurrency(financialSummary.expenseLicoes)}</span>
          </div>
        </div>

        {/* Saldo Total Unificado */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center font-bold text-xs">
                <Wallet className="w-4 h-4" />
              </div>
              <span className="font-bold text-slate-800 text-sm">Total Geral da EBD</span>
            </div>
            <span className="text-[11px] font-semibold text-slate-500">Ambos os Caixas</span>
          </div>

          <div>
            <div className="text-xs text-slate-500 font-medium">Patrimônio Líquido</div>
            <div className="text-2xl font-black tracking-tight text-slate-900">
              {formatCurrency(financialSummary.totalBalance)}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Pendências de aprovação:</span>
            <span className="font-bold text-amber-600">{financialSummary.pendingCount} lançamentos</span>
          </div>
        </div>

      </div>

      {/* Indicadores Rápidos de Lições EBD */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookMarked className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">Indicadores Rápidos de Lições EBD</h3>
          </div>
          <button
            onClick={() => onNavigate('licoes')}
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
          >
            <span>Ver tabela consolidada</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 block uppercase">Total Pedidas</span>
            <span className="text-xl font-extrabold text-slate-800">{lessonsSummary.totalRequested}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Revistas encomendadas</span>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-100">
            <span className="text-[11px] font-bold text-emerald-600 block uppercase">Lições Pagas</span>
            <span className="text-xl font-extrabold text-emerald-700">{lessonsSummary.totalPaid}</span>
            <span className="text-[10px] text-emerald-600 block mt-0.5">
              {lessonsSummary.totalRequested > 0 ? `${Math.round((lessonsSummary.totalPaid / lessonsSummary.totalRequested) * 100)}% quitadas` : '0%'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-100">
            <span className="text-[11px] font-bold text-amber-700 block uppercase">A Pagar</span>
            <span className="text-xl font-extrabold text-amber-800">{lessonsSummary.pendingPayment}</span>
            <span className="text-[10px] text-amber-700 block mt-0.5">Aguardando recebimento</span>
          </div>

          <div className="p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-100">
            <span className="text-[11px] font-bold text-indigo-700 block uppercase">Retiradas</span>
            <span className="text-xl font-extrabold text-indigo-800">{lessonsSummary.totalDelivered}</span>
            <span className="text-[10px] text-indigo-600 block mt-0.5">
              {lessonsSummary.pendingDelivery > 0 ? `${lessonsSummary.pendingDelivery} a retirar` : '100% entregues'}
            </span>
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">Últimos Lançamentos Financeiros</h3>
          </div>
          <button
            onClick={() => onNavigate('financeiro')}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
          >
            <span>Ver extrato completo</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            Nenhum lançamento registrado recentemente.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentTransactions.map(t => {
              const isIncome = t.type === 'income';
              const statusBadge = getStatusBadge(t.status);

              return (
                <div key={t.id} className="p-3.5 hover:bg-slate-50 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                      isIncome ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    }`}>
                      {isIncome ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800 line-clamp-1">{t.description}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2">
                        <span>{formatDate(t.date)}</span>
                        <span>•</span>
                        <span>{getAccountName(t.account)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-right">
                    <span className={`font-bold ${isIncome ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {isIncome ? '+' : '-'}{formatCurrency(t.amount)}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge.bg} ${statusBadge.color} ${statusBadge.border}`}>
                      {statusBadge.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
