import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EbdClass, LessonOrder } from '../types';
import { formatCurrency, formatDate } from './formatters';
import { computeClassOrdersSummary } from './lessonsSummary';

interface GenerateLessonsPdfOptions {
  selectedClasses: EbdClass[];
  allOrders: LessonOrder[];
  generatedByName?: string;
  quarterInfo?: string;
}

export function generateLessonsConsolidatedPdf({
  selectedClasses,
  allOrders,
  generatedByName = 'Secretaria / Direção EBD',
  quarterInfo
}: GenerateLessonsPdfOptions): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const now = new Date();
  const emissionDateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} às ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Calculate totals
  let grandTotalRequested = 0;
  let grandTotalPaid = 0;
  let grandTotalPendingPayment = 0;
  let grandTotalDelivered = 0;
  let grandTotalPendingDelivery = 0;
  let grandTotalAmount = 0;
  let grandPaidAmount = 0;
  let grandPendingAmount = 0;

  const summaries = selectedClasses.map(c => {
    const s = computeClassOrdersSummary(c, allOrders);
    grandTotalRequested += s.totalRequested;
    grandTotalPaid += s.totalPaid;
    grandTotalPendingPayment += s.totalPendingPayment;
    grandTotalDelivered += s.totalDelivered;
    grandTotalPendingDelivery += s.totalPendingDelivery;
    grandTotalAmount += s.totalAmount;
    grandPaidAmount += s.paidAmount;
    grandPendingAmount += s.pendingAmount;
    return s;
  });

  // PAGE HEADER
  // Header bar
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('ESCOLA BÍBLICA DOMINICAL - IEADALPE JDPBX', 14, 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text('Relatório Oficial de Pedidos e Controle de Lições por Classe', 14, 17);

  doc.setFontSize(8);
  doc.text(`Emissão: ${emissionDateStr}`, 196, 17, { align: 'right' });

  // SUBHEADER / METADATA
  let currentY = 28;

  doc.setTextColor(30, 41, 59); // slate-800
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('RESUMO CONSOLIDADO DE LIÇÕES', 14, currentY);

  currentY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // slate-500
  const subMeta = quarterInfo 
    ? `Referência: ${quarterInfo} • Total de Classes Selecionadas: ${selectedClasses.length}`
    : `Total de Classes Selecionadas: ${selectedClasses.length} • Responsável: ${generatedByName}`;
  doc.text(subMeta, 14, currentY);

  currentY += 6;

  // SUMMARY CARDS / BOXES
  const cardWidth = 43;
  const cardHeight = 16;
  const cardGap = 3.5;
  const startX = 14;

  const kpis = [
    { label: 'TOTAL PEDIDAS', val: `${grandTotalRequested} un`, color: [30, 41, 59], sub: 'Revistas' },
    { label: 'PAGAS', val: `${grandTotalPaid} un`, color: [16, 185, 129], sub: formatCurrency(grandPaidAmount) },
    { label: 'A PAGAR', val: `${grandTotalPendingPayment} un`, color: [245, 158, 11], sub: formatCurrency(grandPendingAmount) },
    { label: 'VALOR TOTAL', val: formatCurrency(grandTotalAmount), color: [79, 70, 229], sub: `${grandTotalDelivered} entregues` }
  ];

  kpis.forEach((kpi, i) => {
    const x = startX + i * (cardWidth + cardGap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, currentY, cardWidth, cardHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, x + 3, currentY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.val, x + 3, currentY + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(kpi.sub, x + 3, currentY + 14);
  });

  currentY += cardHeight + 6;

  // SECTION 1: CONSOLIDATED TABLE BY CLASS
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Balanço por Classe', 14, currentY);
  currentY += 2;

  const tableBody = summaries.map(s => [
    s.className,
    s.ageGroup,
    `${s.totalRequested} un`,
    `${s.totalPaid} un`,
    `${s.totalPendingPayment} un`,
    `${s.totalDelivered} un`,
    `${s.totalPendingDelivery} un`,
    formatCurrency(s.totalAmount)
  ]);

  // Add Grand Total row
  tableBody.push([
    'TOTAL GERAL',
    '—',
    `${grandTotalRequested} un`,
    `${grandTotalPaid} un`,
    `${grandTotalPendingPayment} un`,
    `${grandTotalDelivered} un`,
    `${grandTotalPendingDelivery} un`,
    formatCurrency(grandTotalAmount)
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [[
      'Classe',
      'Faixa Etária',
      'Solicitadas',
      'Pagas',
      'Pendentes Pgto',
      'Retiradas',
      'A Retirar',
      'Valor Total'
    ]],
    body: tableBody,
    theme: 'striped',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'left'
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      font: 'helvetica'
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 38 },
      1: { cellWidth: 32 },
      2: { halign: 'center', cellWidth: 20 },
      3: { halign: 'center', cellWidth: 18, textColor: [16, 185, 129] },
      4: { halign: 'center', cellWidth: 22, textColor: [217, 119, 6] },
      5: { halign: 'center', cellWidth: 18, textColor: [37, 99, 235] },
      6: { halign: 'center', cellWidth: 18, textColor: [79, 70, 229] },
      7: { halign: 'right', fontStyle: 'bold', cellWidth: 26 }
    },
    didParseCell: function(data) {
      if (data.row.index === tableBody.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [241, 245, 249];
      }
    },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // SECTION 2: DETAILED ORDERS LIST
  // Collect all orders belonging to selected classes
  const detailedOrders: {
    className: string;
    lessonType: string;
    qty: number;
    unitPrice: number;
    total: number;
    paymentStatus: string;
    deliveryStatus: string;
    notes: string;
    date: string;
  }[] = [];

  selectedClasses.forEach(c => {
    const classOrders = allOrders.filter(o => o.className === c.name || (o.classId && o.classId === c.id));
    classOrders.forEach(ord => {
      detailedOrders.push({
        className: c.name,
        lessonType: ord.lessonType,
        qty: ord.quantity,
        unitPrice: ord.unitPrice || 15,
        total: ord.totalAmount || (ord.quantity * (ord.unitPrice || 15)),
        paymentStatus: ord.paymentStatus === 'pago' ? 'Pago' : 'Não Pago',
        deliveryStatus: ord.deliveryStatus === 'retirado' ? 'Retirado' : 'Não Retirado',
        notes: ord.notes || '—',
        date: formatDate(ord.requestedAt)
      });
    });
  });

  if (detailedOrders.length > 0) {
    // If not enough room on page, add page
    if (currentY > 210) {
      doc.addPage();
      currentY = 16;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('2. Detalhamento de Linhas de Pedidos', 14, currentY);
    currentY += 2;

    const detailRows = detailedOrders.map(d => [
      d.className,
      d.lessonType,
      `${d.qty} un`,
      formatCurrency(d.unitPrice),
      formatCurrency(d.total),
      d.paymentStatus,
      d.deliveryStatus,
      d.notes
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [[
        'Classe',
        'Tipo Revista',
        'Qtd',
        'Preço Unit.',
        'Total',
        'Status Pgto',
        'Retirada',
        'Observação / Destinatário'
      ]],
      body: detailRows,
      theme: 'grid',
      headStyles: {
        fillColor: [71, 85, 105],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
        halign: 'left'
      },
      styles: {
        fontSize: 6.8,
        cellPadding: 1.8,
        font: 'helvetica'
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 32 },
        1: { cellWidth: 26 },
        2: { halign: 'center', cellWidth: 14 },
        3: { halign: 'right', cellWidth: 18 },
        4: { halign: 'right', fontStyle: 'bold', cellWidth: 20 },
        5: { halign: 'center', cellWidth: 18 },
        6: { halign: 'center', cellWidth: 20 },
        7: { cellWidth: 44 }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 12;
  }

  // SIGNATURE SECTION
  if (currentY > 250) {
    doc.addPage();
    currentY = 30;
  }

  const sigWidth = 50;
  const sig1X = 25;
  const sig2X = 85;
  const sig3X = 145;

  doc.setDrawColor(148, 163, 184);
  doc.line(sig1X, currentY + 15, sig1X + sigWidth, currentY + 15);
  doc.line(sig2X, currentY + 15, sig2X + sigWidth, currentY + 15);
  doc.line(sig3X, currentY + 15, sig3X + sigWidth, currentY + 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Superintendência EBD', sig1X + sigWidth / 2, currentY + 19, { align: 'center' });
  doc.text('Secretaria da EBD', sig2X + sigWidth / 2, currentY + 19, { align: 'center' });
  doc.text('Tesouraria da EBD', sig3X + sigWidth / 2, currentY + 19, { align: 'center' });

  // FOOTER WITH PAGE NUMBERS
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `EBD Controle IEADALPE • Relatório Consolidado de Lições • Página ${i} de ${pageCount}`,
      105,
      290,
      { align: 'center' }
    );
  }

  return doc;
}
