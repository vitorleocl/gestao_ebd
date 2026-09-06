import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  UploadCloud, 
  Camera, 
  Trash2, 
  AlertCircle, 
  Clock, 
  RotateCcw, 
  PenTool, 
  CheckCircle2,
  FileText,
  DollarSign,
  Calendar,
  Layers,
  Tag,
  ImageIcon
} from 'lucide-react';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { 
  FinancialTransaction, 
  AccountType, 
  TransactionType, 
  TransactionStatus 
} from '../types';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from './FinancialModule';
import { uploadReceiptImage } from '../utils/storage';
import { DigitalSignaturePad } from './DigitalSignaturePad';

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: FinancialTransaction | null;
  onSuccess: (message: string) => void;
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  isOpen,
  onClose,
  transaction,
  onSuccess
}) => {
  const { currentUser, userProfile, isMaster, isDirigente } = useAuth();

  // Form states
  const [formType, setFormType] = useState<TransactionType>('income');
  const [formAccount, setFormAccount] = useState<AccountType>('caixa_5');
  const [formCategory, setFormCategory] = useState<string>(INCOME_CATEGORIES[0]);
  const [formAmount, setFormAmount] = useState<string>('');
  const [formDate, setFormDate] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');

  // Receipt state
  const [formFile, setFormFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [keepExistingReceipt, setKeepExistingReceipt] = useState<boolean>(true);

  // Digital Signature state
  const [showSignaturePad, setShowSignaturePad] = useState<boolean>(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [signatureSignerName, setSignatureSignerName] = useState<string>('');
  const [keepExistingSignature, setKeepExistingSignature] = useState<boolean>(true);

  // Camera capture input
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingStatusText, setSubmittingStatusText] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // Populate form fields whenever a new transaction is selected
  useEffect(() => {
    if (transaction && isOpen) {
      setFormType(transaction.type);
      setFormAccount(transaction.account);
      setFormCategory(
        transaction.category || 
        (transaction.type === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0])
      );
      setFormAmount(transaction.amount.toString());
      setFormDate(transaction.date || new Date().toISOString().split('T')[0]);
      setFormDescription(transaction.description || '');

      setFormFile(null);
      setFilePreview(transaction.receiptUrl || null);
      setKeepExistingReceipt(!!transaction.receiptUrl);

      setShowSignaturePad(false);
      setSignatureDataUrl(transaction.signatureUrl || null);
      setSignatureSignerName(transaction.signatureName || '');
      setKeepExistingSignature(!!transaction.signatureUrl);

      setFormError(null);
    }
  }, [transaction, isOpen]);

  if (!isOpen || !transaction) return null;

  const handleTypeChange = (type: TransactionType) => {
    setFormType(type);
    if (type === 'income') {
      setFormCategory(INCOME_CATEGORIES[0]);
    } else {
      setFormCategory(EXPENSE_CATEGORIES[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFormFile(file);
      setKeepExistingReceipt(false);
      const reader = new FileReader();
      reader.onload = () => setFilePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveReceipt = () => {
    setFormFile(null);
    setFilePreview(null);
    setKeepExistingReceipt(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleRemoveSignature = () => {
    setSignatureDataUrl(null);
    setSignatureSignerName('');
    setKeepExistingSignature(false);
    setShowSignaturePad(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const amountNum = parseFloat(formAmount.replace(',', '.'));
    if (isNaN(amountNum) || amountNum <= 0) {
      setFormError('Por favor, informe um valor numérico válido e maior que zero.');
      return;
    }

    if (!currentUser) {
      setFormError('Usuário não autenticado.');
      return;
    }

    setIsSubmitting(true);
    setSubmittingStatusText('Iniciando...');

    try {
      let finalReceiptUrl: string | null = null;
      let finalReceiptName: string | null = null;

      if (formFile) {
        setSubmittingStatusText('Otimizando imagem...');
        const uploadResult = await uploadReceiptImage(
          formFile,
          undefined,
          (status) => setSubmittingStatusText(status)
        );
        finalReceiptUrl = uploadResult.downloadUrl;
        finalReceiptName = uploadResult.fileName;
      } else if (keepExistingReceipt && transaction.receiptUrl) {
        finalReceiptUrl = transaction.receiptUrl;
        finalReceiptName = transaction.receiptName || 'comprovante.jpg';
      }

      let finalSignatureUrl: string | null = null;
      let finalSignatureName: string | null = null;
      let finalSignatureDate: string | null = null;

      if (signatureDataUrl && (!transaction.signatureUrl || signatureDataUrl !== transaction.signatureUrl)) {
        finalSignatureUrl = signatureDataUrl;
        finalSignatureName = signatureSignerName.trim() || userProfile?.displayName || currentUser.displayName || 'Responsável';
        finalSignatureDate = new Date().toISOString();
      } else if (keepExistingSignature && transaction.signatureUrl) {
        finalSignatureUrl = transaction.signatureUrl;
        finalSignatureName = transaction.signatureName || 'Responsável';
        finalSignatureDate = transaction.signatureDate || transaction.createdAt;
      }

      setSubmittingStatusText('Gravando alterações no banco...');

      const finalDescription = formDescription.trim() || formCategory || (formType === 'income' ? 'Entrada financeira' : 'Saída financeira');

      // Crucial: The user specified that upon editing, the transaction must subsequently be re-approved.
      // Therefore, status is reset to 'pending', and previous approval credentials are removed.
      const updatePayload: Record<string, any> = {
        type: formType,
        account: formAccount,
        category: formCategory || (formType === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]),
        amount: amountNum,
        date: formDate,
        description: finalDescription,
        status: 'pending' as TransactionStatus,
        updatedAt: new Date().toISOString(),
        updatedByUid: currentUser.uid,
        updatedByName: userProfile?.displayName || currentUser.displayName || currentUser.email || 'Usuário',
        // Clear old approval data so it must be evaluated anew
        approvedByUid: deleteField(),
        approvedByName: deleteField(),
        approvedAt: deleteField()
      };

      if (finalReceiptUrl) {
        updatePayload.receiptUrl = finalReceiptUrl;
        updatePayload.receiptName = finalReceiptName;
      } else {
        updatePayload.receiptUrl = deleteField();
        updatePayload.receiptName = deleteField();
      }

      if (finalSignatureUrl) {
        updatePayload.signatureUrl = finalSignatureUrl;
        updatePayload.signatureName = finalSignatureName;
        updatePayload.signatureDate = finalSignatureDate;
      } else {
        updatePayload.signatureUrl = deleteField();
        updatePayload.signatureName = deleteField();
        updatePayload.signatureDate = deleteField();
      }

      const transDocRef = doc(db, 'transactions', transaction.id);
      await updateDoc(transDocRef, updatePayload);

      onSuccess('Lançamento atualizado com sucesso! O status retornou para "Pendente" para reavaliação e aprovação.');
      onClose();

    } catch (err: unknown) {
      console.error("Erro ao atualizar transação:", err);
      handleFirestoreError(err, OperationType.UPDATE, `transactions/${transaction.id}`);
      setFormError(err instanceof Error ? err.message : 'Falha ao salvar as alterações. Verifique sua conexão.');
    } finally {
      setIsSubmitting(false);
      setSubmittingStatusText('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Editar Lançamento</h3>
              <p className="text-xs text-slate-500">
                Altere os dados informados para posterior reavaliação
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Re-approval Notice Banner */}
        <div className="bg-amber-50 border-b border-amber-200/70 px-5 py-2.5 flex items-center gap-2.5 text-xs text-amber-800">
          <Clock className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Aviso de Auditoria:</strong> Ao salvar a edição, o status deste lançamento retornará para <strong>Pendente</strong> para ser aprovado novamente pelo Dirigente ou Master.
          </span>
        </div>

        {/* Error Alert */}
        {formError && (
          <div className="m-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          
          {/* Transaction Type */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Tipo de Movimentação
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleTypeChange('income')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  formType === 'income'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${formType === 'income' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                <span>Entrada (+)</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('expense')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  formType === 'expense'
                    ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${formType === 'expense' ? 'bg-rose-500' : 'bg-slate-300'}`} />
                <span>Saída (-)</span>
              </button>
            </div>
          </div>

          {/* Account / Caixa */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>Caixa de Destino / Origem</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormAccount('caixa_5')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  formAccount === 'caixa_5'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-bold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>Caixa 5%</span>
              </button>

              <button
                type="button"
                onClick={() => setFormAccount('caixa_licoes')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  formAccount === 'caixa_licoes'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-bold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>Caixa de Lições</span>
              </button>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-slate-500" />
              <span>Categoria</span>
            </label>
            <select
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {(formType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Amount and Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-slate-500" />
                <span>Valor (R$) *</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0,00"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Data do Lançamento *</span>
              </label>
              <input
                type="date"
                required
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Description / Histórico */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">
                Descrição / Histórico
              </label>
              <span className="text-[11px] text-slate-400 font-medium">Opcional</span>
            </div>
            <input
              type="text"
              placeholder="Ex: Cota mensal da classe dos adultos"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* RECEIPT ATTACHMENT SECTION */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
              <span>Comprovante / Imagem do Recibo</span>
            </label>

            {filePreview ? (
              <div className="relative rounded-xl border border-slate-200 overflow-hidden bg-slate-50 p-2">
                <div className="flex items-center gap-3">
                  <img 
                    src={filePreview} 
                    alt="Preview do Comprovante" 
                    className="w-16 h-16 object-cover rounded-lg border border-slate-200 shrink-0" 
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">
                      {formFile ? formFile.name : (transaction.receiptName || 'Comprovante anexado')}
                    </p>
                    <p className="text-[11px] text-emerald-600 font-medium">
                      {formFile ? 'Novo arquivo selecionado' : 'Arquivo atual mantido'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveReceipt}
                    title="Remover comprovante"
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <label className="p-3 border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer bg-slate-50/50 hover:bg-indigo-50/20 transition-all text-center">
                  <UploadCloud className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-semibold text-slate-700">Escolher Arquivo</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>

                <label className="p-3 border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer bg-slate-50/50 hover:bg-indigo-50/20 transition-all text-center">
                  <Camera className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-semibold text-slate-700">Tirar Foto</span>
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>

          {/* DIGITAL SIGNATURE SECTION */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <PenTool className="w-3.5 h-3.5 text-indigo-600" />
                <span>Assinatura Digital</span>
              </label>

              {signatureDataUrl && !showSignaturePad && (
                <button
                  type="button"
                  onClick={() => setShowSignaturePad(true)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                >
                  Assinar Novamente
                </button>
              )}
            </div>

            {signatureDataUrl && !showSignaturePad ? (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-10 bg-white border border-slate-200 rounded-lg flex items-center justify-center overflow-hidden p-1">
                    <img src={signatureDataUrl} alt="Assinatura" className="max-h-full max-w-full object-contain" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Assinatura Digital Gravada</p>
                    <p className="text-[11px] text-slate-500">
                      Signatário: {signatureSignerName || transaction.signatureName || 'Responsável'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveSignature}
                  title="Remover assinatura"
                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : showSignaturePad ? (
              <div className="space-y-2">
                <DigitalSignaturePad
                  initialSignerName={signatureSignerName || userProfile?.displayName || currentUser?.displayName || ''}
                  onSignatureChange={(url, name) => {
                    setSignatureDataUrl(url);
                    setSignatureSignerName(name);
                    setKeepExistingSignature(false);
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowSignaturePad(false)}
                  className="text-xs text-slate-500 hover:text-slate-700 font-medium cursor-pointer"
                >
                  Cancelar alteração de assinatura
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowSignaturePad(true)}
                className="w-full py-2.5 px-3 border border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/20 rounded-xl text-xs font-bold text-slate-600 hover:text-indigo-700 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <PenTool className="w-4 h-4 text-indigo-600" />
                <span>Coletar Assinatura Digital do Responsável</span>
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-colors disabled:opacity-60 flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting && (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
              )}
              <span>{isSubmitting ? (submittingStatusText || 'Salvando...') : 'Salvar e Enviar para Aprovação'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
