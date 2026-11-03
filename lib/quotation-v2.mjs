// Exact Workforce quotation generator.
//
// The source PDF is the design. This module only places variable values in the
// measured blank/variable fields and replaces the three conflicting pricing
// body copy. It never redraws a page, table, logo, bank detail, or body copy.

export const GENERATOR_VERSION = 'quotation-v2-exact-workforce-2026-11-03-compatible-xref-v2';

export const WORKFORCE_FIELD_MASKS = Object.freeze({
  usersEssentials: { page: 2, x: 480, top: 75, width: 72, height: 29, background: 'white' },
  usersOperations: { page: 2, x: 480, top: 87, width: 72, height: 32, background: 'white' },
  billingCycle: { page: 3, x: 57, top: 205, width: 225, height: 20, background: 'navy' },
  annualEquivalent: { page: 3, x: 57, top: 244, width: 225, height: 34, background: 'navy' },
  subscriptionRow: { page: 3, x: 50, top: 386, width: 385, height: 30, background: 'white' },
  locatorRow: { page: 3, x: 50, top: 421, width: 385, height: 18, background: 'white' },
  terms: { page: 3, x: 43, top: 599, width: 510, height: 17, background: 'white' },
});

// Every dynamic overlay field, including fields that are blank in the source
// and therefore do not need a background mask. These are intentionally kept
// explicit for pixel-diff/audit tooling owned by the parent API.
export const WORKFORCE_OVERLAY_FIELDS = Object.freeze({
  coverCustomer: { page: 1, x: 84, top: 707, width: 250, height: 27, background: 'navy', minSize: 8 },
  coverQuotationNumber: { page: 1, x: 45, top: 790, width: 122, height: 18, background: 'navy', minSize: 8 },
  coverIssuedDate: { page: 1, x: 175, top: 790, width: 124, height: 18, background: 'navy', minSize: 8 },
  coverExpiresAt: { page: 1, x: 306, top: 790, width: 124, height: 18, background: 'navy', minSize: 8 },
  coverPreparedBy: { page: 1, x: 436, top: 790, width: 114, height: 18, background: 'navy', minSize: 8 },
  usersEssentials: { page: 2, x: 481, top: 76, width: 69, height: 27, background: 'white', minSize: 8 },
  usersOperations: { page: 2, x: 481, top: 89, width: 69, height: 29, background: 'white', minSize: 8 },
  heroPrice: { page: 3, x: 69, top: 179, width: 188, height: 22, background: 'navy', minSize: 8 },
  billingHeader: { page: 3, x: 60.55, top: 209, width: 220, height: 15, background: 'navy', minSize: 8 },
  billingFrequency: { page: 3, x: 450, top: 76, width: 100, height: 15, background: 'white', minSize: 8 },
  regularUnitPrice: { page: 3, x: 443, top: 165, width: 89, height: 15, background: 'white', minSize: 8 },
  discountPercent: { page: 3, x: 443, top: 219, width: 89, height: 15, background: 'white', minSize: 8 },
  netUnitPrice: { page: 3, x: 443, top: 273, width: 89, height: 15, background: 'white', minSize: 8 },
  annualEquivalent: { page: 3, x: 60, top: 246, width: 220, height: 29, background: 'navy', minSize: 8 },
  subscriptionLabel: { page: 3, x: 53, top: 389, width: 382, height: 11, background: 'white', minSize: 8 },
  implementationLabel: { page: 3, x: 53, top: 401, width: 382, height: 11, background: 'white', minSize: 8 },
  subscriptionAmount: { page: 3, x: 435, top: 389, width: 108, height: 11, background: 'white', minSize: 8 },
  implementationAmount: { page: 3, x: 435, top: 401, width: 108, height: 11, background: 'white', minSize: 8 },
  locatorLabel: { page: 3, x: 53, top: 424, width: 382, height: 12, background: 'white', minSize: 8 },
  locatorAmount: { page: 3, x: 435, top: 424, width: 108, height: 12, background: 'white', minSize: 8 },
  subtotal: { page: 3, x: 435, top: 459, width: 108, height: 15, background: 'white', minSize: 8 },
  discount: { page: 3, x: 435, top: 494, width: 108, height: 15, background: 'white', minSize: 8 },
  vat: { page: 3, x: 435, top: 529, width: 108, height: 15, background: 'white', minSize: 8 },
  total: { page: 3, x: 412, top: 564, width: 131, height: 15, background: 'navy', minSize: 8 },
  timezone: { page: 4, x: 216, top: 604, width: 85, height: 15, background: 'white', minSize: 8 },
  reference: { page: 5, x: 451, top: 77, width: 99, height: 15, background: 'white', minSize: 8 },
  validityDays: { page: 5, x: 79, top: 140, width: 29, height: 18, background: 'white', minSize: 8 },
  paymentExpiry: { page: 5, x: 298, top: 143, width: 225, height: 17, background: 'white', minSize: 8 },
});

const SUPPORTED_PLANS = new Set(['essentials', 'combined', 'full']);
const SUPPORTED_CYCLES = new Set(['annual', 'semiannual', 'quarterly', 'monthly']);
const CYCLE_MONTHS = Object.freeze({ annual: 12, semiannual: 6, quarterly: 3, monthly: 1 });
const PLAN_LABELS = Object.freeze({ essentials: 'Workforce Essentials', combined: 'Workforce Operations', full:'Full Platform' });
const NAVY = Object.freeze({ r: 28 / 255, g: 35 / 255, b: 64 / 255 });
const WHITE = Object.freeze({ r: 1, g: 1, b: 1 });
const DARK = Object.freeze({ r: 27 / 255, g: 35 / 255, b: 65 / 255 });
const GRAY = Object.freeze({ r: 63 / 255, g: 70 / 255, b: 89 / 255 });
const LIGHT = Object.freeze({ r: 190 / 255, g: 201 / 255, b: 222 / 255 });

export class QuotationValidationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'QuotationValidationError';
    this.code = code;
    this.status = 422;
    this.details = details;
  }
}

function reject(code, message, details) {
  throw new QuotationValidationError(code, message, details);
}

function integerMinor(value, field, { allowZero = true } = {}) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || (!allowZero && value <= 0) || (allowZero && value < 0)) {
    reject('money.invalid', `${field} must be a safe integer amount in minor units.`, { field, value });
  }
  return value;
}

function integer(value, field, { min = 0 } = {}) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min) {
    reject('number.invalid', `${field} must be a safe integer.`, { field, value });
  }
  return value;
}

function finite(value, field, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    reject('number.invalid', `${field} must be a finite number in range.`, { field, value });
  }
  return value;
}

function dateOnly(value, field) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    reject('date.invalid', `${field} must use YYYY-MM-DD.`, { field, value });
  }
  const [year, month, day] = value.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (year < 2000 || year > 2100 || d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    reject('date.invalid', `${field} is not a valid calendar date.`, { field, value });
  }
  return value;
}

function dayDifference(start, end) {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

function sumSchedule(schedule, field) {
  return schedule.reduce((sum, row) => sum + row[field], 0);
}

/**
 * Validate a calculator result before allowing a customer-facing PDF.
 *
 * The calculator is authoritative. This function intentionally does not
 * recalculate pricing policy; it verifies that the saved calculator result is
 * complete, supported by the five-page source table, safe in minor units, and
 * internally reconciled.
 */
export function validateWorkforceQuotation(quote, { approvalRecorded = false } = {}) {
  if (!quote || typeof quote !== 'object') reject('quote.missing', 'A calculated quotation is required.');
  if (!SUPPORTED_PLANS.has(quote.plan)) reject('plan.unsupported', 'This Workforce quotation template does not support the selected plan.', { plan: quote.plan });
  if (!SUPPORTED_CYCLES.has(quote.cycle)) reject('cycle.unsupported', 'This Workforce quotation template does not support the selected billing cycle.', { cycle: quote.cycle });

  const months = CYCLE_MONTHS[quote.cycle];
  const chargedMonths=quote.cycle==='annual'&&quote.annualPricing==='ten-month'?10:months;
  const annualMonths=quote.cycle==='annual'&&quote.annualPricing==='ten-month'?10:12;
  if(quote.cycle==='annual'&&chargedMonths!==10)reject('pricing.legacy-annual','العرض القديم محسوب على 12 شهرًا، والقالب الحالي يعرض سعر 10 شهور. أنشئ عرضًا جديدًا بالتسعير المعتمد؛ لن نغيّر أسعار العرض القديم تلقائيًا.');
  const cycleMonths = quote.cycleMonths ?? months;
  integer(cycleMonths, 'cycle months', { min: 1 });
  if (cycleMonths !== months) reject('cycle.reconciliation', 'Saved cycleMonths does not match the selected billing cycle.', { cycle: quote.cycle, cycleMonths, expected: months });
  const actualEmployees = integer(quote.employees, 'actual employees', { min: 1 });
  const billedEmployees = integer(quote.billedEmployees, 'billed employees', { min: 1 });
  if (billedEmployees < actualEmployees) reject('users.reconciliation', 'Billed users cannot be lower than actual users.', { actualEmployees, billedEmployees });

  if (quote.implementation === null || quote.implementation === undefined) {
    reject('implementation.missing', 'Implementation pricing is incomplete; complete the approved setup fee before issuing the quotation.');
  }
  integerMinor(quote.implementation, 'implementation', { allowZero: false });

  const discount = quote.discount ?? 0;
  const upliftRate = quote.upliftRate ?? 0;
  const hardwareQty = quote.hardwareQty ?? 0;
  const hardwareUnitPrice = quote.hardwareUnitPrice ?? 0;
  const hardwareTotal = quote.hardwareTotal ?? 0;
  const extrasAnnual = quote.extrasAnnual ?? 0;
  const extrasOnce = quote.extrasOnce ?? hardwareTotal;
  finite(discount, 'discount', { min: 0, max: 100 });
  finite(upliftRate, 'uplift rate', { min: 0, max: 100 });
  integer(hardwareQty, 'Locator quantity', { min: 0 });
  finite(hardwareUnitPrice, 'hardware unit price', { min: hardwareQty > 0 ? 0.01 : 0, max: Number.MAX_SAFE_INTEGER / 100 });

  if (quote.taxRate === null || quote.taxRate === undefined || quote.taxMode === 'unknown') {
    reject('tax.unknown', 'Tax treatment is unresolved; select a tax mode before issuing the customer PDF.');
  }
  finite(quote.taxRate, 'tax rate', { min: 0, max: 100 });

  const approvalNeeded = discount > 5 || billedEmployees > 500 || actualEmployees < 30;
  const recorded = approvalRecorded === true || (typeof approvalRecorded === 'string' && approvalRecorded.trim().length > 0);
  if (approvalNeeded && !recorded) {
    reject('approval.required', 'Recorded commercial approval is required before issuing this quotation.', { approval: quote.approval });
  }

  const moneyFields = [
    'baseMonthly', 'upliftMonthly', 'beforeDiscountMonthly', 'discountMonthly', 'coreMonthly',
    'recurringAnnual', 'firstYearSubtotal',
    'knownFirstYearSubtotal', 'firstYearTax', 'firstYearTotal', 'fullSavingAnnual',
  ];
  for (const field of moneyFields) integerMinor(quote[field], field);
  integerMinor(extrasAnnual, 'extrasAnnual');
  integerMinor(extrasOnce, 'extrasOnce');
  integerMinor(hardwareTotal, 'hardwareTotal');

  const roundedHardwareUnit = Math.round(hardwareUnitPrice * 100);
  if (!Number.isSafeInteger(roundedHardwareUnit) || hardwareQty * roundedHardwareUnit !== hardwareTotal) {
    reject('hardware.reconciliation', 'Locator quantity, rounded unit price, and total do not reconcile.', { hardwareQty, hardwareUnitPrice, hardwareTotal });
  }

  if (extrasAnnual !== 0 || extrasOnce !== hardwareTotal) {
    reject('fees.unsupported', 'Optional recurring or other one-time fees cannot be represented faithfully in the original Workforce table; issue a supported quote without them.', {
      extrasAnnual,
      extrasOnce,
      hardwareTotal,
    });
  }

  if (quote.baseMonthly + quote.upliftMonthly !== quote.beforeDiscountMonthly) {
    reject('quote.reconciliation', 'Base price and billing-cycle uplift do not reconcile to the pre-discount monthly price.');
  }
  if (quote.upliftMonthly !== Math.round(quote.baseMonthly * upliftRate / 100)) {
    reject('quote.reconciliation', 'Billing-cycle uplift does not reconcile to its saved rate.');
  }
  if (quote.discountMonthly !== Math.round(quote.beforeDiscountMonthly * discount / 100)) {
    reject('quote.reconciliation', 'Discount amount does not reconcile to its saved percentage.');
  }

  if (!Array.isArray(quote.schedule) || quote.schedule.length !== 12 / cycleMonths) {
    reject('schedule.incomplete', 'The quotation payment schedule is incomplete for the selected billing cycle.');
  }
  const schedule = quote.schedule;
  for (let i = 0; i < schedule.length; i += 1) {
    const row = schedule[i];
    if (!row || row.number !== i + 1) reject('schedule.invalid', 'Payment schedule numbering is not reconciled.', { row: i + 1 });
    dateOnly(row.date, `schedule[${i}].date`);
    for (const field of ['core', 'extra', 'once', 'implementation', 'knownSubtotal', 'subtotal', 'tax', 'total']) {
      if (row[field] === null || row[field] === undefined) reject('schedule.incomplete', `Payment schedule row ${i + 1} is missing ${field}.`, { row: i + 1, field });
      integerMinor(row[field], `schedule[${i}].${field}`);
    }
    const expectedSetup = i === 0 ? quote.implementation : 0;
    const expectedCore = quote.coreMonthly * chargedMonths;
    const expectedOnce = i === 0 ? hardwareTotal : 0;
    if (row.implementation !== expectedSetup) reject('schedule.reconciliation', `Implementation fee is not allocated only to the first payment.`, { row: i + 1 });
    if (row.core !== expectedCore || row.extra !== 0 || row.once !== expectedOnce) {
      reject('schedule.reconciliation', `Payment schedule row ${i + 1} does not match supported recurring and one-time components.`, { row: i + 1 });
    }
    if (row.knownSubtotal !== row.core + row.extra + row.once + row.implementation || row.subtotal !== row.knownSubtotal) {
      reject('schedule.reconciliation', `Payment schedule row ${i + 1} does not reconcile to its components.`, { row: i + 1 });
    }
    const expectedTax = Math.round(row.subtotal * quote.taxRate / 100);
    if (row.tax !== expectedTax || row.total !== row.subtotal + row.tax) {
      reject('schedule.reconciliation', `Tax or total is not reconciled on payment schedule row ${i + 1}.`, { row: i + 1 });
    }
  }

  const first = schedule[0];
  if (quote.coreMonthly !== quote.beforeDiscountMonthly - quote.discountMonthly) {
    reject('quote.reconciliation', 'Subscription price and discount do not reconcile.');
  }
  if (quote.recurringAnnual !== quote.coreMonthly * annualMonths + extrasAnnual) {
    reject('quote.reconciliation', 'Recurring annual value does not reconcile to the calculator result.');
  }
  if (quote.firstYearSubtotal !== sumSchedule(schedule, 'subtotal') || quote.knownFirstYearSubtotal !== sumSchedule(schedule, 'knownSubtotal')) {
    reject('quote.reconciliation', 'First-year subtotal does not reconcile to the payment schedule.');
  }
  if (quote.firstYearTax !== sumSchedule(schedule, 'tax') || quote.firstYearTotal !== sumSchedule(schedule, 'total')) {
    reject('quote.reconciliation', 'First-year tax or total does not reconcile to the payment schedule.');
  }
  if (quote.firstYearSubtotal !== quote.recurringAnnual + quote.implementation + extrasOnce) {
    reject('quote.reconciliation', 'First-year subtotal does not reconcile to recurring, setup, and one-time amounts.');
  }
  const discountForCycle = quote.discountMonthly * chargedMonths;
  const grossFirstSubtotal = first.subtotal + discountForCycle;
  const expectedGrossFirstSubtotal = quote.beforeDiscountMonthly * chargedMonths + quote.implementation + hardwareTotal;
  if (grossFirstSubtotal !== expectedGrossFirstSubtotal || grossFirstSubtotal - discountForCycle !== first.subtotal || first.total !== first.subtotal + first.tax) {
    reject('quote.reconciliation', 'Gross subtotal, discount, VAT, and total do not reconcile.');
  }
  if (first.subtotal <= 0 || first.total <= 0) reject('quote.reconciliation', 'The first payment must have a positive reconciled subtotal and total.');

  return Object.freeze({
    plan: quote.plan,
    planLabel: PLAN_LABELS[quote.plan],
    cycle: quote.cycle,
    cycleMonths,
    actualEmployees,
    billedEmployees,
    validityBasis: 'issuedDate/expiresAt',
  });
}

function cleanText(value) {
  return String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function hasArabic(value) {
  return /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/u.test(String(value ?? ''));
}

function bytesFromImage(value) {
  if (!value) return null;
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (typeof value !== 'string') return null;
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/u.exec(value);
  if (!match) reject('customer.image.invalid', 'Customer image must be a PNG data URL or PNG bytes.');
  const binary = typeof atob === 'function' ? atob(match[1]) : Buffer.from(match[1], 'base64').toString('binary');
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function amount(minor) {
  return `${(minor === 0 ? 0 : minor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP`;
}

function billingCopy(cycle) {
  return {
    annual: 'per user, per month · billed yearly',
    semiannual: 'per user, per month · billed every 6 months',
    quarterly: 'per user, per month · billed every 3 months',
    monthly: 'per user, per month · billed monthly',
  }[cycle];
}

function mask(page, field, color) {
  page.drawRectangle({ x: field.x, y: page.getHeight() - field.top - field.height, width: field.width, height: field.height, color });
}

function drawTextInField(page, value, field, font, color, { size = 9, minSize = 8, align = 'left', lineGap = 0, line = 0 } = {}) {
  if (value === undefined || value === null || value === '') return;
  const text = cleanText(value);
  let fontSize = size;
  while (fontSize >= minSize && font.widthOfTextAtSize(text, fontSize) > field.width) fontSize -= 0.1;
  if (fontSize < minSize || font.widthOfTextAtSize(text, fontSize) > field.width) {
    reject('layout.overflow', `Dynamic quotation field ${field.name || 'unnamed'} is too long for the original field.`, { field: field.name, value: text, width: field.width, minSize });
  }
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  const x = align === 'right' ? field.x + field.width - textWidth : align === 'center' ? field.x + (field.width - textWidth) / 2 : field.x;
  const top = field.top + line * (fontSize + lineGap);
  if (top + fontSize > field.top + field.height + 0.5) {
    reject('layout.overflow', `Dynamic quotation field ${field.name || 'unnamed'} exceeds its measured height.`, { field: field.name, value: text });
  }
  page.drawText(text, { x, y: page.getHeight() - top - fontSize, size: fontSize, font, color });
}

function field(name, x, top, width, height) {
  return { name, x, top, width, height };
}

function drawTwoLine(page, first, second, area, font, color, options = {}) {
  const lineHeight = options.lineHeight || 11;
  drawTextInField(page, first, { ...area, height: lineHeight + 1 }, font, color, { ...options, line: 0 });
  drawTextInField(page, second, { ...area, top: area.top + lineHeight, height: area.height - lineHeight }, font, color, { ...options, line: 0 });
}

/** Decode and overlay the original five-page Workforce quotation. */
export async function generateExactWorkforceQuotation(PDFLib, {
  templateBytes,
  quote,
  customer = 'Customer',
  customerImage,
  number,
  issuedDate,
  expiresAt,
  preparedBy = 'Mahmoud Ammar',
  preparedByImage,
  timezone,
  workingHoursTimezone,
  fontBytes,
  boldBytes,
  semiBytes,
  arabicFontBytes,
  fontkit,
  approvalRecorded = false,
} = {}) {
  validateWorkforceQuotation(quote, { approvalRecorded });
  if (!templateBytes) reject('template.missing', 'The original Workforce quotation PDF is not installed.');
  dateOnly(issuedDate, 'issuedDate');
  dateOnly(expiresAt, 'expiresAt');
  const validityDays = dayDifference(issuedDate, expiresAt);
  if (validityDays < 0) reject('date.range', 'expiresAt must be on or after issuedDate.');
  const resolvedTimezone = cleanText(timezone ?? workingHoursTimezone ?? 'Africa/Cairo');
  const customerText = cleanText(customer);
  if (!customerText) reject('customer.missing', 'A customer name is required.');

  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  // Original exports use nonzero object generations. Import pages into a fresh
  // document so every resource/catalog reference is renumbered consistently.
  // Saving the loaded original directly can produce invalid xref entries.
  const source = await PDFDocument.load(templateBytes);
  const doc = await PDFDocument.create();
  for (const page of await doc.copyPages(source, source.getPageIndices())) doc.addPage(page);
  if (doc.getPageCount() !== 5) reject('template.pages', 'The original Workforce quotation must contain exactly five pages.');
  for (const page of doc.getPages()) {
    if (Math.abs(page.getWidth() - 595.3039) > 0.05 || Math.abs(page.getHeight() - 841.8898) > 0.05) {
      reject('template.geometry', 'The original Workforce quotation must use A4 page geometry.');
    }
  }
  if (fontkit) doc.registerFontkit(fontkit);

  const regular = await doc.embedFont(fontBytes || StandardFonts.Helvetica, { subset: !!fontBytes });
  const semibold = semiBytes ? await doc.embedFont(semiBytes, { subset: true }) : regular;
  const bold = await doc.embedFont(boldBytes || StandardFonts.HelveticaBold, { subset: !!boldBytes });
  const arabic = arabicFontBytes ? await doc.embedFont(arabicFontBytes, { subset: true }) : null;
  const colors = { navy: rgb(NAVY.r, NAVY.g, NAVY.b), white: rgb(WHITE.r, WHITE.g, WHITE.b), dark: rgb(DARK.r, DARK.g, DARK.b), gray: rgb(GRAY.r, GRAY.g, GRAY.b) };
  const pages = doc.getPages();

  // Page 1: the original navy cover remains intact; only its blanks receive values.
  const cover = pages[0];
  const imageBytes = bytesFromImage(customerImage);
  if (imageBytes) {
    const image = await doc.embedPng(imageBytes);
    const width = Math.min(250, image.width * 0.36);
    const scale = width / image.width;
    const height = image.height * scale;
    cover.drawImage(image, { x: 84, y: cover.getHeight() - 711 - height, width, height });
  } else {
    if (hasArabic(customerText) && !arabic) reject('customer.arabic_font_missing', 'Arabic customer names require the browser-rendered PNG or an embedded Arabic font; no characters were reversed or substituted.');
    drawTextInField(cover, customerText, field('coverCustomer', 84, 711, 250, 25), hasArabic(customerText) ? arabic : bold, colors.white, { size: 12, minSize: 8 });
  }
  drawTextInField(cover, number, field('quotationNumber', 45, 790, 122, 18), bold, colors.white, { size: 9, minSize: 8 });
  drawTextInField(cover, issuedDate, field('issuedDate', 175, 790, 124, 18), regular, colors.white, { size: 9, minSize: 8 });
  drawTextInField(cover, expiresAt, field('expiresAt', 306, 790, 124, 18), regular, colors.white, { size: 9, minSize: 8 });
  const preparedImageBytes = bytesFromImage(preparedByImage);
  if (preparedImageBytes) {
    const preparedImage = await doc.embedPng(preparedImageBytes);
    const preparedField = field('preparedByImage', 436, 790, 114, 18);
    const scale = Math.min(preparedField.width / preparedImage.width, preparedField.height / preparedImage.height);
    const width = preparedImage.width * scale;
    const height = preparedImage.height * scale;
    cover.drawImage(preparedImage, { x: preparedField.x, y: cover.getHeight() - preparedField.top - height, width, height });
  } else {
    drawTextInField(cover, cleanText(preparedBy), field('preparedBy', 436, 790, 114, 18), regular, colors.white, { size: 9, minSize: 8 });
  }

  // Page 2: preserve the source Users label and fill only the plan-specific
  // blank lines between that label and its dotted separator.
  const usersOperations = quote.plan !== 'essentials';
  const userArea = usersOperations ? WORKFORCE_FIELD_MASKS.usersOperations : WORKFORCE_FIELD_MASKS.usersEssentials;
  const userField = usersOperations ? field('usersOperations', 481, 89, 69, 29) : field('usersEssentials', 481, 76, 69, 27);
  mask(pages[1], { ...userArea, name: userField.name }, colors.white);
  drawTwoLine(pages[1], `Actual ${quote.employees}`, `Billed ${quote.billedEmployees}`, userField, semibold, colors.dark, { size: 8, minSize: 8, align: 'right', lineHeight: 11 });

  // Page 3: all replacements are narrow text masks over the source copy only.
  const pricing = pages[2];
  mask(pricing, { ...WORKFORCE_FIELD_MASKS.billingCycle, name: 'billingCycle' }, colors.navy);
  const unitRegular = Math.round(quote.beforeDiscountMonthly / quote.billedEmployees);
  const unitNet = Math.round(quote.coreMonthly / quote.billedEmployees);
  drawTextInField(pricing, amount(unitNet), field('heroPrice', 69, 179, 188, 22), bold, colors.white, { size: 19, minSize: 8 });
  drawTextInField(pricing, billingCopy(quote.cycle), field('billingHeader', 60.55, 209, 220, 15), regular, rgb(LIGHT.r, LIGHT.g, LIGHT.b), { size: 9.5, minSize: 8 });
  drawTextInField(pricing, amount(unitRegular), field('regularUnitPrice', 443, 165, 89, 15), regular, colors.dark, { size: 8.7, minSize: 8, align: 'right' });
  drawTextInField(pricing, `${quote.discount ?? 0}%`, field('discountPercent', 443, 219, 89, 15), regular, colors.dark, { size: 8.7, minSize: 8, align: 'right' });
  drawTextInField(pricing, amount(unitNet), field('netUnitPrice', 443, 273, 89, 15), regular, colors.dark, { size: 8.7, minSize: 8, align: 'right' });

  drawTextInField(pricing, { annual: 'Annual', semiannual: 'Semiannual', quarterly: 'Quarterly', monthly: 'Monthly' }[quote.cycle], field('billingFrequency', 450, 76, 100, 15), semibold, colors.dark, { size: 9, minSize: 8, align: 'right' });

  // Preserve the approved source's ten-month annual offer verbatim.

  // Preserve the original pricing table lines. Only the source row text is masked.
  const subscriptionMask = { ...WORKFORCE_FIELD_MASKS.subscriptionRow, name: 'subscriptionRow' };
  mask(pricing, subscriptionMask, colors.white);
  const chargedMonths=quote.cycle==='annual'&&quote.annualPricing==='ten-month'?10:quote.cycleMonths;
  const subscriptionAmount = quote.beforeDiscountMonthly * chargedMonths;
  drawTextInField(pricing, `${PLAN_LABELS[quote.plan]} · ${quote.billedEmployees} users × ${chargedMonths} paid months`, field('subscriptionLabel', 53, 389, 382, 11), regular, colors.dark, { size: 9.2, minSize: 8 });
  drawTextInField(pricing, 'Implementation (one-time)', field('implementationLabel', 53, 401, 382, 11), regular, colors.dark, { size: 8.2, minSize: 8 });
  drawTextInField(pricing, amount(subscriptionAmount), field('subscriptionAmount', 435, 389, 108, 11), regular, colors.dark, { size: 9.2, minSize: 8, align: 'right' });
  drawTextInField(pricing, amount(quote.implementation), field('implementationAmount', 435, 401, 108, 11), regular, colors.dark, { size: 8.2, minSize: 8, align: 'right' });

  const locatorMask = { ...WORKFORCE_FIELD_MASKS.locatorRow, name: 'locatorRow' };
  mask(pricing, locatorMask, colors.white);
  if ((quote.hardwareQty ?? 0) > 0) {
    drawTextInField(pricing, `GeoInTime Locator · ${quote.hardwareQty} × ${amount(Math.round(quote.hardwareUnitPrice * 100))}/device`, field('locatorLabel', 53, 424, 382, 12), regular, colors.dark, { size: 8.7, minSize: 8 });
    drawTextInField(pricing, amount(quote.hardwareTotal), field('locatorAmount', 435, 424, 108, 12), regular, colors.dark, { size: 8.7, minSize: 8, align: 'right' });
  }

  const first = quote.schedule[0];
  const rowAmounts = [
    [first.subtotal + quote.discountMonthly * chargedMonths, 'subtotal'],
    [-(quote.discountMonthly * chargedMonths), 'discount'],
    [first.tax, 'vat'],
    [first.total, 'total'],
  ];
  const rowTops = [459, 494, 529, 564];
  rowAmounts.forEach(([value, name], index) => drawTextInField(pricing, value < 0 ? `-${amount(-value)}` : amount(value), field(name, index === 3 ? 412 : 435, rowTops[index], index === 3 ? 131 : 108, 15), index === 3 ? bold : regular, index === 3 ? colors.white : colors.dark, { size: index === 3 ? 10.5 : 9.2, minSize: 8, align: 'right' }));

  mask(pricing, { ...WORKFORCE_FIELD_MASKS.terms, name: 'terms' }, colors.white);
  drawTextInField(pricing, 'The 12-month figures are a calculator forecast; commitment follows the signed agreement.', field('terms', 45, 601, 505, 13), regular, colors.gray, { size: 8, minSize: 8 });

  // Page 4: fill the original timezone blank only.
  drawTextInField(pages[3], resolvedTimezone, field('timezone', 216, 604, 85, 15), regular, colors.dark, { size: 9.2, minSize: 8 });

  // Page 5: validity/reference blanks. No approval watermark is emitted; unapproved
  // quotes fail validation above rather than being customer-facing drafts.
  drawTextInField(pages[4], number, field('reference', 451, 77, 99, 15), regular, colors.dark, { size: 8.5, minSize: 8, align: 'right' });
  drawTextInField(pages[4], String(validityDays), field('validityDays', 79, 140, 29, 18), bold, colors.dark, { size: 12, minSize: 8, align: 'right' });
  drawTextInField(pages[4], expiresAt, field('paymentExpiry', 298, 143, 225, 17), bold, colors.dark, { size: 10.5, minSize: 8 });

  doc.setTitle(`GeoInTime - ${cleanText(number)}`);
  doc.setAuthor('GeoInTime');
  doc.setProducer(`GeoInTime Commercial Studio ${GENERATOR_VERSION}`);
  // The attached tagged source PDFs contain object references that the
  // vendored pdf-lib serializer emits as broken object streams by default;
  // disabling streams keeps the catalog/pages tree valid for Poppler,
  // browser viewers, and archival validation.
  return doc.save({ useObjectStreams: false });
}
