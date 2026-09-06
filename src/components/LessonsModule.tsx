import React, { useState, useMemo } from 'react';
import { 
  BookMarked, 
  PlusCircle, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  PackageCheck, 
  PackageX, 
  DollarSign, 
  Trash2, 
  Edit3, 
  X, 
  AlertCircle, 
  ArrowRight,
  TrendingUp,
  Layers,
  Sparkles
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { 
  LessonOrder, 
  LessonType, 
  PaymentStatus, 
  DeliveryStatus, 
  ClassConsolidation 
} from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';

interface LessonsModuleProps {
  orders: LessonOrder[];
  loading: boolean;
}

const DEFAULT_CLASSES = [
  'Classe dos Homens',
  'Classe das Mulheres',
  'Classe de Jovens',
  'Classe de Adolescentes',
  'Classe Infantil / Crianças',
  'Classe de Novos Convertidos / Discipulado'
];

export const LessonsModule: React.FC<LessonsModuleProps> = ({ orders, loading }) => {
  const { currentUser, userProfile, isMaster, isDirigente, isSecretaria } = useAuth();

  // Filters
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedLessonType, setSelectedLessonType] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | PaymentStatus>('all');
  const [deliveryFilter, setDeliveryFilter] = useState<'all' | DeliveryStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Active view: 'consolidated' or 'list'
  const [viewMode, setViewMode] = useState<'consolidated' | 'list'>('consolidated');

  // Modal New / Edit Order
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<LessonOrder | null>(null);

  // Form fields
  const [formLessonType, setFormLessonType] = useState<LessonType>('Adulto');
  const [formClassName, setFormClassName] = useState<string>('Classe dos Homens');
  const [customClassName, setCustomClassName] = useState<string>('');
  const [formQuantity, setFormQuantity] = useState<string>('10');
  const [formUnitPrice, setFormUnitPrice] = useState<string>('15');
  const [formPaymentStatus, setFormPaymentStatus] = useState<PaymentStatus>('nao_pago');
  const [formDeliveryStatus, setFormDeliveryStatus] = useState<DeliveryStatus>('nao_retirado');
  const [formNotes, setFormNotes] = useState<string>('');
  const [createFinancialEntry, setCreateFinancialEntry] = useState<boolean>(true);

  // Mark as Paid confirmation modal with Auto-financial-entry checkbox
  const [payModalOrder, setPayModalOrder] = useState<LessonOrder | null>(null);
  const [payAutoGenerateCashEntry, setPayAutoGenerateCashEntry] = useState<boolean>(true);
  const [payAmount, setPayAmount] = useState<string>('');

  // Status message
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // All distinct classes from current orders + default suggestions
  const allClasses = useMemo(() => {
    const set = new Set<string>(DEFAULT_CLASSES);
    orders.forEach(o => {
      if (o.className) set.add(o.className);
    });
    return Array.from(set);
  }, [orders]);

  // Consolidated data by Class
  const classConsolidations = useMemo<ClassConsolidation[]>(() => {
    const map = new Map<string, ClassConsolidation>();

    orders.forEach(o => {
      const cName = o.className || 'Não definida';
      if (!map.has(cName)) {
        map.set(cName, {
          className: cName,
          totalRequested: 0,
          totalPaid: 0,
          totalPendingPayment: 0,
          totalDelivered: 0,
          totalPendingDelivery: 0,
          totalAmount: 0
        });
      }

      const item = map.get(cName)!;
      item.totalRequested += o.quantity;
      if (o.totalAmount) item.totalAmount += o.totalAmount;
      else if (o.unitPrice) item.totalAmount += (o.unitPrice * o.quantity);

      if (o.paymentStatus === 'pago') {
        item.totalPaid += o.quantity;
      } else {
        item.totalPendingPayment += o.quantity;
      }

      if (o.deliveryStatus === 'retirado') {
        item.totalDelivered += o.quantity;
      } else {
        item.totalPendingDelivery += o.quantity;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalRequested - a.totalRequested);
  }, [orders]);

  // Overall totals
  const overallMetrics = useMemo(() => {
    let requested = 0;
    let paid = 0;
    let pendingPayment = 0;
    let delivered = 0;
    let pendingDelivery = 0;

    orders.forEach(o => {
      requested += o.quantity;
      if (o.paymentStatus === 'pago') paid += o.quantity;
      else pendingPayment += o.quantity;

      if (o.deliveryStatus === 'retirado') delivered += o.quantity;
      else pendingDelivery += o.quantity;
    });

    return { requested, paid, pendingPayment, delivered, pendingDelivery };
  }, [orders]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (selectedClass !== 'all' && o.className !== selectedClass) return false;
      if (selectedLessonType !== 'all' && o.lessonType !== selectedLessonType) return false;
      if (paymentFilter !== 'all' && o.paymentStatus !== paymentFilter) return false;
      if (deliveryFilter !== 'all' && o.deliveryStatus !== deliveryFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesClass = o.className.toLowerCase().includes(q);
        const matchesType = o.lessonType.toLowerCase().includes(q);
        const matchesNotes = (o.notes || '').toLowerCase().includes(q);
        if (!matchesClass && !matchesType && !matchesNotes) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, selectedClass, selectedLessonType, paymentFilter, deliveryFilter, searchQuery]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingOrder(null);
    setFormLessonType('Adulto');
    setFormClassName('Classe dos Homens');
    setCustomClassName('');
    setFormQuantity('10');
    setFormUnitPrice('15');
    setFormPaymentStatus('nao_pago');
    setFormDeliveryStatus('nao_retirado');
    setFormNotes('');
    setCreateFinancialEntry(true);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (o: LessonOrder) => {
    setEditingOrder(o);
    setFormLessonType(o.lessonType);
    if (DEFAULT_CLASSES.includes(o.className)) {
      setFormClassName(o.className);
      setCustomClassName('');
    } else {
      setFormClassName('other');
      setCustomClassName(o.className);
    }
    setFormQuantity(o.quantity.toString());
    setFormUnitPrice(o.unitPrice ? o.unitPrice.toString() : '15');
    setFormPaymentStatus(o.paymentStatus);
    setFormDeliveryStatus(o.deliveryStatus);
    setFormNotes(o.notes || '');
    setCreateFinancialEntry(false);
    setIsModalOpen(true);
  };

  // Submit Add / Edit Lesson Order
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const qty = parseInt(formQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      alert('Informe uma quantidade válida maior que zero.');
      return;
    }

    const unitPriceNum = parseFloat(formUnitPrice.replace(',', '.'));
    const totalCalc = !isNaN(unitPriceNum) && unitPriceNum > 0 ? (qty * unitPriceNum) : 0;

    const finalClassName = formClassName === 'other' ? customClassName.trim() : formClassName;
    if (!finalClassName) {
      alert('Informe o nome da classe solicitante.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingOrder) {
        // Update existing order
        const docRef = doc(db, 'lessonOrders', editingOrder.id);
        const updates: Partial<LessonOrder> = {
          lessonType: formLessonType,
          className: finalClassName,
          quantity: qty,
          unitPrice: unitPriceNum || undefined,
          totalAmount: totalCalc,
          paymentStatus: formPaymentStatus,
          deliveryStatus: formDeliveryStatus,
          notes: formNotes.trim() || undefined,
          updatedAt: new Date().toISOString()
        };

        if (formPaymentStatus === 'pago' && !editingOrder.paidAt) {
          updates.paidAt = new Date().toISOString();
        }
        if (formDeliveryStatus === 'retirado' && !editingOrder.deliveredAt) {
          updates.deliveredAt = new Date().toISOString();
        }

        await updateDoc(docRef, updates);
        setStatusMessage({ type: 'success', text: 'Solicitação de lições atualizada com sucesso!' });
      } else {
        // Create new order
        const nowIso = new Date().toISOString();
        const payload = {
          lessonType: formLessonType,
          className: finalClassName,
          quantity: qty,
          unitPrice: unitPriceNum || 0,
          totalAmount: totalCalc,
          paymentStatus: formPaymentStatus,
          deliveryStatus: formDeliveryStatus,
          requestedAt: nowIso,
          paidAt: formPaymentStatus === 'pago' ? nowIso : undefined,
          deliveredAt: formDeliveryStatus === 'retirado' ? nowIso : undefined,
          notes: formNotes.trim() || '',
          createdByUid: currentUser.uid,
          createdByName: userProfile?.displayName || currentUser.displayName || currentUser.email?.split('@')[0] || 'Secretaria',
          createdAt: nowIso
        };

        const docRef = await addDoc(collection(db, 'lessonOrders'), payload);

        // Integration with Caixa de Lições: if created as already paid and option checked, create financial entry!
        if (formPaymentStatus === 'pago' && createFinancialEntry && totalCalc > 0) {
          const transPayload = {
            type: 'income',
            account: 'caixa_licoes',
            amount: totalCalc,
            date: nowIso.split('T')[0],
            description: `Venda de Lições EBD (${formLessonType}) - ${finalClassName} (${qty} unid)`,
            status: (isMaster || isDirigente) ? 'approved' : 'pending',
            createdByUid: currentUser.uid,
            createdByName: userProfile?.displayName || 'Secretaria EBD',
            createdByEmail: currentUser.email || '',
            createdAt: nowIso,
            lessonOrderId: docRef.id
          };
          await addDoc(collection(db, 'transactions'), transPayload);
        }

        setStatusMessage({ type: 'success', text: 'Solicitação de lição cadastrada com sucesso!' });
      }

      setIsModalOpen(false);
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: unknown) {
      console.error("Erro ao salvar lição:", err);
      handleFirestoreError(err, OperationType.WRITE, 'lessonOrders');
      setStatusMessage({ type: 'error', text: 'Erro ao salvar solicitação de lição.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Trigger Pay Modal
  const handleOpenPayModal = (order: LessonOrder) => {
    setPayModalOrder(order);
    const estimated = order.totalAmount || (order.unitPrice ? order.unitPrice * order.quantity : order.quantity * 15);
    setPayAmount(estimated.toString());
    setPayAutoGenerateCashEntry(true);
  };

  // Confirm Mark as Paid + Auto Financial Entry into Caixa de Lições
  const handleConfirmPayment = async () => {
    if (!payModalOrder || !currentUser) return;
    setIsSubmitting(true);

    try {
      const nowIso = new Date().toISOString();
      const orderRef = doc(db, 'lessonOrders', payModalOrder.id);
      
      const parsedAmount = parseFloat(payAmount.replace(',', '.'));
      const finalAmount = !isNaN(parsedAmount) && parsedAmount > 0 
        ? parsedAmount 
        : (payModalOrder.totalAmount || payModalOrder.quantity * 15);

      // 1. Update lesson order status to 'pago'
      await updateDoc(orderRef, {
        paymentStatus: 'pago',
        paidAt: nowIso,
        totalAmount: finalAmount,
        updatedAt: nowIso
      });

      // 2. Integration: Automatically generate income entry in Caixa de Lições
      if (payAutoGenerateCashEntry && finalAmount > 0) {
        const transPayload = {
          type: 'income',
          account: 'caixa_licoes',
          amount: finalAmount,
          date: nowIso.split('T')[0],
          description: `Pagamento de Lições: ${payModalOrder.className} (${payModalOrder.quantity}x ${payModalOrder.lessonType})`,
          status: (isMaster || isDirigente) ? 'approved' : 'pending',
          createdByUid: currentUser.uid,
          createdByName: userProfile?.displayName || currentUser.displayName || 'Secretaria EBD',
          createdByEmail: currentUser.email || '',
          createdAt: nowIso,
          lessonOrderId: payModalOrder.id,
          ...(isMaster || isDirigente ? {
            approvedByUid: currentUser.uid,
            approvedByName: userProfile?.displayName || 'Admin',
            approvedAt: nowIso
          } : {})
        };

        await addDoc(collection(db, 'transactions'), transPayload);
      }

      setStatusMessage({ 
        type: 'success', 
        text: `Lições da ${payModalOrder.className} marcadas como PAGAS${payAutoGenerateCashEntry ? ' e lançadas no Caixa de Lições' : ''}!` 
      });
      setPayModalOrder(null);
      setTimeout(() => setStatusMessage(null), 5000);

    } catch (err: unknown) {
      console.error("Erro ao registrar pagamento:", err);
      handleFirestoreError(err, OperationType.UPDATE, `lessonOrders/${payModalOrder.id}`);
      setStatusMessage({ type: 'error', text: 'Não foi possível registrar o pagamento.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mark Delivery Status Toggle
  const handleToggleDelivery = async (order: LessonOrder) => {
    const newStatus: DeliveryStatus = order.deliveryStatus === 'retirado' ? 'nao_retirado' : 'retirado';
    try {
      const orderRef = doc(db, 'lessonOrders', order.id);
      const nowIso = new Date().toISOString();
      await updateDoc(orderRef, {
        deliveryStatus: newStatus,
        deliveredAt: newStatus === 'retirado' ? nowIso : null,
        updatedAt: nowIso
      });

      setStatusMessage({
        type: 'success',
        text: `Status de retirada atualizado: ${newStatus === 'retirado' ? 'Retirado pelas classes' : 'Não retirado'}`
      });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: unknown) {
      console.error("Erro ao atualizar retirada:", err);
      handleFirestoreError(err, OperationType.UPDATE, `lessonOrders/${order.id}`);
    }
  };

  // Delete Order (Master / Dirigente)
  const handleDeleteOrder = async (order: LessonOrder) => {
    if (!isMaster && !isDirigente) return;
    if (!window.confirm(`Deseja excluir o pedido da "${order.className}" (${order.quantity} lições)?`)) return;

    try {
      await deleteDoc(doc(db, 'lessonOrders', order.id));
      setStatusMessage({ type: 'success', text: 'Pedido de lições excluído com sucesso.' });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: unknown) {
      console.error("Erro ao excluir pedido:", err);
      handleFirestoreError(err, OperationType.DELETE, `lessonOrders/${order.id}`);
    }
  };

  const canManage = isMaster || isDirigente || isSecretaria;

  return (
    <div className="space-y-6">
      
      {/* Toast Notification */}
      {statusMessage && (
        <div className={`p-4 rounded-xl flex items-center justify-between text-sm shadow-xs transition-all ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' 
            : 'bg-rose-50 text-rose-900 border border-rose-200'
        }`}>
          <div className="flex items-center gap-2.5">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600" />
            )}
            <span className="font-medium">{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Controle de Lições da EBD</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
              Secretaria
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Consolidado por classe, controle de solicitações, pagamentos e retiradas
          </p>
        </div>

        {canManage && (
          <button
            id="btn-nova-licao"
            onClick={handleOpenAdd}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nova Solicitação de Lições</span>
          </button>
        )}
      </div>

      {/* Overall Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        
        {/* Total Solicitadas */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Total Solicitadas</span>
          <div className="text-2xl font-extrabold text-slate-900">{overallMetrics.requested}</div>
          <span className="text-[11px] text-slate-500">Revistas pedidas</span>
        </div>

        {/* Total Pagas */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 block">Lições Pagas</span>
          <div className="text-2xl font-extrabold text-emerald-700">{overallMetrics.paid}</div>
          <span className="text-[11px] text-slate-500">
            {overallMetrics.pendingPayment > 0 ? `${overallMetrics.pendingPayment} a pagar` : 'Todas pagas'}
          </span>
        </div>

        {/* Total Retiradas */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 block">Retiradas / Entregues</span>
          <div className="text-2xl font-extrabold text-indigo-700">{overallMetrics.delivered}</div>
          <span className="text-[11px] text-slate-500">
            {overallMetrics.pendingDelivery > 0 ? `${overallMetrics.pendingDelivery} aguardando entrega` : 'Todas entregues'}
          </span>
        </div>

        {/* Pendências de Pagamento */}
        <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 block">A Pagar</span>
          <div className="text-2xl font-extrabold text-amber-900">{overallMetrics.pendingPayment}</div>
          <span className="text-[11px] text-amber-700 font-medium">Requer recebimento</span>
        </div>

      </div>

      {/* View Mode Switcher (Consolidado vs Lista Detalhada) */}
      <div className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode('consolidated')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'consolidated'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Tabela Consolidada por Classe
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'list'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Lista de Pedidos ({filteredOrders.length})
          </button>
        </div>

        <span className="text-xs text-slate-400 hidden sm:block">
          {viewMode === 'consolidated' ? 'Resumo de cobrança e entrega' : 'Histórico detalhado de solicitações'}
        </span>
      </div>

      {/* TABELA CONSOLIDADA POR CLASSE */}
      {viewMode === 'consolidated' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Consolidado Geral por Classe</h3>
              <p className="text-xs text-slate-500">Comparativo de lições pedidas, pagas e retiradas por cada classe</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-700">
              {classConsolidations.length} Classes Registradas
            </span>
          </div>

          {classConsolidations.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <BookMarked className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-sm font-medium">Nenhum pedido de lição registrado ainda.</p>
              <p className="text-xs">Clique no botão "Nova Solicitação de Lições" acima para iniciar.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Classe</th>
                    <th className="py-3 px-4 text-center">Pedidas</th>
                    <th className="py-3 px-4 text-center">Pagas</th>
                    <th className="py-3 px-4 text-center">A Pagar</th>
                    <th className="py-3 px-4 text-center">Retiradas</th>
                    <th className="py-3 px-4 text-center">A Retirar</th>
                    <th className="py-3 px-4 text-right">Status Geral</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {classConsolidations.map((c) => {
                    const isFullyPaid = c.totalPendingPayment === 0;
                    const isFullyDelivered = c.totalPendingDelivery === 0;

                    return (
                      <tr key={c.className} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>{c.className}</span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-extrabold text-slate-800 text-sm">
                          {c.totalRequested}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-emerald-700">
                          {c.totalPaid}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {c.totalPendingPayment > 0 ? (
                            <span className="px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 text-[11px]">
                              {c.totalPendingPayment} pendente{c.totalPendingPayment > 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-medium">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-indigo-700">
                          {c.totalDelivered}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {c.totalPendingDelivery > 0 ? (
                            <span className="px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700 text-[11px]">
                              {c.totalPendingDelivery} restante{c.totalPendingDelivery > 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-medium">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              isFullyPaid 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}>
                              {isFullyPaid ? '100% Pago' : 'Pgto Pendente'}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              isFullyDelivered 
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              {isFullyDelivered ? 'Entregue' : 'Parcial'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* LISTA DETALHADA DE PEDIDOS */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por classe..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">Todas as Classes</option>
              {allClasses.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as 'all' | PaymentStatus)}
              className="py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">Status de Pagamento (Todos)</option>
              <option value="pago">Apenas Pagos</option>
              <option value="nao_pago">Apenas Não Pagos</option>
            </select>

            <select
              value={deliveryFilter}
              onChange={(e) => setDeliveryFilter(e.target.value as 'all' | DeliveryStatus)}
              className="py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">Status de Retirada (Todos)</option>
              <option value="retirado">Apenas Retirados</option>
              <option value="nao_retirado">Apenas Não Retirados</option>
            </select>
          </div>

          {/* Orders Cards / List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
            {filteredOrders.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <p className="text-sm font-semibold text-slate-700">Nenhum pedido encontrado</p>
                <p className="text-xs text-slate-500">Tente ajustar os filtros acima.</p>
              </div>
            ) : (
              filteredOrders.map(order => {
                const isPaid = order.paymentStatus === 'pago';
                const isDelivered = order.deliveryStatus === 'retirado';

                return (
                  <div key={order.id} className="p-4 hover:bg-slate-50/70 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                    
                    {/* Order Info */}
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{order.className}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {order.quantity} Lições ({order.lessonType})
                        </span>
                        
                        {/* Payment Badge */}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}>
                          {isPaid ? '✓ Pago' : '⏳ Não Pago'}
                        </span>

                        {/* Delivery Badge */}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isDelivered ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {isDelivered ? '📦 Retirado' : 'Aguardando Retirada'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span>Pedido: {formatDate(order.requestedAt)}</span>
                        {order.paidAt && <span>• Pago em: {formatDate(order.paidAt)}</span>}
                        {order.deliveredAt && <span>• Retirado em: {formatDate(order.deliveredAt)}</span>}
                        <span>• Por: {order.createdByName}</span>
                      </div>

                      {order.notes && (
                        <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 inline-block">
                          Obs: {order.notes}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      
                      {/* Mark as Paid Action Button */}
                      {!isPaid && canManage && (
                        <button
                          onClick={() => handleOpenPayModal(order)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>Marcar como Pago</span>
                        </button>
                      )}

                      {/* Delivery Toggle Button */}
                      {canManage && (
                        <button
                          onClick={() => handleToggleDelivery(order)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                            isDelivered
                              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600'
                          }`}
                        >
                          <PackageCheck className="w-3.5 h-3.5" />
                          <span>{isDelivered ? 'Desmarcar Retirada' : 'Marcar Retirado'}</span>
                        </button>
                      )}

                      {/* Edit */}
                      {canManage && (
                        <button
                          onClick={() => handleOpenEdit(order)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Editar detalhes"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}

                      {/* Delete (Master/Dirigente only) */}
                      {(isMaster || isDirigente) && (
                        <button
                          onClick={() => handleDeleteOrder(order)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Excluir pedido"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                    </div>

                  </div>
                );
              })
            )}
          </div>

        </div>
      )}

      {/* MODAL: NOVA OU EDITAR SOLICITAÇÃO DE LIÇÕES */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div 
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingOrder ? 'Editar Solicitação de Lições' : 'Nova Solicitação de Lições EBD'}
                </h3>
                <p className="text-xs text-slate-500">Cadastre a quantidade de revistas para a classe solicitante</p>
              </div>
              <button
                onClick={() => !isSubmitting && setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitOrder} className="p-6 space-y-4 overflow-y-auto">
              
              {/* Tipo de Lição */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tipo de Lição / Revista *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['Adulto', 'Aluno', 'Jovens', 'Infantil'] as LessonType[]).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormLessonType(t)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        formLessonType === t
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-500/20 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Classe Solicitante */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Classe Solicitante *
                </label>
                <select
                  value={formClassName}
                  onChange={(e) => setFormClassName(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                >
                  {DEFAULT_CLASSES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  <option value="other">+ Outra Classe (digitar nome)</option>
                </select>

                {formClassName === 'other' && (
                  <input
                    type="text"
                    required
                    placeholder="Digite o nome da classe..."
                    value={customClassName}
                    onChange={(e) => setCustomClassName(e.target.value)}
                    className="mt-2 w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                )}
              </div>

              {/* Quantidade e Valor Unitário */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Quantidade Solicitada *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Preço Unitário Estimado (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                    <input
                      type="number"
                      step="0.50"
                      min="0"
                      value={formUnitPrice}
                      onChange={(e) => setFormUnitPrice(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Status de Pagamento e Retirada */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Status de Pagamento
                  </label>
                  <select
                    value={formPaymentStatus}
                    onChange={(e) => setFormPaymentStatus(e.target.value as PaymentStatus)}
                    className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  >
                    <option value="nao_pago">Não Pago</option>
                    <option value="pago">Pago</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Status de Retirada
                  </label>
                  <select
                    value={formDeliveryStatus}
                    onChange={(e) => setFormDeliveryStatus(e.target.value as DeliveryStatus)}
                    className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  >
                    <option value="nao_retirado">Não Retirado</option>
                    <option value="retirado">Retirado</option>
                  </select>
                </div>
              </div>

              {/* Integração Financeira: Gerar lançamento no Caixa de Lições */}
              {!editingOrder && formPaymentStatus === 'pago' && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-emerald-950">
                    <input
                      type="checkbox"
                      checked={createFinancialEntry}
                      onChange={(e) => setCreateFinancialEntry(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded border-emerald-300 focus:ring-emerald-500"
                    />
                    <span>Gerar automaticamente entrada no Caixa de Lições</span>
                  </label>
                  <p className="text-emerald-800 text-[11px] pl-6">
                    Valor total de {formatCurrency((parseInt(formQuantity) || 0) * (parseFloat(formUnitPrice.replace(',', '.')) || 0))} será lançado na conta do Caixa de Lições.
                  </p>
                </div>
              )}

              {/* Observações */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observações (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Professor João solicitou 2 extras para visitantes..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors disabled:opacity-60 flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>{editingOrder ? 'Salvar Alterações' : 'Cadastrar Solicitação'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL: MARCAR COMO PAGO COM INTEGRAÇÃO FINANCEIRA */}
      {payModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div 
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-emerald-600 p-5 text-white">
              <div className="flex items-center gap-2 font-bold text-base">
                <DollarSign className="w-5 h-5 text-emerald-200" />
                <span>Confirmar Pagamento de Lições</span>
              </div>
              <p className="text-xs text-emerald-100 mt-1">
                {payModalOrder.className} — {payModalOrder.quantity} revistas ({payModalOrder.lessonType})
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Valor Total Recebido (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Integration Checkbox (MANDATORY REQUIREMENT FROM USER PROMPT) */}
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={payAutoGenerateCashEntry}
                    onChange={(e) => setPayAutoGenerateCashEntry(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-emerald-300 focus:ring-emerald-500 mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-bold text-emerald-950 block">
                      Gerar lançamento de entrada no Caixa de Lições
                    </span>
                    <span className="text-[11px] text-emerald-800">
                      Integração imediata: o valor será creditado no saldo do Caixa de Lições da EBD.
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setPayModalOrder(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirmPayment}
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs flex items-center gap-2"
                >
                  {isSubmitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>Confirmar e Salvar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
