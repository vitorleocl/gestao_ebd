import React, { useState, useMemo } from 'react';
import { 
  X, 
  Boxes, 
  ShoppingBag, 
  Layers, 
  Filter, 
  CheckCircle2, 
  PackageCheck, 
  BookOpen, 
  Users, 
  Calendar,
  AlertTriangle,
  GraduationCap,
  Info
} from 'lucide-react';
import { 
  LessonPurchase, 
  LessonOrder, 
  EbdClass, 
  AGE_GROUPS, 
  LESSON_QUARTERS, 
  LESSON_PURCHASE_YEARS 
} from '../types';

interface LessonInventoryBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchases: LessonPurchase[];
  orders: LessonOrder[];
  classes: EbdClass[];
}

export const LessonInventoryBreakdownModal: React.FC<LessonInventoryBreakdownModalProps> = ({
  isOpen,
  onClose,
  purchases,
  orders,
  classes
}) => {
  const [filterQuarter, setFilterQuarter] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');

  // Map class name to age group for associating orders to age groups
  const classAgeGroupMap = useMemo(() => {
    const map = new Map<string, string>();
    classes.forEach(c => {
      if (c.ageGroup) {
        map.set(c.name, c.ageGroup);
      }
    });
    return map;
  }, [classes]);

  // Filter purchases according to quarter / year
  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      if (filterQuarter !== 'all' && p.quarter !== filterQuarter) return false;
      if (filterYear !== 'all' && (p.year?.toString() !== filterYear)) return false;
      return true;
    });
  }, [purchases, filterQuarter, filterYear]);

  // Filter orders (if quarter/year applied or overall)
  const filteredOrders = useMemo(() => {
    return orders;
  }, [orders]);

  // Summary by Lesson Type (Aluno vs Professor)
  const typeSummary = useMemo(() => {
    let purchasedAluno = 0;
    let purchasedProfessor = 0;

    filteredPurchases.forEach(p => {
      const q = p.quantity || 0;
      if (p.lessonType === 'Professor') {
        purchasedProfessor += q;
      } else {
        purchasedAluno += q; // Default is Aluno
      }
    });

    let deliveredAluno = 0;
    let deliveredProfessor = 0;

    filteredOrders.forEach(o => {
      if (o.deliveryStatus === 'retirado') {
        const q = o.quantity || 0;
        if (o.lessonType === 'Professor') {
          deliveredProfessor += q;
        } else {
          deliveredAluno += q;
        }
      }
    });

    const totalPurchased = purchasedAluno + purchasedProfessor;
    const totalDelivered = deliveredAluno + deliveredProfessor;
    const stockAluno = purchasedAluno - deliveredAluno;
    const stockProfessor = purchasedProfessor - deliveredProfessor;
    const totalStock = totalPurchased - totalDelivered;

    return {
      purchasedAluno,
      purchasedProfessor,
      deliveredAluno,
      deliveredProfessor,
      stockAluno,
      stockProfessor,
      totalPurchased,
      totalDelivered,
      totalStock
    };
  }, [filteredPurchases, filteredOrders]);

  // Summary by Age Group
  const ageGroupBreakdown = useMemo(() => {
    // Collect all age groups
    const groups = [...AGE_GROUPS];

    return groups.map(group => {
      // Purchases for this age group
      const groupPurchases = filteredPurchases.filter(p => p.ageGroup === group);
      const alunoPurchased = groupPurchases
        .filter(p => (p.lessonType || 'Aluno') === 'Aluno')
        .reduce((sum, p) => sum + (p.quantity || 0), 0);
      const professorPurchased = groupPurchases
        .filter(p => p.lessonType === 'Professor')
        .reduce((sum, p) => sum + (p.quantity || 0), 0);
      const totalPurchased = alunoPurchased + professorPurchased;

      // Orders for classes that match this age group
      const matchingClasses = classes.filter(c => c.ageGroup === group);
      const matchingClassNames = new Set(matchingClasses.map(c => c.name));

      const groupOrders = filteredOrders.filter(o => 
        matchingClassNames.has(o.className) || (o.classId && matchingClasses.some(c => c.id === o.classId))
      );

      const totalRequested = groupOrders.reduce((sum, o) => sum + (o.quantity || 0), 0);
      const totalDelivered = groupOrders
        .filter(o => o.deliveryStatus === 'retirado')
        .reduce((sum, o) => sum + (o.quantity || 0), 0);
      const totalPendingDelivery = totalRequested - totalDelivered;

      const remainingStock = totalPurchased - totalDelivered;

      return {
        ageGroup: group,
        alunoPurchased,
        professorPurchased,
        totalPurchased,
        totalRequested,
        totalDelivered,
        totalPendingDelivery,
        remainingStock
      };
    });
  }, [filteredPurchases, filteredOrders, classes]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-auto">
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-white">
                Resumo de Compras & Estoque da EBD
              </h3>
              <p className="text-xs text-indigo-200">
                Detalhamento analítico por <strong>Tipo de Lição (Aluno / Professor)</strong> e por <strong>Faixa Etária</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-indigo-300 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1 bg-slate-50/50">
          
          {/* Quick Filters */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Filter className="w-3.5 h-3.5 text-indigo-600" />
              <span>Filtrar Compras por Lote:</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Trimestre */}
              <select
                value={filterQuarter}
                onChange={(e) => setFilterQuarter(e.target.value)}
                className="px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">Todos os Trimestres</option>
                {LESSON_QUARTERS.map(q => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>

              {/* Ano */}
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">Todos os Anos</option>
                {LESSON_PURCHASE_YEARS.map(y => (
                  <option key={y} value={y.toString()}>{y}</option>
                ))}
              </select>

              {(filterQuarter !== 'all' || filterYear !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterQuarter('all');
                    setFilterYear('all');
                  }}
                  className="px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          </div>

          {/* ========================================================
              1. CARDS DE RESUMO POR TIPO DE LIÇÃO (ALUNO X PROFESSOR)
          ======================================================== */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <GraduationCap className="w-4 h-4 text-indigo-600" />
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                1. Resumo Consolidado por Tipo de Revista
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Aluno */}
              <div className="bg-white rounded-2xl p-4 border border-indigo-100 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider">
                      Revista do Aluno
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Aluno
                    </span>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-slate-500">Total Comprado:</span>
                      <span className="text-base font-black text-slate-900">{typeSummary.purchasedAluno} un</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-slate-500">Já Retirado:</span>
                      <span className="text-xs font-bold text-blue-700">{typeSummary.deliveredAluno} un</span>
                    </div>
                  </div>
                </div>
                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Saldo em Estoque:</span>
                  <span className={`text-sm font-black ${
                    typeSummary.stockAluno < 0 ? 'text-rose-600' : 'text-emerald-700'
                  }`}>
                    {typeSummary.stockAluno} un
                  </span>
                </div>
              </div>

              {/* Professor */}
              <div className="bg-white rounded-2xl p-4 border border-purple-100 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wider">
                      Revista do Professor
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-50 text-purple-700 border border-purple-200">
                      Professor
                    </span>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-slate-500">Total Comprado:</span>
                      <span className="text-base font-black text-slate-900">{typeSummary.purchasedProfessor} un</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-slate-500">Já Retirado:</span>
                      <span className="text-xs font-bold text-blue-700">{typeSummary.deliveredProfessor} un</span>
                    </div>
                  </div>
                </div>
                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Saldo em Estoque:</span>
                  <span className={`text-sm font-black ${
                    typeSummary.stockProfessor < 0 ? 'text-rose-600' : 'text-emerald-700'
                  }`}>
                    {typeSummary.stockProfessor} un
                  </span>
                </div>
              </div>

              {/* Balanço Geral */}
              <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl p-4 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">
                      Estoque Total Geral
                    </span>
                    <Boxes className="w-4 h-4 text-indigo-300" />
                  </div>
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-indigo-200">Total Comprado:</span>
                      <span className="text-base font-black text-white">{typeSummary.totalPurchased} un</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-indigo-200">Total Retirado:</span>
                      <span className="text-xs font-bold text-indigo-300">{typeSummary.totalDelivered} un</span>
                    </div>
                  </div>
                </div>
                <div className="pt-3 mt-3 border-t border-white/10 flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-200">Saldo Disponível:</span>
                  <span className={`text-base font-black ${
                    typeSummary.totalStock < 0 ? 'text-rose-400' : 'text-emerald-400'
                  }`}>
                    {typeSummary.totalStock} un
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================
              2. TABELA COMPARATIVA POR FAIXA ETÁRIA
          ======================================================== */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  2. Detalhamento por Faixa Etária (Aluno x Professor)
                </h4>
              </div>
              <span className="text-[11px] text-slate-500">
                Baseado nos lotes de compra cadastrados
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-3.5">Faixa Etária da Lição</th>
                      <th className="py-3 px-3 text-center">Aluno (Compr.)</th>
                      <th className="py-3 px-3 text-center">Prof. (Compr.)</th>
                      <th className="py-3 px-3 text-center font-black">Total Comprado</th>
                      <th className="py-3 px-3 text-center">Pedidos (Classes)</th>
                      <th className="py-3 px-3 text-center">Retiradas</th>
                      <th className="py-3 px-3 text-right">Saldo em Estoque</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ageGroupBreakdown.map((row, idx) => {
                      const hasPurchases = row.totalPurchased > 0;
                      const hasOrders = row.totalRequested > 0;

                      return (
                        <tr 
                          key={row.ageGroup} 
                          className={`hover:bg-slate-50 transition-colors ${
                            idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                          }`}
                        >
                          {/* Faixa Etária */}
                          <td className="py-3 px-3.5 font-bold text-slate-900">
                            <div className="flex items-center gap-2">
                              <span>{row.ageGroup}</span>
                              {hasPurchases && (
                                <span className="w-2 h-2 rounded-full bg-indigo-500" title="Possui compras registradas" />
                              )}
                            </div>
                          </td>

                          {/* Aluno */}
                          <td className="py-3 px-3 text-center font-mono font-bold text-indigo-700">
                            {row.alunoPurchased > 0 ? (
                              <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100">
                                {row.alunoPurchased}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>

                          {/* Professor */}
                          <td className="py-3 px-3 text-center font-mono font-bold text-purple-700">
                            {row.professorPurchased > 0 ? (
                              <span className="px-2 py-0.5 rounded-md bg-purple-50 border border-purple-100">
                                {row.professorPurchased}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>

                          {/* Total Comprado */}
                          <td className="py-3 px-3 text-center font-mono font-black text-slate-900 text-sm">
                            {row.totalPurchased > 0 ? `${row.totalPurchased} un` : <span className="text-slate-300 font-normal">0 un</span>}
                          </td>

                          {/* Total Pedidos Solicitados */}
                          <td className="py-3 px-3 text-center font-mono text-slate-700">
                            {row.totalRequested > 0 ? `${row.totalRequested} un` : <span className="text-slate-300">-</span>}
                          </td>

                          {/* Total Retiradas */}
                          <td className="py-3 px-3 text-center font-mono font-bold text-blue-700">
                            {row.totalDelivered > 0 ? `${row.totalDelivered} un` : <span className="text-slate-300">-</span>}
                          </td>

                          {/* Saldo Restante */}
                          <td className="py-3 px-3 text-right font-mono font-black text-sm">
                            {hasPurchases ? (
                              <span className={`inline-block px-2.5 py-0.5 rounded-md font-bold ${
                                row.remainingStock < 0 
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                                  : row.remainingStock === 0
                                    ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}>
                                {row.remainingStock} un
                              </span>
                            ) : (
                              <span className="text-slate-300 font-normal">Sem compras</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100/90 font-bold border-t-2 border-slate-300 text-slate-900 text-xs">
                      <td className="py-3 px-3.5">TOTAL GERAL CONSOLIDADO</td>
                      <td className="py-3 px-3 text-center font-mono text-indigo-800">
                        {typeSummary.purchasedAluno} un
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-purple-800">
                        {typeSummary.purchasedProfessor} un
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-black text-slate-950 text-sm">
                        {typeSummary.totalPurchased} un
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-700">
                        {orders.reduce((sum, o) => sum + (o.quantity || 0), 0)} un
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-blue-800">
                        {typeSummary.totalDelivered} un
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-sm">
                        <span className={`px-2.5 py-0.5 rounded-md ${
                          typeSummary.totalStock < 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {typeSummary.totalStock} un
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* Dica explicativa */}
          <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-start gap-3 text-xs text-indigo-900">
            <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Como funciona o cálculo do estoque:</p>
              <p className="text-indigo-800 mt-0.5">
                O quantitativo comprado é registrado pela Direção/Coordenação da EBD através do botão <strong>"Gerenciar Compras"</strong>. Conforme os professores ou responsáveis das classes fazem a retirada física das revistas, o saldo disponível em estoque é deduzido em tempo real.
              </p>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-end bg-white shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            Fechar Resumo
          </button>
        </div>

      </div>
    </div>
  );
};
