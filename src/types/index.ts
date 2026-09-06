export type UserRole = 'MASTER' | 'DIRIGENTE' | 'SECRETARIA' | 'TESOURARIA' | 'PENDING';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  createdAt: string;
  updatedAt?: string;
}

export type AccountType = 'caixa_5' | 'caixa_licoes';
export type TransactionType = 'income' | 'expense';
export type TransactionStatus = 'approved' | 'pending' | 'rejected';

export interface FinancialTransaction {
  id: string;
  type: TransactionType;
  account: AccountType;
  amount: number;
  date: string;
  description: string;
  receiptUrl?: string;
  receiptName?: string;
  status: TransactionStatus;
  createdByUid: string;
  createdByName: string;
  createdByEmail: string;
  approvedByUid?: string;
  approvedByName?: string;
  approvedAt?: string;
  createdAt: string;
  lessonOrderId?: string;
}

export type LessonType = 'Adulto' | 'Aluno' | 'Jovens' | 'Infantil' | 'Outro';
export type PaymentStatus = 'pago' | 'nao_pago';
export type DeliveryStatus = 'retirado' | 'nao_retirado';

export interface LessonOrder {
  id: string;
  lessonType: LessonType;
  className: string;
  quantity: number;
  unitPrice?: number;
  totalAmount?: number;
  paymentStatus: PaymentStatus;
  deliveryStatus: DeliveryStatus;
  requestedAt: string;
  paidAt?: string;
  deliveredAt?: string;
  notes?: string;
  createdByUid: string;
  createdByName: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ClassConsolidation {
  className: string;
  totalRequested: number;
  totalPaid: number;
  totalPendingPayment: number;
  totalDelivered: number;
  totalPendingDelivery: number;
  totalAmount: number;
}
