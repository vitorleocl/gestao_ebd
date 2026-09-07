import React, { useState, useEffect } from 'react';
import { 
  X, 
  PackageCheck, 
  PackageX, 
  User, 
  Calendar, 
  CheckCircle2, 
  AlertCircle,
  FileSpreadsheet
} from 'lucide-react';
import { LessonOrder, DeliveryStatus } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';

interface LessonDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: LessonOrder | null;
  onConfirmDelivery?: (orderId: string, deliveryStatus: DeliveryStatus, deliveredTo?: string) => Promise<void>;
  onSave?: (orderId: string, deliveryStatus: DeliveryStatus, deliveredTo: string, deliveredAt?: string) => Promise<void>;
}

export const LessonDeliveryModal: React.FC<LessonDeliveryModalProps> = ({
  isOpen,
  onClose,
  order,
  onConfirmDelivery,
  onSave
}) => {
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>('nao_retirado');
  const [deliveredTo, setDeliveredTo] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (order) {
      setDeliveryStatus(order.deliveryStatus || 'nao_retirado');
      setDeliveredTo(order.deliveredTo || '');
    }
  }, [order]);

  if (!isOpen || !order) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const cleanDeliveredTo = deliveryStatus === 'retirado' ? deliveredTo.trim() : '';
      if (onSave) {
        await onSave(order.id, deliveryStatus, cleanDeliveredTo);
      } else if (onConfirmDelivery) {
        await onConfirmDelivery(order.id, deliveryStatus, cleanDeliveredTo);
      }
      onClose();
    } catch (err) {
      console.error("Erro ao registrar retirada:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden flex flex-col shadow-2xl border border-slate-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
              <PackageCheck className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h3 className="font-black text-base text-white">Controle de Retirada</h3>
              <p className="text-xs text-blue-200">
                Quem pegou as lições da classe {order.className}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Order Summary Box */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Classe:</span>
              <span className="font-bold text-slate-900">{order.className}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Tipo da Revista:</span>
              <span className={`font-bold px-2 py-0.5 rounded-md text-[11px] ${
                order.lessonType === 'Professor'
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-indigo-100 text-indigo-800'
              }`}>
                {order.lessonType}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Quantidade Solicitada:</span>
              <span className="font-black text-slate-900 font-mono text-sm">{order.quantity} unidades</span>
            </div>
          </div>

          {/* Status Selection: Retirado vs Não Retirado */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Status da Retirada *
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setDeliveryStatus('retirado')}
                className={`p-3 rounded-2xl text-xs font-bold flex flex-col items-center justify-center gap-1.5 border-2 transition-all cursor-pointer ${
                  deliveryStatus === 'retirado'
                    ? 'bg-blue-50/80 border-blue-600 text-blue-900 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <PackageCheck className={`w-5 h-5 ${deliveryStatus === 'retirado' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>Lições Retiradas</span>
                <span className="text-[10px] font-normal text-slate-500">Entregue fisicamente</span>
              </button>

              <button
                type="button"
                onClick={() => setDeliveryStatus('nao_retirado')}
                className={`p-3 rounded-2xl text-xs font-bold flex flex-col items-center justify-center gap-1.5 border-2 transition-all cursor-pointer ${
                  deliveryStatus === 'nao_retirado'
                    ? 'bg-amber-50/80 border-amber-500 text-amber-900 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <PackageX className={`w-5 h-5 ${deliveryStatus === 'nao_retirado' ? 'text-amber-600' : 'text-slate-400'}`} />
                <span>Não Retirado</span>
                <span className="text-[10px] font-normal text-slate-500">Aguardando entrega</span>
              </button>
            </div>
          </div>

          {/* Campo aberto e opcional: Quem Pegou */}
          {deliveryStatus === 'retirado' && (
            <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-2xl space-y-2 animate-in fade-in">
              <label className="block text-xs font-bold text-blue-950">
                Quem pegou / retirou as lições? <span className="font-normal text-blue-700">(Opcional)</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" />
                <input
                  type="text"
                  value={deliveredTo}
                  onChange={(e) => setDeliveredTo(e.target.value)}
                  placeholder="Ex: Prof. Silas, Débora, Líder Marcos..."
                  className="w-full pl-9 pr-3 py-2 text-xs font-bold bg-white border border-blue-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>
              <p className="text-[11px] text-blue-700">
                Você pode informar o nome do professor, aluno ou responsável que levou as revistas.
              </p>
            </div>
          )}

          {deliveryStatus === 'nao_retirado' && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500">
              ℹ️ As {order.quantity} lições continuarão marcadas como pendentes de retirada na planilha da classe.
            </div>
          )}

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Salvando...' : 'Confirmar Retirada'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
