import { createHash } from 'node:crypto';
import { calculate, CALCULATION_VERSION } from '../calculator.mjs';
import { validDate } from '../business.mjs';

export class ProposalDataError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProposalDataError';
    this.code = 'QUOTATION_DATA';
    this.status = 422;
  }
}

export function quotationExpiry(start) {
  if (!validDate(start)) throw new ProposalDataError('تاريخ إصدار عرض السعر غير صحيح.');
  const date = new Date(start + 'T12:00:00Z');
  let workingDays = 0;
  while (workingDays < 7) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (![5, 6].includes(date.getUTCDay())) workingDays++;
  }
  return date.toISOString().slice(0, 10);
}

const fields = ['employees', 'billedEmployees', 'plan', 'cycle', 'cycleMonths', 'upliftRate',
  'baseRate', 'baseMonthly', 'upliftMonthly', 'beforeDiscountMonthly', 'discount', 'discountMonthly',
  'coreMonthly', 'extrasAnnual', 'extrasOnce', 'implementation', 'customRequired', 'taxMode', 'taxRate',
  'hardwareQty', 'hardwareUnitPrice', 'hardwareTotal', 'recurringAnnual', 'firstYearSubtotal',
  'knownFirstYearSubtotal', 'firstYearTax', 'firstYearTotal', 'schedule'];
function pricingSnapshot(quote) {
  return Object.fromEntries(fields.map(key => [key, quote[key]]));
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}

export function proposalContext(row) {
  const data = row.data;
  if (!data?.quote || !data.input) throw new ProposalDataError('بيانات حساب العرض المحفوظ ناقصة؛ افتح العرض وراجع المدخلات قبل إصدار PDF.');
  // Verify current-policy records against their saved calculator inputs. Historical
  // pricing is never recalculated or overwritten by a download request.
  if (data.quote.calculationVersion === CALCULATION_VERSION) {
    let calculated;
    try { calculated = calculate(data.input); } catch {
      throw new ProposalDataError('مدخلات الحاسبة المحفوظة غير مكتملة؛ راجع العرض قبل الإصدار.');
    }
    if (JSON.stringify(canonical(pricingSnapshot(calculated))) !== JSON.stringify(canonical(pricingSnapshot(data.quote)))) {
      throw new ProposalDataError('أرقام العرض المحفوظ لا تطابق مدخلات الحاسبة. راجع العرض واحفظ نسخة صحيحة؛ لن نغيّر الأسعار تلقائيًا.');
    }
  }
  const issuedDate = data.issuedDate || String(row.created_at).slice(0, 10);
  if (!validDate(issuedDate)) throw new ProposalDataError('تاريخ إصدار العرض المحفوظ غير صحيح.');
  const expiresAt = data.quotationDetails?.expiresAt || quotationExpiry(issuedDate);
  if (!validDate(expiresAt) || expiresAt < issuedDate) throw new ProposalDataError('تاريخ انتهاء العرض لازم يكون صحيح وبعد تاريخ الإصدار.');
  const number = data.quotationDetails?.reference || 'GIT-' + issuedDate.replaceAll('-', '') + '-' + row.id.slice(0, 6).toUpperCase();
  const preparedBy = data.quotationDetails?.preparedBy || 'Mahmoud Ammar';
  const workingHoursTimezone = data.quotationDetails?.timezone || 'Africa/Cairo';
  return { quote: data.quote, customer: data.customer, number, issuedDate, expiresAt,
    preparedBy, workingHoursTimezone, approvalRecorded: Boolean(data.approvalNote?.trim()) };
}

export function proposalArchiveKey(owner, row, context, format) {
  const digest = createHash('sha256').update(JSON.stringify({ revision: row.revision, data: row.data,
    issued: context.issuedDate, format })).digest('hex');
  return 'proposals/' + encodeURIComponent(owner) + '/' + row.id + '/' + digest + '.pdf';
}
