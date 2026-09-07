import React, { useState } from 'react';
import { 
  ShoppingBag, 
  Boxes, 
  Calendar, 
  X, 
  Trash2, 
  PlusCircle, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  FileText
} from 'lucide-react';
import { collection, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { LessonPurchase, AGE_GROUPS, AgeGroup } from '../types';
import { formatCurrency, formatDate, getTodayDateString } from '../utils/formatters';

interface LessonPurchasesModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchases: LessonPurchase[];
  loadingPurchases?: boolean;
  totalDelivered: number;
  canManage: boolean;
  onSuccessMessage: (msg: string) => void;
  onErrorMessage: (msg: string) => void;
}

export const LessonPurchasesModal: React.FC<LessonPurchasesModalProps> = ({
  isOpen,
  onClose,
  purchases,
  loadingPurchases = false,
  totalDelivered,
  canManage,
  onSuccessMessage,
  onErrorMessage
}) => {
  const { currentUser, userProfile } = useAuth();

  const [formAgeGroup, setFormAgeGroup] = useState<string>(AGE_GROUPS[9]); // Padrão: Adultos
  const [formQuantity, setFormQuantity] = useState<string>('50');
  const [formDate, setFormDate] = useState<string>(getTodayDateString());
  const [formNotes, setFormNotes] = useState<string>('');
  const [formTotalCost, setFormTotalCost] = useState<string>('');
  const [filterAgeGroup, setFilterAgeGroup] = useState<string>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalPurchased = purchases.reduce((acc, p) => acc + (p.quantity || 0), 0);
  const stockBalance = totalPurchased - totalDelivered;

  // Filtered purchases list
  const displayedPurchases = filterAgeGroup === 'all'
    ? purchases
    : purchases.filter(p => p.ageGroup === filterAgeGroup);

  const handleAddPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !canManage) return;

    const qty = parseInt(formQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      onErrorMessage('Informe uma quantidade válida de lições compradas.');
      return;
    }

    if (!formDate) {
      onErrorMessage('Informe a data da compra.');
      return;
    }

    if (!formAgeGroup) {
      onErrorMessage('Selecione o tipo por faixa etária da lição.');
      return;
    }

    setIsSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const parsedCost = parseFloat(formTotalCost.replace(',', '.'));
      
      await addDoc(collection(db, 'lessonPurchases'), {
        quantity: qty,
        purchaseDate: formDate,
        ageGroup: formAgeGroup,
        notes: formNotes.trim(),
        totalCost: !isNaN(parsedCost) && parsedCost > 0 ? parsedCost : null,
        createdByUid: currentUser.uid,
        createdByName: userProfile?.displayName || currentUser.displayName || currentUser.email?.split('@')[0] || 'Direção',
        createdAt: nowIso
      });

      onSuccessMessage(`Lote de ${qty} lições (${formAgeGroup}) registrado com sucesso!`);
      setFormQuantity('50');
      setFormNotes('');
      setFormTotalCost('');
      setFormDate(getTodayDateString());
    } catch (err: any) {
      console.error('Erro ao registrar compra de lições:', err);
      handleFirestoreError(err, OperationType.CREATE, 'lessonPurchases');
      onErrorMessage('Erro ao registrar compra de lições.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (purchase: LessonPurchase) => {
    if (!currentUser || !canManage) return;
    if (!window.confirm(`Deseja realmente remover o lote de compra de ${purchase.quantity} lições (${formatDate(purchase.purchaseDate)})?`)) {
      return;
    }

    setDeletingId(purchase.id);
    try {
      await deleteDoc(doc(db, 'lessonPurchases', purchase.id));
      onSuccessMessage('Lote de compra excluído com sucesso.');
    } catch (err: any) {
      console.error('Erro ao excluir lote de compra:', err);
      handleFirestoreError(err, OperationType.DELETE, 'lessonPurchases');
      onErrorMessage('Erro ao excluir lote de compra.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-950 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-950/20">
              <ShoppingBag className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                Lições Compradas pela Direção
              </h3>
              <p className="text-xs text-slate-500">
                Controle do quantitativo comprado antecipadamente e saldo em estoque
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Executive Inventory Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Total Comprado */}
            <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-100 space-y-1">
              <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
                Total Comprado
              </span>
              <div className="text-2xl font-black text-indigo-950">
                {totalPurchased} <span className="text-xs font-semibold text-indigo-600">un</span>
              </div>
              <span className="text-[11px] text-indigo-700 block">
                Pela direção da EBD
              </span>
            </div>

            {/* Retirado Fisicamente */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Retirado pelas Classes
              </span>
              <div className="text-2xl font-black text-slate-800">
                {totalDelivered} <span className="text-xs font-semibold text-slate-400">un</span>
              </div>
              <span className="text-[11px] text-slate-500 block">
                Subtraído fisicamente
              </span>
            </div>

            {/* Saldo Restante em Estoque */}
            <div className={`p-4 rounded-2xl border space-y-1 ${
              stockBalance < 0 
                ? 'bg-rose-50 border-rose-200 text-rose-950'
                : 'bg-emerald-50 border-emerald-200 text-emerald-950'
            }`}>
              <span className="text-[10px] font-bold uppercase tracking-wider block opacity-80">
                Saldo em Estoque
              </span>
              <div className="text-2xl font-black">
                {stockBalance} <span className="text-xs font-semibold opacity-75">un</span>
              </div>
              <span className="text-[11px] block opacity-80 font-medium">
                {stockBalance < 0 
                  ? 'Retiradas excedem compras!' 
                  : 'Disponível para entrega'}
              </span>
            </div>
          </div>

          {/* Registration Form (Only for Dirigente / Secretaria / Master) */}
          {canManage ? (
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3.5">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-indigo-600" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Registrar Nova Compra Antecipada
                </h4>
              </div>

              <form onSubmit={handleAddPurchase} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  
                  {/* Tipo por Faixa Etária */}
                  <div className="sm:col-span-2 lg:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Tipo por Faixa Etária *
                    </label>
                    <select
                      value={formAgeGroup}
                      onChange={(e) => setFormAgeGroup(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer text-slate-800"
                    >
                      {AGE_GROUPS.map(ag => (
                        <option key={ag} value={ag}>{ag}</option>
                      ))}
                    </select>
                  </div>

                  {/* Quantidade */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Quantidade Comprada *
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formQuantity}
                      onChange={(e) => setFormQuantity(e.target.value)}
                      placeholder="Ex: 50"
                      className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Data da Compra */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Data da Compra *
                    </label>
                    <input
                      type="date"
                      required
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Custo Total (Opcional) */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Custo Total Pago (R$) <span className="font-normal text-slate-400">(opcional)</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formTotalCost}
                      onChange={(e) => setFormTotalCost(e.target.value)}
                      placeholder="Ex: 750.00"
                      className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Detalhes / Observação */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Trimestre / Fornecedor / Detalhes <span className="font-normal text-slate-400">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      placeholder="Ex: Revistas 3º Trimestre 2026 - CPAD"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-xs font-bold bg-indigo-950 hover:bg-indigo-900 text-white rounded-xl shadow-xs flex items-center gap-2 transition cursor-pointer"
                  >
                    {isSubmitting ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <PlusCircle className="w-3.5 h-3.5 text-indigo-300" />
                    )}
                    <span>Adicionar Lote Comprado</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Apenas membros com perfil de Secretaria, Dirigente ou Master podem cadastrar novas compras.</span>
            </div>
          )}

          {/* Purchase History Table */}
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Histórico de Lotes Comprados ({purchases.length})
                </h4>
                <span className="text-[11px] text-slate-400">
                  Ordenado pelos mais recentes
                </span>
              </div>

              {/* Filter by Faixa Etária */}
              {purchases.length > 0 && (
                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <span className="text-[11px] font-semibold text-slate-500">Filtrar por Faixa:</span>
                  <select
                    value={filterAgeGroup}
                    onChange={(e) => setFilterAgeGroup(e.target.value)}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-slate-200 rounded-lg text-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="all">Todas as Faixas ({purchases.length})</option>
                    {AGE_GROUPS.map(ag => {
                      const c = purchases.filter(p => p.ageGroup === ag).length;
                      if (c === 0) return null;
                      return (
                        <option key={ag} value={ag}>{ag} ({c})</option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>

            {loadingPurchases ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Carregando registros de compras...
              </div>
            ) : purchases.length === 0 ? (
              <div className="p-8 border border-dashed border-slate-200 rounded-2xl text-center space-y-2 bg-slate-50/50">
                <Boxes className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-600">Nenhum lote de compra registrado ainda</p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Registre o quantitativo de revistas comprado antecipadamente pela direção para acompanhar o saldo restante do estoque.
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">Data</th>
                        <th className="py-2.5 px-3">Faixa Etária</th>
                        <th className="py-2.5 px-3">Quantidade</th>
                        <th className="py-2.5 px-3">Detalhes / Trimestre</th>
                        <th className="py-2.5 px-3">Valor Total</th>
                        <th className="py-2.5 px-3">Registrado por</th>
                        {canManage && <th className="py-2.5 px-3 text-right">Ação</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {displayedPurchases.map((purchase) => (
                        <tr key={purchase.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-2.5 px-3 font-semibold text-slate-700 whitespace-nowrap">
                            {formatDate(purchase.purchaseDate)}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-100">
                              {purchase.ageGroup || 'Geral / Adultos'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                              +{purchase.quantity} un
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">
                            {purchase.notes || '—'}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-700 whitespace-nowrap">
                            {purchase.totalCost ? formatCurrency(purchase.totalCost) : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                            {purchase.createdByName || 'Direção'}
                          </td>
                          {canManage && (
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleDelete(purchase)}
                                disabled={deletingId === purchase.id}
                                title="Excluir lote"
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              >
                                {deletingId === purchase.id ? (
                                  <div className="w-3.5 h-3.5 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            Saldo Atual: <strong className="text-slate-800">{stockBalance} revistas disponíveis</strong>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/70 rounded-xl transition cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
