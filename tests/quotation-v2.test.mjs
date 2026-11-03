import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFLib from '../lib/vendor/pdf-lib.mjs';
import fontkit from '../lib/vendor/fontkit.mjs';
import assets from '../lib/proposal-assets.mjs';
import { calculate } from '../lib/calculator.mjs';
import {
  GENERATOR_VERSION,
  QuotationValidationError,
  WORKFORCE_FIELD_MASKS,
  WORKFORCE_OVERLAY_FIELDS,
  generateExactWorkforceQuotation,
  validateWorkforceQuotation,
} from '../lib/quotation-v2.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const templateDir = process.env.QUOTATION_TEMPLATE_DIR || '/home/ubuntu/upload';
const decode = value => Uint8Array.from(Buffer.from(value, 'base64'));
const execFile = promisify(execFileCallback);
const template = async plan => readFile(path.join(templateDir, `GeoInTime_Quotation_Workforce_${plan}_Bank_Transfer.pdf`));
const baseInput = { employees: 60, plan: 'essentials', cycle: 'annual', discount: 0, taxMode: 'egypt', startDate: '2026-10-25', extraAmount: '' };
const baseQuote = (changes = {}) => calculate({ ...baseInput, ...changes });
const assetsFor = () => ({ fontBytes: decode(assets.font), boldBytes: decode(assets.bold), semiBytes: decode(assets.semi), fontkit });
const assert422 = (fn, code) => {
  assert.throws(fn, error => error instanceof QuotationValidationError && error.status === 422 && error.code === code);
};

// Keep this test file runnable in a checkout without the uploaded PDFs, while CI
// and local production verification use QUOTATION_TEMPLATE_DIR=/home/ubuntu/upload.
const originalsAvailable = await Promise.all([
  template('Essentials').then(() => true, () => false),
  template('Operations').then(() => true, () => false),
]);

test('exports a cache-busting generator version and measured field masks', () => {
  assert.match(GENERATOR_VERSION, /^quotation-v2-exact-workforce-/);
  assert.deepEqual(WORKFORCE_FIELD_MASKS.usersEssentials, { page: 2, x: 480, top: 75, width: 72, height: 29, background: 'white' });
  assert.deepEqual(WORKFORCE_FIELD_MASKS.usersOperations, { page: 2, x: 480, top: 87, width: 72, height: 32, background: 'white' });
  assert.deepEqual(WORKFORCE_FIELD_MASKS.billingCycle, { page: 3, x: 57, top: 205, width: 225, height: 20, background: 'navy' });
  assert.deepEqual(WORKFORCE_FIELD_MASKS.subscriptionRow, { page: 3, x: 50, top: 386, width: 385, height: 30, background: 'white' });
  assert.equal(WORKFORCE_FIELD_MASKS.coverMeta, undefined);
  assert.deepEqual(WORKFORCE_OVERLAY_FIELDS.heroPrice, { page: 3, x: 69, top: 179, width: 188, height: 22, background: 'navy', minSize: 8 });
  assert.deepEqual(WORKFORCE_OVERLAY_FIELDS.regularUnitPrice, { page: 3, x: 443, top: 165, width: 89, height: 15, background: 'white', minSize: 8 });
  assert.deepEqual(WORKFORCE_OVERLAY_FIELDS.discountPercent, { page: 3, x: 443, top: 219, width: 89, height: 15, background: 'white', minSize: 8 });
  assert.deepEqual(WORKFORCE_OVERLAY_FIELDS.netUnitPrice, { page: 3, x: 443, top: 273, width: 89, height: 15, background: 'white', minSize: 8 });
});

test('validates a standard annual quote with implementation as a supported explicit subline', () => {
  const quote = baseQuote();
  const result = validateWorkforceQuotation(quote);
  assert.equal(result.plan, 'essentials');
  assert.equal(result.cycleMonths, 12);
  assert.equal(quote.implementation, 750000);
  assert.equal(quote.schedule[0].implementation, 750000);
  assert.equal(quote.firstYearTotal, 5369400);
});

test('blocks unresolved tax, incomplete setup, unsupported plan, unsupported optional fees, and missing approval', () => {
  assert422(() => validateWorkforceQuotation(baseQuote({ taxMode: 'unknown' })), 'tax.unknown');
  assert422(() => validateWorkforceQuotation(baseQuote({ employees: 501 })), 'implementation.missing');
  assert422(() => validateWorkforceQuotation({ ...baseQuote(), plan: 'operations' }), 'plan.unsupported');
  assert422(() => validateWorkforceQuotation(baseQuote({ extraAmount: 100 })), 'fees.unsupported');
  assert422(() => validateWorkforceQuotation(baseQuote({ discount: 7 })), 'approval.required');
  assert.doesNotThrow(() => validateWorkforceQuotation(baseQuote({ discount: 7 }), { approvalRecorded: true }));
});

test('reconciles gross subscription, discount, VAT, total, and hardware numerically', () => {
  const quote = baseQuote({ discount: 7, hardwareQty: 2, hardwareUnitPrice: 2700, cycle: 'quarterly' });
  assert.doesNotThrow(() => validateWorkforceQuotation(quote, { approvalRecorded: true }));
  const first = quote.schedule[0];
  const discountForCycle = quote.discountMonthly * quote.cycleMonths;
  const grossSubtotal = first.subtotal + discountForCycle;
  assert.equal(grossSubtotal, quote.beforeDiscountMonthly * quote.cycleMonths + quote.implementation + quote.hardwareTotal);
  assert.equal(grossSubtotal - discountForCycle, first.subtotal);
  assert.equal(first.total, first.subtotal + first.tax);
  assert.equal(quote.hardwareQty * Math.round(quote.hardwareUnitPrice * 100), quote.hardwareTotal);
  assert.equal(first.core, quote.coreMonthly * quote.cycleMonths);
  assert.equal(first.extra, 0);
  assert.equal(first.once, quote.hardwareTotal);
});

test('rejects stale cycle, pricing, hardware, schedule, and saved-approval fields', () => {
  const cycle = baseQuote({ discount: 7 });
  cycle.approval = { needsApproval: false };
  assert422(() => validateWorkforceQuotation(cycle), 'approval.required');

  const badCycle = baseQuote();
  badCycle.cycleMonths = 6;
  assert422(() => validateWorkforceQuotation(badCycle), 'cycle.reconciliation');

  const badBase = baseQuote();
  badBase.beforeDiscountMonthly += 1;
  assert422(() => validateWorkforceQuotation(badBase), 'quote.reconciliation');

  const badDiscount = baseQuote({ discount: 7 });
  badDiscount.discountMonthly += 1;
  assert422(() => validateWorkforceQuotation(badDiscount, { approvalRecorded: true }), 'quote.reconciliation');

  const badHardware = baseQuote({ hardwareQty: 1, hardwareUnitPrice: 2700 });
  badHardware.hardwareTotal += 1;
  badHardware.extrasOnce += 1;
  badHardware.schedule[0].once += 1;
  assert422(() => validateWorkforceQuotation(badHardware), 'hardware.reconciliation');

  const badSchedule = baseQuote();
  badSchedule.schedule[0].core += 1;
  assert422(() => validateWorkforceQuotation(badSchedule), 'schedule.reconciliation');
});

test('rejects non-safe monetary values and schedule tampering instead of producing a customer PDF', () => {
  const unsafe = baseQuote();
  unsafe.firstYearTotal = Number.MAX_SAFE_INTEGER + 1;
  assert422(() => validateWorkforceQuotation(unsafe), 'money.invalid');
  const tampered = baseQuote();
  tampered.schedule = structuredClone(tampered.schedule);
  tampered.schedule[0].total += 1;
  assert422(() => validateWorkforceQuotation(tampered), 'schedule.reconciliation');
});

for (const [label, plan, filePlan] of [
  ['Essentials', 'essentials', 'Essentials'],
  ['Operations', 'combined', 'Operations'],
]) {
  test(`renders the original ${label} template as exactly five A4 pages without a draft watermark`, { skip: !originalsAvailable[filePlan === 'Essentials' ? 0 : 1] }, async () => {
    const quote = baseQuote({ plan });
    const bytes = await generateExactWorkforceQuotation(PDFLib, {
      templateBytes: await template(filePlan),
      quote,
      customer: 'Acme Workforce',
      number: 'GIT-20261103-ABC123',
      issuedDate: '2026-11-03',
      expiresAt: '2026-11-10',
      ...assetsFor(),
    });
    const doc = await PDFLib.PDFDocument.load(bytes);
    assert.equal(doc.getPageCount(), 5);
    for (const page of doc.getPages()) {
      assert.ok(Math.abs(page.getWidth() - 595.3039) < 0.05);
      assert.ok(Math.abs(page.getHeight() - 841.8898) < 0.05);
    }
    assert.equal(Buffer.from(bytes).toString('latin1').includes('DRAFT - COMMERCIAL APPROVAL REQUIRED'), false);
  });
}

test('renders financially meaningful dynamic values and preserves the static Users label', { skip: !originalsAvailable[0] }, async () => {
  const quote = baseQuote({ discount: 7, hardwareQty: 2, hardwareUnitPrice: 2700 });
  const bytes = await generateExactWorkforceQuotation(PDFLib, {
    templateBytes: await template('Essentials'),
    quote,
    customer: 'Token check',
    number: 'GIT-TOKENS',
    issuedDate: '2026-11-03',
    expiresAt: '2026-11-10',
    workingHoursTimezone: 'Europe/London',
    approvalRecorded: true,
    ...assetsFor(),
  });
  const dir = await mkdtemp('/tmp/quotation-v2-');
  const pdfPath = path.join(dir, 'tokens.pdf');
  try {
    await writeFile(pdfPath, bytes);
    const { stdout } = await execFile('pdftotext', ['-layout', pdfPath, '-']);
    assert.match(stdout, /\bUsers\b/);
    assert.match(stdout, /Actual 60/);
    assert.match(stdout, /Billed 60/);
    assert.match(stdout, /yearly/);
    assert.match(stdout, /55\.00 EGP/);
    assert.match(stdout, /7%/);
    assert.match(stdout, /51\.15 EGP/);
    assert.match(stdout, /Europe\/London/);
    assert.match(stdout, /52,500\.00 EGP/);
    assert.match(stdout, /-2,772\.00 EGP/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('uses the actual issued/expiry day difference rather than a hardcoded validity number', { skip: !originalsAvailable[0] }, async () => {
  const bytes = await generateExactWorkforceQuotation(PDFLib, {
    templateBytes: await template('Essentials'),
    quote: baseQuote(),
    customer: 'Calendar check',
    number: 'GIT-DATES',
    issuedDate: '2026-11-03',
    expiresAt: '2026-11-17',
    ...assetsFor(),
  });
  assert.equal((await PDFLib.PDFDocument.load(bytes)).getPageCount(), 5);
});

test('Arabic names render without reversing characters when an Arabic font is supplied', { skip: !originalsAvailable[0] }, async () => {
  const arabicFontBytes = await readFile('/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf').catch(() => null);
  if (!arabicFontBytes) return;
  const bytes = await generateExactWorkforceQuotation(PDFLib, {
    templateBytes: await template('Essentials'),
    quote: baseQuote(),
    customer: 'شركة الجيواين تايم',
    number: 'GIT-ARABIC',
    issuedDate: '2026-11-03',
    expiresAt: '2026-11-12',
    arabicFontBytes,
    ...assetsFor(),
  });
  assert.equal((await PDFLib.PDFDocument.load(bytes)).getPageCount(), 5);
});

test('Arabic names fail safely when no image or Arabic font is available', { skip: !originalsAvailable[0] }, async () => {
  await assert.rejects(generateExactWorkforceQuotation(PDFLib, {
    templateBytes: await template('Essentials'),
    quote: baseQuote(),
    customer: 'شركة عربية',
    number: 'GIT-ARABIC',
    issuedDate: '2026-11-03',
    expiresAt: '2026-11-10',
  }), error => error instanceof QuotationValidationError && error.status === 422 && error.code === 'customer.arabic_font_missing');
});

test('accepts the frontend PNG data URL without requiring a server-side character reversal', { skip: !originalsAvailable[0] }, async () => {
  const customerImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAYAAAB/qH1jAAAAGElEQVR4nGMUFFb+zwABjAwMDAxMDGgAACcsAUvKq+1GAAAAAElFTkSuQmCC';
  const bytes = await generateExactWorkforceQuotation(PDFLib, {
    templateBytes: await template('Essentials'),
    quote: baseQuote(),
    customer: 'شركة GeoInTime',
    customerImage,
    preparedByImage: customerImage,
    number: 'GIT-IMAGE',
    issuedDate: '2026-11-03',
    expiresAt: '2026-11-10',
    ...assetsFor(),
  });
  assert.equal((await PDFLib.PDFDocument.load(bytes)).getPageCount(), 5);
});
