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
  category?: string;
  amount: number;
  date: string;
  description: string;
  receiptUrl?: string;
  receiptName?: string;
  signatureUrl?: string;
  signatureName?: string;
  signatureDate?: string;
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

export const AGE_GROUPS = [
  'Berçário (0 a 2 anos)',
  'Maternal (3 e 4 anos)',
  'Primários (5 e 6 anos)',
  'Juniores (7 a 8 anos)',
  'Juniores (9 a 10 anos)',
  'Pré-Adolescentes (11 a 12 anos)',
  'Adolescentes (13 a 14 anos)',
  'Juvenis (15 a 17 anos)',
  'Jovens (18 a 29 anos)',
  'Adultos'
] as const;

export type AgeGroup = typeof AGE_GROUPS[number];

export interface EbdClass {
  id: string;
  name: string;
  ageGroup?: AgeGroup | string; // Lição por Faixa Etária obrigatória no cadastro
  createdAt: string;
  createdByUid: string;
  createdByName?: string;
  updatedAt?: string;
}

export type LessonType = 'Professor' | 'Aluno' | 'Adulto';
export type LessonAudience = 'Professor' | 'Aluno';
export type PaymentStatus = 'pago' | 'nao_pago';
export type DeliveryStatus = 'retirado' | 'nao_retirado';

export const LESSON_QUARTERS = [
  '1º Trimestre',
  '2º Trimestre',
  '3º Trimestre',
  '4º Trimestre',
] as const;
export type LessonQuarter = typeof LESSON_QUARTERS[number];

export const LESSON_PURCHASE_YEARS = [
  2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035
] as const;

export interface LessonPurchase {
  id: string;
  quantity: number;          // Quantitativo comprado antecipadamente pela direção
  purchaseDate: string;      // Data da compra (YYYY-MM-DD)
  ageGroup?: AgeGroup | string; // Tipo por faixa Etária
  lessonType?: 'Professor' | 'Aluno' | string; // Tipo de Lição: apenas Professor ou Aluno
  quarter?: LessonQuarter | string; // 1º Trimestre, 2º Trimestre, 3º Trimestre, 4º Trimestre
  year?: number | string;    // Ano (2026 em diante)
  notes?: string;            // Observações / Fornecedor / Detalhes adicionais
  unitCost?: number;         // Custo unitário (opcional)
  totalCost?: number;        // Custo total pago (opcional)
  createdByUid: string;
  createdByName: string;
  createdAt: string;
  updatedAt?: string;
}

export interface LessonOrder {
  id: string;
  lessonType: LessonType;
  className: string;
  classId?: string;
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
