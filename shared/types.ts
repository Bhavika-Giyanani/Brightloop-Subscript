export type UserRole = 'SUPER_ADMIN' | 'INTERNAL_STAFF' | 'CUSTOMER';

export interface User {
  id: string;
  email: string;
  password?: string;
  passwordHash?: string;
  name: string;
  role: UserRole;
  customerId?: string;
  phone?: string;
  company?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  userId?: string;
  name: string;
  companyName: string;
  email: string;
  phone: string;
  billingAddress: string;
  city?: string;
  country?: string;
  taxNumber?: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

export type ProductType = 'SaaS' | 'Addon' | 'Service' | 'License';

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  additionalPrice: number;
  sku: string;
  status: 'ACTIVE' | 'ARCHIVED';
}

export interface Product {
  id: string;
  name: string;
  type: ProductType;
  baseSalesPrice: number;
  costPrice: number;
  description: string;
  variants: ProductVariant[];
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

export type BillingFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface SubscriptionPlan {
  id: string;
  name: string;
  productId: string;
  billingPrice: number;
  billingFrequency: BillingFrequency;
  minQuantity: number;
  availableFrom: string;
  availableUntil: string;
  autoCloseDays: number;
  allowPause: boolean;
  allowEarlyClosure: boolean;
  allowRenewal: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export interface QuotationTemplateLine {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
}

export interface QuotationTemplate {
  id: string;
  name: string;
  description: string;
  validityDurationDays: number;
  planId?: string;
  lines: QuotationTemplateLine[];
  taxIds: string[];
  discountId?: string;
  createdAt: string;
  updatedAt: string;
}

export type SubscriptionStatus = 'DRAFT' | 'QUOTATION' | 'CONFIRMED' | 'ACTIVE' | 'CLOSED';
export type PaymentTerms = 'IMMEDIATE' | 'NET_15' | 'NET_30' | 'NET_60';

export interface SubscriptionLine {
  id: string;
  productId: string;
  variantId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  lineTotal: number;
}

export interface SubscriptionHistoryEntry {
  id: string;
  subscriptionId: string;
  action: string;
  fromStatus?: SubscriptionStatus;
  toStatus?: SubscriptionStatus;
  performedBy: string;
  timestamp: string;
  notes?: string;
}

export interface Subscription {
  id: string;
  subscriptionNumber: string;
  customerId: string;
  planId: string;
  startDate: string;
  expiryDate: string;
  nextBillingDate: string;
  paymentTerms: PaymentTerms;
  lines: SubscriptionLine[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  status: SubscriptionStatus;
  isPaused: boolean;
  history: SubscriptionHistoryEntry[];
  taxIds: string[];
  discountId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Tax {
  id: string;
  name: string;
  rate: number; // percentage, e.g., 18 for 18%
  type: 'PERCENTAGE' | 'SURCHARGE';
  description: string;
  effectiveStartDate: string;
  effectiveEndDate: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export interface Discount {
  id: string;
  name: string;
  code: string;
  type: 'FIXED' | 'PERCENTAGE';
  value: number; // fixed amount or percentage
  minPurchaseAmount: number;
  minQuantity: number;
  applicableProductIds: string[];
  applicablePlanIds: string[];
  startDate: string;
  endDate: string;
  maxUsageCount: number;
  currentUsageCount: number;
  status: 'ACTIVE' | 'EXPIRED' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export type InvoiceStatus = 'DRAFT' | 'CONFIRMED' | 'PAID' | 'CANCELLED';

export interface InvoiceLine {
  id: string;
  productId: string;
  variantId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  lineTotal: number;
}

export interface TaxBreakdown {
  taxId: string;
  taxName: string;
  rate: number;
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  subscriptionId?: string;
  invoiceDate: string;
  dueDate: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  lines: InvoiceLine[];
  subtotal: number;
  taxBreakdown: TaxBreakdown[];
  discountBreakdown?: {
    discountId?: string;
    code?: string;
    name?: string;
    amount: number;
  };
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  status: InvoiceStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type PaymentMethod = 'UPI' | 'BANK_TRANSFER' | 'CARD' | 'CASH' | 'OTHER';

export interface Payment {
  id: string;
  paymentNumber: string;
  invoiceId: string;
  customerId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  transactionReference: string;
  notes?: string;
  status: 'SUCCESS' | 'REFUNDED';
  createdAt: string;
}

export interface DashboardKPIs {
  totalCustomers: number;
  activeSubscriptions: number;
  totalSubscriptions: number;
  revenueReceived: number; // actual cash collected
  invoicedRevenue: number; // total confirmed/paid invoiced
  outstandingAmount: number; // pending collections
  overdueInvoicesCount: number;
  overdueInvoicesAmount: number;
  mrr: number; // normalized Monthly Recurring Revenue
  arr: number; // normalized Annual Recurring Revenue
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    customerId?: string;
    company?: string;
    phone?: string;
  };
}
