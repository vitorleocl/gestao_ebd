import React, { useState, useMemo } from 'react';
import { 
  BookMarked, 
  PlusCircle, 
  Search, 
  CheckCircle2, 
  Clock, 
  PackageCheck, 
  PackageX, 
  DollarSign, 
  Trash2, 
  Edit3, 
  X, 
  AlertCircle, 
  ArrowLeft,
  School,
  Table,
  Layers,
  Sparkles,
  Check,
  ChevronRight,
  TrendingUp,
  FileSpreadsheet
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
  ClassConsolidation,
  EbdClass
} from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';

interface LessonsModuleProps {
  orders: LessonOrder[];
  loading: boolean;
  classes: EbdClass[];
  loadingClasses: boolean;
}

const DEFAULT_CLASS_PRESETS = [
  'Classe dos Homens',
  'Classe das Mulheres',
  'Classe de Jovens',
  'Classe de Adolescentes',
  'Classe Infantil / Crianças',
  'Classe de Novos Convertidos / Discipulado'
];

export const LessonsModule: React.FC<LessonsModuleProps> = ({ 
  orders, 
  loading,
  classes,
  loadingClasses
}) => {
  const { currentUser, userProfile, isMaster, isDirigente, isSecretaria } = useAuth();

  // Primary active tab
  const [activeTab, setActiveTab] = useState<'classes_orders' | 'manage_classes' | 'consolidated'>('classes_orders');

  // Currently selected class for the spreadsheet table view
  const [selectedClass, setSelectedClass] = useState<EbdClass | null>(null);

  // Search and status filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPayment, setFilterPayment] = useState<'all' | PaymentStatus>('all');
  const [filterDelivery, setFilterDelivery] = useState<'all' | DeliveryStatus>('all');

  // Modal: Add / Edit Lesson Order in a Class
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<LessonOrder | null>(null);

  // Order Form State
  const [formLessonType, setFormLessonType] = useState<LessonType>('Adulto');
  const [formQuantity, setFormQuantity] = useState<string>('10');
  const [formUnitPrice, setFormUnitPrice] = useState<string>('15');
  const [formPaymentStatus, setFormPaymentStatus] = useState<PaymentStatus>('nao_pago');
  const [formDeliveryStatus, setFormDeliveryStatus] = useState<DeliveryStatus>('nao_retirado');
  const [formNotes, setFormNotes] = useState<string>('');
  const [createFinancialEntry, setCreateFinancialEntry] = useState<boolean>(true);

  // Class Management State
  const [newClassName, setNewClassName] = useState('');
  const [editingClass, setEditingClass] = useState<EbdClass | null>(null);
  const [editClassNameVal, setEditClassNameVal] = useState('');
  const [isClassSubmitting, setIsClassSubmitting] = useState(false);

  // Pay confirmation modal
  const [payModalOrder, setPayModalOrder] = useState<LessonOrder | null>(null);
  const [payAutoGenerateCashEntry, setPayAutoGenerateCashEntry] = useState<boolean>(true);
  const [payAmount, setPayAmount] = useState<string>('');

  // Status message notification
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-seed default classes if none exist
  const handleSeedDefaultClasses = async () => {
    if (!currentUser) return;
    setIsClassSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      for (const name of DEFAULT_CLASS_PRESETS) {
        // Only add if not already present
        const alreadyExists = classes.some(c => c.name.toLowerCase() === name.toLowerCase());
        if (!alreadyExists) {
          await addDoc(collection(db, 'ebdClasses'), {
            name,
            createdAt: nowIso,
            createdByUid: currentUser.uid,
            createdByName: userProfile?.displayName || 'Secretaria EBD'
          });
        }
      }
      setStatusMessage({ type: 'success', text: 'Classes padrão da EBD cadastradas com sucesso!' });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: unknown) {
      console.error("Erro ao cadastrar classes padrão:", err);
      handleFirestoreError(err, OperationType.WRITE, 'ebdClasses');
      setStatusMessage({ type: 'error', text: 'Erro ao cadastrar classes padrão.' });
    } finally {
      setIsClassSubmitting(false);
    }
  };

  // Create a new class (name only)
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim() || !currentUser) return;

    setIsClassSubmitting(true);
    try {
      const name = newClassName.trim();
      const duplicate = classes.some(c => c.name.toLowerCase() === name.toLowerCase());
      if (duplicate) {
        setStatusMessage({ type: 'error', text: 'Já existe uma classe com este nome.' });
        setIsClassSubmitting(false);
        return;
      }

      await addDoc(collection(db, 'ebdClasses'), {
        name,
        createdAt: new Date().toISOString(),
        createdByUid: currentUser.uid,
        createdByName: userProfile?.displayName || 'Secretaria EBD'
      });

      setNewClassName('');
      setStatusMessage({ type: 'success', text: `Classe "${name}" criada com sucesso!` });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: unknown) {
      console.error("Erro ao criar classe:", err);
      handleFirestoreError(err, OperationType.WRITE, 'ebdClasses');
      setStatusMessage({ type: 'error', text: 'Erro ao criar classe.' });
    } finally {
      setIsClassSubmitting(false);
    }
  };

  // Update existing class name
  const handleSaveClassEdit = async () => {
    if (!editingClass || !editClassNameVal.trim() || !currentUser) return;
    setIsClassSubmitting(true);
    try {
      const newName = editClassNameVal.trim();
      await updateDoc(doc(db, 'ebdClasses', editingClass.id), {
        name: newName,
        updatedAt: new Date().toISOString()
      });

      // Also update orders that carried the old class name for consistency
      const affectedOrders = orders.filter(o => o.className === editingClass.name || o.classId === editingClass.id);
      for (const ord of affectedOrders) {
        await updateDoc(doc(db, 'lessonOrders', ord.id), {
          className: newName,
          classId: editingClass.id,
          updatedAt: new Date().toISOString()
        });
      }

      // If this class is currently selected in sheet view, update reference
      if (selectedClass?.id === editingClass.id) {
        setSelectedClass({ ...editingClass, name: newName });
      }

      setEditingClass(null);
      setEditClassNameVal('');
      setStatusMessage({ type: 'success', text: `Classe atualizada para "${newName}"!` });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: unknown) {
      console.error("Erro ao editar classe:", err);
      handleFirestoreError(err, OperationType.UPDATE, `ebdClasses/${editingClass.id}`);
      setStatusMessage({ type: 'error', text: 'Erro ao atualizar nome da classe.' });
    } finally {
      setIsClassSubmitting(false);
    }
  };

  // Delete class
  const handleDeleteClass = async (classItem: EbdClass) => {
    const classOrders = orders.filter(o => o.className === classItem.name || o.classId === classItem.id);
    const confirmText = classOrders.length > 0 
      ? `Atenção: A classe "${classItem.name}" possui ${classOrders.length} pedido(s) registrado(s). Deseja realmente excluí-la?`
      : `Deseja realmente excluir a classe "${classItem.name}"?`;

    if (!window.confirm(confirmText)) return;

    try {
      await deleteDoc(doc(db, 'ebdClasses', classItem.id));
      if (selectedClass?.id === classItem.id) {
        setSelectedClass(null);
      }
      setStatusMessage({ type: 'success', text: `Classe "${classItem.name}" removida com sucesso!` });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: unknown) {
      console.error("Erro ao excluir classe:", err);
      handleFirestoreError(err, OperationType.DELETE, `ebdClasses/${classItem.id}`);
      setStatusMessage({ type: 'error', text: 'Não foi possível remover a classe.' });
    }
  };

  // Class metrics map
  const classStatsMap = useMemo(() => {
    const map = new Map<string, {
      totalRequested: number;
      totalPaid: number;
      totalPendingPayment: number;
      totalDelivered: number;
      totalPendingDelivery: number;
      totalAmount: number;
      ordersCount: number;
    }>();

    orders.forEach(o => {
      const cName = o.className;
      if (!map.has(cName)) {
        map.set(cName, {
          totalRequested: 0,
          totalPaid: 0,
          totalPendingPayment: 0,
          totalDelivered: 0,
          totalPendingDelivery: 0,
          totalAmount: 0,
          ordersCount: 0
        });
      }
      const st = map.get(cName)!;
      st.ordersCount++;
      st.totalRequested += o.quantity;
      const orderVal = o.totalAmount || (o.unitPrice ? o.unitPrice * o.quantity : o.quantity * 15);
      st.totalAmount += orderVal;

      if (o.paymentStatus === 'pago') st.totalPaid += o.quantity;
      else st.totalPendingPayment += o.quantity;

      if (o.deliveryStatus === 'retirado') st.totalDelivered += o.quantity;
      else st.totalPendingDelivery += o.quantity;
    });

    return map;
  }, [orders]);

  // Orders for the currently selected class in spreadsheet view
  const selectedClassOrders = useMemo(() => {
    if (!selectedClass) return [];
    return orders
      .filter(o => o.className === selectedClass.name || o.classId === selectedClass.id)
      .filter(o => {
        if (filterPayment !== 'all' && o.paymentStatus !== filterPayment) return false;
        if (filterDelivery !== 'all' && o.deliveryStatus !== filterDelivery) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchType = o.lessonType.toLowerCase().includes(q);
          const matchNotes = (o.notes || '').toLowerCase().includes(q);
          if (!matchType && !matchNotes) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, selectedClass, filterPayment, filterDelivery, searchQuery]);

  // Metrics for the selected class
  const selectedClassMetrics = useMemo(() => {
    if (!selectedClass) return { totalRequested: 0, totalPaid: 0, totalDelivered: 0, totalAmount: 0 };
    const stats = classStatsMap.get(selectedClass.name);
    return {
      totalRequested: stats?.totalRequested || 0,
      totalPaid: stats?.totalPaid || 0,
      totalDelivered: stats?.totalDelivered || 0,
      totalAmount: stats?.totalAmount || 0
    };
  }, [selectedClass, classStatsMap]);

  // Consolidated table metrics
  const classConsolidations = useMemo<ClassConsolidation[]>(() => {
    const map = new Map<string, ClassConsolidation>();

    // Initialize all registered classes
    classes.forEach(c => {
      map.set(c.name, {
        className: c.name,
        totalRequested: 0,
        totalPaid: 0,
        totalPendingPayment: 0,
        totalDelivered: 0,
        totalPendingDelivery: 0,
        totalAmount: 0
      });
    });

    // Populate with order data
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
      const val = o.totalAmount || (o.unitPrice ? o.unitPrice * o.quantity : o.quantity * 15);
      item.totalAmount += val;

      if (o.paymentStatus === 'pago') item.totalPaid += o.quantity;
      else item.totalPendingPayment += o.quantity;

      if (o.deliveryStatus === 'retirado') item.totalDelivered += o.quantity;
      else item.totalPendingDelivery += o.quantity;
    });

    return Array.from(map.values()).sort((a, b) => b.totalRequested - a.totalRequested);
  }, [classes, orders]);

  // Open Order Modal for creation
  const handleOpenAddOrder = () => {
    setEditingOrder(null);
    setFormLessonType('Adulto');
    setFormQuantity('10');
    setFormUnitPrice('15');
    setFormPaymentStatus('nao_pago');
    setFormDeliveryStatus('nao_retirado');
    setFormNotes('');
    setCreateFinancialEntry(true);
    setIsOrderModalOpen(true);
  };

  // Open Order Modal for edit
  const handleOpenEditOrder = (order: LessonOrder) => {
    setEditingOrder(order);
    setFormLessonType(order.lessonType);
    setFormQuantity(order.quantity.toString());
    setFormUnitPrice(order.unitPrice ? order.unitPrice.toString() : '15');
    setFormPaymentStatus(order.paymentStatus);
    setFormDeliveryStatus(order.deliveryStatus);
    setFormNotes(order.notes || '');
    setCreateFinancialEntry(false);
    setIsOrderModalOpen(true);
  };

  // Submit Order (Add or Edit)
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedClass) return;

    const qty = parseInt(formQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      alert('Informe uma quantidade válida maior que zero.');
      return;
    }

    const unitPriceNum = parseFloat(formUnitPrice.replace(',', '.'));
    const totalCalc = qty * (isNaN(unitPriceNum) ? 15 : unitPriceNum);

    setIsSubmitting(true);
    try {
      if (editingOrder) {
        // Edit order
        const docRef = doc(db, 'lessonOrders', editingOrder.id);
        const updates: Partial<LessonOrder> = {
          lessonType: formLessonType,
          quantity: qty,
          unitPrice: unitPriceNum || 0,
          totalAmount: totalCalc,
          paymentStatus: formPaymentStatus,
          deliveryStatus: formDeliveryStatus,
          notes: formNotes.trim() || '',
          updatedAt: new Date().toISOString()
        };

        if (formPaymentStatus === 'pago' && !editingOrder.paidAt) {
          updates.paidAt = new Date().toISOString();
        }
        if (formDeliveryStatus === 'retirado' && !editingOrder.deliveredAt) {
          updates.deliveredAt = new Date().toISOString();
        }

        await updateDoc(docRef, updates);
        setStatusMessage({ type: 'success', text: 'Linha de pedido atualizada com sucesso!' });
      } else {
        // New order
        const nowIso = new Date().toISOString();
        const payload = {
          lessonType: formLessonType,
          className: selectedClass.name,
          classId: selectedClass.id,
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
          createdByName: userProfile?.displayName || currentUser.displayName || 'Secretaria EBD',
          createdAt: nowIso
        };

        const docRef = await addDoc(collection(db, 'lessonOrders'), payload);

        // Optional auto-entry into Caixa de Lições if created as paid
        if (formPaymentStatus === 'pago' && createFinancialEntry && totalCalc > 0) {
          const transPayload = {
            type: 'income',
            account: 'caixa_licoes',
            category: 'Compra de Revistas/Lições',
            amount: totalCalc,
            date: nowIso.split('T')[0],
            description: `Venda de Lições (${formLessonType}) - ${selectedClass.name} (${qty} unid)`,
            status: (isMaster || isDirigente) ? 'approved' : 'pending',
            createdByUid: currentUser.uid,
            createdByName: userProfile?.displayName || 'Secretaria EBD',
            createdByEmail: currentUser.email || '',
            createdAt: nowIso,
            lessonOrderId: docRef.id
          };
          await addDoc(collection(db, 'transactions'), transPayload);
        }

        setStatusMessage({ type: 'success', text: 'Linha de lição adicionada à planilha!' });
      }

      setIsOrderModalOpen(false);
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: unknown) {
      console.error("Erro ao salvar lição:", err);
      handleFirestoreError(err, OperationType.WRITE, 'lessonOrders');
      setStatusMessage({ type: 'error', text: 'Erro ao salvar solicitação de lição.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Direct toggle payment status (Planilha Excel 1-click control)
  const handleQuickTogglePayment = async (order: LessonOrder) => {
    if (!currentUser) return;
    if (order.paymentStatus === 'nao_pago') {
      // Open pay confirmation modal with Caixa de Lições option
      setPayModalOrder(order);
      const estimated = order.totalAmount || (order.unitPrice ? order.unitPrice * order.quantity : order.quantity * 15);
      setPayAmount(estimated.toString());
      setPayAutoGenerateCashEntry(true);
    } else {
      // Toggle from pago back to nao_pago
      if (!window.confirm(`Deseja alterar o status para NÃO PAGO?`)) return;
      try {
        const orderRef = doc(db, 'lessonOrders', order.id);
        await updateDoc(orderRef, {
          paymentStatus: 'nao_pago',
          updatedAt: new Date().toISOString()
        });
        setStatusMessage({ type: 'success', text: 'Status de pagamento alterado para NÃO PAGO.' });
        setTimeout(() => setStatusMessage(null), 3000);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `lessonOrders/${order.id}`);
      }
    }
  };

  // Confirm Payment & Auto Financial Entry into Caixa de Lições
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
          category: 'Compra de Revistas/Lições',
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
      setTimeout(() => setStatusMessage(null), 4000);

    } catch (err: unknown) {
      console.error("Erro ao registrar pagamento:", err);
      handleFirestoreError(err, OperationType.UPDATE, `lessonOrders/${payModalOrder.id}`);
      setStatusMessage({ type: 'error', text: 'Não foi possível registrar o pagamento.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Direct toggle delivery status (Planilha Excel 1-click control)
  const handleToggleDelivery = async (order: LessonOrder) => {
    const newStatus: DeliveryStatus = order.deliveryStatus === 'retirado' ? 'nao_retirado' : 'retirado';
    try {
      const orderRef = doc(db, 'lessonOrders', order.id);
      const nowIso = new Date().toISOString();
      await updateDoc(orderRef, {
        deliveryStatus: newStatus,
        deliveredAt: newStatus === 'retirado' ? nowIso : undefined,
        updatedAt: nowIso
      });
      setStatusMessage({ 
        type: 'success', 
        text: newStatus === 'retirado' ? 'Marcado como RETIRADO!' : 'Marcado como NÃO RETIRADO!' 
      });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: unknown) {
      console.error("Erro ao alterar retirada:", err);
      handleFirestoreError(err, OperationType.UPDATE, `lessonOrders/${order.id}`);
    }
  };

  // Delete an order row
  const handleDeleteOrder = async (orderId: string) => {
    if (!window.confirm('Deseja realmente excluir esta linha de pedido?')) return;
    try {
      await deleteDoc(doc(db, 'lessonOrders', orderId));
      setStatusMessage({ type: 'success', text: 'Linha de pedido excluída com sucesso!' });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: unknown) {
      console.error("Erro ao excluir lição:", err);
      handleFirestoreError(err, OperationType.DELETE, `lessonOrders/${orderId}`);
    }
  };

  return (
    <div className="space-y-6">

      {/* Top Banner & Module Description */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <BookMarked className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Gestão de Lições da EBD
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            Controle de pedidos, pagamentos e retiradas por classe no formato de planilha
          </p>
        </div>

        {/* Global Navigation Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl self-start sm:self-auto overflow-x-auto">
          <button
            onClick={() => {
              setActiveTab('classes_orders');
              setSelectedClass(null);
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'classes_orders' 
                ? 'bg-white text-slate-900 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Lições por Classe</span>
          </button>

          <button
            onClick={() => setActiveTab('manage_classes')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'manage_classes' 
                ? 'bg-white text-slate-900 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <School className="w-4 h-4 text-indigo-600" />
            <span>Classes</span>
            {classes.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                {classes.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('consolidated')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'consolidated' 
                ? 'bg-white text-slate-900 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Table className="w-4 h-4 text-slate-600" />
            <span>Tabela Geral</span>
          </button>
        </div>
      </div>

      {/* Status Message Notification */}
      {statusMessage && (
        <div className={`p-4 rounded-xl text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border border-rose-200 text-rose-800'
        }`}>
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================
          TAB 1: LIÇÕES POR CLASSE (CARDS OU PLANILHA EXCEL)
      ======================================================== */}
      {activeTab === 'classes_orders' && (
        <>
          {/* Se nenhuma classe foi selecionada ainda: exibe os Cards das Classes */}
          {!selectedClass ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Selecione uma Classe</h2>
                  <p className="text-xs text-slate-500">
                    Clique na classe desejada para abrir a planilha e registrar ou controlar lições
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('manage_classes')}
                    className="px-3.5 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Nova Classe</span>
                  </button>
                </div>
              </div>

              {loadingClasses || loading ? (
                <div className="p-12 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200">
                  <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <span>Carregando classes e dados da EBD...</span>
                </div>
              ) : classes.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                    <School className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Nenhuma classe cadastrada ainda</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                      Crie as classes da sua EBD para começar a controlar as lições e entregas no estilo planilha.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <button
                      onClick={handleSeedDefaultClasses}
                      disabled={isClassSubmitting}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Cadastrar Classes Padrão com 1 Clique</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('manage_classes')}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                    >
                      Criar Nova Classe Manualmente
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {classes.map(c => {
                    const stats = classStatsMap.get(c.name);
                    const totalPed = stats?.totalRequested || 0;
                    const totalPago = stats?.totalPaid || 0;
                    const totalRet = stats?.totalDelivered || 0;
                    const totalVal = stats?.totalAmount || 0;
                    const pendingPay = totalPed - totalPago;
                    const pendingDel = totalPed - totalRet;

                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedClass(c)}
                        className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-4"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                📖
                              </div>
                              <h3 className="font-black text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
                                {c.name}
                              </h3>
                            </div>
                            <span className="text-xs text-slate-400 group-hover:text-emerald-600 flex items-center">
                              <ChevronRight className="w-4 h-4" />
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
                            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                              <span className="text-[10px] font-bold text-slate-400 block uppercase">Pedidas</span>
                              <span className="text-base font-black text-slate-800">{totalPed}</span>
                            </div>
                            <div className="bg-emerald-50/60 p-2 rounded-xl border border-emerald-100">
                              <span className="text-[10px] font-bold text-emerald-700 block uppercase">Pagas</span>
                              <span className="text-base font-black text-emerald-800">{totalPago}</span>
                            </div>
                            <div className="bg-blue-50/60 p-2 rounded-xl border border-blue-100">
                              <span className="text-[10px] font-bold text-blue-700 block uppercase">Retiradas</span>
                              <span className="text-base font-black text-blue-800">{totalRet}</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                          <div className="flex items-center justify-between text-slate-600">
                            <span>Total estimado:</span>
                            <strong className="text-slate-900 font-bold">{formatCurrency(totalVal)}</strong>
                          </div>

                          <div className="flex items-center justify-between text-[11px]">
                            <span className={`${pendingPay > 0 ? 'text-amber-700 font-bold' : 'text-slate-400'}`}>
                              {pendingPay > 0 ? `${pendingPay} pendentes de pgto` : 'Sem pendências financeiras'}
                            </span>
                            <span className={`${pendingDel > 0 ? 'text-indigo-700 font-bold' : 'text-slate-400'}`}>
                              {pendingDel > 0 ? `${pendingDel} a retirar` : 'Todas entregues'}
                            </span>
                          </div>

                          <button
                            type="button"
                            className="w-full py-2 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            <span>Abrir Planilha de Lições</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* ========================================================
               VISÃO PLANILHA EXCEL DA CLASSE SELECIONADA
            ======================================================== */
            <div className="space-y-4">
              
              {/* Top Navigation & Class Header */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedClass(null)}
                      className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer border border-slate-200"
                      title="Voltar para a lista de classes"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          Planilha de Lições
                        </span>
                        <h2 className="text-lg font-black text-slate-900 tracking-tight">
                          {selectedClass.name}
                        </h2>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Controle linha a linha de quantidade solicitada, preço unitário, pagamento e retirada estilo Excel
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleOpenAddOrder}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer self-start sm:self-auto"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>+ Nova Linha de Pedido</span>
                  </button>
                </div>

                {/* Metrics Bar for Selected Class */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Solicitado</span>
                    <span className="text-lg font-black text-slate-800">{selectedClassMetrics.totalRequested} un</span>
                  </div>
                  <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                    <span className="text-[10px] font-bold text-emerald-700 block uppercase">Total Pago</span>
                    <span className="text-lg font-black text-emerald-800">{selectedClassMetrics.totalPaid} un</span>
                  </div>
                  <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                    <span className="text-[10px] font-bold text-blue-700 block uppercase">Total Retirado</span>
                    <span className="text-lg font-black text-blue-800">{selectedClassMetrics.totalDelivered} un</span>
                  </div>
                  <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                    <span className="text-[10px] font-bold text-indigo-700 block uppercase">Valor Total</span>
                    <span className="text-lg font-black text-indigo-900">{formatCurrency(selectedClassMetrics.totalAmount)}</span>
                  </div>
                </div>

                {/* Spreadsheet Quick Filters */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">Filtrar linhas:</span>
                    <select
                      value={filterPayment}
                      onChange={(e) => setFilterPayment(e.target.value as any)}
                      className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700"
                    >
                      <option value="all">Pagamento: Todos</option>
                      <option value="pago">Apenas Pagos</option>
                      <option value="nao_pago">Apenas Não Pagos</option>
                    </select>

                    <select
                      value={filterDelivery}
                      onChange={(e) => setFilterDelivery(e.target.value as any)}
                      className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700"
                    >
                      <option value="all">Retirada: Todos</option>
                      <option value="retirado">Apenas Retirados</option>
                      <option value="nao_retirado">Apenas Não Retirados</option>
                    </select>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar por revista ou observação..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* SPREADSHEET EXCEL-STYLE TABLE */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                        <th className="py-3 px-3 w-12 text-center">#</th>
                        <th className="py-3 px-3">Tipo / Revista</th>
                        <th className="py-3 px-3 text-center">Qtd</th>
                        <th className="py-3 px-3 text-right">Preço Unit.</th>
                        <th className="py-3 px-3 text-right">Total Est.</th>
                        <th className="py-3 px-3 text-center">Status Pagamento</th>
                        <th className="py-3 px-3 text-center">Status Retirada</th>
                        <th className="py-3 px-3">Observação / Destinatário</th>
                        <th className="py-3 px-3 w-20 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-sans">
                      {selectedClassOrders.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-12 text-center text-slate-400">
                            <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                            <p className="font-semibold text-slate-600">Nenhum pedido lançado nesta classe ainda.</p>
                            <p className="text-[11px] text-slate-400 mt-1">
                              Clique no botão "+ Nova Linha de Pedido" acima para começar a planilha.
                            </p>
                          </td>
                        </tr>
                      ) : (
                        selectedClassOrders.map((ord, idx) => {
                          const unitPrice = ord.unitPrice || 15;
                          const totalVal = ord.totalAmount || (ord.quantity * unitPrice);
                          const isPaid = ord.paymentStatus === 'pago';
                          const isDelivered = ord.deliveryStatus === 'retirado';

                          return (
                            <tr 
                              key={ord.id} 
                              className={`hover:bg-slate-50/80 transition-colors ${
                                idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'
                              }`}
                            >
                              {/* Index / Date */}
                              <td className="py-2.5 px-3 text-center font-mono text-slate-400 text-[11px]">
                                {idx + 1}
                              </td>

                              {/* Lesson Type */}
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-900">{ord.lessonType}</div>
                                <div className="text-[10px] text-slate-400">{formatDate(ord.requestedAt)}</div>
                              </td>

                              {/* Quantity */}
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900 text-sm">
                                {ord.quantity}
                              </td>

                              {/* Unit Price */}
                              <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                                {formatCurrency(unitPrice)}
                              </td>

                              {/* Total Amount */}
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                {formatCurrency(totalVal)}
                              </td>

                              {/* STATUS PAGAMENTO (1-Click Toggle Pill Button) */}
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleQuickTogglePayment(ord)}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer shadow-xs border ${
                                    isPaid
                                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                                      : 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200 animate-pulse'
                                  }`}
                                  title="Clique para alternar status de pagamento"
                                >
                                  {isPaid ? (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>Pago</span>
                                    </>
                                  ) : (
                                    <>
                                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                                      <span>Não Pago</span>
                                    </>
                                  )}
                                </button>
                              </td>

                              {/* STATUS RETIRADA (1-Click Toggle Pill Button) */}
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleDelivery(ord)}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer shadow-xs border ${
                                    isDelivered
                                      ? 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200'
                                      : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                                  }`}
                                  title="Clique para alternar status de retirada (quem pegou)"
                                >
                                  {isDelivered ? (
                                    <>
                                      <PackageCheck className="w-3.5 h-3.5 text-blue-600" />
                                      <span>Retirado</span>
                                    </>
                                  ) : (
                                    <>
                                      <PackageX className="w-3.5 h-3.5 text-slate-500" />
                                      <span>Não Retirado</span>
                                    </>
                                  )}
                                </button>
                              </td>

                              {/* Observations / Person Notes */}
                              <td className="py-2.5 px-3 text-slate-600">
                                <span className="text-xs">
                                  {ord.notes || <span className="text-slate-300 italic">Sem observação</span>}
                                </span>
                              </td>

                              {/* Row Actions */}
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => handleOpenEditOrder(ord)}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                    title="Editar linha"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteOrder(ord.id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Excluir linha"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>

                    {/* SPREADSHEET FOOTER ROW (TOTALS) */}
                    {selectedClassOrders.length > 0 && (
                      <tfoot>
                        <tr className="bg-slate-100/80 font-black text-slate-900 border-t-2 border-slate-300">
                          <td className="py-3 px-3 text-center font-bold text-[11px] text-slate-500">TOTAIS</td>
                          <td className="py-3 px-3 font-bold">{selectedClassOrders.length} linhas registradas</td>
                          <td className="py-3 px-3 text-center font-mono text-sm">
                            {selectedClassOrders.reduce((sum, o) => sum + o.quantity, 0)}
                          </td>
                          <td className="py-3 px-3 text-right text-slate-500 font-mono text-[11px]">—</td>
                          <td className="py-3 px-3 text-right font-mono text-sm text-emerald-900">
                            {formatCurrency(selectedClassOrders.reduce((sum, o) => sum + (o.totalAmount || o.quantity * (o.unitPrice || 15)), 0))}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="text-[11px] font-bold text-emerald-800">
                              {selectedClassOrders.filter(o => o.paymentStatus === 'pago').reduce((s, o) => s + o.quantity, 0)} pagas
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="text-[11px] font-bold text-blue-800">
                              {selectedClassOrders.filter(o => o.deliveryStatus === 'retirado').reduce((s, o) => s + o.quantity, 0)} retiradas
                            </span>
                          </td>
                          <td colSpan={2} className="py-3 px-3 text-right text-[11px] text-slate-400 font-normal">
                            Planilha sincronizada em tempo real
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ========================================================
          TAB 2: GERENCIAR CLASSES (CRUD: APENAS O NOME)
      ======================================================== */}
      {activeTab === 'manage_classes' && (
        <div className="space-y-6">
          
          {/* Header & New Class Form */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <School className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-black text-slate-900">Cadastro e Gestão de Classes</h2>
            </div>
            <p className="text-xs text-slate-500">
              Cadastre, renomeie ou exclua as classes da Escola Bíblica Dominical. Cada classe possui sua própria planilha de pedidos de lições.
            </p>

            {/* Quick Add Class Input Form */}
            <form onSubmit={handleCreateClass} className="flex flex-col sm:flex-row gap-3 pt-2">
              <input
                type="text"
                required
                placeholder="Nome da nova classe (ex: Classe Betel, Classe dos Homens, Jovens)..."
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                className="flex-1 px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
              <button
                type="submit"
                disabled={isClassSubmitting || !newClassName.trim()}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                {isClassSubmitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <PlusCircle className="w-4 h-4" />
                <span>Cadastrar Classe</span>
              </button>
            </form>

            {/* Default Class Presets Quick Generator */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Sugestões rápidas:</span>
              </span>
              {DEFAULT_CLASS_PRESETS.map(preset => {
                const alreadyAdded = classes.some(c => c.name.toLowerCase() === preset.toLowerCase());
                if (alreadyAdded) return null;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={async () => {
                      if (!currentUser) return;
                      await addDoc(collection(db, 'ebdClasses'), {
                        name: preset,
                        createdAt: new Date().toISOString(),
                        createdByUid: currentUser.uid,
                        createdByName: userProfile?.displayName || 'Secretaria'
                      });
                    }}
                    className="px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                  >
                    + {preset}
                  </button>
                );
              })}
            </div>
          </div>

          {/* List of Registered Classes */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Classes Cadastradas ({classes.length})
              </h3>
            </div>

            {classes.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Nenhuma classe cadastrada ainda. Utilize o campo acima para adicionar.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {classes.map(c => {
                  const isEditing = editingClass?.id === c.id;
                  const stats = classStatsMap.get(c.name);
                  const count = stats?.ordersCount || 0;

                  return (
                    <div key={c.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors">
                      {isEditing ? (
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="text"
                            value={editClassNameVal}
                            onChange={(e) => setEditClassNameVal(e.target.value)}
                            className="flex-1 px-3 py-1.5 text-xs bg-white border border-indigo-400 rounded-lg focus:outline-none ring-2 ring-indigo-500/20"
                            autoFocus
                          />
                          <button
                            onClick={handleSaveClassEdit}
                            disabled={isClassSubmitting || !editClassNameVal.trim()}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg cursor-pointer"
                          >
                            Salvar
                          </button>
                          <button
                            onClick={() => setEditingClass(null)}
                            className="px-3 py-1.5 text-slate-600 hover:bg-slate-200 text-xs font-semibold rounded-lg cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
                            <School className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 text-sm">{c.name}</span>
                            <div className="text-[11px] text-slate-400">
                              {count > 0 ? `${count} pedido(s) registrado(s)` : 'Nenhum pedido lançado ainda'}
                            </div>
                          </div>
                        </div>
                      )}

                      {!isEditing && (
                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <button
                            onClick={() => {
                              setSelectedClass(c);
                              setActiveTab('classes_orders');
                            }}
                            className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            <span>Abrir Planilha</span>
                          </button>

                          <button
                            onClick={() => {
                              setEditingClass(c);
                              setEditClassNameVal(c.name);
                            }}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Editar nome da classe"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteClass(c)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Remover classe"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 3: TABELA CONSOLIDADA GERAL (VISÃO DE TODAS AS CLASSES)
      ======================================================== */}
      {activeTab === 'consolidated' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight">Tabela Consolidada Geral</h2>
            <p className="text-xs text-slate-500">Resumo comparativo de todas as classes cadastradas na EBD</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Classe</th>
                  <th className="py-3 px-4 text-center">Total Pedidas</th>
                  <th className="py-3 px-4 text-center">Pagas</th>
                  <th className="py-3 px-4 text-center">Pendentes Pgto</th>
                  <th className="py-3 px-4 text-center">Retiradas</th>
                  <th className="py-3 px-4 text-center">A Retirar</th>
                  <th className="py-3 px-4 text-right">Valor Total</th>
                  <th className="py-3 px-4 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classConsolidations.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Nenhuma classe ou pedido registrado.
                    </td>
                  </tr>
                ) : (
                  classConsolidations.map(item => {
                    const classObj = classes.find(c => c.name === item.className);
                    return (
                      <tr key={item.className} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                          <span>{item.className}</span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-800 text-sm">
                          {item.totalRequested}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-700">
                          {item.totalPaid}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-amber-700">
                          {item.totalPendingPayment}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-blue-700">
                          {item.totalDelivered}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-indigo-700">
                          {item.totalPendingDelivery}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(item.totalAmount)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => {
                              if (classObj) {
                                setSelectedClass(classObj);
                                setActiveTab('classes_orders');
                              }
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg cursor-pointer"
                          >
                            Ver Planilha
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: ADICIONAR / EDITAR LINHA DE PEDIDO NA CLASSE
      ======================================================== */}
      {isOrderModalOpen && selectedClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    {editingOrder ? 'Editar Linha de Pedido' : 'Nova Linha de Pedido na Planilha'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Classe: <strong>{selectedClass.name}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOrderModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitOrder} className="p-6 space-y-4 overflow-y-auto flex-1">
              
              {/* Tipo da Lição */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tipo da Revista / Lição *
                </label>
                <select
                  value={formLessonType}
                  onChange={(e) => setFormLessonType(e.target.value as LessonType)}
                  className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white cursor-pointer"
                >
                  <option value="Adulto">Adulto</option>
                  <option value="Aluno">Aluno</option>
                  <option value="Jovens">Jovens</option>
                  <option value="Infantil">Infantil</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              {/* Quantidade e Preço Unitário Estimado */}
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
                    Preço Unitário Estimado (R$) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formUnitPrice}
                      onChange={(e) => setFormUnitPrice(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Total Estimado preview */}
              <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                <span className="text-emerald-900 font-medium">Total previsto desta linha:</span>
                <span className="text-emerald-950 font-black text-sm">
                  {formatCurrency((parseInt(formQuantity, 10) || 0) * (parseFloat(formUnitPrice.replace(',', '.')) || 0))}
                </span>
              </div>

              {/* Status de Pagamento Inicial */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Status de Pagamento
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormPaymentStatus('pago')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      formPaymentStatus === 'pago'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Pago</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormPaymentStatus('nao_pago')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      formPaymentStatus === 'nao_pago'
                        ? 'bg-amber-50 border-amber-500 text-amber-800 ring-2 ring-amber-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Não Pago</span>
                  </button>
                </div>
              </div>

              {/* Status de Retirada Inicial */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Status de Retirada (Controle de quem pegou)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormDeliveryStatus('retirado')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      formDeliveryStatus === 'retirado'
                        ? 'bg-blue-50 border-blue-500 text-blue-800 ring-2 ring-blue-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <PackageCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>Retirado</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormDeliveryStatus('nao_retirado')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      formDeliveryStatus === 'nao_retirado'
                        ? 'bg-slate-200 border-slate-400 text-slate-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <PackageX className="w-3.5 h-3.5 text-slate-400" />
                    <span>Não Retirado</span>
                  </button>
                </div>
              </div>

              {/* Observação / Nome do Aluno */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observações / Nome de quem pegou
                </label>
                <input
                  type="text"
                  placeholder="Ex: Entregue a Carlos, Revista Professor, etc..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              {/* Auto financeiro se já for pago */}
              {formPaymentStatus === 'pago' && !editingOrder && (
                <label className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={createFinancialEntry}
                    onChange={(e) => setCreateFinancialEntry(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                  />
                  <span className="text-slate-700">
                    Lançar receita automaticamente no <strong>Caixa de Lições</strong>
                  </span>
                </label>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOrderModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>{editingOrder ? 'Salvar Alterações' : 'Adicionar à Planilha'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: CONFIRMAR PAGAMENTO & LANÇAR NO CAIXA DE LIÇÕES
      ======================================================== */}
      {payModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-sm">Confirmar Pagamento</h3>
                  <p className="text-[11px] text-slate-500">{payModalOrder.className} • {payModalOrder.quantity}x {payModalOrder.lessonType}</p>
                </div>
              </div>
              <button
                onClick={() => setPayModalOrder(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Valor Pago (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={payAutoGenerateCashEntry}
                    onChange={(e) => setPayAutoGenerateCashEntry(e.target.checked)}
                    className="w-4 h-4 mt-0.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="font-bold text-emerald-950 block">
                      Lançar automaticamente no Caixa de Lições
                    </span>
                    <span className="text-[11px] text-emerald-700">
                      Gera um lançamento financeiro de entrada com a categoria "Compra de Revistas/Lições"
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPayModalOrder(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs flex items-center gap-2 cursor-pointer"
              >
                {isSubmitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <span>Confirmar Pagamento</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
