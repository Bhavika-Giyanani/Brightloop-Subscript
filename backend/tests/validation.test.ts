import assert from 'node:assert/strict';
import test from 'node:test';
import { validateEmailAddress, validatePassword, normalizeEmail } from '../../shared/authValidation.ts';
import { calculateBillingNextDate } from '../models/database.ts';
import { adjustPriceForVariant, getVariantSurcharge } from '../../frontend/src/lib/pricing.ts';
import type { Product } from '../../shared/types.ts';

test('email validation trims and normalizes addresses', () => {
  assert.deepEqual(validateEmailAddress(' user@example.com '), { valid: true });
  assert.equal(normalizeEmail(' USER@Example.COM '), 'user@example.com');
  assert.equal(validateEmailAddress('missing-at-sign').valid, false);
  assert.equal(validateEmailAddress(42).valid, false);
});

test('password validation enforces every documented requirement', () => {
  assert.equal(validatePassword('Abcdefg!').valid, false);
  assert.match(validatePassword('abcdefgh!').error || '', /uppercase/i);
  assert.match(validatePassword('ABCDEFGH!').error || '', /lowercase/i);
  assert.match(validatePassword('Abcdefgh1').error || '', /special/i);
  assert.equal(validatePassword('Customer@12345!').valid, true);
});

test('billing date calculations clamp month and leap-year boundaries', () => {
  assert.equal(calculateBillingNextDate('2026-01-31', 'MONTHLY'), '2026-02-28');
  assert.equal(calculateBillingNextDate('2024-01-31', 'MONTHLY'), '2024-02-29');
  assert.equal(calculateBillingNextDate('2024-02-29', 'YEARLY'), '2025-02-28');
  assert.equal(calculateBillingNextDate('2026-12-31', 'DAILY'), '2027-01-01');
  assert.throws(() => calculateBillingNextDate('2026-02-31', 'MONTHLY'), RangeError);
});

test('variant surcharges are applied once and updated when the variant changes', () => {
  const product: Product = {
    id: 'product-1',
    name: 'Accounting',
    type: 'SaaS',
    baseSalesPrice: 2000,
    costPrice: 500,
    description: '',
    variants: [
      { id: 'variant-odoo', productId: 'product-1', name: 'Odoo', additionalPrice: 560, sku: 'ODOO', status: 'ACTIVE' },
      { id: 'variant-audit', productId: 'product-1', name: 'Audit', additionalPrice: 750, sku: 'AUDIT', status: 'ACTIVE' }
    ],
    status: 'ACTIVE',
    createdAt: '',
    updatedAt: ''
  };

  assert.equal(product.baseSalesPrice + getVariantSurcharge(product, 'variant-odoo'), 2560);
  assert.equal(adjustPriceForVariant(2560, product, 'variant-odoo', undefined), 2000);
  assert.equal(adjustPriceForVariant(2560, product, 'variant-odoo', 'variant-audit'), 2750);
});
