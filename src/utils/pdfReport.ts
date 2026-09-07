import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FinancialTransaction, AccountType } from '../types';
import { formatCurrency, formatDate } from './formatters';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

interface GeneratePdfOptions {
  transactions: FinancialTransaction[];
  month: number; // 1 to 12
  year: number;
  accountFilter?: 'all' | AccountType;
  generatedByName: string;
  generatedByRole?: string;
}

export function parseTransactionDate(dateStr: string): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;
  const clean = dateStr.split('T')[0];
  const parts = clean.split('-');
  if (parts.length >= 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return { year: y, month: m, day: d };
    }
  }
  const dt = new Date(dateStr);
  if (!isNaN(dt.getTime())) {
    return { year: dt.getFullYear(), month: dt.getMonth() + 1, day: dt.getDate() };
  }
  return null;
}

export function generateMonthlyFinancialReportPdf({
  transactions,
  month,
  year,
  accountFilter = 'all',
  generatedByName,
  generatedByRole = 'Tesouraria'
}: GeneratePdfOptions): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const monthName = MONTH_NAMES[month - 1] || `Mês ${month}`;
  const now = new Date();
  const emissionDateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} às ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Filter approved transactions
  const approved = transactions.filter(t => t.status === 'approved');

  // Compute previous balances (strictly before this month)
  let prevCaixa5 = 0;
  let prevCaixaLicoes = 0;

  // Current month transactions
  const monthTransactions: FinancialTransaction[] = [];

  approved.forEach(t => {
    const p = parseTransactionDate(t.date);
    if (!p) return;

    const isBefore = p.year < year || (p.year === year && p.month < month);
    const isCurrent = p.year === year && p.month === month;

    if (isBefore) {
      if (t.account === 'caixa_5') {
        prevCaixa5 += t.type === 'income' ? t.amount : -t.amount;
      } else if (t.account === 'caixa_licoes') {
        prevCaixaLicoes += t.type === 'income' ? t.amount : -t.amount;
      }
    } else if (isCurrent) {
      if (accountFilter === 'all' || t.account === accountFilter) {
        monthTransactions.push(t);
      }
    }
  });

  // Sort month transactions by date ascending
  monthTransactions.sort((a, b) => {
    const da = a.date || '';
    const db = b.date || '';
    return da.localeCompare(db);
  });

  // Calculate month metrics
  let monthIncomeCaixa5 = 0;
  let monthExpenseCaixa5 = 0;
  let monthIncomeLicoes = 0;
  let monthExpenseLicoes = 0;

  const incomeByCategory: Record<string, number> = {};
  const expenseByCategory: Record<string, number> = {};

  monthTransactions.forEach(t => {
    if (t.type === 'income') {
      if (t.account === 'caixa_5') monthIncomeCaixa5 += t.amount;
      if (t.account === 'caixa_licoes') monthIncomeLicoes += t.amount;
      incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + t.amount;
    } else {
      if (t.account === 'caixa_5') monthExpenseCaixa5 += t.amount;
      if (t.account === 'caixa_licoes') monthExpenseLicoes += t.amount;
      expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + t.amount;
    }
  });

  const finalCaixa5 = prevCaixa5 + monthIncomeCaixa5 - monthExpenseCaixa5;
  const finalCaixaLicoes = prevCaixaLicoes + monthIncomeLicoes - monthExpenseLicoes;

  const totalMonthIncome = monthIncomeCaixa5 + monthIncomeLicoes;
  const totalMonthExpense = monthExpenseCaixa5 + monthExpenseLicoes;
  const totalMonthNet = totalMonthIncome - totalMonthExpense;
  const totalFinalBalance = finalCaixa5 + finalCaixaLicoes;

  // ==========================================
  // PDF DRAWING (Header & Brand)
  // ==========================================
  const primaryColor = [30, 27, 75]; // #1e1b4b (Deep Church Navy)
  const accentColor = [16, 185, 129]; // #10b981 (Emerald)
  const textColor = [30, 41, 59]; // slate-800
  const lightBg = [248, 250, 252]; // slate-50

  // Header Banner
  doc.setFillColor(30, 27, 75);
  doc.rect(0, 0, 210, 32, 'F');

  // Title Text inside Banner
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('IEADALPE JDPBX — ESCOLA BÍBLICA DOMINICAL', 14, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(224, 231, 255);
  doc.text(`RELATÓRIO FINANCEIRO MENSAL — ${monthName.toUpperCase()} / ${year}`, 14, 21);

  doc.setFontSize(8);
  doc.setTextColor(199, 210, 254);
  const accountSubtitle = accountFilter === 'all' 
    ? 'Visão Consolidada: Todos os Caixas (Caixa 5% + Caixa de Lições)' 
    : accountFilter === 'caixa_5' 
      ? 'Filtro: Caixa Geral (Cota 5% da Igreja)' 
      : 'Filtro: Caixa de Lições / Revistas EBD';
  doc.text(accountSubtitle, 14, 27);

  // Emission info on right of banner
  doc.setFontSize(7.5);
  doc.setTextColor(224, 231, 255);
  doc.text(`Emitido em: ${emissionDateStr}`, 196, 14, { align: 'right' });
  doc.text(`Responsável: ${generatedByName} (${generatedByRole})`, 196, 20, { align: 'right' });

  // Reset text color
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);

  let currentY = 38;

  // ==========================================
  // 1. QUADRO RESUMO DE SALDOS (BALANCES TABLE)
  // ==========================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('1. DEMONSTRATIVO CONSOLIDADO DE SALDOS', 14, currentY);
  currentY += 3;

  const balanceHeaders = [
    ['Conta / Caixa', 'Saldo Anterior', 'Entradas no Mês', 'Saídas no Mês', 'Saldo Final']
  ];

  const balanceRows = [
    [
      'Caixa Geral (Cota 5% Igreja)',
      formatCurrency(prevCaixa5),
      formatCurrency(monthIncomeCaixa5),
      formatCurrency(monthExpenseCaixa5),
      formatCurrency(finalCaixa5)
    ],
    [
      'Caixa de Lições (Revistas EBD)',
      formatCurrency(prevCaixaLicoes),
      formatCurrency(monthIncomeLicoes),
      formatCurrency(monthExpenseLicoes),
      formatCurrency(finalCaixaLicoes)
    ],
    [
      'TOTAL GERAL CONSOLIDADO',
      formatCurrency(prevCaixa5 + prevCaixaLicoes),
      formatCurrency(totalMonthIncome),
      formatCurrency(totalMonthExpense),
      formatCurrency(totalFinalBalance)
    ]
  ];

  autoTable(doc, {
    startY: currentY,
    head: balanceHeaders,
    body: balanceRows,
    theme: 'grid',
    headStyles: {
      fillColor: [49, 46, 129],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 62 },
      1: { halign: 'right', cellWidth: 32 },
      2: { halign: 'right', cellWidth: 32, textColor: [5, 150, 105] },
      3: { halign: 'right', cellWidth: 32, textColor: [225, 29, 72] },
      4: { halign: 'right', cellWidth: 32, fontStyle: 'bold' }
    },
    didParseCell: (data) => {
      // Highlight the total row
      if (data.row.index === 2) {
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.fontStyle = 'bold';
        if (data.column.index === 4) {
          data.cell.styles.textColor = [30, 27, 75];
        }
      }
    },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // ==========================================
  // 2. DEMONSTRATIVO POR CATEGORIAS
  // ==========================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('2. RESUMO POR CATEGORIA NO MÊS', 14, currentY);
  currentY += 3;

  // Prepare category items
  const categoryRows: string[][] = [];
  const incomeEntries = Object.entries(incomeByCategory).sort((a, b) => b[1] - a[1]);
  const expenseEntries = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]);
  const maxRows = Math.max(incomeEntries.length, expenseEntries.length, 1);

  for (let i = 0; i < maxRows; i++) {
    const inc = incomeEntries[i];
    const exp = expenseEntries[i];

    categoryRows.push([
      inc ? inc[0] : '',
      inc ? formatCurrency(inc[1]) : '',
      exp ? exp[0] : '',
      exp ? formatCurrency(exp[1]) : ''
    ]);
  }

  // Add category totals
  categoryRows.push([
    'Total de Receitas',
    formatCurrency(totalMonthIncome),
    'Total de Despesas',
    formatCurrency(totalMonthExpense)
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Receitas / Entradas', 'Valor (R$)', 'Despesas / Saídas', 'Valor (R$)']],
    body: categoryRows,
    theme: 'plain',
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [30, 41, 59],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [51, 65, 85]
    },
    columnStyles: {
      0: { cellWidth: 62 },
      1: { halign: 'right', cellWidth: 32, fontStyle: 'bold', textColor: [5, 150, 105] },
      2: { cellWidth: 62 },
      3: { halign: 'right', cellWidth: 32, fontStyle: 'bold', textColor: [225, 29, 72] }
    },
    didParseCell: (data) => {
      if (data.row.index === categoryRows.length - 1) {
        data.cell.styles.fillColor = [248, 250, 252];
        data.cell.styles.fontStyle = 'bold';
      }
    },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // ==========================================
  // 3. EXTRATO DETALHADO DOS LANÇAMENTOS DO MÊS
  // ==========================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`3. EXTRATO DETALHADO DE LANÇAMENTOS (${monthTransactions.length} registros)`, 14, currentY);
  currentY += 3;

  const transactionTableRows = monthTransactions.map(t => {
    const isInc = t.type === 'income';
    const accLabel = t.account === 'caixa_5' ? 'Caixa 5%' : 'Lições';
    const valFormatted = `${isInc ? '+' : '-'} ${formatCurrency(t.amount)}`;
    return [
      formatDate(t.date),
      isInc ? 'Entrada' : 'Saída',
      accLabel,
      t.category || 'Geral',
      t.description || '—',
      valFormatted
    ];
  });

  if (transactionTableRows.length === 0) {
    transactionTableRows.push(['—', '—', '—', 'Nenhum lançamento no período', '—', 'R$ 0,00']);
  }

  autoTable(doc, {
    startY: currentY,
    head: [['Data', 'Tipo', 'Caixa', 'Categoria', 'Descrição / Histórico', 'Valor (R$)']],
    body: transactionTableRows,
    theme: 'striped',
    headStyles: {
      fillColor: [30, 27, 75],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59]
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 18, fontStyle: 'bold' },
      2: { cellWidth: 22 },
      3: { cellWidth: 38 },
      4: { cellWidth: 58 },
      5: { cellWidth: 32, halign: 'right', fontStyle: 'bold' }
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        if (data.cell.raw === 'Entrada') {
          data.cell.styles.textColor = [5, 150, 105];
        } else if (data.cell.raw === 'Saída') {
          data.cell.styles.textColor = [225, 29, 72];
        }
      }
      if (data.section === 'body' && data.column.index === 5) {
        const raw = String(data.cell.raw || '');
        if (raw.startsWith('+')) {
          data.cell.styles.textColor = [5, 150, 105];
        } else if (raw.startsWith('-')) {
          data.cell.styles.textColor = [225, 29, 72];
        }
      }
    },
    margin: { left: 14, right: 14 }
  });

  // ==========================================
  // SIGNATURES BLOCK & FOOTER ON LAST PAGE
  // ==========================================
  const pageCount = (doc as any).internal.getNumberOfPages();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // If it's the last page, render signatures above bottom footer
    if (i === pageCount) {
      const lastTableY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 180;
      let sigY = Math.max(lastTableY + 16, 246);

      // If table encroaches into signature area, add a new page
      if (lastTableY > 235) {
        doc.addPage();
        sigY = 60;
      }

      // Three signature lines
      doc.setDrawColor(148, 163, 184); // slate-400
      doc.setLineWidth(0.4);

      // Line 1: Tesouraria
      doc.line(18, sigY, 70, sigY);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85);
      doc.text('Tesouraria da EBD', 44, sigY + 4, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(generatedByName, 44, sigY + 7.5, { align: 'center' });

      // Line 2: Dirigente / Pastor
      doc.line(78, sigY, 132, sigY);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85);
      doc.text('Dirigente da Congregação', 105, sigY + 4, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text('Visto e Aprovado', 105, sigY + 7.5, { align: 'center' });

      // Line 3: Coordenação EBD
      doc.line(140, sigY, 194, sigY);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85);
      doc.text('Superintendente / Coordenação', 167, sigY + 4, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text('Arquivo EBD JDPBX', 167, sigY + 7.5, { align: 'center' });
    }

    // Standard Page Footer
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(14, 287, 196, 287);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('Gestão EBD | IEADALPE JDPBX — Documento Gerencial emitido via Sistema Integrado', 14, 291);
    doc.text(`Página ${i} de ${pageCount}`, 196, 291, { align: 'right' });
  }

  return doc;
}
