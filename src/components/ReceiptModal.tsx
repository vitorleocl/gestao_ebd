import React, { useState } from 'react';
import { X, ExternalLink, FileText, PenTool, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import { formatDate } from '../utils/formatters';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string;
  signatureUrl?: string;
  signatureName?: string;
  signatureDate?: string;
  title?: string;
  description?: string;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  signatureUrl,
  signatureName,
  signatureDate,
  title = 'Comprovante & Documentos',
  description
}) => {
  const hasBoth = Boolean(imageUrl && signatureUrl);
  const [activeTab, setActiveTab] = useState<'receipt' | 'signature'>(
    imageUrl ? 'receipt' : 'signature'
  );

  if (!isOpen || (!imageUrl && !signatureUrl)) return null;

  const currentView = hasBoth ? activeTab : (imageUrl ? 'receipt' : 'signature');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              {currentView === 'receipt' ? <FileText className="w-4 h-4" /> : <PenTool className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">{title}</h3>
              {description && <p className="text-xs text-slate-500 line-clamp-1">{description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(currentView === 'receipt' ? imageUrl : signatureUrl) && (
              <a
                href={currentView === 'receipt' ? imageUrl : signatureUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                title="Abrir imagem em nova guia"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab switcher if both receipt and signature are attached */}
        {hasBoth && (
          <div className="flex border-b border-slate-200 bg-slate-100/70 p-1 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('receipt')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'receipt'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
              <span>Comprovante / Recibo</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('signature')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'signature'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PenTool className="w-3.5 h-3.5 text-emerald-600" />
              <span>Assinatura Digital</span>
            </button>
          </div>
        )}

        {/* Content area */}
        <div className="p-4 overflow-auto flex items-center justify-center bg-slate-950/5 min-h-[280px] max-h-[calc(90vh-140px)]">
          {currentView === 'receipt' && imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              className="max-h-full max-w-full rounded-lg object-contain shadow-sm"
            />
          ) : signatureUrl ? (
            <div className="w-full max-w-md bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 py-1 px-3 rounded-full w-fit mx-auto border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Assinatura Digital Registrada</span>
              </div>

              {/* Signature Graphic */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center">
                <img
                  src={signatureUrl}
                  alt="Assinatura Digital"
                  className="max-h-36 max-w-full object-contain filter drop-shadow-xs"
                />
              </div>

              {/* Signer Details */}
              <div className="space-y-1 text-xs border-t border-slate-100 pt-3">
                <div className="text-slate-900 font-bold text-sm">
                  {signatureName || 'Responsável pelo Lançamento'}
                </div>
                <div className="text-slate-400 text-[11px]">
                  {signatureDate ? `Assinado em ${formatDate(signatureDate)}` : 'Validação digital vinculada ao registro'}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-white flex justify-between items-center text-xs text-slate-500">
          <span>
            {currentView === 'receipt' ? 'Comprovante do lançamento' : 'Assinatura digital autenticada'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
