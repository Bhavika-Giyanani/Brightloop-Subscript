import path from 'path';
import fs from 'fs';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import {
  User,
  Customer,
  Product,
  SubscriptionPlan,
  QuotationTemplate,
  Subscription,
  Tax,
  Discount,
  Invoice,
  Payment,
  DashboardKPIs,
  BillingFrequency,
  SubscriptionLine
} from './types.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(process.env.SQLITE_DB_PATH || path.join(DATA_DIR, 'brightloop.sqlite'));
const COLLECTIONS = [
  'users',
  'customers',
  'products',
  'plans',
  'templates',
  'subscriptions',
  'taxes',
  'discounts',
  'invoices',
  'payments',
  'passwordResetTokens'
] as const;

export interface DatabaseSchema {
  users: User[];
  customers: Customer[];
  products: Product[];
  plans: SubscriptionPlan[];
  templates: QuotationTemplate[];
  subscriptions: Subscription[];
  taxes: Tax[];
  discounts: Discount[];
  invoices: Invoice[];
  payments: Payment[];
  passwordResetTokens: { token: string; email: string; expiresAt: string }[];
}

// In-memory cache backed by one SQLite table per collection.
let dbCache: DatabaseSchema | null = null;
let sqlite: DatabaseSync | null = null;

function ensureDataDirectory() {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
}

function getSqlite(): DatabaseSync {
  if (!sqlite) {
    ensureDataDirectory();
    sqlite = new DatabaseSync(DB_FILE);
    sqlite.exec('CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    for (const collection of COLLECTIONS) {
      sqlite.exec(`CREATE TABLE IF NOT EXISTS "${collection}" (id TEXT PRIMARY KEY, data TEXT NOT NULL)`);
    }
  }
  return sqlite;
}

function writeDatabase(data: DatabaseSchema): void {
  const database = getSqlite();
  database.exec('BEGIN IMMEDIATE');
  try {
    for (const collection of COLLECTIONS) {
      database.exec(`DELETE FROM "${collection}"`);
      const statement = database.prepare(`INSERT INTO "${collection}" (id, data) VALUES (?, ?)`);
      for (const record of data[collection] as Array<{ id?: string; token?: string }>) {
        const id = collection === 'passwordResetTokens' ? record.token : record.id;
        if (!id) {
          throw new Error(`Cannot save ${collection} record without an id.`);
        }
        statement.run(id, JSON.stringify(record));
      }
    }
    database.prepare('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)').run('initialized', 'true');
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function readDatabase(): DatabaseSchema | null {
  const database = getSqlite();
  const initialized = database.prepare('SELECT value FROM app_meta WHERE key = ?').get('initialized') as { value: string } | undefined;
  if (!initialized) return null;

  const result = {} as DatabaseSchema;
  for (const collection of COLLECTIONS) {
    const records = database.prepare(`SELECT data FROM "${collection}"`).all() as Array<{ data: string }>;
    result[collection] = records.map(record => JSON.parse(record.data)) as never;
  }
  return result;
}

function markDemoAccountsSeeded(): void {
  getSqlite().prepare('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)').run('demo_seed_version', '1');
}

function ensureDemoAccounts(data: DatabaseSchema): DatabaseSchema {
  const marker = getSqlite().prepare('SELECT value FROM app_meta WHERE key = ?').get('demo_seed_version') as { value: string } | undefined;
  if (marker?.value === '1') return data;

  const demoData = getInitialSeedData();
  for (const collection of COLLECTIONS) {
    data[collection] ||= [] as never;
  }
  for (const user of demoData.users) {
    if (!data.users.some(existing => existing.email.trim().toLowerCase() === user.email.toLowerCase())) {
      data.users.push(user);
    }
  }
  for (const customer of demoData.customers) {
    if (!data.customers.some(existing => existing.email.trim().toLowerCase() === customer.email.toLowerCase())) {
      data.customers.push(customer);
    }
  }

  writeDatabase(data);
  markDemoAccountsSeeded();
  return data;
}

export function getInitialSeedData(): DatabaseSchema {
  const hash = (pwd: string) => bcrypt.hashSync(pwd, 10);
  const now = new Date().toISOString();
  const past30Days = new Date(Date.now() - 30 * 86400000).toISOString();
  const past15Days = new Date(Date.now() - 15 * 86400000).toISOString();
  const todayStr = new Date().toISOString().split('T')[0];
  const nextMonthStr = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  const duePastStr = new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0];
  const demoAvailableUntil = `${new Date().getUTCFullYear() + 2}-12-31`;

  const users: User[] = [
    {
      id: 'usr-admin-1',
      email: 'admin@brightloop.io',
      passwordHash: hash('Admin@12345!'),
      name: 'Aditi Rao (Super Admin)',
      role: 'SUPER_ADMIN',
      phone: '+91 98765 43210',
      company: 'Brightloop Technologies HQ',
      status: 'ACTIVE',
      createdAt: past30Days,
      updatedAt: past30Days
    },
    {
      id: 'usr-staff-1',
      email: 'staff@brightloop.io',
      passwordHash: hash('Staff@12345!'),
      name: 'Rohan Sharma (Account Executive)',
      role: 'INTERNAL_STAFF',
      phone: '+91 98234 56789',
      company: 'Brightloop Operations',
      status: 'ACTIVE',
      createdAt: past30Days,
      updatedAt: past30Days
    },
    {
      id: 'usr-cust-1',
      email: 'alex@acmecorp.com',
      passwordHash: hash('Customer@12345!'),
      name: 'Alex Morgan',
      role: 'CUSTOMER',
      customerId: 'cust-1',
      phone: '+1 415 555 0192',
      company: 'Acme Enterprise Corp',
      status: 'ACTIVE',
      createdAt: past30Days,
      updatedAt: past30Days
    },
    {
      id: 'usr-cust-2',
      email: 'sarah@novadesign.co',
      passwordHash: hash('Customer@12345!'),
      name: 'Sarah Jenkins',
      role: 'CUSTOMER',
      customerId: 'cust-2',
      phone: '+44 20 7946 0912',
      company: 'Nova Design Studio',
      status: 'ACTIVE',
      createdAt: past30Days,
      updatedAt: past30Days
    }
  ];

  const customers: Customer[] = [
    {
      id: 'cust-1',
      userId: 'usr-cust-1',
      name: 'Alex Morgan',
      companyName: 'Acme Enterprise Corp',
      email: 'alex@acmecorp.com',
      phone: '+1 415 555 0192',
      billingAddress: '452 Innovation Blvd, Suite 400',
      city: 'San Francisco, CA',
      country: 'United States',
      taxNumber: 'US-EIN-948201948',
      status: 'ACTIVE',
      createdAt: past30Days,
      updatedAt: past30Days
    },
    {
      id: 'cust-2',
      userId: 'usr-cust-2',
      name: 'Sarah Jenkins',
      companyName: 'Nova Design Studio',
      email: 'sarah@novadesign.co',
      phone: '+44 20 7946 0912',
      billingAddress: '18 Shoreditch High St',
      city: 'London',
      country: 'United Kingdom',
      taxNumber: 'GB-VAT-394819284',
      status: 'ACTIVE',
      createdAt: past30Days,
      updatedAt: past30Days
    },
    {
      id: 'cust-3',
      name: 'Vikram Mehta',
      companyName: 'Zenith Logistics Ltd',
      email: 'vikram@zenithlogistics.in',
      phone: '+91 99201 88372',
      billingAddress: 'Tower B, Cyber City, Phase 2',
      city: 'Gurugram',
      country: 'India',
      taxNumber: 'GSTIN07AAACZ1234F1Z5',
      status: 'ACTIVE',
      createdAt: past15Days,
      updatedAt: past15Days
    },
    {
      id: 'cust-4',
      name: 'Elena Rostova',
      companyName: 'Apex Cloud Systems',
      email: 'elena@apexcloud.io',
      phone: '+1 206 555 9382',
      billingAddress: '900 Pine St, Floor 12',
      city: 'Seattle, WA',
      country: 'United States',
      taxNumber: 'US-EIN-839201941',
      status: 'ACTIVE',
      createdAt: past15Days,
      updatedAt: past15Days
    }
  ];

  const products: Product[] = [
    {
      id: 'prod-1',
      name: 'Brightloop Accounting Cloud',
      type: 'SaaS',
      baseSalesPrice: 2000,
      costPrice: 450,
      description: 'Comprehensive double-entry cloud accounting with real-time ledger, bank sync, and GST/VAT tax reporting.',
      status: 'ACTIVE',
      createdAt: past30Days,
      updatedAt: past30Days,
      variants: [
        { id: 'var-1-1', productId: 'prod-1', name: 'Standard Edition', additionalPrice: 0, sku: 'ACC-STD', status: 'ACTIVE' },
        { id: 'var-1-2', productId: 'prod-1', name: 'Odoo Integration Suite', additionalPrice: 560, sku: 'ACC-ODOO', status: 'ACTIVE' },
        { id: 'var-1-3', productId: 'prod-1', name: 'Multi-Currency Engine', additionalPrice: 750, sku: 'ACC-MULTICURR', status: 'ACTIVE' },
        { id: 'var-1-4', productId: 'prod-1', name: 'Enterprise Audit Trail & Lock', additionalPrice: 1200, sku: 'ACC-AUDIT', status: 'ACTIVE' }
      ]
    },
    {
      id: 'prod-2',
      name: 'Brightloop CRM Pro',
      type: 'SaaS',
      baseSalesPrice: 1500,
      costPrice: 320,
      description: 'Unified customer journey tracker, pipeline automation, omnichannel contact sync, and deal forecasting.',
      status: 'ACTIVE',
      createdAt: past30Days,
      updatedAt: past30Days,
      variants: [
        { id: 'var-2-1', productId: 'prod-2', name: 'Starter Pipeline', additionalPrice: 0, sku: 'CRM-START', status: 'ACTIVE' },
        { id: 'var-2-2', productId: 'prod-2', name: 'WhatsApp & Telephony Gateway', additionalPrice: 600, sku: 'CRM-COMM', status: 'ACTIVE' },
        { id: 'var-2-3', productId: 'prod-2', name: 'Predictive Deal Analytics', additionalPrice: 900, sku: 'CRM-AI', status: 'ACTIVE' }
      ]
    },
    {
      id: 'prod-3',
      name: 'Recurring Billing & Subscription Engine',
      type: 'SaaS',
      baseSalesPrice: 4500,
      costPrice: 800,
      description: 'High-availability subscription engine with automated proration, dunning retries, and invoice ledger.',
      status: 'ACTIVE',
      createdAt: past30Days,
      updatedAt: past30Days,
      variants: [
        { id: 'var-3-1', productId: 'prod-3', name: 'Base Gateway', additionalPrice: 0, sku: 'BILL-BASE', status: 'ACTIVE' },
        { id: 'var-3-2', productId: 'prod-3', name: 'High-Throughput Webhooks', additionalPrice: 1500, sku: 'BILL-HOOKS', status: 'ACTIVE' }
      ]
    },
    {
      id: 'prod-4',
      name: 'Dedicated Onboarding & Data Migration',
      type: 'Service',
      baseSalesPrice: 12000,
      costPrice: 5000,
      description: 'White-glove migration of legacy accounting books, custom schema configuration, and 8 hours staff training.',
      status: 'ACTIVE',
      createdAt: past30Days,
      updatedAt: past30Days,
      variants: [
        { id: 'var-4-1', productId: 'prod-4', name: 'Standard 10-day Package', additionalPrice: 0, sku: 'SERV-ONBOARD', status: 'ACTIVE' },
        { id: 'var-4-2', productId: 'prod-4', name: 'Expedited 48h Turnaround', additionalPrice: 6000, sku: 'SERV-RUSH', status: 'ACTIVE' }
      ]
    }
  ];

  const plans: SubscriptionPlan[] = [
    {
      id: 'plan-1',
      name: 'Accounting Cloud - Monthly Growth',
      productId: 'prod-1',
      billingPrice: 2000,
      billingFrequency: 'MONTHLY',
      minQuantity: 1,
      availableFrom: '2026-01-01',
      availableUntil: demoAvailableUntil,
      autoCloseDays: 30,
      allowPause: true,
      allowEarlyClosure: true,
      allowRenewal: true,
      status: 'ACTIVE',
      createdAt: past30Days,
      updatedAt: past30Days
    },
    {
      id: 'plan-2',
      name: 'Accounting Cloud - Annual Scale (16% Savings)',
      productId: 'prod-1',
      billingPrice: 20000,
      billingFrequency: 'YEARLY',
      minQuantity: 1,
      availableFrom: '2026-01-01',
      availableUntil: demoAvailableUntil,
      autoCloseDays: 60,
      allowPause: true,
      allowEarlyClosure: false,
      allowRenewal: true,
      status: 'ACTIVE',
      createdAt: past30Days,
      updatedAt: past30Days
    },
    {
      id: 'plan-3',
      name: 'CRM Pro - Monthly Team',
      productId: 'prod-2',
      billingPrice: 1500,
      billingFrequency: 'MONTHLY',
      minQuantity: 2,
      availableFrom: '2026-01-01',
      availableUntil: demoAvailableUntil,
      autoCloseDays: 15,
      allowPause: true,
      allowEarlyClosure: true,
      allowRenewal: true,
      status: 'ACTIVE',
      createdAt: past30Days,
      updatedAt: past30Days
    },
    {
      id: 'plan-4',
      name: 'Billing Engine - Weekly High-Velocity',
      productId: 'prod-3',
      billingPrice: 1200,
      billingFrequency: 'WEEKLY',
      minQuantity: 1,
      availableFrom: '2026-01-01',
      availableUntil: '2027-12-31',
      autoCloseDays: 7,
      allowPause: false,
      allowEarlyClosure: true,
      allowRenewal: true,
      status: 'ACTIVE',
      createdAt: past30Days,
      updatedAt: past30Days
    }
  ];

  const taxes: Tax[] = [
    {
      id: 'tax-1',
      name: 'GST 18%',
      rate: 18,
      type: 'PERCENTAGE',
      description: 'Standard Goods and Services Tax applicable to software and digital subscriptions.',
      effectiveStartDate: '2025-01-01',
      effectiveEndDate: '2030-12-31',
      status: 'ACTIVE',
      createdAt: past30Days,
      updatedAt: past30Days
    },
    {
      id: 'tax-2',
      name: 'Digital Services Surcharge 2%',
      rate: 2,
      type: 'SURCHARGE',
      description: 'Regulatory compliance and cyber-security infrastructure fee.',
      effectiveStartDate: '2025-01-01',
      effectiveEndDate: '2030-12-31',
      status: 'ACTIVE',
      createdAt: past30Days,
      updatedAt: past30Days
    },
    {
      id: 'tax-3',
      name: 'Zero-Rated International Export 0%',
      rate: 0,
      type: 'PERCENTAGE',
      description: 'Cross-border digital export tax exemption with valid export documentation.',
      effectiveStartDate: '2025-01-01',
      effectiveEndDate: '2030-12-31',
      status: 'ACTIVE',
      createdAt: past30Days,
      updatedAt: past30Days
    }
  ];

  const discounts: Discount[] = [
    {
      id: 'disc-1',
      name: 'Early Adopter 15%',
      code: 'EARLYBIRD15',
      type: 'PERCENTAGE',
      value: 15,
      minPurchaseAmount: 2000,
      minQuantity: 1,
      applicableProductIds: ['prod-1', 'prod-2', 'prod-3'],
      applicablePlanIds: ['plan-1', 'plan-2', 'plan-3'],
      startDate: '2026-01-01',
      endDate: '2027-12-31',
      maxUsageCount: 150,
      currentUsageCount: 24,
      status: 'ACTIVE',
      createdAt: past30Days,
      updatedAt: past30Days
    },
    {
      id: 'disc-2',
      name: 'Startup Kickstart ₹500 Off',
      code: 'STARTUP500',
      type: 'FIXED',
      value: 500,
      minPurchaseAmount: 1500,
      minQuantity: 1,
      applicableProductIds: ['prod-1', 'prod-2'],
      applicablePlanIds: ['plan-1', 'plan-3'],
      startDate: '2026-01-01',
      endDate: '2027-12-31',
      maxUsageCount: 80,
      currentUsageCount: 12,
      status: 'ACTIVE',
      createdAt: past30Days,
      updatedAt: past30Days
    }
  ];

  const templates: QuotationTemplate[] = [
    {
      id: 'tmpl-1',
      name: 'Full Stack Business Automation Suite',
      description: 'Preconfigured bundle including Accounting Cloud with Odoo sync and 3 CRM Pro user seats.',
      validityDurationDays: 30,
      planId: 'plan-1',
      taxIds: ['tax-1'],
      discountId: 'disc-1',
      lines: [
        {
          id: 'tmpl-l-1',
          productId: 'prod-1',
          variantId: 'var-1-2',
          quantity: 1,
          unitPrice: 2560
        },
        {
          id: 'tmpl-l-2',
          productId: 'prod-2',
          variantId: 'var-2-1',
          quantity: 3,
          unitPrice: 1500
        }
      ],
      createdAt: past30Days,
      updatedAt: past30Days
    },
    {
      id: 'tmpl-2',
      name: 'Rapid SaaS Launch Bundle',
      description: 'Dedicated Billing Engine API with expedited training onboarding.',
      validityDurationDays: 15,
      planId: 'plan-4',
      taxIds: ['tax-1', 'tax-2'],
      lines: [
        {
          id: 'tmpl-l-3',
          productId: 'prod-3',
          variantId: 'var-3-2',
          quantity: 1,
          unitPrice: 6000
        }
      ],
      createdAt: past30Days,
      updatedAt: past30Days
    }
  ];

  const subscriptions: Subscription[] = [
    {
      id: 'sub-1',
      subscriptionNumber: 'SUB-2026-0001',
      customerId: 'cust-1',
      planId: 'plan-1',
      startDate: past30Days.split('T')[0],
      expiryDate: nextMonthStr,
      nextBillingDate: todayStr, // Due for billing right now!
      paymentTerms: 'NET_30',
      status: 'ACTIVE',
      isPaused: false,
      taxIds: ['tax-1'],
      discountId: 'disc-1',
      subtotal: 2560,
      discountAmount: 384, // 15% off 2560
      taxAmount: 391.68, // 18% of 2176
      totalAmount: 2567.68,
      notes: 'Acme Enterprise primary ERP integration contract.',
      lines: [
        {
          id: 'sub-l-1',
          productId: 'prod-1',
          variantId: 'var-1-2',
          description: 'Brightloop Accounting Cloud (Odoo Integration Suite)',
          quantity: 1,
          unitPrice: 2560,
          discountAmount: 384,
          taxRate: 18,
          taxAmount: 391.68,
          lineTotal: 2567.68
        }
      ],
      history: [
        {
          id: 'hist-1',
          subscriptionId: 'sub-1',
          action: 'Created Draft',
          toStatus: 'DRAFT',
          performedBy: 'Aditi Rao',
          timestamp: past30Days,
          notes: 'Initial quotation created'
        },
        {
          id: 'hist-2',
          subscriptionId: 'sub-1',
          action: 'Issued Quotation',
          fromStatus: 'DRAFT',
          toStatus: 'QUOTATION',
          performedBy: 'Aditi Rao',
          timestamp: past30Days
        },
        {
          id: 'hist-3',
          subscriptionId: 'sub-1',
          action: 'Quotation Confirmed by Customer',
          fromStatus: 'QUOTATION',
          toStatus: 'CONFIRMED',
          performedBy: 'Alex Morgan',
          timestamp: past30Days
        },
        {
          id: 'hist-4',
          subscriptionId: 'sub-1',
          action: 'Subscription Activated',
          fromStatus: 'CONFIRMED',
          toStatus: 'ACTIVE',
          performedBy: 'Rohan Sharma',
          timestamp: past30Days
        }
      ],
      createdAt: past30Days,
      updatedAt: past30Days
    },
    {
      id: 'sub-2',
      subscriptionNumber: 'SUB-2026-0002',
      customerId: 'cust-2',
      planId: 'plan-3',
      startDate: past15Days.split('T')[0],
      expiryDate: nextMonthStr,
      nextBillingDate: nextMonthStr,
      paymentTerms: 'NET_15',
      status: 'ACTIVE',
      isPaused: false,
      taxIds: ['tax-1'],
      subtotal: 4500,
      discountAmount: 0,
      taxAmount: 810,
      totalAmount: 5310,
      notes: 'Nova Design Studio CRM seats.',
      lines: [
        {
          id: 'sub-l-2',
          productId: 'prod-2',
          variantId: 'var-2-1',
          description: 'Brightloop CRM Pro (Starter Pipeline) x 3 seats',
          quantity: 3,
          unitPrice: 1500,
          discountAmount: 0,
          taxRate: 18,
          taxAmount: 810,
          lineTotal: 5310
        }
      ],
      history: [
        {
          id: 'hist-5',
          subscriptionId: 'sub-2',
          action: 'Direct Activation',
          toStatus: 'ACTIVE',
          performedBy: 'Rohan Sharma',
          timestamp: past15Days
        }
      ],
      createdAt: past15Days,
      updatedAt: past15Days
    },
    {
      id: 'sub-3',
      subscriptionNumber: 'SUB-2026-0003',
      customerId: 'cust-3',
      planId: 'plan-2',
      startDate: past15Days.split('T')[0],
      expiryDate: '2027-10-15',
      nextBillingDate: '2027-10-15',
      paymentTerms: 'IMMEDIATE',
      status: 'CONFIRMED',
      isPaused: false,
      taxIds: ['tax-1'],
      subtotal: 20000,
      discountAmount: 0,
      taxAmount: 3600,
      totalAmount: 23600,
      lines: [
        {
          id: 'sub-l-3',
          productId: 'prod-1',
          variantId: 'var-1-1',
          description: 'Brightloop Accounting Cloud - Annual Scale',
          quantity: 1,
          unitPrice: 20000,
          discountAmount: 0,
          taxRate: 18,
          taxAmount: 3600,
          lineTotal: 23600
        }
      ],
      history: [
        {
          id: 'hist-6',
          subscriptionId: 'sub-3',
          action: 'Quotation sent to Vikram Mehta',
          toStatus: 'QUOTATION',
          performedBy: 'Rohan Sharma',
          timestamp: past15Days
        },
        {
          id: 'hist-7',
          subscriptionId: 'sub-3',
          action: 'Confirmed by Zenith Logistics',
          fromStatus: 'QUOTATION',
          toStatus: 'CONFIRMED',
          performedBy: 'Vikram Mehta',
          timestamp: past15Days
        }
      ],
      createdAt: past15Days,
      updatedAt: past15Days
    }
  ];

  const invoices: Invoice[] = [
    {
      id: 'inv-1',
      invoiceNumber: 'INV-2026-0001',
      customerId: 'cust-1',
      subscriptionId: 'sub-1',
      invoiceDate: past30Days.split('T')[0],
      dueDate: duePastStr, // overdue if unpaid! But paid!
      billingPeriodStart: past30Days.split('T')[0],
      billingPeriodEnd: todayStr,
      subtotal: 2560,
      discountBreakdown: {
        discountId: 'disc-1',
        code: 'EARLYBIRD15',
        name: 'Early Adopter 15%',
        amount: 384
      },
      taxBreakdown: [
        { taxId: 'tax-1', taxName: 'GST 18%', rate: 18, amount: 391.68 }
      ],
      totalAmount: 2567.68,
      paidAmount: 2567.68,
      outstandingAmount: 0,
      status: 'PAID',
      notes: 'Initial billing invoice for Acme Corp.',
      lines: [
        {
          id: 'inv-l-1',
          productId: 'prod-1',
          variantId: 'var-1-2',
          description: 'Brightloop Accounting Cloud (Odoo Integration Suite)',
          quantity: 1,
          unitPrice: 2560,
          discountAmount: 384,
          taxRate: 18,
          taxAmount: 391.68,
          lineTotal: 2567.68
        }
      ],
      createdAt: past30Days,
      updatedAt: past30Days
    },
    {
      id: 'inv-2',
      invoiceNumber: 'INV-2026-0002',
      customerId: 'cust-2',
      subscriptionId: 'sub-2',
      invoiceDate: past15Days.split('T')[0],
      dueDate: duePastStr, // Overdue now!
      billingPeriodStart: past15Days.split('T')[0],
      billingPeriodEnd: nextMonthStr,
      subtotal: 4500,
      taxBreakdown: [
        { taxId: 'tax-1', taxName: 'GST 18%', rate: 18, amount: 810 }
      ],
      totalAmount: 5310,
      paidAmount: 2000,
      outstandingAmount: 3310,
      status: 'CONFIRMED',
      notes: 'Partial payment received. Outstanding balance due immediately.',
      lines: [
        {
          id: 'inv-l-2',
          productId: 'prod-2',
          variantId: 'var-2-1',
          description: 'Brightloop CRM Pro (Starter Pipeline) x 3 seats',
          quantity: 3,
          unitPrice: 1500,
          discountAmount: 0,
          taxRate: 18,
          taxAmount: 810,
          lineTotal: 5310
        }
      ],
      createdAt: past15Days,
      updatedAt: past15Days
    }
  ];

  const payments: Payment[] = [
    {
      id: 'pay-1',
      paymentNumber: 'PAY-2026-0001',
      invoiceId: 'inv-1',
      customerId: 'cust-1',
      amount: 2567.68,
      paymentMethod: 'BANK_TRANSFER',
      paymentDate: past30Days.split('T')[0],
      transactionReference: 'WIRE-US-9481920',
      notes: 'Full payment via Fedwire reference 9481920',
      status: 'SUCCESS',
      createdAt: past30Days
    },
    {
      id: 'pay-2',
      paymentNumber: 'PAY-2026-0002',
      invoiceId: 'inv-2',
      customerId: 'cust-2',
      amount: 2000,
      paymentMethod: 'UPI',
      paymentDate: past15Days.split('T')[0],
      transactionReference: 'UPI-IN-83910284',
      notes: 'Initial deposit paid via UPI gateway',
      status: 'SUCCESS',
      createdAt: past15Days
    }
  ];

  return {
    users,
    customers,
    products,
    plans,
    templates,
    subscriptions,
    taxes,
    discounts,
    invoices,
    payments,
    passwordResetTokens: []
  };
}

export function loadDatabase(): DatabaseSchema {
  if (dbCache) {
    return dbCache;
  }

  const storedData = readDatabase();
  if (storedData) {
    dbCache = ensureDemoAccounts(storedData);
    return dbCache;
  }

  const legacyFile = path.join(DATA_DIR, 'brightloop_db.json');
  if (fs.existsSync(legacyFile)) {
    const legacyData = JSON.parse(fs.readFileSync(legacyFile, 'utf-8')) as DatabaseSchema;
    dbCache = ensureDemoAccounts(legacyData);
    return dbCache;
  }

  const seed = getInitialSeedData();
  writeDatabase(seed);
  markDemoAccountsSeeded();
  dbCache = seed;
  return dbCache;
}

export function saveDatabase(data: DatabaseSchema) {
  writeDatabase(data);
  dbCache = data;
}

export function closeDatabase(): void {
  sqlite?.close();
  sqlite = null;
  dbCache = null;
}

// ---------------- BUSINESS LOGIC RECURRING BILLING ENGINE ----------------

export function calculateBillingNextDate(currentDateStr: string, frequency: BillingFrequency): string {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(currentDateStr);
  if (!dateOnly) throw new RangeError(`Invalid billing date: ${currentDateStr}`);

  const year = Number(dateOnly[1]);
  const month = Number(dateOnly[2]) - 1;
  const day = Number(dateOnly[3]);
  const date = new Date(Date.UTC(year, month, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month
    || date.getUTCDate() !== day
  ) {
    throw new RangeError(`Invalid billing date: ${currentDateStr}`);
  }

  switch (frequency) {
    case 'DAILY':
      date.setUTCDate(date.getUTCDate() + 1);
      break;
    case 'WEEKLY':
      date.setUTCDate(date.getUTCDate() + 7);
      break;
    case 'MONTHLY': {
      const targetMonth = month + 1;
      const targetYear = year + Math.floor(targetMonth / 12);
      const normalizedMonth = targetMonth % 12;
      const targetDay = Math.min(day, new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate());
      date.setUTCFullYear(targetYear, normalizedMonth, targetDay);
      break;
    }
    case 'YEARLY': {
      const targetYear = year + 1;
      const targetDay = Math.min(day, new Date(Date.UTC(targetYear, month + 1, 0)).getUTCDate());
      date.setUTCFullYear(targetYear, month, targetDay);
      break;
    }
  }
  return date.toISOString().split('T')[0];
}

function addDays(currentDateStr: string, days: number): string {
  const [year, month, day] = currentDateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.toISOString().split('T')[0] !== currentDateStr) {
    throw new RangeError(`Invalid billing date: ${currentDateStr}`);
  }
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0];
}

export function runRecurringBilling(): { processed: number; generatedInvoices: Invoice[] } {
  const db = loadDatabase();
  const today = new Date().toISOString().split('T')[0];
  const generated: Invoice[] = [];
  let changed = false;

  for (const sub of db.subscriptions) {
    if (sub.status !== 'ACTIVE' || sub.isPaused) {
      continue;
    }

    const plan = db.plans.find(candidate => candidate.id === sub.planId);
    if (!plan) continue;
    if (!plan.allowRenewal) {
      const autoCloseDate = addDays(sub.expiryDate, plan.autoCloseDays);
      if (today >= autoCloseDate) {
        const now = new Date().toISOString();
        sub.status = 'CLOSED';
        sub.isPaused = false;
        sub.updatedAt = now;
        sub.history.push({
          id: `hist-${randomUUID()}`,
          subscriptionId: sub.id,
          action: 'Automatically closed after the plan term and grace period.',
          fromStatus: 'ACTIVE',
          toStatus: 'CLOSED',
          performedBy: 'System Recurring Engine',
          timestamp: now,
          notes: `Plan renewal is disabled; the ${plan.autoCloseDays}-day grace period ended on ${autoCloseDate}.`
        });
        changed = true;
        continue;
      }
      if (sub.nextBillingDate >= sub.expiryDate) continue;
    }

    // Check if nextBillingDate is due (<= today)
    if (sub.nextBillingDate <= today) {
      const frequency = plan.billingFrequency;

      const billingStart = sub.nextBillingDate;
      const billingEnd = calculateBillingNextDate(billingStart, frequency);

      // Duplicate check: Verify that no invoice already exists for this subscription covering this billing period start
      const existing = db.invoices.find(
        inv => inv.subscriptionId === sub.id && inv.billingPeriodStart === billingStart
      );

      if (!existing) {
        // Calculate due date based on payment terms
        const dueDateParts = billingStart.split('-').map(Number);
        const dueDateObj = new Date(Date.UTC(dueDateParts[0], dueDateParts[1] - 1, dueDateParts[2]));
        let daysToAdd = 0;
        if (sub.paymentTerms === 'NET_15') daysToAdd = 15;
        else if (sub.paymentTerms === 'NET_30') daysToAdd = 30;
        else if (sub.paymentTerms === 'NET_60') daysToAdd = 60;
        dueDateObj.setUTCDate(dueDateObj.getUTCDate() + daysToAdd);
        const dueDate = dueDateObj.toISOString().split('T')[0];

        // Format unique invoice number
        const invCount = db.invoices.length + 1;
        const invNum = `INV-${new Date().getUTCFullYear()}-${String(invCount).padStart(4, '0')}`;

        const invoiceSubtotal = Number(sub.lines.reduce((sum, line) => sum + line.lineTotal, 0).toFixed(2));
        const applicableLines = sub.lines.filter(line => !sub.discountId
          || !db.discounts.find(discount => discount.id === sub.discountId)?.applicableProductIds.length
          || db.discounts.find(discount => discount.id === sub.discountId)?.applicableProductIds.includes(line.productId));
        const eligibleSubtotal = Number(applicableLines.reduce((sum, line) => sum + line.lineTotal, 0).toFixed(2));
        const eligibleQuantity = applicableLines.reduce((sum, line) => sum + line.quantity, 0);
        let discountBreakdown: Invoice['discountBreakdown'];
        let discountAmount = 0;
        if (sub.discountId) {
          const disc = db.discounts.find(d => d.id === sub.discountId && d.status === 'ACTIVE');
          if (disc && billingStart >= disc.startDate && billingStart <= disc.endDate
            && disc.currentUsageCount < disc.maxUsageCount
            && eligibleSubtotal >= disc.minPurchaseAmount
            && eligibleQuantity >= disc.minQuantity
            && (!disc.applicablePlanIds.length || disc.applicablePlanIds.includes(sub.planId))
            && (!disc.applicableProductIds.length || eligibleSubtotal > 0)) {
            discountAmount = Number((disc.type === 'PERCENTAGE'
              ? eligibleSubtotal * disc.value / 100
              : Math.min(disc.value, eligibleSubtotal)).toFixed(2));
            disc.currentUsageCount += 1;
            discountBreakdown = {
              discountId: disc.id,
              code: disc.code,
              name: disc.name,
              amount: discountAmount
            };
          }
        }

        const taxRules = sub.taxIds
          .map(taxId => db.taxes.find(tax => tax.id === taxId && tax.status === 'ACTIVE'
            && billingStart >= tax.effectiveStartDate && billingStart <= tax.effectiveEndDate))
          .filter((tax): tax is Tax => tax !== undefined);
        const discountEligibleProductIds = sub.discountId
          ? db.discounts.find(discount => discount.id === sub.discountId)?.applicableProductIds || []
          : [];
        const eligibleProductIds = new Set(discountEligibleProductIds);
        const taxAmounts = new Map(taxRules.map(tax => [tax.id, 0]));
        const invoiceLines = sub.lines.map(line => {
          const eligibleForDiscount = !discountBreakdown || eligibleProductIds.size === 0 || eligibleProductIds.has(line.productId);
          const lineSubtotal = Number(line.lineTotal.toFixed(2));
          const lineDiscount = eligibleForDiscount && eligibleSubtotal > 0
            ? Number((discountAmount * lineSubtotal / eligibleSubtotal).toFixed(2))
            : 0;
          const taxableAmount = Math.max(0, lineSubtotal - lineDiscount);
          let taxRate = 0;
          let taxAmount = 0;
          for (const tax of taxRules) {
            const amount = Number((taxableAmount * tax.rate / 100).toFixed(2));
            taxRate += tax.rate;
            taxAmount += amount;
            taxAmounts.set(tax.id, (taxAmounts.get(tax.id) || 0) + amount);
          }
          return {
            id: `inv-line-${randomUUID()}`,
            productId: line.productId,
            variantId: line.variantId,
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            taxRate,
            taxAmount: Number(taxAmount.toFixed(2)),
            discountAmount: lineDiscount,
            lineTotal: Number(taxableAmount.toFixed(2))
          };
        });
        const taxBreakdown = taxRules.map(tax => ({
          taxId: tax.id,
          taxName: tax.name,
          rate: tax.rate,
          amount: Number((taxAmounts.get(tax.id) || 0).toFixed(2))
        }));
        const netSubtotal = Math.max(0, invoiceSubtotal - discountAmount);
        const invoiceTaxAmount = taxBreakdown.reduce((sum, tax) => sum + tax.amount, 0);
        const invoiceTotal = Number((netSubtotal + invoiceTaxAmount).toFixed(2));

        const newInvoice: Invoice = {
          id: `inv-${randomUUID()}`,
          invoiceNumber: invNum,
          customerId: sub.customerId,
          subscriptionId: sub.id,
          invoiceDate: billingStart,
          dueDate: dueDate,
          billingPeriodStart: billingStart,
          billingPeriodEnd: billingEnd,
          lines: invoiceLines,
          subtotal: invoiceSubtotal,
          taxBreakdown,
          discountBreakdown,
          totalAmount: invoiceTotal,
          paidAmount: 0,
          outstandingAmount: invoiceTotal,
          status: 'CONFIRMED',
          notes: `Automated recurring renewal for ${plan ? plan.name : 'Subscription'} (${sub.subscriptionNumber})`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        db.invoices.push(newInvoice);
        generated.push(newInvoice);
        changed = true;
        sub.discountAmount = discountAmount;
        sub.taxAmount = invoiceTaxAmount;
        sub.totalAmount = invoiceTotal;

        // Advance nextBillingDate
        sub.nextBillingDate = billingEnd;
        sub.expiryDate = billingEnd;
        sub.updatedAt = new Date().toISOString();
        changed = true;
        sub.history.push({
          id: `hist-${randomUUID()}`,
          subscriptionId: sub.id,
          action: `Automated Invoice ${invNum} Generated`,
          timestamp: new Date().toISOString(),
          performedBy: 'System Recurring Engine',
          notes: `Billing period ${billingStart} to ${billingEnd}. Next renewal: ${billingEnd}`
        });
      } else {
        // Already invoiced, advance next billing date so it does not loop
        sub.nextBillingDate = billingEnd;
        sub.expiryDate = billingEnd;
        sub.updatedAt = new Date().toISOString();
        changed = true;
      }
    }
  }

  if (changed) {
    saveDatabase(db);
  }

  return { processed: db.subscriptions.length, generatedInvoices: generated };
}

// ---------------- FINANCIAL REPORTING & KPIs ----------------

export function computeDashboardMetrics(): DashboardKPIs {
  const db = loadDatabase();
  const today = new Date().toISOString().split('T')[0];

  const totalCustomers = db.customers.filter(c => c.status === 'ACTIVE').length;
  const activeSubs = db.subscriptions.filter(s => s.status === 'ACTIVE' && !s.isPaused);
  const activeSubscriptions = activeSubs.length;
  const totalSubscriptions = db.subscriptions.length;

  // Actual cash received from all success payment transactions
  const revenueReceived = db.payments
    .filter(p => p.status === 'SUCCESS')
    .reduce((sum, p) => sum + p.amount, 0);

  // Invoiced revenue = sum of confirmed and paid invoices
  const invoicedRevenue = db.invoices
    .filter(i => i.status === 'CONFIRMED' || i.status === 'PAID')
    .reduce((sum, i) => sum + i.totalAmount, 0);

  // Outstanding amount on confirmed invoices
  const outstandingAmount = db.invoices
    .filter(i => i.status === 'CONFIRMED')
    .reduce((sum, i) => sum + i.outstandingAmount, 0);

  // Overdue invoices: status is CONFIRMED, outstanding > 0, and dueDate < today
  const overdueInvoices = db.invoices.filter(
    i => i.status === 'CONFIRMED' && i.outstandingAmount > 0 && i.dueDate < today
  );
  const overdueInvoicesCount = overdueInvoices.length;
  const overdueInvoicesAmount = overdueInvoices.reduce((sum, i) => sum + i.outstandingAmount, 0);

  // Monthly Recurring Revenue (MRR) strictly normalized to a monthly value:
  // DAILY: amount * 30
  // WEEKLY: amount * 4.333
  // MONTHLY: amount * 1
  // YEARLY: amount / 12
  let mrr = 0;
  for (const sub of activeSubs) {
    const plan = db.plans.find(p => p.id === sub.planId);
    const freq = plan ? plan.billingFrequency : 'MONTHLY';
    const amount = sub.totalAmount;
    switch (freq) {
      case 'DAILY':
        mrr += amount * 30;
        break;
      case 'WEEKLY':
        mrr += amount * (52 / 12);
        break;
      case 'MONTHLY':
        mrr += amount;
        break;
      case 'YEARLY':
        mrr += amount / 12;
        break;
    }
  }

  const arr = mrr * 12;

  return {
    totalCustomers,
    activeSubscriptions,
    totalSubscriptions,
    revenueReceived: Number(revenueReceived.toFixed(2)),
    invoicedRevenue: Number(invoicedRevenue.toFixed(2)),
    outstandingAmount: Number(outstandingAmount.toFixed(2)),
    overdueInvoicesCount,
    overdueInvoicesAmount: Number(overdueInvoicesAmount.toFixed(2)),
    mrr: Number(mrr.toFixed(2)),
    arr: Number(arr.toFixed(2))
  };
}
