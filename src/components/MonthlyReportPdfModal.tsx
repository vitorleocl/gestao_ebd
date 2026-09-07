import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  X, 
  Calendar, 
  CheckCircle2, 
  ArrowDownRight, 
  ArrowUpRight, 
  Wallet,
  AlertCircle
} from 'lucide-react';
import { FinancialTransaction, AccountType } from '../types';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/formatters';
import { generateMonthlyFinancialReportPdf, parseTransactionDate } from '../utils/pdfReport';

interface MonthlyReportPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: FinancialTransaction[];
}

const MONTHS = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' }
];

export const MonthlyReportPdfModal: React.FC<MonthlyReportPdfModalProps> = ({
  isOpen,
  onClose,
  transactions
}) => {
  const { currentUser, userProfile, userRole } = useAuth();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedAccount, setSelectedAccount] = useState<'all' | AccountType>('all');
  const [isGenerating, setIsGenerating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Compute available years from transactions plus current year
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>([now.getFullYear()]);
    transactions.forEach(t => {
      const p = parseTransactionDate(t.date);
      if (p) yearsSet.add(p.year);
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [transactions]);

  // Compute live statistics for the selected month/year/account
  const monthStats = useMemo(() => {
    let income = 0;
    let expense = 0;
    let count = 0;

    const approved = transactions.filter(t => t.status === 'approved');

    approved.forEach(t => {
      const p = parseTransactionDate(t.date);
      if (!p) return;

      if (p.year === selectedYear && p.month === selectedMonth) {
        if (selectedAccount === 'all' || t.account === selectedAccount) {
          count++;
          if (t.type === 'income') {
            income += t.amount;
          } else {
            expense += t.amount;
          }
        }
      }
    });

    return {
      income,
      expense,
      balance: income - expense,
      count
    };
  }, [transactions, selectedMonth, selectedYear, selectedAccount]);

  if (!isOpen) return null;

  const handleDownloadPdf = () => {
    setIsGenerating(true);
    setFeedback(null);
    try {
      const doc = generateMonthlyFinancialReportPdf({
        transactions,
        month: selectedMonth,
        year: selectedYear,
        accountFilter: selectedAccount,
        generatedByName: userProfile?.displayName || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Tesouraria',
        generatedByRole: userRole || 'Tesouraria'
      });

      const monthStr = String(selectedMonth).padStart(2, '0');
      const filename = `Relatorio_Financeiro_EBD_${monthStr}_${selectedYear}.pdf`;
      doc.save(filename);
      setFeedback(`Relatório baixado com sucesso: ${filename}`);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      setFeedback('Ocorreu um erro ao gerar o relatório em PDF.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePreviewPdf = () => {
    setIsGenerating(true);
    setFeedback(null);
    try {
      const doc = generateMonthlyFinancialReportPdf({
        transactions,
        month: selectedMonth,
        year: selectedYear,
        accountFilter: selectedAccount,
        generatedByName: userProfile?.displayName || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Tesouraria',
        generatedByRole: userRole || 'Tesouraria'
      });

      const pdfBlob = doc.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      window.open(blobUrl, '_blank');
      setFeedback('Relatório aberto para visualização e impressão.');
    } catch (err) {
      console.error('Erro ao visualizar PDF:', err);
      setFeedback('Ocorreu um erro ao abrir o relatório.');
    } finally {
      setIsGenerating(false);
    }
  };

  const setPreviousMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };

  const setCurrentMonth = () => {
    setSelectedMonth(now.getMonth() + 1);
    setSelectedYear(now.getFullYear());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-950 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-950/20">
              <FileText className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                Relatório Financeiro Mensal (PDF)
              </h3>
              <p className="text-xs text-slate-500">
                IEADALPE JDPBX — Escola Bíblica Dominical
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

        {/* Form Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          
          {/* Quick Presets */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Atalhos:</span>
            <button
              type="button"
              onClick={setCurrentMonth}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
            >
              Mês Atual
            </button>
            <button
              type="button"
              onClick={setPreviousMonth}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
            >
              Mês Anterior
            </button>
          </div>

          {/* Month & Year Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mês de Referência *
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white cursor-pointer"
              >
                {MONTHS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Ano *
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white cursor-pointer"
              >
                {availableYears.map(yr => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Account Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Escopo do Relatório
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedAccount('all')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                  selectedAccount === 'all'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-900 ring-2 ring-indigo-500/20'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Geral (Todos)
              </button>
              <button
                type="button"
                onClick={() => setSelectedAccount('caixa_5')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                  selectedAccount === 'caixa_5'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-900 ring-2 ring-indigo-500/20'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Caixa 5%
              </button>
              <button
                type="button"
                onClick={() => setSelectedAccount('caixa_licoes')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                  selectedAccount === 'caixa_licoes'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-900 ring-2 ring-indigo-500/20'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Caixa Lições
              </button>
            </div>
          </div>

          {/* Month Overview Summary Cards */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-bold text-slate-700 uppercase tracking-wide text-[11px]">
                Prévia de {MONTHS[selectedMonth - 1]?.label} / {selectedYear}
              </span>
              <span>{monthStats.count} lançamento(s) aprovado(s)</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-emerald-700 block">Entradas</span>
                <span className="text-xs font-black text-emerald-600">
                  {formatCurrency(monthStats.income)}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-rose-700 block">Saídas</span>
                <span className="text-xs font-black text-rose-600">
                  {formatCurrency(monthStats.expense)}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-600 block">Saldo Mês</span>
                <span className={`text-xs font-black ${monthStats.balance >= 0 ? 'text-indigo-950' : 'text-rose-600'}`}>
                  {formatCurrency(monthStats.balance)}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              * O documento inclui demonstrativo de saldos anteriores, demonstrativo por categoria, extrato detalhado com datas e campos para assinaturas da Tesouraria e Direção.
            </p>
          </div>

          {feedback && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-medium text-indigo-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-xl transition cursor-pointer text-center"
          >
            Fechar
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handlePreviewPdf}
              disabled={isGenerating}
              className="flex-1 sm:flex-initial px-4 py-2.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl shadow-2xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Visualizar / Imprimir</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGenerating}
              className="flex-1 sm:flex-initial px-5 py-2.5 text-xs font-bold text-white bg-indigo-950 hover:bg-indigo-900 rounded-xl shadow-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              {isGenerating ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-4 h-4 text-indigo-300" />
              )}
              <span>Baixar PDF</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
