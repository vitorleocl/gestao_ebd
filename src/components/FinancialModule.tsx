import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  PlusCircle, 
  Search, 
  Filter, 
  ArrowUpRight, 
  ArrowDownRight, 
  CheckCircle, 
  Clock, 
  Image as ImageIcon, 
  Trash2, 
  UploadCloud, 
  X, 
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Wallet,
  Calendar,
  Layers,
  Camera,
  Tag,
  PenTool,
  CheckCircle2
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
  FinancialTransaction, 
  AccountType, 
  TransactionType, 
  TransactionStatus 
} from '../types';
import { formatCurrency, formatDate, getAccountName, getStatusBadge } from '../utils/formatters';
import { uploadReceiptImage } from '../utils/storage';
import { ReceiptModal } from './ReceiptModal';
import { DigitalSignaturePad } from './DigitalSignaturePad';

export const INCOME_CATEGORIES = [
  'Cota 5% Igreja',
  'Doações Especiais',
  'Sorteios/Rifas'
];

export const EXPENSE_CATEGORIES = [
  'Compra de Revistas/Lições',
  'Material Didático/Papelaria',
  'Alimentação/Lanche',
  'Festividades/Eventos',
  'Brindes e Premiações de Alunos',
  'Manutenção/Decoração de Salas',
  'Passagem/Despesas'
];

interface FinancialModuleProps {
  transactions: FinancialTransaction[];
  loading: boolean;
  onRefresh?: () => void;
}

export const FinancialModule: React.FC<FinancialModuleProps> = ({
  transactions,
  loading
}) => {
  const { currentUser, userProfile, isMaster, isDirigente } = useAuth();

  // Filters state
  const [selectedAccount, setSelectedAccount] = useState<'all' | AccountType>('all');
  const [selectedType, setSelectedType] = useState<'all' | TransactionType>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | TransactionStatus>('all');
  const [periodFilter, setPeriodFilter] = useState<'month' | 'year' | 'all'>('month');
  const [searchQuery, setSearchQuery] = useState('');

  // New Transaction Form Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formType, setFormType] = useState<TransactionType>('income');
  const [formAccount, setFormAccount] = useState<AccountType>('caixa_5');
  const [formCategory, setFormCategory] = useState<string>(INCOME_CATEGORIES[0]);
  const [formAmount, setFormAmount] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formDescription, setFormDescription] = useState<string>('');
  const [formFile, setFormFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [signatureSignerName, setSignatureSignerName] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [autoApprove, setAutoApprove] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Live Camera state & refs
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const directCameraInputRef = useRef<HTMLInputElement | null>(null);

  // Receipt & Signature Modal View
  const [viewReceipt, setViewReceipt] = useState<{ 
    url?: string; 
    signatureUrl?: string;
    signatureName?: string;
    signatureDate?: string;
    title: string; 
    description?: string 
  } | null>(null);

  // Approval/Delete Action State
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // Account filter
      if (selectedAccount !== 'all' && t.account !== selectedAccount) return false;
      // Type filter
      if (selectedType !== 'all' && t.type !== selectedType) return false;
      // Status filter
      if (selectedStatus !== 'all' && t.status !== selectedStatus) return false;

      // Period filter
      if (periodFilter !== 'all') {
        const transDate = new Date(t.date);
        const now = new Date();
        if (periodFilter === 'month') {
          if (transDate.getMonth() !== now.getMonth() || transDate.getFullYear() !== now.getFullYear()) {
            return false;
          }
        } else if (periodFilter === 'year') {
          if (transDate.getFullYear() !== now.getFullYear()) {
            return false;
          }
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesDesc = t.description.toLowerCase().includes(q);
        const matchesCreator = t.createdByName.toLowerCase().includes(q);
        const matchesAmount = t.amount.toString().includes(q);
        if (!matchesDesc && !matchesCreator && !matchesAmount) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, selectedAccount, selectedType, selectedStatus, periodFilter, searchQuery]);

  // Balance calculation (only approved transactions count for liquid balance)
  const balances = useMemo(() => {
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
    const totalBalance = balanceCaixa5 + balanceLicoes;

    return {
      caixa5: {
        balance: balanceCaixa5,
        income: incomeCaixa5,
        expense: expenseCaixa5
      },
      licoes: {
        balance: balanceLicoes,
        income: incomeLicoes,
        expense: expenseLicoes
      },
      totalBalance,
      pendingCount,
      pendingAmount
    };
  }, [transactions]);

  // Clean up camera stream if unmounting or modal closing
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleSelectType = (type: TransactionType) => {
    setFormType(type);
    if (type === 'income') {
      setFormCategory(INCOME_CATEGORIES[0]);
    } else {
      setFormCategory(EXPENSE_CATEGORIES[0]);
    }
  };

  // Live Camera Controls
  const startCamera = async () => {
    setCameraError(null);
    setIsCameraOpen(true);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Navegador sem suporte a câmera direta.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.warn("Camera live stream error:", err);
      setCameraError('Não foi possível iniciar o visor da câmera diretamente neste navegador. Clique abaixo para tirar a foto usando a câmera nativa do seu aparelho.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
    setCameraError(null);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) {
        const capturedFile = new File([blob], `comprovante_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setFormFile(capturedFile);
        setFilePreview(canvas.toDataURL('image/jpeg'));
      }
      stopCamera();
    }, 'image/jpeg', 0.85);
  };

  // Handle image file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFormFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeSelectedFile = () => {
    setFormFile(null);
    setFilePreview(null);
  };

  // Submit New Transaction
  const handleSubmitTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const amountNum = parseFloat(formAmount.replace(',', '.'));
    if (isNaN(amountNum) || amountNum <= 0) {
      setFormError('Por favor, informe um valor financeiro válido e maior que zero.');
      return;
    }

    if (!currentUser) {
      setFormError('Usuário não autenticado.');
      return;
    }

    setIsSubmitting(true);
    try {
      let receiptUrl: string | undefined = undefined;
      let receiptName: string | undefined = undefined;

      if (formFile) {
        const uploadResult = await uploadReceiptImage(formFile, (prog) => {
          setUploadProgress(prog);
        });
        receiptUrl = uploadResult.downloadUrl;
        receiptName = uploadResult.fileName;
      }

      // Permissions rule: Tesouraria always creates 'pending', Master/Dirigente can auto-approve
      const canDirectApprove = isMaster || isDirigente;
      const finalStatus: TransactionStatus = (canDirectApprove && autoApprove) ? 'approved' : 'pending';

      const finalDescription = formDescription.trim() || formCategory || (formType === 'income' ? 'Entrada financeira' : 'Saída financeira');

      const payload = {
        type: formType,
        account: formAccount,
        category: formCategory || (formType === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]),
        amount: amountNum,
        date: formDate,
        description: finalDescription,
        status: finalStatus,
        createdByUid: currentUser.uid,
        createdByName: userProfile?.displayName || currentUser.displayName || currentUser.email?.split('@')[0] || 'Usuário',
        createdByEmail: currentUser.email || '',
        createdAt: new Date().toISOString(),
        ...(receiptUrl ? { receiptUrl, receiptName } : {}),
        ...(signatureDataUrl ? {
          signatureUrl: signatureDataUrl,
          signatureName: signatureSignerName.trim() || userProfile?.displayName || currentUser.displayName || 'Responsável',
          signatureDate: new Date().toISOString()
        } : {}),
        ...(finalStatus === 'approved' ? {
          approvedByUid: currentUser.uid,
          approvedByName: userProfile?.displayName || currentUser.displayName || 'Admin',
          approvedAt: new Date().toISOString()
        } : {})
      };

      const transactionsRef = collection(db, 'transactions');
      await addDoc(transactionsRef, payload);

      // Reset form
      setFormAmount('');
      setFormDescription('');
      setFormFile(null);
      setFilePreview(null);
      setSignatureDataUrl(null);
      setSignatureSignerName('');
      setFormCategory(INCOME_CATEGORIES[0]);
      setUploadProgress(0);
      setIsModalOpen(false);

      setActionMessage({
        type: 'success',
        text: finalStatus === 'approved' 
          ? 'Lançamento registrado e aprovado com sucesso!' 
          : 'Lançamento registrado e aguardando validação do Dirigente/Master!'
      });
      setTimeout(() => setActionMessage(null), 5000);

    } catch (err: unknown) {
      console.error("Erro ao criar lançamento:", err);
      try {
        handleFirestoreError(err, OperationType.CREATE, 'transactions');
      } catch (fErr) {
        setFormError('Falha ao salvar lançamento no banco de dados. Verifique permissões.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Approve Transaction (MASTER / DIRIGENTE)
  const handleApproveTransaction = async (t: FinancialTransaction) => {
    if (!isMaster && !isDirigente) return;
    if (!currentUser) return;

    setActionLoadingId(t.id);
    try {
      const docRef = doc(db, 'transactions', t.id);
      await updateDoc(docRef, {
        status: 'approved',
        approvedByUid: currentUser.uid,
        approvedByName: userProfile?.displayName || currentUser.displayName || 'Dirigente',
        approvedAt: new Date().toISOString()
      });

      setActionMessage({
        type: 'success',
        text: `Lançamento de ${formatCurrency(t.amount)} aprovado com sucesso!`
      });
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: unknown) {
      console.error("Erro ao aprovar:", err);
      handleFirestoreError(err, OperationType.UPDATE, `transactions/${t.id}`);
      setActionMessage({
        type: 'error',
        text: 'Não foi possível aprovar o lançamento.'
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete Transaction (MASTER / DIRIGENTE)
  const handleDeleteTransaction = async (t: FinancialTransaction) => {
    if (!isMaster && !isDirigente) return;
    if (!window.confirm(`Deseja realmente excluir o lançamento "${t.description}" de ${formatCurrency(t.amount)}?`)) {
      return;
    }

    setActionLoadingId(t.id);
    try {
      const docRef = doc(db, 'transactions', t.id);
      await deleteDoc(docRef);

      setActionMessage({
        type: 'success',
        text: 'Lançamento excluído com sucesso.'
      });
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: unknown) {
      console.error("Erro ao excluir:", err);
      handleFirestoreError(err, OperationType.DELETE, `transactions/${t.id}`);
      setActionMessage({
        type: 'error',
        text: 'Não foi possível excluir o lançamento.'
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Toast Banner */}
      {actionMessage && (
        <div className={`p-4 rounded-xl flex items-center justify-between text-sm shadow-sm transition-all ${
          actionMessage.type === 'success' 
            ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' 
            : 'bg-rose-50 text-rose-900 border border-rose-200'
        }`}>
          <div className="flex items-center gap-2.5">
            {actionMessage.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600" />
            )}
            <span className="font-medium">{actionMessage.text}</span>
          </div>
          <button 
            onClick={() => setActionMessage(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & New Transaction Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Módulo Financeiro da EBD</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Controle dos Caixas 5% e Lições, extrato em tempo real e validações
          </p>
        </div>

        <button
          id="btn-novo-lancamento"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold rounded-xl shadow-sm shadow-indigo-100 transition-all cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Novo Lançamento</span>
        </button>
      </div>

      {/* Account Balances Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Caixa 5% Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                5%
              </div>
              <span className="font-bold text-slate-800 text-sm">Caixa 5%</span>
            </div>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              Saldo Líquido
            </span>
          </div>
          <div>
            <div className={`text-2xl font-extrabold tracking-tight ${balances.caixa5.balance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
              {formatCurrency(balances.caixa5.balance)}
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 grid grid-cols-2 text-xs">
            <div className="text-slate-500">
              <span className="block text-[11px]">Entradas:</span>
              <span className="font-semibold text-emerald-600">+{formatCurrency(balances.caixa5.income)}</span>
            </div>
            <div className="text-slate-500 text-right">
              <span className="block text-[11px]">Saídas:</span>
              <span className="font-semibold text-rose-600">-{formatCurrency(balances.caixa5.expense)}</span>
            </div>
          </div>
        </div>

        {/* Caixa de Lições Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                📖
              </div>
              <span className="font-bold text-slate-800 text-sm">Caixa de Lições</span>
            </div>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              Saldo Líquido
            </span>
          </div>
          <div>
            <div className={`text-2xl font-extrabold tracking-tight ${balances.licoes.balance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
              {formatCurrency(balances.licoes.balance)}
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 grid grid-cols-2 text-xs">
            <div className="text-slate-500">
              <span className="block text-[11px]">Entradas:</span>
              <span className="font-semibold text-emerald-600">+{formatCurrency(balances.licoes.income)}</span>
            </div>
            <div className="text-slate-500 text-right">
              <span className="block text-[11px]">Saídas:</span>
              <span className="font-semibold text-rose-600">-{formatCurrency(balances.licoes.expense)}</span>
            </div>
          </div>
        </div>

        {/* Total Consolidado & Pendências */}
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-indigo-300" />
              <span className="font-bold text-sm text-slate-100">Total Consolidado</span>
            </div>
            {balances.pendingCount > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 animate-pulse">
                {balances.pendingCount} pendente{balances.pendingCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div>
            <div className="text-2xl font-extrabold tracking-tight text-white">
              {formatCurrency(balances.totalBalance)}
            </div>
          </div>
          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-indigo-200">
            <span>Aguardando Validação:</span>
            <span className="font-bold text-amber-300">{formatCurrency(balances.pendingAmount)}</span>
          </div>
        </div>

      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        
        {/* Account Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
          <button
            onClick={() => setSelectedAccount('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              selectedAccount === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todos os Caixas
          </button>
          <button
            onClick={() => setSelectedAccount('caixa_5')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              selectedAccount === 'caixa_5'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Caixa 5%
          </button>
          <button
            onClick={() => setSelectedAccount('caixa_licoes')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              selectedAccount === 'caixa_licoes'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Caixa de Lições
          </button>

          {/* Pending only quick pill */}
          {balances.pendingCount > 0 && (
            <button
              onClick={() => setSelectedStatus(selectedStatus === 'pending' ? 'all' : 'pending')}
              className={`ml-auto px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedStatus === 'pending'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Pendentes ({balances.pendingCount})</span>
            </button>
          )}
        </div>

        {/* Secondary Filters & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por descrição ou autor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
            />
          </div>

          {/* Period filter */}
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as 'month' | 'year' | 'all')}
              className="w-full py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="month">Este Mês Atual</option>
              <option value="year">Este Ano</option>
              <option value="all">Todo o Histórico</option>
            </select>
          </div>

          {/* Type filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as 'all' | TransactionType)}
              className="w-full py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Entradas e Saídas</option>
              <option value="income">Apenas Entradas (+)</option>
              <option value="expense">Apenas Saídas (-)</option>
            </select>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as 'all' | TransactionStatus)}
              className="w-full py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Todos os Status</option>
              <option value="approved">Apenas Aprovados</option>
              <option value="pending">Apenas Pendentes</option>
            </select>
          </div>

        </div>

      </div>

      {/* Transactions List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">
            Extrato de Lançamentos ({filteredTransactions.length})
          </h3>
          <span className="text-xs text-slate-500">
            {selectedAccount === 'all' ? 'Ambos os Caixas' : getAccountName(selectedAccount)}
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs">Carregando extrato financeiro...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Wallet className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Nenhum lançamento encontrado</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Não há transações cadastradas para os filtros selecionados. Clique em "Novo Lançamento" para cadastrar.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredTransactions.map(t => {
              const isIncome = t.type === 'income';
              const statusBadge = getStatusBadge(t.status);
              const isProcessing = actionLoadingId === t.id;

              return (
                <div 
                  key={t.id} 
                  className={`p-4 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    t.status === 'pending' ? 'bg-amber-50/30' : ''
                  }`}
                >
                  
                  {/* Left: Icon, Description, Metadata */}
                  <div className="flex items-start gap-3.5">
                    <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center font-bold shadow-xs ${
                      isIncome 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-rose-100 text-rose-700'
                    }`}>
                      {isIncome ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900 text-sm">{t.description}</span>
                        
                        {/* Account Badge */}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          t.account === 'caixa_5' 
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {getAccountName(t.account)}
                        </span>

                        {/* Category Badge */}
                        {t.category && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                            <Tag className="w-2.5 h-2.5 text-slate-400" />
                            <span>{t.category}</span>
                          </span>
                        )}

                        {/* Signature Indicator Badge */}
                        {t.signatureUrl && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1" title={`Assinado por ${t.signatureName || t.createdByName}`}>
                            <PenTool className="w-2.5 h-2.5 text-emerald-600" />
                            <span>Assinado</span>
                          </span>
                        )}

                        {/* Status Badge */}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge.bg} ${statusBadge.color} ${statusBadge.border}`}>
                          {statusBadge.label}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span>{formatDate(t.date)}</span>
                        <span>•</span>
                        <span>Por: <strong className="text-slate-700 font-medium">{t.createdByName}</strong></span>
                        {t.approvedByName && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-700 font-medium">Validado por: {t.approvedByName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Amount & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pl-13 sm:pl-0">
                    
                    {/* Amount */}
                    <div className="text-left sm:text-right">
                      <span className={`text-base font-extrabold tracking-tight ${
                        isIncome ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {isIncome ? '+' : '-'}{formatCurrency(t.amount)}
                      </span>
                    </div>

                    {/* Receipt & Signature preview button */}
                    {(t.receiptUrl || t.signatureUrl) && (
                      <button
                        onClick={() => setViewReceipt({
                          url: t.receiptUrl,
                          signatureUrl: t.signatureUrl,
                          signatureName: t.signatureName,
                          signatureDate: t.signatureDate || t.createdAt,
                          title: t.description,
                          description: `${getAccountName(t.account)} — ${formatCurrency(t.amount)} (${formatDate(t.date)})`
                        })}
                        title="Visualizar comprovante e/ou assinatura digital"
                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg border border-indigo-200 flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                      >
                        {t.receiptUrl ? (
                          <ImageIcon className="w-3.5 h-3.5" />
                        ) : (
                          <PenTool className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                        <span className="hidden sm:inline">
                          {t.receiptUrl && t.signatureUrl ? 'Anexos (2)' : t.receiptUrl ? 'Comprovante' : 'Assinatura'}
                        </span>
                      </button>
                    )}

                    {/* Approvals (Master/Dirigente only) */}
                    {(isMaster || isDirigente) && t.status === 'pending' && (
                      <button
                        disabled={isProcessing}
                        onClick={() => handleApproveTransaction(t)}
                        title="Aprovar e validar este lançamento"
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Aprovar</span>
                      </button>
                    )}

                    {/* Delete action (Master/Dirigente only) */}
                    {(isMaster || isDirigente) && (
                      <button
                        disabled={isProcessing}
                        onClick={() => handleDeleteTransaction(t)}
                        title="Excluir lançamento"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* NEW TRANSACTION MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div 
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">Novo Lançamento Financeiro</h3>
                <p className="text-xs text-slate-500">Registre uma entrada ou saída no caixa da EBD</p>
              </div>
              <button
                onClick={() => !isSubmitting && setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitTransaction} className="p-6 space-y-4 overflow-y-auto">
              
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Type Switcher (Entrada / Saída) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tipo de Movimentação *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectType('income')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                      formType === 'income'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                    <span>Entrada (Receita)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectType('expense')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                      formType === 'expense'
                        ? 'bg-rose-50 border-rose-500 text-rose-700 ring-2 ring-rose-500/20 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4 text-rose-600" />
                    <span>Saída (Despesa)</span>
                  </button>
                </div>
              </div>

              {/* Categoria do Lançamento */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Categoria *
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white cursor-pointer"
                >
                  {(formType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  {formType === 'income' ? 'Categorias oficiais de entrada' : 'Categorias oficiais de saída'}
                </span>
              </div>

              {/* Account Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Caixa de Destino/Origem *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormAccount('caixa_5')}
                    className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                      formAccount === 'caixa_5'
                        ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-xs font-bold text-indigo-950">Caixa 5%</div>
                    <div className="text-[11px] text-slate-500">Recurso dos 5% da EBD</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormAccount('caixa_licoes')}
                    className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                      formAccount === 'caixa_licoes'
                        ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-xs font-bold text-emerald-950">Caixa de Lições</div>
                    <div className="text-[11px] text-slate-500">Venda e compra de revistas</div>
                  </button>
                </div>
              </div>

              {/* Valor e Data */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Valor (R$) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="0,00"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Data do Lançamento *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Descrição (Opcional) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Descrição / Histórico <span className="font-normal text-slate-400">(Opcional)</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Pode deixar em branco</span>
                </div>
                <textarea
                  rows={2}
                  placeholder="Opcional - detalhamento ou histórico adicional do lançamento..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white resize-none"
                />
              </div>

              {/* Assinatura Digital Escrita */}
              <DigitalSignaturePad
                initialSignerName={userProfile?.displayName || currentUser?.displayName || ''}
                onSignatureChange={(dataUrl, name) => {
                  setSignatureDataUrl(dataUrl);
                  setSignatureSignerName(name);
                }}
                disabled={isSubmitting}
              />

              {/* Comprovante / Anexo */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Comprovante (Imagem / Recibo)
                </label>
                
                {filePreview ? (
                  <div className="relative p-2.5 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <img src={filePreview} alt="Preview" className="w-12 h-12 rounded-lg object-cover border border-slate-300 shrink-0" />
                      <div className="truncate text-xs font-medium text-slate-700">
                        {formFile?.name || 'Comprovante capturado'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={removeSelectedFile}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                      title="Remover comprovante"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {/* Botão Tirar Foto Agora */}
                      <button
                        type="button"
                        onClick={startCamera}
                        className="p-3 border-2 border-dashed border-indigo-200 hover:border-indigo-500 rounded-xl flex flex-col items-center justify-center gap-1.5 bg-indigo-50/40 hover:bg-indigo-50 transition-all cursor-pointer text-indigo-950"
                      >
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                          <Camera className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-indigo-900">Tirar Foto Agora</span>
                        <span className="text-[10px] text-indigo-500 text-center">Usar câmera do aparelho</span>
                      </button>

                      {/* Botão Selecionar Arquivo */}
                      <label className="p-3 border-2 border-dashed border-slate-200 hover:border-slate-400 rounded-xl flex flex-col items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer text-slate-700">
                        <div className="w-8 h-8 rounded-lg bg-slate-200/70 text-slate-600 flex items-center justify-center">
                          <UploadCloud className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-800">Escolher Arquivo</span>
                        <span className="text-[10px] text-slate-400 text-center">Galeria ou documento</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {/* Fallback direto de câmera mobile */}
                    <input
                      ref={directCameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                )}

                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="mt-2 space-y-1">
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-indigo-600 h-full transition-all" style={{ width: `${uploadProgress}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-500">Enviando imagem: {uploadProgress}%</span>
                  </div>
                )}
              </div>

              {/* Status / Direct Approval Notice */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                {isMaster || isDirigente ? (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoApprove}
                      onChange={(e) => setAutoApprove(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    <span className="font-semibold text-slate-800">
                      Aprovar lançamento de imediato (perfil {userProfile?.role})
                    </span>
                  </label>
                ) : (
                  <div className="flex items-start gap-2 text-amber-800">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Como <strong>TESOURARIA</strong>, este lançamento ficará <em>pendente de validação</em> até ser aprovado por um Dirigente ou Master.
                    </span>
                  </div>
                )}
                <div className="text-[11px] text-slate-400">
                  Responsável registrado: <strong>{userProfile?.displayName || currentUser?.email}</strong>
                </div>
              </div>

              {/* Submit Buttons */}
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
                  className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-colors disabled:opacity-60 flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>Salvar Lançamento</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* RECEIPT & SIGNATURE VIEW MODAL */}
      <ReceiptModal
        isOpen={!!viewReceipt}
        onClose={() => setViewReceipt(null)}
        imageUrl={viewReceipt?.url}
        signatureUrl={viewReceipt?.signatureUrl}
        signatureName={viewReceipt?.signatureName}
        signatureDate={viewReceipt?.signatureDate}
        title={viewReceipt?.title}
        description={viewReceipt?.description}
      />

      {/* LIVE CAMERA CAPTURE MODAL */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden max-w-md w-full text-white shadow-2xl space-y-3 p-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-200">
                <Camera className="w-4 h-4 text-indigo-400" />
                <span>Fotografar Comprovante / Recibo</span>
              </div>
              <button 
                type="button"
                onClick={stopCamera}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {cameraError ? (
              <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-slate-300 space-y-3 text-center">
                <p>{cameraError}</p>
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    directCameraInputRef.current?.click();
                  }}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs cursor-pointer shadow-sm inline-flex items-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  <span>Abrir Câmera do Sistema</span>
                </button>
              </div>
            ) : (
              <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3] flex items-center justify-center border border-slate-800">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-4 border-2 border-dashed border-white/40 pointer-events-none rounded-lg flex items-center justify-center">
                  <span className="text-[11px] font-semibold text-white/80 bg-black/50 px-2.5 py-1 rounded-full backdrop-blur-xs">
                    Posicione o recibo aqui
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={stopCamera}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              {!cameraError && (
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Capturar Foto</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
