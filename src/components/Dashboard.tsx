import React, { useMemo, useState } from 'react';
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
  Wallet,
  BarChart3,
  Boxes,
  ShoppingBag
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { FinancialTransaction, LessonOrder, LessonPurchase } from '../types';
import { formatCurrency, formatDate, getAccountName, getStatusBadge } from '../utils/formatters';

interface DashboardProps {
  transactions: FinancialTransaction[];
  orders: LessonOrder[];
  purchases?: LessonPurchase[];
  onNavigate: (tab: 'dashboard' | 'financeiro' | 'licoes' | 'usuarios') => void;
  onOpenNewTransaction: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  transactions,
  orders,
  purchases = [],
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

  // Lessons summary with stock tracking
  const lessonsSummary = useMemo(() => {
    let totalRequested = 0;
    let totalPaid = 0;
    let totalDelivered = 0;

    orders.forEach(o => {
      totalRequested += o.quantity;
      if (o.paymentStatus === 'pago') totalPaid += o.quantity;
      if (o.deliveryStatus === 'retirado') totalDelivered += o.quantity;
    });

    const totalPurchased = purchases.reduce((acc, p) => acc + (p.quantity || 0), 0);
    // Subtrai conforme for sendo retirado dos pedidos (retirado fisicamente)
    const stockRemaining = totalPurchased - totalDelivered;
    const pendingPayment = totalRequested - totalPaid;
    const pendingDelivery = totalRequested - totalDelivered;

    return {
      totalPurchased,
      stockRemaining,
      totalRequested,
      totalPaid,
      totalDelivered,
      pendingPayment,
      pendingDelivery
    };
  }, [orders, purchases]);

  // Recent transactions (last 5)
  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [transactions]);

  // Chart account view filter
  const [chartAccountView, setChartAccountView] = useState<'both' | 'caixa_5' | 'caixa_licoes'>('both');

  // Monthly aggregated data for Recharts Bar Chart
  const monthlyChartData = useMemo(() => {
    const monthsMap = new Map<string, {
      monthKey: string;
      monthLabel: string;
      caixa5Entradas: number;
      caixa5Saidas: number;
      licoesEntradas: number;
      licoesSaidas: number;
      totalEntradas: number;
      totalSaidas: number;
    }>();

    // Default to the last 6 months minimum
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const key = `${y}-${m}`;
      const rawMonth = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
      const monthLabel = `${rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1)}/${String(y).slice(2)}`;
      monthsMap.set(key, {
        monthKey: key,
        monthLabel,
        caixa5Entradas: 0,
        caixa5Saidas: 0,
        licoesEntradas: 0,
        licoesSaidas: 0,
        totalEntradas: 0,
        totalSaidas: 0,
      });
    }

    // Populate with approved transactions
    transactions.forEach(t => {
      if (t.status !== 'approved') return;
      const dateStr = t.date || '';
      if (dateStr.length < 7) return;
      const key = dateStr.slice(0, 7);

      if (!monthsMap.has(key)) {
        const [yStr, mStr] = key.split('-');
        const y = parseInt(yStr, 10);
        const m = parseInt(mStr, 10);
        const d = new Date(y, m - 1, 1);
        const rawMonth = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
        const monthLabel = `${rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1)}/${String(y).slice(2)}`;
        monthsMap.set(key, {
          monthKey: key,
          monthLabel,
          caixa5Entradas: 0,
          caixa5Saidas: 0,
          licoesEntradas: 0,
          licoesSaidas: 0,
          totalEntradas: 0,
          totalSaidas: 0,
        });
      }

      const item = monthsMap.get(key)!;
      if (t.account === 'caixa_5') {
        if (t.type === 'income') {
          item.caixa5Entradas += t.amount;
          item.totalEntradas += t.amount;
        } else {
          item.caixa5Saidas += t.amount;
          item.totalSaidas += t.amount;
        }
      } else if (t.account === 'caixa_licoes') {
        if (t.type === 'income') {
          item.licoesEntradas += t.amount;
          item.totalEntradas += t.amount;
        } else {
          item.licoesSaidas += t.amount;
          item.totalSaidas += t.amount;
        }
      }
    });

    return Array.from(monthsMap.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
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

      {/* Gráfico de Barras Mensal dos Dois Caixas (Recharts) */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Movimentação Mensal: Entradas e Saídas dos Caixas
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Comparativo mês a mês do Caixa 5% e do Caixa de Lições
            </p>
          </div>

          {/* Filter view pills */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setChartAccountView('both')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                chartAccountView === 'both'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ambos os Caixas
            </button>
            <button
              onClick={() => setChartAccountView('caixa_5')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                chartAccountView === 'caixa_5'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Caixa 5%
            </button>
            <button
              onClick={() => setChartAccountView('caixa_licoes')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                chartAccountView === 'caixa_licoes'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Caixa de Lições
            </button>
          </div>
        </div>

        {/* Chart View Container */}
        <div className="w-full h-72 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={monthlyChartData}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              barGap={4}
              barCategoryGap="25%"
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="monthLabel" 
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
              />
              <YAxis 
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => `R$${val}`}
              />
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  return (
                    <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs border border-slate-700 min-w-[200px] space-y-2">
                      <div className="font-bold border-b border-slate-700 pb-1 text-indigo-200">
                        {label}
                      </div>
                      <div className="space-y-1">
                        {payload.map((entry, index) => (
                          <div key={`item-${index}`} className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-1.5 text-slate-300">
                              <span 
                                className="w-2.5 h-2.5 rounded-full inline-block" 
                                style={{ backgroundColor: entry.color }} 
                              />
                              <span>{entry.name}:</span>
                            </span>
                            <span className="font-bold text-white">
                              {formatCurrency(Number(entry.value) || 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }} 
              />
              <Legend 
                wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                iconType="circle"
                iconSize={8}
              />

              {chartAccountView === 'both' && (
                <>
                  <Bar dataKey="caixa5Entradas" name="5%: Entradas" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="caixa5Saidas" name="5%: Saídas" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="licoesEntradas" name="Lições: Entradas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="licoesSaidas" name="Lições: Saídas" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </>
              )}

              {chartAccountView === 'caixa_5' && (
                <>
                  <Bar dataKey="caixa5Entradas" name="Entradas (Caixa 5%)" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="caixa5Saidas" name="Saídas (Caixa 5%)" fill="#e11d48" radius={[4, 4, 0, 0]} maxBarSize={36} />
                </>
              )}

              {chartAccountView === 'caixa_licoes' && (
                <>
                  <Bar dataKey="licoesEntradas" name="Entradas (Caixa de Lições)" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="licoesSaidas" name="Saídas (Caixa de Lições)" fill="#d97706" radius={[4, 4, 0, 0]} maxBarSize={36} />
                </>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookMarked className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">Estoque e Indicadores de Lições EBD</h3>
          </div>
          <button
            onClick={() => onNavigate('licoes')}
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
          >
            <span>Gerenciar Lições EBD</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* 1. Compradas Antecipadamente pela Direção */}
          <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-indigo-700 block uppercase tracking-wider">Lições Compradas</span>
              <ShoppingBag className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <div className="text-xl font-black text-indigo-950 tracking-tight">
              {lessonsSummary.totalPurchased} <span className="text-xs font-semibold text-indigo-600">un</span>
            </div>
            <span className="text-[10px] text-indigo-700 block font-medium">
              Compradas pela Direção
            </span>
          </div>

          {/* 2. Saldo Disponível em Estoque (Subtraído conforme retiradas) */}
          <div className={`p-3.5 rounded-xl border space-y-1 ${
            lessonsSummary.stockRemaining < 0 
              ? 'bg-rose-50 border-rose-200 text-rose-900' 
              : lessonsSummary.stockRemaining === 0 && lessonsSummary.totalPurchased === 0
                ? 'bg-slate-50 border-slate-200 text-slate-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-950'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold block uppercase tracking-wider">Saldo em Estoque</span>
              <Boxes className="w-3.5 h-3.5 opacity-80" />
            </div>
            <div className="text-xl font-black tracking-tight">
              {lessonsSummary.stockRemaining} <span className="text-xs font-semibold opacity-75">un</span>
            </div>
            <span className="text-[10px] block font-medium opacity-85">
              {lessonsSummary.totalPurchased === 0 
                ? 'Sem compras cadastradas' 
                : `${lessonsSummary.totalDelivered} un já retiradas`}
            </span>
          </div>

          {/* 3. Retiradas Fisicamente */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Retiradas</span>
            <div className="text-xl font-black text-slate-800 tracking-tight">
              {lessonsSummary.totalDelivered} <span className="text-xs font-semibold text-slate-400">un</span>
            </div>
            <span className="text-[10px] text-slate-500 block font-medium">
              Subtraídas do estoque
            </span>
          </div>

          {/* 4. Total Pedidas */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Total Pedidas</span>
            <div className="text-xl font-black text-slate-800 tracking-tight">
              {lessonsSummary.totalRequested} <span className="text-xs font-semibold text-slate-400">un</span>
            </div>
            <span className="text-[10px] text-slate-500 block font-medium">
              Demandadas pelas classes
            </span>
          </div>

          {/* 5. Lições Pagas */}
          <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-1">
            <span className="text-[10px] font-bold text-emerald-700 block uppercase tracking-wider">Lições Pagas</span>
            <div className="text-xl font-black text-emerald-800 tracking-tight">
              {lessonsSummary.totalPaid} <span className="text-xs font-semibold text-emerald-600">un</span>
            </div>
            <span className="text-[10px] text-emerald-700 block font-medium">
              {lessonsSummary.totalRequested > 0 ? `${Math.round((lessonsSummary.totalPaid / lessonsSummary.totalRequested) * 100)}% quitadas` : '0%'}
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
