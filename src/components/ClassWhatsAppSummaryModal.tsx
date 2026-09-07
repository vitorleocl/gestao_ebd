import React, { useState } from 'react';
import { 
  X, 
  MessageCircle, 
  Copy, 
  Check, 
  Share2, 
  FileSpreadsheet, 
  CheckCircle2, 
  Clock, 
  PackageCheck,
  ArrowUpRight
} from 'lucide-react';
import { EbdClass, LessonOrder } from '../types';
import { formatClassWhatsAppMessage, computeClassOrdersSummary, openWhatsApp } from '../utils/lessonsSummary';
import { formatCurrency } from '../utils/formatters';

interface ClassWhatsAppSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  ebdClass: EbdClass | null;
  orders: LessonOrder[];
}

export const ClassWhatsAppSummaryModal: React.FC<ClassWhatsAppSummaryModalProps> = ({
  isOpen,
  onClose,
  ebdClass,
  orders
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !ebdClass) return null;

  const classOrders = orders.filter(o => o.className === ebdClass.name || (o.classId && o.classId === ebdClass.id));
  const summary = computeClassOrdersSummary(ebdClass, orders);
  const messageText = formatClassWhatsAppMessage(ebdClass, orders);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Erro ao copiar texto:', err);
    }
  };

  const handleSendWhatsApp = () => {
    // Also copy to clipboard for convenience
    navigator.clipboard.writeText(messageText).catch(() => {});
    openWhatsApp(messageText);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-700 to-teal-800 text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
              <MessageCircle className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Resumo para WhatsApp</h3>
              <p className="text-xs text-emerald-100/80">
                Classe: <span className="font-semibold text-white">{ebdClass.name}</span> {ebdClass.ageGroup ? `(${ebdClass.ageGroup})` : ''}
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
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Revistas</span>
              <span className="text-base font-black text-slate-800">{summary.totalRequested} un</span>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
              <span className="text-[10px] uppercase font-bold text-emerald-700 block">Pagas</span>
              <span className="text-base font-black text-emerald-800">{summary.totalPaid} un</span>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
              <span className="text-[10px] uppercase font-bold text-amber-700 block">A Pagar</span>
              <span className="text-base font-black text-amber-800">{summary.totalPendingPayment} un</span>
            </div>
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-center">
              <span className="text-[10px] uppercase font-bold text-indigo-700 block">Valor Total</span>
              <span className="text-base font-black text-indigo-900">{formatCurrency(summary.totalAmount)}</span>
            </div>
          </div>

          {/* Delivery quick pill */}
          <div className="flex items-center justify-between px-3 py-2 bg-blue-50/60 border border-blue-100 rounded-xl text-xs text-blue-900 font-medium">
            <span className="flex items-center gap-1.5">
              <PackageCheck className="w-4 h-4 text-blue-600" />
              <span>Status de Entrega:</span>
            </span>
            <span>
              <strong>{summary.totalDelivered}</strong> retiradas / <strong>{summary.totalPendingDelivery}</strong> a retirar
            </span>
          </div>

          {/* WhatsApp Text Preview Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">Prévia da Mensagem Formatada:</label>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Copiar Texto</span>
                  </>
                )}
              </button>
            </div>
            <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl text-xs font-mono whitespace-pre-wrap max-h-56 overflow-y-auto border border-slate-800 select-all leading-relaxed shadow-inner">
              {messageText}
            </div>
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

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 sm:flex-initial px-4 py-2.5 text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl shadow-2xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
              <span>{copied ? 'Copiado!' : 'Copiar'}</span>
            </button>

            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="flex-1 sm:flex-initial px-5 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs flex items-center justify-center gap-2 transition cursor-pointer"
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
