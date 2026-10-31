import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import nodemailer from 'nodemailer';
import { normalizeEmail, validateEmailAddress, validatePassword } from '../../shared/authValidation.ts';
import {
  loadDatabase,
  saveDatabase,
  runRecurringBilling,
  computeDashboardMetrics,
  calculateBillingNextDate
} from '../models/database.ts';
import {
  User,
  UserRole,
  SubscriptionStatus,
  Subscription,
  Invoice,
  InvoiceStatus,
  Payment,
  Customer,
  Product,
  SubscriptionPlan,
  QuotationTemplate,
  Tax,
  Discount
} from '../models/types.ts';

const app = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || randomBytes(32).toString('hex');
const JWT_EXPIRES_IN = '7d';

// ---------------- AUTH MIDDLEWARE & HELPERS ----------------

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    customerId?: string;
  };
}

function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required. Please sign in.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token. Please log in again.' });
    }
    req.user = decoded;
    next();
  });
}

function requireRoles(roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied: insufficient permissions for this operation.' });
    }
    next();
  };
}

function isValidDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isInvoiceStatus(value: unknown): value is InvoiceStatus {
  return value === 'DRAFT' || value === 'CONFIRMED' || value === 'PAID' || value === 'CANCELLED';
}

function validateQuotationTemplateInput(input: any, db: ReturnType<typeof loadDatabase>): string | undefined {
  const { name, description = '', validityDurationDays = 30, planId, lines, taxIds = [], discountId } = input;
  if (typeof name !== 'string' || !name.trim()
    || typeof description !== 'string'
    || !Number.isInteger(validityDurationDays) || validityDurationDays < 1
    || (planId !== undefined && !db.plans.some(plan => plan.id === planId && plan.status === 'ACTIVE'))
    || !Array.isArray(lines) || lines.length === 0
    || lines.some((line: any) => {
      const product = db.products.find(candidate => candidate.id === line?.productId && candidate.status === 'ACTIVE');
      return !product || !Number.isInteger(line.quantity) || line.quantity < 1
        || !isNonNegativeNumber(line.unitPrice)
        || (line.variantId !== undefined && !product.variants.some(variant => variant.id === line.variantId && variant.status === 'ACTIVE'));
    })
    || !Array.isArray(taxIds) || taxIds.some((taxId: unknown) => typeof taxId !== 'string')
    || (discountId !== undefined && typeof discountId !== 'string')) {
    return 'Template name, duration, plan, tax, and product line details must be valid.';
  }
  if (taxIds.some((taxId: string) => !db.taxes.some(tax => tax.id === taxId && tax.status === 'ACTIVE'))
    || (discountId && !db.discounts.some(discount => discount.id === discountId && discount.status === 'ACTIVE'))) {
    return 'Template tax or discount configuration is unavailable.';
  }
}

// ---------------- 1. AUTHENTICATION & USER MANAGEMENT ----------------

app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  const emailValidation = validateEmailAddress(email);
  if (!emailValidation.valid) {
    return res.status(400).json({ error: emailValidation.error });
  }
  if (typeof password !== 'string' || password.length === 0) {
    return res.status(400).json({ error: 'Password is required.' });
  }

  const db = loadDatabase();
  const normalizedEmail = normalizeEmail(email);
  const user = db.users.find(u => normalizeEmail(u.email) === normalizedEmail);

  if (!user || !user.passwordHash || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  if (user.status !== 'ACTIVE') {
    return res.status(403).json({ error: 'Account is deactivated. Please contact support.' });
  }

  const tokenPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
    customerId: user.customerId
  };

  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  return res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      customerId: user.customerId,
      company: user.company,
      phone: user.phone
    }
  });
});

app.post('/api/auth/register', (req: Request, res: Response) => {
  const { name, email, password, companyName, phone, billingAddress } = req.body || {};

  if (typeof name !== 'string' || !name.trim()
    || typeof companyName !== 'string' || !companyName.trim()) {
    return res.status(400).json({ error: 'Name, email, password, and company name are required.' });
  }

  const emailValidation = validateEmailAddress(email);
  if (!emailValidation.valid) {
    return res.status(400).json({ error: emailValidation.error });
  }
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return res.status(400).json({ error: passwordValidation.error });
  }

  const db = loadDatabase();
  const normalizedEmail = normalizeEmail(email);
  const existingUser = db.users.find(u => normalizeEmail(u.email) === normalizedEmail);
  if (existingUser) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const customerId = `cust-${randomUUID()}`;
  const userId = `usr-${randomUUID()}`;
  const now = new Date().toISOString();
  const customerName = name.trim();
  const company = companyName.trim();
  const normalizedPhone = typeof phone === 'string' ? phone.trim() : '';
  const normalizedBillingAddress = typeof billingAddress === 'string' ? billingAddress.trim() : '';

  const newCustomer: Customer = {
    id: customerId,
    userId,
    name: customerName,
    companyName: company,
    email: normalizedEmail,
    phone: normalizedPhone,
    billingAddress: normalizedBillingAddress,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now
  };

  const newUser: User = {
    id: userId,
    email: normalizedEmail,
    passwordHash: bcrypt.hashSync(password, 10),
    name: customerName,
    role: 'CUSTOMER',
    customerId,
    phone: normalizedPhone,
    company,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now
  };

  db.customers.push(newCustomer);
  db.users.push(newUser);
  saveDatabase(db);

  const token = jwt.sign(
    { id: newUser.id, email: newUser.email, role: newUser.role, customerId },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return res.status(201).json({
    token,
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      customerId,
      company: newUser.company,
      phone: newUser.phone
    }
  });
});

app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body || {};
  const emailValidation = validateEmailAddress(email);
  if (!emailValidation.valid) {
    return res.status(400).json({ error: emailValidation.error });
  }

  const smtpHost = process.env.SMTP_HOST?.trim();
  const sender = process.env.SMTP_FROM?.trim();
  if (!smtpHost || !sender) {
    return res.status(503).json({ error: 'Password reset email delivery is not configured.' });
  }

  const db = loadDatabase();
  const user = db.users.find(u => normalizeEmail(u.email) === normalizeEmail(email));
  if (!user) {
    return res.json({ message: 'If that email exists, password reset instructions have been dispatched.' });
  }

  const resetToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(resetToken).digest('hex');
  const expiresAt = new Date(Date.now() + 3600000).toISOString();

  db.passwordResetTokens = db.passwordResetTokens || [];
  db.passwordResetTokens.push({
    token: tokenHash,
    email: user.email,
    expiresAt
  });
  saveDatabase(db);

  try {
    const port = Number.parseInt(process.env.SMTP_PORT || '587', 10);
    const transport = nodemailer.createTransport({
      host: smtpHost,
      port,
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER && process.env.SMTP_PASSWORD
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined
    });
    const resetUrl = new URL('/', process.env.APP_URL || 'http://localhost:3000');
    resetUrl.searchParams.set('resetToken', resetToken);
    await transport.sendMail({
      from: sender,
      to: user.email,
      subject: 'Reset your Brightloop password',
      text: `Use this link within one hour to reset your Brightloop password: ${resetUrl.toString()}`,
      html: `<p>Use this link within one hour to reset your Brightloop password:</p><p><a href="${resetUrl.toString()}">Reset password</a></p>`
    });
  } catch (mailError) {
    db.passwordResetTokens = db.passwordResetTokens.filter(record => record.token !== tokenHash);
    saveDatabase(db);
    console.error('Password reset email delivery failed:', mailError);
    return res.status(502).json({ error: 'Password reset email could not be delivered. Please try again later.' });
  }

  return res.json({ message: 'If that email exists, password reset instructions have been dispatched.' });
});

app.post('/api/auth/reset-password', (req: Request, res: Response) => {
  const { token, newPassword } = req.body || {};
  if (typeof token !== 'string' || !token || typeof newPassword !== 'string' || !newPassword) {
    return res.status(400).json({ error: 'Reset token and new password are required.' });
  }

  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.valid) {
    return res.status(400).json({ error: passwordValidation.error });
  }

  const db = loadDatabase();
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const tokenRecordIndex = (db.passwordResetTokens || []).findIndex(
    t => t.token === tokenHash && new Date(t.expiresAt) > new Date()
  );

  if (tokenRecordIndex === -1) {
    return res.status(400).json({ error: 'Reset token is invalid or has expired.' });
  }

  const tokenRecord = db.passwordResetTokens[tokenRecordIndex];
  const user = db.users.find(u => u.email.toLowerCase() === tokenRecord.email.toLowerCase());
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  user.passwordHash = bcrypt.hashSync(newPassword, 10);
  user.updatedAt = new Date().toISOString();
  db.passwordResetTokens.splice(tokenRecordIndex, 1);
  saveDatabase(db);

  return res.json({ message: 'Password has been reset successfully. You may now log in.' });
});

app.get('/api/auth/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const user = db.users.find(u => u.id === req.user?.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const customer = user.customerId ? db.customers.find(c => c.id === user.customerId) : undefined;

  return res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      customerId: user.customerId,
      phone: user.phone,
      company: user.company,
      customer
    }
  });
});

app.put('/api/auth/update-profile', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { name, phone, company, billingAddress, currentPassword, newPassword } = req.body || {};
  const db = loadDatabase();
  const user = db.users.find(u => u.id === req.user?.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }
  if ((name !== undefined && (typeof name !== 'string' || !name.trim()))
    || (phone !== undefined && typeof phone !== 'string')
    || (company !== undefined && typeof company !== 'string')
    || (billingAddress !== undefined && typeof billingAddress !== 'string')) {
    return res.status(400).json({ error: 'Profile fields must contain valid text values.' });
  }

  if (newPassword) {
    if (typeof currentPassword !== 'string' || !user.passwordHash || !bcrypt.compareSync(currentPassword, user.passwordHash)) {
      return res.status(400).json({ error: 'Current password is required and must match.' });
    }
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }
    user.passwordHash = bcrypt.hashSync(newPassword, 10);
  }

  if (name !== undefined) user.name = name.trim();
  if (phone !== undefined) user.phone = phone;
  if (company !== undefined) user.company = company;
  user.updatedAt = new Date().toISOString();

  // If customer, update customer record too
  if (user.customerId) {
    const cust = db.customers.find(c => c.id === user.customerId);
    if (cust) {
      if (name !== undefined) cust.name = name.trim();
      if (phone !== undefined) cust.phone = phone;
      if (company !== undefined) cust.companyName = company;
      if (billingAddress !== undefined) cust.billingAddress = billingAddress;
      cust.updatedAt = new Date().toISOString();
    }
  }

  saveDatabase(db);
  return res.json({
    message: 'Profile updated successfully.',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      customerId: user.customerId,
      phone: user.phone,
      company: user.company
    }
  });
});

// ---------------- 2. STAFF MANAGEMENT (SUPER ADMIN ONLY) ----------------

app.get('/api/staff', authenticateToken, requireRoles(['SUPER_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const staffUsers = db.users
    .filter(u => u.role === 'INTERNAL_STAFF' || u.role === 'SUPER_ADMIN')
    .map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      phone: u.phone,
      company: u.company,
      status: u.status,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt
    }));
  return res.json(staffUsers);
});

app.post('/api/staff', authenticateToken, requireRoles(['SUPER_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const { name, email, password, phone, role } = req.body || {};
  if (typeof name !== 'string' || !name.trim()
    || (role !== undefined && !['SUPER_ADMIN', 'INTERNAL_STAFF'].includes(role))
    || (phone !== undefined && typeof phone !== 'string')) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  const emailValidation = validateEmailAddress(email);
  if (!emailValidation.valid) {
    return res.status(400).json({ error: emailValidation.error });
  }
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return res.status(400).json({ error: passwordValidation.error });
  }

  const db = loadDatabase();
  const normalizedEmail = normalizeEmail(email);
  if (db.users.find(u => normalizeEmail(u.email) === normalizedEmail)) {
    return res.status(409).json({ error: 'User with this email already exists.' });
  }

  const now = new Date().toISOString();
  const newStaff: User = {
    id: `usr-staff-${randomUUID()}`,
    email: normalizedEmail,
    passwordHash: bcrypt.hashSync(password, 10),
    name: name.trim(),
    role: role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'INTERNAL_STAFF',
    phone: typeof phone === 'string' ? phone.trim() : '',
    company: process.env.COMPANY_NAME?.trim() || '',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now
  };

  db.users.push(newStaff);
  saveDatabase(db);

  return res.status(201).json({
    message: 'Staff account created successfully.',
    staff: {
      id: newStaff.id,
      name: newStaff.name,
      email: newStaff.email,
      role: newStaff.role,
      phone: newStaff.phone,
      status: newStaff.status,
      createdAt: newStaff.createdAt
    }
  });
});

app.patch('/api/staff/:id', authenticateToken, requireRoles(['SUPER_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { name, phone, status, role, newPassword } = req.body || {};
  const db = loadDatabase();
  const staff = db.users.find(u => u.id === id && (u.role === 'INTERNAL_STAFF' || u.role === 'SUPER_ADMIN'));
  if (!staff) {
    return res.status(404).json({ error: 'Staff member not found.' });
  }
  if ((name !== undefined && (typeof name !== 'string' || !name.trim()))
    || (phone !== undefined && typeof phone !== 'string')
    || (status !== undefined && !['ACTIVE', 'INACTIVE'].includes(status))
    || (role !== undefined && !['SUPER_ADMIN', 'INTERNAL_STAFF'].includes(role))) {
    return res.status(400).json({ error: 'Staff account details are invalid.' });
  }

  if (name !== undefined) staff.name = name.trim();
  if (phone !== undefined) staff.phone = phone;
  if (status !== undefined) staff.status = status;
  if (role !== undefined) staff.role = role;
  if (newPassword) {
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }
    staff.passwordHash = bcrypt.hashSync(newPassword, 10);
  }
  staff.updatedAt = new Date().toISOString();

  saveDatabase(db);
  return res.json({
    message: 'Staff updated successfully.',
    staff: {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      phone: staff.phone,
      company: staff.company,
      status: staff.status,
      updatedAt: staff.updatedAt
    }
  });
});

// ---------------- 3. CUSTOMER MANAGEMENT ----------------

app.get('/api/customers', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  if (req.user?.role === 'CUSTOMER') {
    const customer = db.customers.find(c => c.id === req.user?.customerId);
    return res.json(customer ? [customer] : []);
  }
  return res.json(db.customers);
});

app.post('/api/customers', authenticateToken, requireRoles(['SUPER_ADMIN', 'INTERNAL_STAFF']), (req: AuthenticatedRequest, res: Response) => {
  const { name, companyName, email, phone, billingAddress, city, country, taxNumber } = req.body || {};
  const emailValidation = validateEmailAddress(email);
  if (typeof name !== 'string' || !name.trim()
    || typeof companyName !== 'string' || !companyName.trim()
    || !emailValidation.valid
    || [phone, billingAddress, city, country, taxNumber].some(value => value !== undefined && typeof value !== 'string')) {
    return res.status(400).json({ error: 'Customer name, company name, and email are required.' });
  }

  const db = loadDatabase();
  const normalizedEmail = normalizeEmail(email);
  if (db.customers.some(candidate => normalizeEmail(candidate.email) === normalizedEmail)
    || db.users.some(candidate => normalizeEmail(candidate.email) === normalizedEmail)) {
    return res.status(409).json({ error: 'A customer or account with this email already exists.' });
  }
  const now = new Date().toISOString();
  const customerId = `cust-${randomUUID()}`;

  const newCustomer: Customer = {
    id: customerId,
    name: name.trim(),
    companyName: companyName.trim(),
    email: normalizedEmail,
    phone: phone || '',
    billingAddress: billingAddress || '',
    city: city || '',
    country: country || '',
    taxNumber: taxNumber || '',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now
  };

  db.customers.push(newCustomer);
  saveDatabase(db);
  return res.status(201).json(newCustomer);
});

app.put('/api/customers/:id', authenticateToken, requireRoles(['SUPER_ADMIN', 'INTERNAL_STAFF']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const db = loadDatabase();
  const customer = db.customers.find(c => c.id === id);
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found.' });
  }

  const patch = req.body || {};
  if ((patch.name !== undefined && (typeof patch.name !== 'string' || !patch.name.trim()))
    || (patch.companyName !== undefined && (typeof patch.companyName !== 'string' || !patch.companyName.trim()))
    || (patch.email !== undefined && !validateEmailAddress(patch.email).valid)
    || ['phone', 'billingAddress', 'city', 'country', 'taxNumber'].some(field => patch[field] !== undefined && typeof patch[field] !== 'string')
    || (patch.status !== undefined && !['ACTIVE', 'INACTIVE'].includes(patch.status))) {
    return res.status(400).json({ error: 'Customer details are invalid.' });
  }
  const nextEmail = patch.email === undefined ? customer.email : normalizeEmail(patch.email);
  if (db.customers.some(candidate => candidate.id !== customer.id && normalizeEmail(candidate.email) === nextEmail)
    || db.users.some(candidate => candidate.customerId !== customer.id && normalizeEmail(candidate.email) === nextEmail)) {
    return res.status(409).json({ error: 'A customer or account with this email already exists.' });
  }
  const user = db.users.find(candidate => candidate.customerId === customer.id);
  customer.name = patch.name === undefined ? customer.name : patch.name.trim();
  customer.companyName = patch.companyName === undefined ? customer.companyName : patch.companyName.trim();
  customer.email = nextEmail;
  for (const field of ['phone', 'billingAddress', 'city', 'country', 'taxNumber'] as const) {
    if (patch[field] !== undefined) customer[field] = patch[field];
  }
  if (patch.status !== undefined) customer.status = patch.status;
  if (user && patch.email !== undefined) user.email = nextEmail;
  if (user) user.updatedAt = new Date().toISOString();
  customer.updatedAt = new Date().toISOString();
  saveDatabase(db);
  return res.json(customer);
});

// ---------------- 4. PRODUCT & VARIANT MANAGEMENT ----------------

app.get('/api/products', (req: Request, res: Response) => {
  const db = loadDatabase();
  return res.json(db.products);
});

app.post('/api/products', authenticateToken, requireRoles(['SUPER_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const { name, type, baseSalesPrice, costPrice = 0, description = '', variants = [] } = req.body || {};
  if (typeof name !== 'string' || !name.trim()
    || !['SaaS', 'Addon', 'Service', 'License'].includes(type)
    || !isNonNegativeNumber(baseSalesPrice)
    || !isNonNegativeNumber(costPrice)
    || typeof description !== 'string'
    || !Array.isArray(variants)
    || variants.some((variant: any) => typeof variant?.name !== 'string' || !variant.name.trim()
      || (variant.sku !== undefined && (typeof variant.sku !== 'string' || !variant.sku.trim()))
      || !isNonNegativeNumber(variant.additionalPrice ?? 0))) {
    return res.status(400).json({ error: 'Name, type, and base sales price are required.' });
  }

  const db = loadDatabase();
  const now = new Date().toISOString();
  const productId = `prod-${randomUUID()}`;

  const formattedVariants = variants.map((v: any, idx: number) => ({
    id: v.id || `var-${productId}-${idx}`,
    productId,
    name: v.name || 'Default Variant',
    additionalPrice: Number(v.additionalPrice) || 0,
    sku: v.sku || `${name.substring(0, 3).toUpperCase()}-${idx}`,
    status: 'ACTIVE' as const
  }));

  const newProduct: Product = {
    id: productId,
    name: name.trim(),
    type,
    baseSalesPrice: Number(baseSalesPrice),
    costPrice: Number(costPrice) || 0,
    description: description || '',
    variants: formattedVariants,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now
  };

  db.products.push(newProduct);
  saveDatabase(db);
  return res.status(201).json(newProduct);
});

app.put('/api/products/:id', authenticateToken, requireRoles(['SUPER_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const db = loadDatabase();
  const product = db.products.find(p => p.id === id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found.' });
  }

  const { name, type, baseSalesPrice, costPrice, description, variants, status } = req.body || {};
  if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
    return res.status(400).json({ error: 'Product name cannot be empty.' });
  }
  if (type !== undefined && !['SaaS', 'Addon', 'Service', 'License'].includes(type)) {
    return res.status(400).json({ error: 'Product type is invalid.' });
  }
  if (baseSalesPrice !== undefined && !isNonNegativeNumber(baseSalesPrice)) {
    return res.status(400).json({ error: 'Sales price must be a non-negative number.' });
  }
  if (costPrice !== undefined && !isNonNegativeNumber(costPrice)) {
    return res.status(400).json({ error: 'Cost price must be a non-negative number.' });
  }
  if (description !== undefined && typeof description !== 'string') {
    return res.status(400).json({ error: 'Product description must be text.' });
  }
  if (status !== undefined && !['ACTIVE', 'ARCHIVED'].includes(status)) {
    return res.status(400).json({ error: 'Product status is invalid.' });
  }
  if (variants !== undefined && (!Array.isArray(variants) || variants.some((variant: any) =>
    typeof variant?.name !== 'string' || !variant.name.trim()
    || (variant.sku !== undefined && (typeof variant.sku !== 'string' || !variant.sku.trim()))
    || !isNonNegativeNumber(variant.additionalPrice ?? 0)))) {
    return res.status(400).json({ error: 'Product variants must have a name and a valid additional price.' });
  }
  if (name !== undefined) product.name = name.trim();
  if (type !== undefined) product.type = type;
  if (baseSalesPrice !== undefined) product.baseSalesPrice = baseSalesPrice;
  if (costPrice !== undefined) product.costPrice = costPrice;
  if (description !== undefined) product.description = description;
  if (status !== undefined) product.status = status;

  if (variants && Array.isArray(variants)) {
    product.variants = variants.map((v: any, idx: number) => ({
      id: v.id || `var-${product.id}-${idx}`,
      productId: product.id,
      name: v.name,
      additionalPrice: Number(v.additionalPrice) || 0,
      sku: v.sku || `${product.name.substring(0, 3).toUpperCase()}-${idx}`,
      status: v.status || 'ACTIVE'
    }));
  }

  product.updatedAt = new Date().toISOString();
  saveDatabase(db);
  return res.json(product);
});

app.delete('/api/products/:id', authenticateToken, requireRoles(['SUPER_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const db = loadDatabase();
  const productIndex = db.products.findIndex(p => p.id === id);
  if (productIndex === -1) {
    return res.status(404).json({ error: 'Product not found.' });
  }

  // Dependency check: Cannot delete if referenced in active subscriptions or historical invoices
  const hasActiveSubscriptions = db.subscriptions.some(
    s => s.status !== 'CLOSED' && s.lines.some(l => l.productId === id)
  );
  const hasInvoices = db.invoices.some(i => i.lines.some(l => l.productId === id));

  if (hasActiveSubscriptions || hasInvoices) {
    // Soft archive instead
    db.products[productIndex].status = 'ARCHIVED';
    db.products[productIndex].updatedAt = new Date().toISOString();
    saveDatabase(db);
    return res.json({
      message: 'Product is referenced by active subscriptions or billing invoices. Archiving product instead of hard deleting to preserve audit history.',
      product: db.products[productIndex]
    });
  }

  db.products.splice(productIndex, 1);
  saveDatabase(db);
  return res.json({ message: 'Product deleted permanently.' });
});

// ---------------- 5. SUBSCRIPTION PLAN MANAGEMENT ----------------

app.get('/api/plans', (req: Request, res: Response) => {
  const db = loadDatabase();
  return res.json(db.plans);
});

app.post('/api/plans', authenticateToken, requireRoles(['SUPER_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const {
    name,
    productId,
    billingPrice,
    billingFrequency,
    minQuantity,
    availableFrom,
    availableUntil,
    autoCloseDays,
    allowPause,
    allowEarlyClosure,
    allowRenewal
  } = req.body;

  const db = loadDatabase();
  const start = availableFrom || new Date().toISOString().split('T')[0];
  const end = availableUntil || `${new Date().getUTCFullYear() + 2}-12-31`;
  const quantity = minQuantity ?? 1;
  const closeDays = autoCloseDays ?? 30;
  if (typeof name !== 'string' || !name.trim() || typeof productId !== 'string'
    || !db.products.some(product => product.id === productId && product.status === 'ACTIVE')
    || !isNonNegativeNumber(billingPrice)
    || !['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(billingFrequency)
    || !Number.isInteger(quantity) || quantity < 1
    || !Number.isInteger(closeDays) || closeDays < 0
    || !isValidDateOnly(start) || !isValidDateOnly(end) || start > end
    || [allowPause, allowEarlyClosure, allowRenewal].some(value => value !== undefined && typeof value !== 'boolean')) {
    return res.status(400).json({ error: 'Name, product, price, and billing frequency are required.' });
  }

  const now = new Date().toISOString();
  const newPlan: SubscriptionPlan = {
    id: `plan-${randomUUID()}`,
    name,
    productId,
    billingPrice: Number(billingPrice),
    billingFrequency,
    minQuantity: quantity,
    availableFrom: start,
    availableUntil: end,
    autoCloseDays: closeDays,
    allowPause: allowPause ?? true,
    allowEarlyClosure: allowEarlyClosure ?? true,
    allowRenewal: allowRenewal ?? true,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now
  };

  db.plans.push(newPlan);
  saveDatabase(db);
  return res.status(201).json(newPlan);
});

app.put('/api/plans/:id', authenticateToken, requireRoles(['SUPER_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const db = loadDatabase();
  const plan = db.plans.find(p => p.id === id);
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found.' });
  }

  const patch = req.body || {};
  const next = {
    ...plan,
    name: patch.name ?? plan.name,
    productId: patch.productId ?? plan.productId,
    billingPrice: patch.billingPrice ?? plan.billingPrice,
    billingFrequency: patch.billingFrequency ?? plan.billingFrequency,
    minQuantity: patch.minQuantity ?? plan.minQuantity,
    availableFrom: patch.availableFrom ?? plan.availableFrom,
    availableUntil: patch.availableUntil ?? plan.availableUntil,
    autoCloseDays: patch.autoCloseDays ?? plan.autoCloseDays,
    allowPause: patch.allowPause ?? plan.allowPause,
    allowEarlyClosure: patch.allowEarlyClosure ?? plan.allowEarlyClosure,
    allowRenewal: patch.allowRenewal ?? plan.allowRenewal,
    status: patch.status ?? plan.status
  };
  if (typeof next.name !== 'string' || !next.name.trim()
    || !db.products.some(product => product.id === next.productId && product.status === 'ACTIVE')
    || !isNonNegativeNumber(next.billingPrice)
    || !['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(next.billingFrequency)
    || !Number.isInteger(next.minQuantity) || next.minQuantity < 1
    || !Number.isInteger(next.autoCloseDays) || next.autoCloseDays < 0
    || !isValidDateOnly(next.availableFrom) || !isValidDateOnly(next.availableUntil)
    || next.availableFrom > next.availableUntil
    || [next.allowPause, next.allowEarlyClosure, next.allowRenewal].some(value => typeof value !== 'boolean')
    || !['ACTIVE', 'INACTIVE'].includes(next.status)) {
    return res.status(400).json({ error: 'Plan details are invalid.' });
  }
  Object.assign(plan, next, { updatedAt: new Date().toISOString() });
  saveDatabase(db);
  return res.json(plan);
});

// ---------------- 6. QUOTATION TEMPLATE MANAGEMENT ----------------

app.get('/api/quotation-templates', authenticateToken, requireRoles(['SUPER_ADMIN', 'INTERNAL_STAFF']), (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  return res.json(db.templates);
});

app.post('/api/quotation-templates', authenticateToken, requireRoles(['SUPER_ADMIN', 'INTERNAL_STAFF']), (req: AuthenticatedRequest, res: Response) => {
  const input = req.body || {};
  const db = loadDatabase();
  const validationError = validateQuotationTemplateInput(input, db);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }
  const { name, description = '', validityDurationDays = 30, planId, lines, taxIds = [], discountId } = input;
  const now = new Date().toISOString();
  const newTemplate: QuotationTemplate = {
    id: `tmpl-${randomUUID()}`,
    name: name.trim(),
    description,
    validityDurationDays,
    planId: planId || undefined,
    lines: lines.map((l: any) => ({
      id: `tmpl-l-${randomUUID()}`,
      productId: l.productId,
      variantId: l.variantId,
      quantity: l.quantity,
      unitPrice: l.unitPrice
    })),
    taxIds: taxIds || [],
    discountId: discountId || undefined,
    createdAt: now,
    updatedAt: now
  };

  db.templates.push(newTemplate);
  saveDatabase(db);
  return res.status(201).json(newTemplate);
});

app.put('/api/quotation-templates/:id', authenticateToken, requireRoles(['SUPER_ADMIN', 'INTERNAL_STAFF']), (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const template = db.templates.find(candidate => candidate.id === req.params.id);
  if (!template) {
    return res.status(404).json({ error: 'Template not found.' });
  }
  const input = req.body || {};
  const validationError = validateQuotationTemplateInput(input, db);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }
  const { name, description = '', validityDurationDays = 30, planId, lines, taxIds = [], discountId } = input;
  Object.assign(template, {
    name: name.trim(),
    description,
    validityDurationDays,
    planId: planId || undefined,
    lines: lines.map((line: any) => ({
      id: `tmpl-l-${randomUUID()}`,
      productId: line.productId,
      variantId: line.variantId,
      quantity: line.quantity,
      unitPrice: line.unitPrice
    })),
    taxIds,
    discountId: discountId === undefined ? template.discountId : discountId || undefined,
    updatedAt: new Date().toISOString()
  });
  saveDatabase(db);
  return res.json(template);
});

app.post('/api/quotation-templates/:id/duplicate', authenticateToken, requireRoles(['SUPER_ADMIN', 'INTERNAL_STAFF']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const db = loadDatabase();
  const original = db.templates.find(t => t.id === id);
  if (!original) {
    return res.status(404).json({ error: 'Template not found.' });
  }

  const now = new Date().toISOString();
  const duplicated: QuotationTemplate = {
    ...JSON.parse(JSON.stringify(original)),
    id: `tmpl-${randomUUID()}`,
    name: `${original.name} (Copy)`,
    createdAt: now,
    updatedAt: now
  };

  db.templates.push(duplicated);
  saveDatabase(db);
  return res.status(201).json(duplicated);
});

app.delete('/api/quotation-templates/:id', authenticateToken, requireRoles(['SUPER_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const db = loadDatabase();
  const idx = db.templates.findIndex(t => t.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Template not found.' });
  }
  db.templates.splice(idx, 1);
  saveDatabase(db);
  return res.json({ message: 'Template removed.' });
});

// ---------------- 7. QUOTATIONS & SUBSCRIPTION MANAGEMENT ----------------

app.get('/api/subscriptions', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  if (req.user?.role === 'CUSTOMER') {
    const custSubs = db.subscriptions.filter(s => s.customerId === req.user?.customerId);
    return res.json(custSubs);
  }
  return res.json(db.subscriptions);
});

app.post('/api/subscriptions', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { customerId, planId, startDate, paymentTerms, lines, taxIds, discountId, notes, status } = req.body || {};

  // Authorization check: Customer can only create for themselves
  const effectiveCustomerId = req.user?.role === 'CUSTOMER' ? req.user.customerId! : customerId;
  if (!effectiveCustomerId || !planId) {
    return res.status(400).json({ error: 'Customer and subscription plan are required.' });
  }

  const db = loadDatabase();
  const plan = db.plans.find(p => p.id === planId);
  if (!plan || !db.products.some(product => product.id === plan.productId && product.status === 'ACTIVE')) {
    return res.status(400).json({ error: 'Specified plan does not exist.' });
  }
  if (req.user?.role !== 'CUSTOMER' && !db.customers.some(customer => customer.id === effectiveCustomerId && customer.status === 'ACTIVE')) {
    return res.status(400).json({ error: 'Specified customer does not exist or is inactive.' });
  }

  const now = new Date().toISOString();
  const effectiveStartDate = startDate || now.split('T')[0];
  if (!isValidDateOnly(effectiveStartDate)) {
    return res.status(400).json({ error: 'A valid subscription start date is required.' });
  }
  if (plan.status !== 'ACTIVE' || effectiveStartDate < plan.availableFrom || effectiveStartDate > plan.availableUntil) {
    return res.status(400).json({ error: 'The selected subscription plan is not available on the requested start date.' });
  }
  if (status && !['DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE'].includes(status)) {
    return res.status(400).json({ error: 'A subscription cannot be created with the requested status.' });
  }
  const effectivePaymentTerms = paymentTerms || 'NET_30';
  if (!['IMMEDIATE', 'NET_15', 'NET_30', 'NET_60'].includes(effectivePaymentTerms)) {
    return res.status(400).json({ error: 'Payment terms are invalid.' });
  }
  if (taxIds !== undefined && (!Array.isArray(taxIds) || taxIds.some((id: unknown) => typeof id !== 'string'))) {
    return res.status(400).json({ error: 'Tax rules must be provided as a list of IDs.' });
  }
  const effectiveTaxIds: string[] = taxIds || [];
  const activeTaxes = effectiveTaxIds.map(id => db.taxes.find(tax => tax.id === id));
  if (activeTaxes.some(tax => !tax || tax.status !== 'ACTIVE'
    || effectiveStartDate < tax.effectiveStartDate || effectiveStartDate > tax.effectiveEndDate)) {
    return res.status(400).json({ error: 'One or more selected tax rules are unavailable for the subscription start date.' });
  }

  // Calculate Expiry Date & Next Billing Date based on frequency
  const expiryDate = calculateBillingNextDate(effectiveStartDate, plan.billingFrequency);
  const nextBillingDate = effectiveStartDate; // billing starts at startDate

  // Calculate line items, taxes, discounts
  let subtotal = 0;
  const requestedLines = req.user?.role === 'CUSTOMER' ? [] : lines;
  if (requestedLines !== undefined && (!Array.isArray(requestedLines) || requestedLines.some((line: any) => {
    const product = db.products.find(candidate => candidate.id === line?.productId && candidate.status === 'ACTIVE');
    return !product
      || !Number.isInteger(line.quantity) || line.quantity < 1
      || !isNonNegativeNumber(line.unitPrice)
      || (line.variantId !== undefined && !product.variants.some(variant => variant.id === line.variantId && variant.status === 'ACTIVE'));
  }))) {
    return res.status(400).json({ error: 'Subscription lines must reference active products and valid variants with positive quantities and prices.' });
  }
  const processedLines: Subscription['lines'] = (requestedLines || []).map((l: any) => {
    const qty = l.quantity;
    const price = l.unitPrice;
    const lineTotal = qty * price;
    subtotal += lineTotal;
    return {
      id: `sub-l-${randomUUID()}`,
      productId: l.productId,
      variantId: l.variantId,
      description: typeof l.description === 'string' ? l.description : 'Subscription Line Item',
      quantity: qty,
      unitPrice: price,
      taxRate: 0,
      taxAmount: 0,
      discountAmount: 0,
      lineTotal
    };
  });

  // If no custom lines provided, generate default from plan
  if (processedLines.length === 0) {
    const prod = db.products.find(p => p.id === plan.productId);
    const linePrice = plan.billingPrice;
    subtotal = linePrice * plan.minQuantity;
    processedLines.push({
      id: `sub-l-${randomUUID()}`,
      productId: plan.productId,
      variantId: prod?.variants[0]?.id,
      description: `${prod?.name || 'Software Subscription'} (${plan.name})`,
      quantity: plan.minQuantity,
      unitPrice: linePrice,
      taxRate: 0,
      taxAmount: 0,
      discountAmount: 0,
      lineTotal: subtotal
    });
  }

  // Calculate discount
  let discountAmount = 0;
  if (discountId) {
    const disc = db.discounts.find(d => d.id === discountId && d.status === 'ACTIVE');
    const eligibleLines = processedLines
      .filter((line: Subscription['lines'][number]) => disc?.applicableProductIds.length === 0 || disc?.applicableProductIds.includes(line.productId))
    const eligibleSubtotal = eligibleLines.reduce<number>((sum, line) => sum + line.lineTotal, 0);
    const eligibleQuantity = eligibleLines.reduce<number>((sum, line) => sum + line.quantity, 0);
    if (!disc || effectiveStartDate < disc.startDate || effectiveStartDate > disc.endDate
      || disc.currentUsageCount >= disc.maxUsageCount
      || (disc.minPurchaseAmount > 0 && eligibleSubtotal < disc.minPurchaseAmount)
      || eligibleQuantity < disc.minQuantity
      || (disc.applicablePlanIds.length > 0 && !disc.applicablePlanIds.includes(planId))
      || (disc.applicableProductIds.length > 0 && eligibleSubtotal === 0)) {
      return res.status(400).json({ error: 'The selected discount is not valid for this subscription.' });
    }
    discountAmount = disc.type === 'PERCENTAGE'
      ? (eligibleSubtotal * disc.value) / 100
      : Math.min(disc.value, eligibleSubtotal);
  }

  // Calculate taxes on net subtotal
  const netSubtotal = Math.max(0, subtotal - discountAmount);
  let taxAmount = 0;
  for (const tid of effectiveTaxIds) {
    const tax = db.taxes.find(t => t.id === tid && t.status === 'ACTIVE'
      && effectiveStartDate >= t.effectiveStartDate && effectiveStartDate <= t.effectiveEndDate);
    if (tax) {
      const lineTax = (netSubtotal * tax.rate) / 100;
      taxAmount += lineTax;
    }
  }

  const totalAmount = Number((netSubtotal + taxAmount).toFixed(2));
  const subCount = db.subscriptions.length + 1;
  const subscriptionNumber = `SUB-${new Date().getUTCFullYear()}-${String(subCount).padStart(4, '0')}`;

  const initialStatus = req.user?.role === 'CUSTOMER' ? 'QUOTATION' : status || 'DRAFT';
  const subscriptionId = `sub-${randomUUID()}`;

  const newSub: Subscription = {
    id: subscriptionId,
    subscriptionNumber,
    customerId: effectiveCustomerId,
    planId,
    startDate: effectiveStartDate,
    expiryDate,
    nextBillingDate,
    paymentTerms: effectivePaymentTerms,
    lines: processedLines,
    subtotal: Number(subtotal.toFixed(2)),
    taxAmount: Number(taxAmount.toFixed(2)),
    discountAmount: Number(discountAmount.toFixed(2)),
    totalAmount,
    status: initialStatus,
    isPaused: false,
    taxIds: effectiveTaxIds,
    discountId: discountId || undefined,
    notes: notes || '',
    history: [
      {
        id: `hist-${randomUUID()}`,
        subscriptionId,
        action: `Created subscription with status ${initialStatus}`,
        toStatus: initialStatus,
        performedBy: req.user?.email || 'User',
        timestamp: now,
        notes: `Subscription initiated via ${req.user?.role === 'CUSTOMER' ? 'Customer Portal' : 'Admin Operations'}`
      }
    ],
    createdAt: now,
    updatedAt: now
  };

  db.subscriptions.push(newSub);
  saveDatabase(db);

  // If activated directly, trigger automatic initial invoice generation
  if (newSub.status === 'ACTIVE') {
    runRecurringBilling();
  }

  return res.status(201).json(newSub);
});

app.post('/api/subscriptions/:id/transition', authenticateToken, requireRoles(['SUPER_ADMIN', 'INTERNAL_STAFF']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { targetStatus, actionNotes } = req.body || {};
  const validTargets = ['QUOTATION', 'CONFIRMED', 'ACTIVE', 'CLOSED', 'PAUSED', 'RESUME', 'RENEW'];
  if (typeof targetStatus !== 'string' || !validTargets.includes(targetStatus)) {
    return res.status(400).json({ error: 'A valid subscription status transition is required.' });
  }
  const db = loadDatabase();
  const sub = db.subscriptions.find(s => s.id === id);
  if (!sub) {
    return res.status(404).json({ error: 'Subscription not found.' });
  }

  const previousStatus = sub.status;
  const now = new Date().toISOString();

  // Workflow enforcement: Draft -> Quotation -> Confirmed -> Active -> Closed
  if (targetStatus === 'QUOTATION' && previousStatus !== 'DRAFT') {
    return res.status(400).json({ error: 'Can only convert DRAFT to QUOTATION.' });
  }
  if (targetStatus === 'CONFIRMED' && !['DRAFT', 'QUOTATION'].includes(previousStatus)) {
    return res.status(400).json({ error: 'Can only confirm from DRAFT or QUOTATION.' });
  }
  if (targetStatus === 'ACTIVE') {
    if (previousStatus !== 'CONFIRMED' && !(previousStatus === 'ACTIVE' && sub.isPaused)) {
      return res.status(400).json({ error: 'Can only activate a confirmed or paused subscription.' });
    }
    sub.isPaused = false;
    sub.status = 'ACTIVE';
  } else if (targetStatus === 'PAUSED') {
    const plan = db.plans.find(p => p.id === sub.planId);
    if (previousStatus !== 'ACTIVE' || sub.isPaused || !plan?.allowPause) {
      return res.status(400).json({ error: 'The plan associated with this subscription does not allow pausing.' });
    }
    sub.isPaused = true;
  } else if (targetStatus === 'RESUME') {
    if (previousStatus !== 'ACTIVE' || !sub.isPaused) {
      return res.status(400).json({ error: 'Only a paused active subscription can be resumed.' });
    }
    sub.isPaused = false;
  } else if (targetStatus === 'CLOSED') {
    const plan = db.plans.find(p => p.id === sub.planId);
    if (previousStatus !== 'ACTIVE' || sub.isPaused || !plan?.allowEarlyClosure) {
      return res.status(400).json({ error: 'The subscription plan does not permit early closure.' });
    }
    sub.status = 'CLOSED';
    sub.isPaused = false;
  } else if (targetStatus === 'RENEW') {
    const plan = db.plans.find(p => p.id === sub.planId);
    if (!plan?.allowRenewal || sub.status === 'DRAFT' || sub.status === 'QUOTATION') {
      return res.status(400).json({ error: 'Plan does not permit manual renewal.' });
    }
    const freq = plan ? plan.billingFrequency : 'MONTHLY';
    sub.expiryDate = calculateBillingNextDate(sub.expiryDate, freq);
  } else {
    sub.status = targetStatus as SubscriptionStatus;
  }

  sub.updatedAt = now;
  sub.history.push({
    id: `hist-${randomUUID()}`,
    subscriptionId: sub.id,
    action: targetStatus === 'PAUSED' ? 'Paused Subscription' : targetStatus === 'RESUME' ? 'Resumed Subscription' : targetStatus === 'RENEW' ? 'Renewed Subscription' : `Status changed to ${targetStatus}`,
    fromStatus: previousStatus,
    toStatus: sub.status,
    performedBy: req.user?.email || 'User',
    timestamp: now,
    notes: actionNotes || ''
  });

  saveDatabase(db);

  // If activated or renewed, run recurring check
  if (sub.status === 'ACTIVE') {
    runRecurringBilling();
  }

  return res.json({ message: 'Subscription updated successfully.', subscription: sub });
});

// ---------------- 8. TAX MANAGEMENT ----------------

app.get('/api/taxes', (req: Request, res: Response) => {
  const db = loadDatabase();
  return res.json(db.taxes);
});

app.post('/api/taxes', authenticateToken, requireRoles(['SUPER_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const { name, rate, type, description, effectiveStartDate, effectiveEndDate } = req.body;
  const start = effectiveStartDate || new Date().toISOString().split('T')[0];
  const end = effectiveEndDate || `${new Date().getUTCFullYear() + 4}-12-31`;
  if (typeof name !== 'string' || !name.trim()
    || !isNonNegativeNumber(rate) || rate > 100
    || !['PERCENTAGE', 'SURCHARGE'].includes(type || 'PERCENTAGE')
    || (description !== undefined && typeof description !== 'string')
    || !isValidDateOnly(start) || !isValidDateOnly(end) || start > end) {
    return res.status(400).json({ error: 'Tax name and rate are required.' });
  }

  const db = loadDatabase();
  const now = new Date().toISOString();
  const newTax: Tax = {
    id: `tax-${randomUUID()}`,
    name: name.trim(),
    rate,
    type: type || 'PERCENTAGE',
    description: description || '',
    effectiveStartDate: start,
    effectiveEndDate: end,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now
  };

  db.taxes.push(newTax);
  saveDatabase(db);
  return res.status(201).json(newTax);
});

app.put('/api/taxes/:id', authenticateToken, requireRoles(['SUPER_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const db = loadDatabase();
  const tax = db.taxes.find(t => t.id === id);
  if (!tax) {
    return res.status(404).json({ error: 'Tax rule not found.' });
  }

  const patch = req.body || {};
  const next = {
    ...tax,
    name: patch.name ?? tax.name,
    rate: patch.rate ?? tax.rate,
    type: patch.type ?? tax.type,
    description: patch.description ?? tax.description,
    effectiveStartDate: patch.effectiveStartDate ?? tax.effectiveStartDate,
    effectiveEndDate: patch.effectiveEndDate ?? tax.effectiveEndDate,
    status: patch.status ?? tax.status
  };
  if (typeof next.name !== 'string' || !next.name.trim()
    || !isNonNegativeNumber(next.rate) || next.rate > 100
    || !['PERCENTAGE', 'SURCHARGE'].includes(next.type)
    || typeof next.description !== 'string'
    || !isValidDateOnly(next.effectiveStartDate) || !isValidDateOnly(next.effectiveEndDate)
    || next.effectiveStartDate > next.effectiveEndDate
    || !['ACTIVE', 'INACTIVE'].includes(next.status)) {
    return res.status(400).json({ error: 'Tax rule details are invalid.' });
  }
  Object.assign(tax, next, { updatedAt: new Date().toISOString() });
  saveDatabase(db);
  return res.json(tax);
});

// ---------------- 9. DISCOUNT MANAGEMENT ----------------

app.get('/api/discounts', (req: Request, res: Response) => {
  const db = loadDatabase();
  return res.json(db.discounts);
});

app.post('/api/discounts', authenticateToken, requireRoles(['SUPER_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const { name, code, type, value, minPurchaseAmount, minQuantity, applicableProductIds, applicablePlanIds, startDate, endDate, maxUsageCount } = req.body;
  const normalizedCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
  const start = startDate || new Date().toISOString().split('T')[0];
  const end = endDate || `${new Date().getUTCFullYear() + 2}-12-31`;
  const minimumPurchase = minPurchaseAmount ?? 0;
  const minimumQuantity = minQuantity ?? 1;
  const usageLimit = maxUsageCount ?? 100;
  const discountType = type ?? 'PERCENTAGE';
  if (typeof name !== 'string' || !name.trim() || !normalizedCode
    || !['FIXED', 'PERCENTAGE'].includes(discountType)
    || !isNonNegativeNumber(value) || value <= 0 || (discountType === 'PERCENTAGE' && value > 100)
    || !isNonNegativeNumber(minimumPurchase)
    || !Number.isInteger(minimumQuantity) || minimumQuantity < 1
    || !Number.isInteger(usageLimit) || usageLimit < 1
    || (applicableProductIds !== undefined && (!Array.isArray(applicableProductIds) || applicableProductIds.some((id: unknown) => typeof id !== 'string')))
    || (applicablePlanIds !== undefined && (!Array.isArray(applicablePlanIds) || applicablePlanIds.some((id: unknown) => typeof id !== 'string')))
    || !isValidDateOnly(start) || !isValidDateOnly(end) || start > end) {
    return res.status(400).json({ error: 'Name, discount code, and value are required.' });
  }

  const db = loadDatabase();
  if (db.discounts.some(discount => discount.code.toUpperCase() === normalizedCode)) {
    return res.status(409).json({ error: 'A discount with this code already exists.' });
  }
  if ((applicableProductIds || []).some((id: string) => !db.products.some(product => product.id === id))
    || (applicablePlanIds || []).some((id: string) => !db.plans.some(plan => plan.id === id))) {
    return res.status(400).json({ error: 'Discount eligibility references an unknown product or plan.' });
  }
  const now = new Date().toISOString();
  const newDiscount: Discount = {
    id: `disc-${randomUUID()}`,
    name: name.trim(),
    code: normalizedCode,
    type: discountType,
    value,
    minPurchaseAmount: minimumPurchase,
    minQuantity: minimumQuantity,
    applicableProductIds: applicableProductIds || [],
    applicablePlanIds: applicablePlanIds || [],
    startDate: start,
    endDate: end,
    maxUsageCount: usageLimit,
    currentUsageCount: 0,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now
  };

  db.discounts.push(newDiscount);
  saveDatabase(db);
  return res.status(201).json(newDiscount);
});

app.put('/api/discounts/:id', authenticateToken, requireRoles(['SUPER_ADMIN']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const db = loadDatabase();
  const discount = db.discounts.find(d => d.id === id);
  if (!discount) {
    return res.status(404).json({ error: 'Discount not found.' });
  }

  const patch = req.body || {};
  const next = {
    ...discount,
    name: patch.name ?? discount.name,
    code: typeof patch.code === 'string' ? patch.code.trim().toUpperCase() : discount.code,
    type: patch.type ?? discount.type,
    value: patch.value ?? discount.value,
    minPurchaseAmount: patch.minPurchaseAmount ?? discount.minPurchaseAmount,
    minQuantity: patch.minQuantity ?? discount.minQuantity,
    applicableProductIds: patch.applicableProductIds ?? discount.applicableProductIds,
    applicablePlanIds: patch.applicablePlanIds ?? discount.applicablePlanIds,
    startDate: patch.startDate ?? discount.startDate,
    endDate: patch.endDate ?? discount.endDate,
    maxUsageCount: patch.maxUsageCount ?? discount.maxUsageCount,
    status: patch.status ?? discount.status
  };
  if (db.discounts.some(candidate => candidate.id !== discount.id && candidate.code.toUpperCase() === next.code.toUpperCase())) {
    return res.status(409).json({ error: 'A discount with this code already exists.' });
  }
  if (typeof next.name !== 'string' || !next.name.trim() || typeof next.code !== 'string' || !next.code.trim()
    || !['FIXED', 'PERCENTAGE'].includes(next.type)
    || !isNonNegativeNumber(next.value) || next.value <= 0 || (next.type === 'PERCENTAGE' && next.value > 100)
    || !isNonNegativeNumber(next.minPurchaseAmount)
    || !Number.isInteger(next.minQuantity) || next.minQuantity < 1
    || !Number.isInteger(next.maxUsageCount) || next.maxUsageCount < discount.currentUsageCount
    || !Array.isArray(next.applicableProductIds) || next.applicableProductIds.some(id => typeof id !== 'string' || !db.products.some(product => product.id === id))
    || !Array.isArray(next.applicablePlanIds) || next.applicablePlanIds.some(id => typeof id !== 'string' || !db.plans.some(plan => plan.id === id))
    || !isValidDateOnly(next.startDate) || !isValidDateOnly(next.endDate) || next.startDate > next.endDate
    || !['ACTIVE', 'EXPIRED', 'INACTIVE'].includes(next.status)) {
    return res.status(400).json({ error: 'Discount details are invalid.' });
  }
  Object.assign(discount, next, { updatedAt: new Date().toISOString() });
  saveDatabase(db);
  return res.json(discount);
});

app.post('/api/discounts/validate', (req: Request, res: Response) => {
  const { code, subtotal = 0, quantity = 1, productId, planId } = req.body || {};
  if (typeof code !== 'string' || !code.trim()
    || !isNonNegativeNumber(subtotal) || !Number.isInteger(quantity) || quantity < 1
    || (productId !== undefined && typeof productId !== 'string')
    || (planId !== undefined && typeof planId !== 'string')) {
    return res.status(400).json({ valid: false, error: 'Discount code, subtotal, quantity, and eligibility details are invalid.' });
  }
  const db = loadDatabase();
  const today = new Date().toISOString().split('T')[0];

  const disc = db.discounts.find(
    d => d.code.toLowerCase() === (code || '').toLowerCase() && d.status === 'ACTIVE'
  );

  if (!disc) {
    return res.status(404).json({ valid: false, error: 'Invalid or inactive discount code.' });
  }

  if (disc.currentUsageCount >= disc.maxUsageCount) {
    return res.status(400).json({ valid: false, error: 'This coupon code has reached its maximum usage limit.' });
  }

  if (today < disc.startDate || today > disc.endDate) {
    return res.status(400).json({ valid: false, error: 'This coupon code has expired or is not yet valid.' });
  }

  if ((disc.applicableProductIds.length > 0 && (!productId || !disc.applicableProductIds.includes(productId)))
    || (disc.applicablePlanIds.length > 0 && (!planId || !disc.applicablePlanIds.includes(planId)))) {
    return res.status(400).json({ valid: false, error: 'This coupon does not apply to the selected product or plan.' });
  }

  if (subtotal !== undefined && subtotal < disc.minPurchaseAmount) {
    return res.status(400).json({
      valid: false,
      error: `Minimum purchase amount of ₹${disc.minPurchaseAmount.toLocaleString()} required for this coupon.`
    });
  }

  if (quantity !== undefined && quantity < disc.minQuantity) {
    return res.status(400).json({
      valid: false,
      error: `Minimum quantity of ${disc.minQuantity} required for this coupon.`
    });
  }

  let calculatedDiscount = 0;
  if (disc.type === 'PERCENTAGE') {
    calculatedDiscount = ((subtotal || 0) * disc.value) / 100;
  } else {
    calculatedDiscount = Math.min(disc.value, subtotal || 0);
  }

  return res.json({
    valid: true,
    discount: disc,
    calculatedAmount: Number(calculatedDiscount.toFixed(2))
  });
});

// ---------------- 10. INVOICE MANAGEMENT & RECURRING BILLING ----------------

app.get('/api/invoices', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  if (req.user?.role === 'CUSTOMER') {
    const custInvoices = db.invoices.filter(i => i.customerId === req.user?.customerId);
    return res.json(custInvoices);
  }
  return res.json(db.invoices);
});

app.get('/api/invoices/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const db = loadDatabase();
  const invoice = db.invoices.find(i => i.id === id);
  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found.' });
  }

  if (req.user?.role === 'CUSTOMER' && invoice.customerId !== req.user.customerId) {
    return res.status(403).json({ error: 'Unauthorized to view this invoice.' });
  }

  const customer = db.customers.find(c => c.id === invoice.customerId);
  const subscription = invoice.subscriptionId ? db.subscriptions.find(s => s.id === invoice.subscriptionId) : undefined;
  const payments = db.payments.filter(p => p.invoiceId === invoice.id);

  return res.json({
    invoice,
    customer,
    subscription,
    payments
  });
});

app.post('/api/invoices', authenticateToken, requireRoles(['SUPER_ADMIN', 'INTERNAL_STAFF']), (req: AuthenticatedRequest, res: Response) => {
  const { customerId, subscriptionId, invoiceDate, dueDate, billingPeriodStart, billingPeriodEnd, lines, taxIds = [], discountId, notes, status = 'DRAFT' } = req.body || {};
  if (typeof customerId !== 'string' || !Array.isArray(lines) || lines.length === 0
    || !Array.isArray(taxIds) || taxIds.some((id: unknown) => typeof id !== 'string')
    || (notes !== undefined && typeof notes !== 'string')
    || !['DRAFT', 'CONFIRMED'].includes(status)) {
    return res.status(400).json({ error: 'Customer and invoice lines are required.' });
  }

  const db = loadDatabase();
  const customer = db.customers.find(candidate => candidate.id === customerId && candidate.status === 'ACTIVE');
  const subscription = subscriptionId ? db.subscriptions.find(candidate => candidate.id === subscriptionId) : undefined;
  const effectiveInvoiceDate = invoiceDate || new Date().toISOString().split('T')[0];
  const effectiveDueDate = dueDate || effectiveInvoiceDate;
  const periodStart = billingPeriodStart || effectiveInvoiceDate;
  const periodEnd = billingPeriodEnd || effectiveInvoiceDate;
  if (!customer || (subscriptionId && (!subscription || subscription.customerId !== customerId))
    || !isValidDateOnly(effectiveInvoiceDate) || !isValidDateOnly(effectiveDueDate)
    || !isValidDateOnly(periodStart) || !isValidDateOnly(periodEnd)
    || effectiveDueDate < effectiveInvoiceDate || periodStart > periodEnd) {
    return res.status(400).json({ error: 'Invoice customer, subscription, and dates must be valid and consistent.' });
  }
  const selectedTaxes = taxIds.map((id: string) => db.taxes.find(tax => tax.id === id));
  if (selectedTaxes.some(tax => !tax || tax.status !== 'ACTIVE'
    || effectiveInvoiceDate < tax.effectiveStartDate || effectiveInvoiceDate > tax.effectiveEndDate)) {
    return res.status(400).json({ error: 'One or more selected tax rules are unavailable for the invoice date.' });
  }
  const now = new Date().toISOString();
  const invCount = db.invoices.length + 1;
  const invoiceNumber = `INV-${new Date().getUTCFullYear()}-${String(invCount).padStart(4, '0')}`;

  let subtotal = 0;
  const baseLines = lines.map((line: any) => {
    const product = db.products.find(candidate => candidate.id === line?.productId && candidate.status === 'ACTIVE');
    if (!product || !Number.isInteger(line.quantity) || line.quantity < 1
      || !isNonNegativeNumber(line.unitPrice)
      || (line.variantId !== undefined && !product.variants.some(variant => variant.id === line.variantId && variant.status === 'ACTIVE'))) {
      return null;
    }
    const lineSubtotal = Number((line.quantity * line.unitPrice).toFixed(2));
    subtotal += lineSubtotal;
    return {
      id: `inv-l-${randomUUID()}`,
      productId: line.productId,
      variantId: line.variantId,
      description: typeof line.description === 'string' ? line.description : product.name,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineSubtotal
    };
  });
  if (baseLines.some(line => line === null)) {
    return res.status(400).json({ error: 'Invoice lines must reference active products and valid variants with positive quantities and prices.' });
  }
  const validLines = baseLines as Array<NonNullable<(typeof baseLines)[number]>>;

  let discountBreakdown;
  let discountAmount = 0;
  if (discountId) {
    const disc = db.discounts.find(d => d.id === discountId && d.status === 'ACTIVE');
    const eligibleLines = validLines.filter(line => !disc || disc.applicableProductIds.length === 0
      || disc.applicableProductIds.includes(line.productId));
    const eligibleSubtotal = eligibleLines.reduce((sum, line) => sum + line.lineSubtotal, 0);
    const quantity = eligibleLines.reduce((sum, line) => sum + line.quantity, 0);
    if (!disc || effectiveInvoiceDate < disc.startDate || effectiveInvoiceDate > disc.endDate
      || disc.currentUsageCount >= disc.maxUsageCount
      || eligibleSubtotal < disc.minPurchaseAmount || quantity < disc.minQuantity
      || (disc.applicablePlanIds.length > 0 && (!subscription || !disc.applicablePlanIds.includes(subscription.planId)))
      || (disc.applicableProductIds.length > 0 && eligibleSubtotal === 0)) {
      return res.status(400).json({ error: 'The selected discount is not valid for this invoice.' });
    }
    discountAmount = disc.type === 'PERCENTAGE'
      ? (eligibleSubtotal * disc.value) / 100
      : Math.min(disc.value, eligibleSubtotal);
    discountAmount = Number(discountAmount.toFixed(2));
    discountBreakdown = { discountId: disc.id, code: disc.code, name: disc.name, amount: discountAmount };
    disc.currentUsageCount += 1;
  }

  const eligibleProductIds = discountBreakdown
    ? new Set(db.discounts.find(discount => discount.id === discountId)?.applicableProductIds || [])
    : new Set<string>();
  const eligibleDiscountSubtotal = validLines
    .filter(line => eligibleProductIds.size === 0 || eligibleProductIds.has(line.productId))
    .reduce((sum, line) => sum + line.lineSubtotal, 0);
  const taxTotals = new Map<string, number>();
  const invoiceLines = validLines.map(line => {
    const eligibleForDiscount = eligibleProductIds.size === 0 || eligibleProductIds.has(line.productId);
    const lineDiscount = eligibleForDiscount && eligibleDiscountSubtotal > 0
      ? Number((discountAmount * line.lineSubtotal / eligibleDiscountSubtotal).toFixed(2))
      : 0;
    const taxableAmount = Math.max(0, line.lineSubtotal - lineDiscount);
    let taxRate = 0;
    let taxAmount = 0;
    for (const tax of selectedTaxes as Tax[]) {
      const amount = Number((taxableAmount * tax.rate / 100).toFixed(2));
      taxRate += tax.rate;
      taxAmount += amount;
      taxTotals.set(tax.id, (taxTotals.get(tax.id) || 0) + amount);
    }
    return {
      id: line.id,
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

  const netSubtotal = Math.max(0, subtotal - discountAmount);
  const taxBreakdown = (selectedTaxes as Tax[]).map(tax => ({
    taxId: tax.id,
    taxName: tax.name,
    rate: tax.rate,
    amount: Number((taxTotals.get(tax.id) || 0).toFixed(2))
  }));
  const totalTax = taxBreakdown.reduce((sum: number, t: any) => sum + t.amount, 0);
  const totalAmount = Number((netSubtotal + totalTax).toFixed(2));

  const newInvoice: Invoice = {
    id: `inv-${randomUUID()}`,
    invoiceNumber,
    customerId,
    subscriptionId,
    invoiceDate: effectiveInvoiceDate,
    dueDate: effectiveDueDate,
    billingPeriodStart: periodStart,
    billingPeriodEnd: periodEnd,
    lines: invoiceLines,
    subtotal: Number(subtotal.toFixed(2)),
    taxBreakdown,
    discountBreakdown,
    totalAmount,
    paidAmount: 0,
    outstandingAmount: totalAmount,
    status,
    notes: notes || '',
    createdAt: now,
    updatedAt: now
  };

  db.invoices.push(newInvoice);
  saveDatabase(db);
  return res.status(201).json(newInvoice);
});

app.patch('/api/invoices/:id/status', authenticateToken, requireRoles(['SUPER_ADMIN', 'INTERNAL_STAFF']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body || {};
  const db = loadDatabase();
  const invoice = db.invoices.find(i => i.id === id);
  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found.' });
  }

  const allowedTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
    DRAFT: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['CANCELLED'],
    PAID: [],
    CANCELLED: []
  };
  if (!isInvoiceStatus(status) || !allowedTransitions[invoice.status].includes(status)) {
    return res.status(400).json({ error: `Invoice cannot transition from ${invoice.status} to ${String(status)}.` });
  }

  invoice.status = status;
  invoice.updatedAt = new Date().toISOString();
  saveDatabase(db);
  return res.json(invoice);
});

// Trigger recurring billing cycle immediately
app.post('/api/billing/run-recurring', authenticateToken, requireRoles(['SUPER_ADMIN', 'INTERNAL_STAFF']), (req: AuthenticatedRequest, res: Response) => {
  const result = runRecurringBilling();
  return res.json({
    message: `Recurring billing completed successfully. Scanned ${result.processed} subscriptions.`,
    generatedInvoicesCount: result.generatedInvoices.length,
    generatedInvoices: result.generatedInvoices
  });
});

// ---------------- 11. PAYMENT MANAGEMENT ----------------

app.get('/api/payments', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  if (req.user?.role === 'CUSTOMER') {
    const custPayments = db.payments.filter(p => p.customerId === req.user?.customerId);
    return res.json(custPayments);
  }
  return res.json(db.payments);
});

app.post('/api/payments', authenticateToken, requireRoles(['SUPER_ADMIN', 'INTERNAL_STAFF']), (req: AuthenticatedRequest, res: Response) => {
  const { invoiceId, amount, paymentMethod, transactionReference, notes, paymentDate } = req.body || {};
  if (typeof invoiceId !== 'string' || !isNonNegativeNumber(amount) || amount <= 0
    || !['UPI', 'BANK_TRANSFER', 'CARD', 'CASH', 'OTHER'].includes(paymentMethod)
    || (transactionReference !== undefined && typeof transactionReference !== 'string')
    || (notes !== undefined && typeof notes !== 'string')
    || (paymentDate !== undefined && !isValidDateOnly(paymentDate))) {
    return res.status(400).json({ error: 'Invoice, amount, and payment method are required.' });
  }

  const payAmount = Number(amount.toFixed(2));
  if (payAmount !== amount) {
    return res.status(400).json({ error: 'Payment amount cannot have more than two decimal places.' });
  }

  const db = loadDatabase();
  const invoice = db.invoices.find(i => i.id === invoiceId);
  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found.' });
  }
  if (invoice.status !== 'CONFIRMED' || invoice.outstandingAmount <= 0) {
    return res.status(400).json({ error: 'Payments can only be recorded against confirmed invoices with an outstanding balance.' });
  }

  if (payAmount !== Number(invoice.outstandingAmount.toFixed(2))) {
    return res.status(400).json({
      error: `Payment amount must settle the full outstanding balance of ₹${invoice.outstandingAmount.toFixed(2)}.`
    });
  }

  const now = new Date().toISOString();
  const payCount = db.payments.length + 1;
  const paymentNumber = `PAY-${new Date().getUTCFullYear()}-${String(payCount).padStart(4, '0')}`;

  const newPayment: Payment = {
    id: `pay-${randomUUID()}`,
    paymentNumber,
    invoiceId: invoice.id,
    customerId: invoice.customerId,
    amount: payAmount,
    paymentMethod,
    paymentDate: paymentDate || now.split('T')[0],
    transactionReference: transactionReference || `TXN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
    notes: notes || '',
    status: 'SUCCESS',
    createdAt: now
  };

  db.payments.push(newPayment);

  // Update invoice balance and status
  invoice.paidAmount = Number((invoice.paidAmount + payAmount).toFixed(2));
  invoice.outstandingAmount = Number(Math.max(0, invoice.totalAmount - invoice.paidAmount).toFixed(2));

  if (invoice.outstandingAmount === 0) {
    invoice.status = 'PAID';
  }
  invoice.updatedAt = now;

  saveDatabase(db);

  return res.status(201).json({
    message: 'Payment recorded successfully.',
    payment: newPayment,
    invoice
  });
});

// ---------------- 12. DASHBOARD & FINANCIAL REPORTING ----------------

app.get('/api/dashboard', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const kpis = computeDashboardMetrics();

  // If customer is requesting, return customer-specific metrics
  if (req.user?.role === 'CUSTOMER') {
    const custId = req.user.customerId;
    const custSubs = db.subscriptions.filter(s => s.customerId === custId);
    const custInvoices = db.invoices.filter(i => i.customerId === custId);
    const custPayments = db.payments.filter(p => p.customerId === custId);

    const activeSubs = custSubs.filter(s => s.status === 'ACTIVE' && !s.isPaused);
    const outstanding = custInvoices.filter(i => i.status === 'CONFIRMED').reduce((s, i) => s + i.outstandingAmount, 0);
    const totalPaid = custPayments.reduce((s, p) => s + p.amount, 0);

    return res.json({
      customerView: true,
      activeSubscriptionsCount: activeSubs.length,
      totalSubscriptionsCount: custSubs.length,
      outstandingAmount: Number(outstanding.toFixed(2)),
      totalPaidAmount: Number(totalPaid.toFixed(2)),
      recentSubscriptions: custSubs.slice(-5).reverse(),
      recentInvoices: custInvoices.slice(-5).reverse(),
      recentPayments: custPayments.slice(-5).reverse()
    });
  }

  // Super Admin & Staff view
  const monthBuckets = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setUTCDate(1);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCMonth(date.getUTCMonth() - 5 + index);
    const key = date.toISOString().slice(0, 7);
    return {
      key,
      month: new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(date),
      invoiced: 0,
      collected: 0,
      active: 0,
      churned: 0,
      endDate: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999))
    };
  });
  const bucketByKey = new Map(monthBuckets.map(bucket => [bucket.key, bucket]));

  for (const invoice of db.invoices) {
    if (invoice.status === 'CONFIRMED' || invoice.status === 'PAID') {
      const bucket = bucketByKey.get(invoice.invoiceDate.slice(0, 7));
      if (bucket) bucket.invoiced += invoice.totalAmount;
    }
  }
  for (const payment of db.payments) {
    if (payment.status === 'SUCCESS') {
      const bucket = bucketByKey.get(payment.paymentDate.slice(0, 7));
      if (bucket) bucket.collected += payment.amount;
    }
  }
  for (const subscription of db.subscriptions) {
    const activeHistory = subscription.history
      .filter(entry => entry.toStatus === 'ACTIVE')
      .map(entry => entry.timestamp)
      .sort();
    const closedHistory = subscription.history
      .filter(entry => entry.toStatus === 'CLOSED')
      .map(entry => entry.timestamp)
      .sort();
    const activeSince = activeHistory[0]
      || (subscription.status === 'ACTIVE' ? subscription.startDate : undefined);
    const closedAt = closedHistory[closedHistory.length - 1]
      || (subscription.status === 'CLOSED' ? subscription.updatedAt : undefined);

    for (const bucket of monthBuckets) {
      if (closedAt?.slice(0, 7) === bucket.key) bucket.churned += 1;
      if (
        activeSince
        && activeSince <= bucket.endDate.toISOString()
        && (!closedAt || closedAt > bucket.endDate.toISOString())
      ) {
        bucket.active += 1;
      }
    }
  }

  const monthlyRevenue = monthBuckets.map(({ month, invoiced, collected }) => ({
    month,
    invoiced: Number(invoiced.toFixed(2)),
    collected: Number(collected.toFixed(2))
  }));
  const subscriptionGrowth = monthBuckets.map(({ month, active, churned }) => ({
    month,
    active,
    churned
  }));

  // 3. Payment Method Distribution
  const paymentMethodCount: Record<string, number> = {};
  for (const p of db.payments) {
    paymentMethodCount[p.paymentMethod] = (paymentMethodCount[p.paymentMethod] || 0) + p.amount;
  }
  const paymentDistribution = Object.entries(paymentMethodCount).map(([name, value]) => ({
    name: name.replace('_', ' '),
    value: Number(value.toFixed(2))
  }));

  // 4. Subscription Status Breakdown
  const statusCount: Record<string, number> = {};
  for (const s of db.subscriptions) {
    statusCount[s.status] = (statusCount[s.status] || 0) + 1;
  }
  const subscriptionStatusBreakdown = Object.entries(statusCount).map(([name, count]) => ({
    name,
    count
  }));

  // 5. Recent tables
  const recentSubscriptions = db.subscriptions.slice(-5).reverse().map(s => {
    const cust = db.customers.find(c => c.id === s.customerId);
    const plan = db.plans.find(p => p.id === s.planId);
    return { ...s, customerName: cust?.name, customerCompany: cust?.companyName, planName: plan?.name };
  });

  const recentInvoices = db.invoices.slice(-5).reverse().map(i => {
    const cust = db.customers.find(c => c.id === i.customerId);
    return { ...i, customerName: cust?.name, customerCompany: cust?.companyName };
  });

  const recentPayments = db.payments.slice(-5).reverse().map(p => {
    const cust = db.customers.find(c => c.id === p.customerId);
    return { ...p, customerName: cust?.name, customerCompany: cust?.companyName };
  });

  const today = new Date().toISOString().split('T')[0];
  const overdueInvoicesList = db.invoices
    .filter(i => i.status === 'CONFIRMED' && i.outstandingAmount > 0 && i.dueDate < today)
    .map(i => {
      const cust = db.customers.find(c => c.id === i.customerId);
      return { ...i, customerName: cust?.name, customerCompany: cust?.companyName };
    });

  return res.json({
    kpis,
    charts: {
      monthlyRevenue,
      subscriptionGrowth,
      paymentDistribution,
      subscriptionStatusBreakdown
    },
    tables: {
      recentSubscriptions,
      recentInvoices,
      recentPayments,
      overdueInvoices: overdueInvoicesList
    }
  });
});

app.get('/api/reports', authenticateToken, requireRoles(['SUPER_ADMIN', 'INTERNAL_STAFF']), (req: AuthenticatedRequest, res: Response) => {
  const db = loadDatabase();
  const { startDate, endDate, customerId, status } = req.query;

  let filteredInvoices = db.invoices;
  if (customerId) filteredInvoices = filteredInvoices.filter(i => i.customerId === customerId);
  if (status) filteredInvoices = filteredInvoices.filter(i => i.status === status);
  if (startDate) filteredInvoices = filteredInvoices.filter(i => i.invoiceDate >= String(startDate));
  if (endDate) filteredInvoices = filteredInvoices.filter(i => i.invoiceDate <= String(endDate));

  let filteredPayments = db.payments;
  if (customerId) filteredPayments = filteredPayments.filter(p => p.customerId === customerId);
  if (startDate) filteredPayments = filteredPayments.filter(p => p.paymentDate >= String(startDate));
  if (endDate) filteredPayments = filteredPayments.filter(p => p.paymentDate <= String(endDate));

  const totalInvoiced = filteredInvoices.reduce((sum, i) => sum + i.totalAmount, 0);
  const totalCollected = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalTaxes = filteredInvoices.reduce((sum, i) => {
    return sum + (i.taxBreakdown || []).reduce((tsum, t) => tsum + t.amount, 0);
  }, 0);
  const totalDiscounts = filteredInvoices.reduce((sum, i) => sum + (i.discountBreakdown?.amount || 0), 0);

  return res.json({
    summary: {
      totalInvoiced: Number(totalInvoiced.toFixed(2)),
      totalCollected: Number(totalCollected.toFixed(2)),
      totalTaxes: Number(totalTaxes.toFixed(2)),
      totalDiscounts: Number(totalDiscounts.toFixed(2)),
      netReceivables: Number((totalInvoiced - totalCollected).toFixed(2))
    },
    invoices: filteredInvoices,
    payments: filteredPayments
  });
});

export { app as apiRouter };
