import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import test from 'node:test';

const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'brightloop-auth-'));
process.env.SQLITE_DB_PATH = path.join(temporaryDirectory, 'test.sqlite');
process.env.JWT_SECRET = 'test-secret-with-sufficient-length';
delete process.env.SMTP_HOST;
delete process.env.SMTP_FROM;

const express = (await import('express')).default;
const routes = (await import('../routes/index.ts')).default;
const { closeDatabase, loadDatabase, runRecurringBilling, saveDatabase } = await import('../models/database.ts');

test('auth endpoints validate input, seed demo accounts, and enforce customer data scope', async () => {
  const app = express();
  app.use(express.json());
  app.use(routes);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  let smtpServer: ReturnType<typeof createServer> | undefined;
  const capturedMessages: string[] = [];

  const request = async (endpoint: string, method: string, body?: unknown, token?: string) => {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    return { response, data: await response.json() as Record<string, any> };
  };

  try {
    const seededEmails = loadDatabase().users.map(user => user.email);
    for (const demoEmail of [
      'admin@brightloop.io',
      'staff@brightloop.io',
      'alex@acmecorp.com',
      'sarah@novadesign.co'
    ]) {
      assert.ok(seededEmails.includes(demoEmail), `Expected seeded account ${demoEmail}`);
    }

    const invalidEmail = await request('/api/auth/login', 'POST', { email: 123, password: 'anything' });
    assert.equal(invalidEmail.response.status, 400);
    const invalidCredentials = await request('/api/auth/login', 'POST', { email: 'admin@brightloop.io', password: 'wrong' });
    assert.equal(invalidCredentials.response.status, 401);
    const validSeedLogin = await request('/api/auth/login', 'POST', {
      email: ' ADMIN@BRIGHTLOOP.IO ',
      password: 'Admin@12345!'
    });
    assert.equal(validSeedLogin.response.status, 200);
    assert.equal(validSeedLogin.data.user.role, 'SUPER_ADMIN');
    const invalidProduct = await request('/api/products', 'POST', {
      name: 'Invalid price product',
      type: 'SaaS',
      baseSalesPrice: -1
    }, validSeedLogin.data.token);
    assert.equal(invalidProduct.response.status, 400);
    const invalidTax = await request('/api/taxes', 'POST', {
      name: 'Invalid rate',
      rate: 101
    }, validSeedLogin.data.token);
    assert.equal(invalidTax.response.status, 400);
    const invalidDiscount = await request('/api/discounts', 'POST', {
      name: 'Invalid discount',
      code: 'INVALID101',
      type: 'PERCENTAGE',
      value: 101
    }, validSeedLogin.data.token);
    assert.equal(invalidDiscount.response.status, 400);
    const invoiceForInvalidStatus = loadDatabase().invoices.find(invoice => invoice.status === 'CONFIRMED');
    assert.ok(invoiceForInvalidStatus);
    const invalidInvoiceStatus = await request(
      `/api/invoices/${invoiceForInvalidStatus.id}/status`,
      'PATCH',
      { status: 'SENT' },
      validSeedLogin.data.token
    );
    assert.equal(invalidInvoiceStatus.response.status, 400);
    const templateProduct = loadDatabase().products.find(product => product.status === 'ACTIVE');
    const templatePlan = loadDatabase().plans.find(plan => plan.status === 'ACTIVE');
    assert.ok(templateProduct && templatePlan);
    const template = await request('/api/quotation-templates', 'POST', {
      name: 'Template integration test',
      description: 'Template CRUD verification',
      validityDurationDays: 30,
      planId: templatePlan.id,
      taxIds: [],
      lines: [{
        productId: templateProduct.id,
        variantId: templateProduct.variants[0]?.id,
        quantity: 1,
        unitPrice: templateProduct.baseSalesPrice
      }]
    }, validSeedLogin.data.token);
    assert.equal(template.response.status, 201);
    const updatedTemplate = await request(`/api/quotation-templates/${template.data.id}`, 'PUT', {
      ...template.data,
      name: 'Updated template integration test'
    }, validSeedLogin.data.token);
    assert.equal(updatedTemplate.response.status, 200);
    assert.equal(updatedTemplate.data.name, 'Updated template integration test');
    const dashboard = await request('/api/dashboard', 'GET', undefined, validSeedLogin.data.token);
    assert.equal(dashboard.response.status, 200);
    const expectedSeedInvoiceTotal = loadDatabase().invoices
      .filter(invoice => invoice.status === 'CONFIRMED' || invoice.status === 'PAID')
      .reduce((sum, invoice) => sum + invoice.totalAmount, 0);
    const chartInvoiceTotal = dashboard.data.charts.monthlyRevenue
      .reduce((sum: number, month: { invoiced: number }) => sum + month.invoiced, 0);
    assert.equal(chartInvoiceTotal, expectedSeedInvoiceTotal);
    assert.equal(dashboard.data.charts.monthlyRevenue.length, 6);

    const seededDb = loadDatabase();
    const dueSubscription = seededDb.subscriptions.find(subscription => subscription.status === 'ACTIVE' && !subscription.isPaused);
    assert.ok(dueSubscription);
    const billingDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const recurringTestSubscription = {
      ...dueSubscription,
      id: 'test-recurring-subscription',
      subscriptionNumber: 'SUB-TEST-RECURRING',
      startDate: billingDate,
      nextBillingDate: billingDate,
      discountId: undefined,
      discountAmount: 0,
      taxIds: [],
      taxAmount: 0,
      history: []
    };
    seededDb.subscriptions.push(recurringTestSubscription);
    saveDatabase(seededDb);
    const firstBillingRun = runRecurringBilling();
    assert.equal(firstBillingRun.generatedInvoices.some(invoice => invoice.subscriptionId === recurringTestSubscription.id), true);
    const invoicesAfterFirstRun = loadDatabase().invoices.length;
    const secondBillingRun = runRecurringBilling();
    assert.equal(secondBillingRun.generatedInvoices.length, 0);
    assert.equal(loadDatabase().invoices.length, invoicesAfterFirstRun);
    assert.equal(
      loadDatabase().invoices.filter(invoice => invoice.subscriptionId === recurringTestSubscription.id && invoice.billingPeriodStart === billingDate).length,
      1
    );

    const activePlan = seededDb.plans.find(plan => plan.id === dueSubscription.planId);
    assert.ok(activePlan);
    const noRenewalPlan = {
      ...activePlan,
      id: 'test-no-renewal-plan',
      allowRenewal: false,
      autoCloseDays: 5
    };
    const noRenewalSubscription = {
      ...dueSubscription,
      id: 'test-no-renewal-subscription',
      subscriptionNumber: 'SUB-TEST-NO-RENEWAL',
      planId: noRenewalPlan.id,
      expiryDate: billingDate,
      nextBillingDate: billingDate,
      discountId: undefined,
      discountAmount: 0,
      taxIds: [],
      taxAmount: 0,
      history: []
    };
    const pausedSubscription = {
      ...dueSubscription,
      id: 'test-paused-subscription',
      subscriptionNumber: 'SUB-TEST-PAUSED',
      nextBillingDate: billingDate,
      isPaused: true,
      discountId: undefined,
      discountAmount: 0,
      taxIds: [],
      taxAmount: 0,
      history: []
    };
    seededDb.plans.push(noRenewalPlan);
    seededDb.subscriptions.push(noRenewalSubscription, pausedSubscription);
    saveDatabase(seededDb);
    runRecurringBilling();
    assert.equal(noRenewalSubscription.status, 'ACTIVE');
    assert.equal(pausedSubscription.nextBillingDate, billingDate);
    assert.equal(
      loadDatabase().invoices.some(invoice => invoice.subscriptionId === noRenewalSubscription.id || invoice.subscriptionId === pausedSubscription.id),
      false
    );

    noRenewalSubscription.expiryDate = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
    noRenewalSubscription.nextBillingDate = noRenewalSubscription.expiryDate;
    saveDatabase(seededDb);
    runRecurringBilling();
    assert.equal(noRenewalSubscription.status, 'CLOSED');
    pausedSubscription.isPaused = false;
    saveDatabase(seededDb);
    const resumedBilling = runRecurringBilling();
    assert.equal(
      resumedBilling.generatedInvoices.some(invoice => invoice.subscriptionId === pausedSubscription.id && invoice.billingPeriodStart === billingDate),
      true
    );

    const payableInvoice = loadDatabase().invoices.find(invoice => invoice.status === 'CONFIRMED' && invoice.outstandingAmount > 1);
    assert.ok(payableInvoice);
    const originalOutstandingAmount = payableInvoice.outstandingAmount;
    const partialPayment = await request('/api/payments', 'POST', {
      invoiceId: payableInvoice.id,
      amount: 1,
      paymentMethod: 'CASH',
      paymentDate: new Date().toISOString().slice(0, 10),
      notes: 'Integration test partial payment'
    }, validSeedLogin.data.token);
    assert.equal(partialPayment.response.status, 400);
    const remainingPayment = await request('/api/payments', 'POST', {
      invoiceId: payableInvoice.id,
      amount: originalOutstandingAmount,
      paymentMethod: 'BANK_TRANSFER'
    }, validSeedLogin.data.token);
    assert.equal(remainingPayment.response.status, 201);
    assert.equal(remainingPayment.data.invoice.status, 'PAID');

    const productResponse = await request('/api/products', 'POST', {
      name: 'Pricing integration product',
      type: 'SaaS',
      baseSalesPrice: 2000,
      costPrice: 500,
      variants: [{ name: 'Odoo', additionalPrice: 560, sku: 'PRICING-ODOO' }]
    }, validSeedLogin.data.token);
    assert.equal(productResponse.response.status, 201);
    const taxResponse = await request('/api/taxes', 'POST', {
      name: 'Pricing integration tax',
      rate: 10,
      type: 'PERCENTAGE'
    }, validSeedLogin.data.token);
    assert.equal(taxResponse.response.status, 201);
    const discountResponse = await request('/api/discounts', 'POST', {
      name: 'Pricing integration discount',
      code: 'PRICING10',
      type: 'PERCENTAGE',
      value: 10,
      minPurchaseAmount: 1000,
      minQuantity: 1,
      applicableProductIds: [productResponse.data.id],
      maxUsageCount: 1
    }, validSeedLogin.data.token);
    assert.equal(discountResponse.response.status, 201);
    const pricingCustomerId = loadDatabase().customers[0].id;
    const invoiceDate = new Date().toISOString().slice(0, 10);
    const calculatedInvoice = await request('/api/invoices', 'POST', {
      customerId: pricingCustomerId,
      invoiceDate,
      dueDate: invoiceDate,
      billingPeriodStart: invoiceDate,
      billingPeriodEnd: invoiceDate,
      taxIds: [taxResponse.data.id],
      discountId: discountResponse.data.id,
      lines: [{
        productId: productResponse.data.id,
        variantId: productResponse.data.variants[0].id,
        description: 'Variant-priced product',
        quantity: 1,
        unitPrice: 2560
      }]
    }, validSeedLogin.data.token);
    assert.equal(calculatedInvoice.response.status, 201);
    assert.equal(calculatedInvoice.data.status, 'DRAFT');
    assert.equal(calculatedInvoice.data.subtotal, 2560);
    assert.equal(calculatedInvoice.data.discountBreakdown.amount, 256);
    assert.equal(calculatedInvoice.data.lines[0].discountAmount, 256);
    assert.equal(calculatedInvoice.data.lines[0].taxAmount, 230.4);
    assert.equal(calculatedInvoice.data.taxBreakdown[0].amount, 230.4);
    assert.equal(calculatedInvoice.data.totalAmount, 2534.4);
    const usedDiscountAgain = await request('/api/invoices', 'POST', {
      customerId: pricingCustomerId,
      invoiceDate,
      dueDate: invoiceDate,
      billingPeriodStart: invoiceDate,
      billingPeriodEnd: invoiceDate,
      discountId: discountResponse.data.id,
      lines: [{
        productId: productResponse.data.id,
        variantId: productResponse.data.variants[0].id,
        quantity: 1,
        unitPrice: 2560
      }]
    }, validSeedLogin.data.token);
    assert.equal(usedDiscountAgain.response.status, 400);
    const confirmedPricingInvoice = await request(`/api/invoices/${calculatedInvoice.data.id}/status`, 'PATCH', {
      status: 'CONFIRMED'
    }, validSeedLogin.data.token);
    assert.equal(confirmedPricingInvoice.response.status, 200);
    assert.equal(confirmedPricingInvoice.data.status, 'CONFIRMED');

    for (const invalidPassword of ['Abcdefg!', 'abcdefgh!', 'ABCDEFGH!', 'Abcdefgh1']) {
      const registration = await request('/api/auth/register', 'POST', {
        name: 'Test User',
        email: `test-${invalidPassword}@example.com`,
        password: invalidPassword,
        companyName: 'Test Company'
      });
      assert.equal(registration.response.status, 400);
    }
    const malformedRegistration = await request('/api/auth/register', 'POST', {
      name: 'Test User',
      email: 'not-an-email',
      password: 'Customer@12345!',
      companyName: 'Test Company'
    });
    assert.equal(malformedRegistration.response.status, 400);

    const email = 'Registration.Test@example.com';
    const registration = await request('/api/auth/register', 'POST', {
      name: 'Registration Test',
      email,
      password: 'Customer@12345!',
      companyName: 'Registration Test Company'
    });
    assert.equal(registration.response.status, 201);
    assert.equal(registration.data.user.email, email.toLowerCase());
    assert.equal('password' in registration.data.user, false);
    assert.notEqual(
      loadDatabase().users.find(user => user.email === email.toLowerCase())?.passwordHash,
      'Customer@12345!'
    );
    const duplicate = await request('/api/auth/register', 'POST', {
      name: 'Duplicate User',
      email: email.toUpperCase(),
      password: 'Customer@12345!',
      companyName: 'Duplicate Company'
    });
    assert.equal(duplicate.response.status, 409);

    const customerLogin = await request('/api/auth/login', 'POST', {
      email: email.toUpperCase(),
      password: 'Customer@12345!'
    });
    assert.equal(customerLogin.response.status, 200);
    const customerToken = customerLogin.data.token as string;
    const customers = await request('/api/customers', 'GET', undefined, customerToken);
    assert.equal(customers.response.status, 200);
    assert.equal((customers.data as unknown as unknown[]).length, 1);
    const customerDashboard = await request('/api/dashboard', 'GET', undefined, customerToken);
    assert.equal(customerDashboard.response.status, 200);
    assert.equal(customerDashboard.data.customerView, true);
    assert.equal('invoicedRevenue' in customerDashboard.data, false);
    const invoices = await request('/api/invoices', 'GET', undefined, customerToken);
    assert.equal(invoices.response.status, 200);
    assert.equal((invoices.data as unknown as unknown[]).length, 0);
    const staffList = await request('/api/staff', 'GET', undefined, customerToken);
    assert.equal(staffList.response.status, 403);
    const customerTemplates = await request('/api/quotation-templates', 'GET', undefined, customerToken);
    assert.equal(customerTemplates.response.status, 403);
    const staffLogin = await request('/api/auth/login', 'POST', {
      email: 'staff@brightloop.io',
      password: 'Staff@12345!'
    });
    assert.equal(staffLogin.response.status, 200);
    const adminOnlyStaffList = await request('/api/staff', 'GET', undefined, staffLogin.data.token);
    assert.equal(adminOnlyStaffList.response.status, 403);
    const staffOnlyProductCreation = await request('/api/products', 'POST', {
      name: 'Unauthorized Product',
      type: 'SaaS',
      baseSalesPrice: 1
    }, staffLogin.data.token);
    assert.equal(staffOnlyProductCreation.response.status, 403);

    const plan = loadDatabase().plans.find(candidate => candidate.status === 'ACTIVE');
    assert.ok(plan);
    const customerSubscription = await request('/api/subscriptions', 'POST', {
      planId: plan.id,
      startDate: new Date().toISOString().slice(0, 10),
      status: 'ACTIVE'
    }, customerToken);
    assert.equal(customerSubscription.response.status, 201);
    assert.equal(customerSubscription.data.status, 'QUOTATION');
    const customerStatusEscalation = await request(
      `/api/subscriptions/${customerSubscription.data.id}/transition`,
      'POST',
      { targetStatus: 'ACTIVE' },
      customerToken
    );
    assert.equal(customerStatusEscalation.response.status, 403);

    const resetWithoutDelivery = await request('/api/auth/forgot-password', 'POST', { email });
    assert.equal(resetWithoutDelivery.response.status, 503);

    const otherInvoiceId = loadDatabase().invoices.find(invoice => invoice.customerId !== registration.data.user.customerId)?.id;
    assert.ok(otherInvoiceId);
    const otherInvoice = await request(`/api/invoices/${otherInvoiceId}`, 'GET', undefined, customerToken);
    assert.equal(otherInvoice.response.status, 403);
    const customerPayment = await request('/api/payments', 'POST', {
      invoiceId: otherInvoiceId,
      amount: 1,
      paymentMethod: 'CARD'
    }, customerToken);
    assert.equal(customerPayment.response.status, 403);

    smtpServer = createServer(socket => {
      let buffer = '';
      let collectingMessage = false;
      const messageLines: string[] = [];
      socket.write('220 brightloop-test ESMTP\r\n');
      socket.on('data', chunk => {
        buffer += chunk.toString();
        let lineEnd = buffer.indexOf('\r\n');
        while (lineEnd >= 0) {
          const line = buffer.slice(0, lineEnd);
          buffer = buffer.slice(lineEnd + 2);
          if (collectingMessage) {
            if (line === '.') {
              collectingMessage = false;
              capturedMessages.push(messageLines.join('\n'));
              messageLines.length = 0;
              socket.write('250 2.0.0 Message accepted\r\n');
            } else {
              messageLines.push(line);
            }
          } else if (line === 'DATA') {
            collectingMessage = true;
            socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
          } else if (line === 'QUIT') {
            socket.write('221 2.0.0 Bye\r\n');
          } else {
            socket.write('250 brightloop-test\r\n');
          }
          lineEnd = buffer.indexOf('\r\n');
        }
      });
    });
    smtpServer.listen(0, '127.0.0.1');
    await once(smtpServer, 'listening');
    const smtpAddress = smtpServer.address();
    assert.ok(smtpAddress && typeof smtpAddress !== 'string');
    process.env.SMTP_HOST = '127.0.0.1';
    process.env.SMTP_PORT = String(smtpAddress.port);
    process.env.SMTP_FROM = 'Brightloop Test <noreply@example.test>';
    process.env.APP_URL = baseUrl;

    const resetRequest = await request('/api/auth/forgot-password', 'POST', { email });
    assert.equal(resetRequest.response.status, 200);
    assert.equal(capturedMessages.length, 1);
    const deliveredMessage = capturedMessages.join('\n').replace(/=\n/g, '').replace(/=3D/gi, '=');
    const resetLink = deliveredMessage.match(/http:\/\/127\.0\.0.1:\d+\/\?resetToken=[a-f0-9]+/)?.[0];
    assert.ok(resetLink, 'Expected reset URL in delivered email.');
    const deliveredToken = new URL(resetLink).searchParams.get('resetToken');
    assert.ok(deliveredToken);
    assert.ok(
      loadDatabase().passwordResetTokens.some(record => record.email === email.toLowerCase()),
      'Expected reset token to be stored for the registered user.'
    );
    assert.ok(
      loadDatabase().passwordResetTokens.some(
        record => record.token === createHash('sha256').update(deliveredToken).digest('hex')
      ),
      'Expected reset link token to match the stored token hash.'
    );

    const reset = await request('/api/auth/reset-password', 'POST', {
      token: deliveredToken,
      newPassword: 'Updated@12345!'
    });
    assert.equal(reset.response.status, 200, JSON.stringify(reset.data));
    const reusedToken = await request('/api/auth/reset-password', 'POST', {
      token: deliveredToken,
      newPassword: 'Another@12345!'
    });
    assert.equal(reusedToken.response.status, 400);
    const loginWithResetPassword = await request('/api/auth/login', 'POST', {
      email,
      password: 'Updated@12345!'
    });
    assert.equal(loginWithResetPassword.response.status, 200);
  } finally {
    server.close();
    await once(server, 'close');
    if (smtpServer?.listening) {
      smtpServer.close();
      await once(smtpServer, 'close');
    }
    closeDatabase();
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
