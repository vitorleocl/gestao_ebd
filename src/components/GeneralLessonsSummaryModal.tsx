import React, { useState, useMemo } from 'react';
import { 
  X, 
  MessageCircle, 
  FileDown, 
  Copy, 
  Check, 
  CheckSquare, 
  Square, 
  Filter, 
  Layers, 
  FileText,
  Boxes,
  ArrowUpRight
} from 'lucide-react';
import { EbdClass, LessonOrder } from '../types';
import { 
  formatGeneralWhatsAppMessage, 
  computeClassOrdersSummary, 
  openWhatsApp 
} from '../utils/lessonsSummary';
import { generateLessonsConsolidatedPdf } from '../utils/lessonsPdfReport';
import { formatCurrency } from '../utils/formatters';

interface GeneralLessonsSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: EbdClass[];
  orders: LessonOrder[];
  currentUserDisplayName?: string;
}

export const GeneralLessonsSummaryModal: React.FC<GeneralLessonsSummaryModalProps> = ({
  isOpen,
  onClose,
  classes,
  orders,
  currentUserDisplayName = 'Secretaria EBD'
}) => {
  // Identify which classes have at least one order
  const classesWithOrders = useMemo(() => {
    return classes.filter(c => {
      return orders.some(o => o.className === c.name || (o.classId && o.classId === c.id));
    });
  }, [classes, orders]);

  // Selected classes IDs (default to classes that have orders, or all if none)
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>(() => {
    if (classesWithOrders.length > 0) {
      return classesWithOrders.map(c => c.id);
    }
    return classes.map(c => c.id);
  });

  const [filterOnlyWithOrders, setFilterOnlyWithOrders] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [showTextPreview, setShowTextPreview] = useState(false);

  if (!isOpen) return null;

  // Filtered available classes to select from
  const availableClasses = filterOnlyWithOrders && classesWithOrders.length > 0
    ? classesWithOrders
    : classes;

  const selectedClasses = classes.filter(c => selectedClassIds.includes(c.id));

  // Compute selected metrics
  let grandTotalRequested = 0;
  let grandTotalPaid = 0;
  let grandTotalPendingPayment = 0;
  let grandTotalDelivered = 0;
  let grandTotalPendingDelivery = 0;
  let grandTotalAmount = 0;
  let grandPaidAmount = 0;
  let grandPendingAmount = 0;

  selectedClasses.forEach(c => {
    const s = computeClassOrdersSummary(c, orders);
    grandTotalRequested += s.totalRequested;
    grandTotalPaid += s.totalPaid;
    grandTotalPendingPayment += s.totalPendingPayment;
    grandTotalDelivered += s.totalDelivered;
    grandTotalPendingDelivery += s.totalPendingDelivery;
    grandTotalAmount += s.totalAmount;
    grandPaidAmount += s.paidAmount;
    grandPendingAmount += s.pendingAmount;
  });

  const toggleSelectClass = (id: string) => {
    setSelectedClassIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedClassIds(availableClasses.map(c => c.id));
  };

  const handleDeselectAll = () => {
    setSelectedClassIds([]);
  };

  const messageText = formatGeneralWhatsAppMessage(selectedClasses, orders);

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Erro ao copiar:', err);
    }
  };

  const handleSendWhatsApp = () => {
    if (selectedClasses.length === 0) return;
    navigator.clipboard.writeText(messageText).catch(() => {});
    openWhatsApp(messageText);
  };

  const handleDownloadPdf = () => {
    if (selectedClasses.length === 0) return;
    setIsGeneratingPdf(true);
    try {
      const doc = generateLessonsConsolidatedPdf({
        selectedClasses,
        allOrders: orders,
        generatedByName: currentUserDisplayName
      });
      const now = new Date();
      const dateStr = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}_${String(now.getDate()).padStart(2, '0')}`;
      doc.save(`relatorio_consolidado_licoes_ebd_${dateStr}.pdf`);
    } catch (err) {
      console.error('Erro ao gerar PDF de lições:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
              <Layers className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h3 className="font-black text-base text-white tracking-tight">Resumo Geral de Pedidos de Lições</h3>
              <p className="text-xs text-slate-300">
                Selecione as classes para exportar lista formatada no WhatsApp ou baixar relatório em PDF
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/20 text-white/80 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          
          {/* KPI Metrics of Selected Classes */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Classes</span>
              <span className="text-lg font-black text-slate-800">
                {selectedClasses.length} <span className="text-xs font-normal text-slate-400">/ {classes.length}</span>
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Revistas</span>
              <span className="text-lg font-black text-slate-800">{grandTotalRequested} un</span>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-emerald-700 block">Pagas</span>
              <span className="text-lg font-black text-emerald-800">{grandTotalPaid} un</span>
              <span className="text-[10px] text-emerald-600 block">{formatCurrency(grandPaidAmount)}</span>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-amber-700 block">Pendentes Pgto</span>
              <span className="text-lg font-black text-amber-800">{grandTotalPendingPayment} un</span>
              <span className="text-[10px] text-amber-600 block">{formatCurrency(grandPendingAmount)}</span>
            </div>

            <div className="col-span-2 sm:col-span-1 p-3 bg-indigo-50 border border-indigo-200 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-indigo-700 block">Valor Total Geral</span>
              <span className="text-lg font-black text-indigo-950">{formatCurrency(grandTotalAmount)}</span>
              <span className="text-[10px] text-indigo-600 block">{grandTotalPendingDelivery} a retirar</span>
            </div>
          </div>

          {/* Controls Bar for Class Selection */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={filterOnlyWithOrders}
                  onChange={(e) => setFilterOnlyWithOrders(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span>Apenas classes com pedidos realizados ({classesWithOrders.length})</span>
              </label>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={handleSelectAll}
                className="px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
              >
                Selecionar Todas
              </button>
              <span className="text-slate-300">•</span>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-lg transition cursor-pointer"
              >
                Desmarcar Todas
              </button>
            </div>
          </div>

          {/* Classes Checklist Grid */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>Selecione as classes para incluir no resumo:</span>
              <span className="text-[11px] font-normal text-slate-400">
                {selectedClasses.length} de {availableClasses.length} selecionada(s)
              </span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto p-1">
              {availableClasses.map(c => {
                const isSelected = selectedClassIds.includes(c.id);
                const classSummary = computeClassOrdersSummary(c, orders);
                const hasOrders = classSummary.orders.length > 0;

                return (
                  <div
                    key={c.id}
                    onClick={() => toggleSelectClass(c.id)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                      isSelected
                        ? 'bg-indigo-50/50 border-indigo-300 shadow-2xs'
                        : 'bg-white border-slate-200 hover:bg-slate-50 opacity-70'
                    }`}
                  >
                    <div className="pt-0.5">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="font-bold text-xs text-slate-900 truncate">{c.name}</h4>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                          {classSummary.totalRequested} un
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        Faixa: {c.ageGroup || 'Geral'}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-600">
                        <span className="text-emerald-700 font-semibold">{classSummary.totalPaid} pagas</span>
                        <span>•</span>
                        <span className="text-amber-700 font-semibold">{classSummary.totalPendingPayment} a pagar</span>
                        <span>•</span>
                        <span className="font-bold text-slate-800">{formatCurrency(classSummary.totalAmount)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Toggle text preview */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowTextPreview(!showTextPreview)}
              className="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1.5 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{showTextPreview ? 'Ocultar prévia da mensagem de WhatsApp' : 'Visualizar prévia da mensagem de WhatsApp'}</span>
            </button>

            {showTextPreview && (
              <div className="mt-2 space-y-2">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleCopyMessage}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                    <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
                  </button>
                </div>
                <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl text-xs font-mono whitespace-pre-wrap max-h-48 overflow-y-auto border border-slate-800 select-all leading-relaxed shadow-inner">
                  {messageText}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
          >
            Fechar
          </button>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            {/* Copy button */}
            <button
              type="button"
              onClick={handleCopyMessage}
              disabled={selectedClasses.length === 0}
              className="flex-1 sm:flex-initial px-3.5 py-2.5 text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl shadow-2xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
              <span>{copied ? 'Copiado' : 'Copiar'}</span>
            </button>

            {/* Download PDF button */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={selectedClasses.length === 0 || isGeneratingPdf}
              className="flex-1 sm:flex-initial px-4 py-2.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              {isGeneratingPdf ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <FileDown className="w-4 h-4 text-slate-300" />
              )}
              <span>Baixar Resumo em PDF</span>
            </button>

            {/* Send WhatsApp button */}
            <button
              type="button"
              onClick={handleSendWhatsApp}
              disabled={selectedClasses.length === 0}
              className="flex-1 sm:flex-initial px-4 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Enviar no WhatsApp</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-200" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
