import { EbdClass, LessonOrder } from '../types';
import { formatCurrency, formatDate } from './formatters';

export interface ClassOrdersSummary {
  className: string;
  ageGroup: string;
  totalRequested: number;
  totalPaid: number;
  totalPendingPayment: number;
  totalDelivered: number;
  totalPendingDelivery: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  orders: LessonOrder[];
}

export function computeClassOrdersSummary(ebdClass: EbdClass, orders: LessonOrder[]): ClassOrdersSummary {
  const classOrders = orders.filter(o => o.className === ebdClass.name || (o.classId && o.classId === ebdClass.id));
  
  let totalRequested = 0;
  let totalPaid = 0;
  let totalPendingPayment = 0;
  let totalDelivered = 0;
  let totalPendingDelivery = 0;
  let totalAmount = 0;
  let paidAmount = 0;
  let pendingAmount = 0;

  classOrders.forEach(o => {
    const qty = o.quantity || 0;
    const unitPrice = o.unitPrice || 15;
    const itemTotal = o.totalAmount || (qty * unitPrice);

    totalRequested += qty;
    totalAmount += itemTotal;

    if (o.paymentStatus === 'pago') {
      totalPaid += qty;
      paidAmount += itemTotal;
    } else {
      totalPendingPayment += qty;
      pendingAmount += itemTotal;
    }

    if (o.deliveryStatus === 'retirado') {
      totalDelivered += qty;
    } else {
      totalPendingDelivery += qty;
    }
  });

  return {
    className: ebdClass.name,
    ageGroup: (ebdClass.ageGroup as string) || 'Geral',
    totalRequested,
    totalPaid,
    totalPendingPayment,
    totalDelivered,
    totalPendingDelivery,
    totalAmount,
    paidAmount,
    pendingAmount,
    orders: classOrders
  };
}

/**
 * Gera mensagem formatada para WhatsApp de uma classe específica
 */
export function formatClassWhatsAppMessage(ebdClass: EbdClass, orders: LessonOrder[]): string {
  const summary = computeClassOrdersSummary(ebdClass, orders);
  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  let text = `📖 *EBD - IEADALPE JDPBX*\n`;
  text += `*RESUMO DE PEDIDOS DE LIÇÕES*\n\n`;
  text += `🏛️ *Classe:* ${summary.className}\n`;
  text += `🎯 *Faixa Etária:* ${summary.ageGroup}\n`;
  text += `📅 *Data do Resumo:* ${dateStr}\n\n`;

  text += `📊 *TOTAIS DA CLASSE:*\n`;
  text += `• *Total Pedido:* ${summary.totalRequested} revistas\n`;
  text += `• *Total Pago:* ${summary.totalPaid} un (${formatCurrency(summary.paidAmount)})\n`;
  text += `• *Pendente Pgto:* ${summary.totalPendingPayment} un (${formatCurrency(summary.pendingAmount)})\n`;
  text += `• *Total Retirado:* ${summary.totalDelivered} un\n`;
  text += `• *A Retirar:* ${summary.totalPendingDelivery} un\n`;
  text += `• 💰 *VALOR TOTAL:* ${formatCurrency(summary.totalAmount)}\n\n`;

  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📋 *ITENS / PEDIDOS (${summary.orders.length}):*\n`;

  if (summary.orders.length === 0) {
    text += `_Nenhum pedido registrado nesta classe._\n`;
  } else {
    summary.orders.forEach((ord, index) => {
      const unit = ord.unitPrice || 15;
      const tot = ord.totalAmount || (ord.quantity * unit);
      const isPaid = ord.paymentStatus === 'pago';
      const isDelivered = ord.deliveryStatus === 'retirado';

      text += `\n*${index + 1}. ${ord.lessonType}* (${ord.quantity} un x ${formatCurrency(unit)})\n`;
      text += `   • Total: *${formatCurrency(tot)}*\n`;
      text += `   • Pagamento: ${isPaid ? '✅ Pago' : '⏳ Pendente'}\n`;
      text += `   • Retirada: ${isDelivered ? '📦 Retirado' : '⏳ Não Retirado'}\n`;
      if (ord.notes && ord.notes.trim()) {
        text += `   • Obs: ${ord.notes.trim()}\n`;
      }
    });
  }

  text += `\n----------------------------------\n`;
  text += `_Secretaria & Direção da EBD - IEADALPE_`;

  return text;
}

/**
 * Gera mensagem formatada para WhatsApp de múltiplas classes selecionadas
 */
export function formatGeneralWhatsAppMessage(
  selectedClasses: EbdClass[],
  allOrders: LessonOrder[]
): string {
  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  let grandTotalRequested = 0;
  let grandTotalPaid = 0;
  let grandTotalPendingPayment = 0;
  let grandTotalDelivered = 0;
  let grandTotalPendingDelivery = 0;
  let grandTotalAmount = 0;
  let grandPaidAmount = 0;
  let grandPendingAmount = 0;

  const classSummaries = selectedClasses.map(c => {
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

  let text = `📖 *EBD - IEADALPE JDPBX*\n`;
  text += `*RESUMO GERAL DE PEDIDOS DE LIÇÕES*\n\n`;
  text += `📅 *Data de Emissão:* ${dateStr}\n`;
  text += `🏛️ *Classes Selecionadas:* ${selectedClasses.length}\n\n`;

  text += `📊 *BALANÇO GERAL CONSOLIDADO:*\n`;
  text += `• *Total Pedido:* ${grandTotalRequested} revistas\n`;
  text += `• *Total Pago:* ${grandTotalPaid} un (${formatCurrency(grandPaidAmount)})\n`;
  text += `• *Pendente de Pgto:* ${grandTotalPendingPayment} un (${formatCurrency(grandPendingAmount)})\n`;
  text += `• *Total Retirado:* ${grandTotalDelivered} un\n`;
  text += `• *Total a Retirar:* ${grandTotalPendingDelivery} un\n`;
  text += `• 💰 *VALOR TOTAL:* ${formatCurrency(grandTotalAmount)}\n\n`;

  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📌 *RESUMO POR CLASSE:*\n`;

  classSummaries.forEach((s) => {
    text += `\n🏛️ *${s.className}* (${s.ageGroup})\n`;
    text += `   • Pedidas: *${s.totalRequested} un* | Valor: *${formatCurrency(s.totalAmount)}*\n`;
    text += `   • Pagamento: ${s.totalPaid} pagas (${formatCurrency(s.paidAmount)}) | ${s.totalPendingPayment} pendentes (${formatCurrency(s.pendingAmount)})\n`;
    text += `   • Retirada: ${s.totalDelivered} retiradas | ${s.totalPendingDelivery} a retirar\n`;
  });

  text += `\n----------------------------------\n`;
  text += `_Secretaria & Direção da EBD - IEADALPE_`;

  return text;
}

/**
 * Abre o WhatsApp com a mensagem formatada
 */
export function openWhatsApp(message: string) {
  const encoded = encodeURIComponent(message);
  const url = `https://api.whatsapp.com/send?text=${encoded}`;
  try {
    const win = window.open(url, '_blank');
    if (!win) {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  } catch (err) {
    console.error('Erro ao abrir WhatsApp:', err);
  }
}
