import { calculate } from '../calculator.mjs';

export function canonicalData(value) {
  if (Array.isArray(value)) return value.map(canonicalData);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalData(value[key])]));
  return value;
}

function normalizedInputs(input, previousQuote) {
  const n = (value, fallback = 0) => Number(value === '' || value === undefined || value === null ? fallback : value);
  const employees = n(input.employees);
  const complex = input.complex === true;
  const custom = employees < 30 || employees > 500 || complex;
  const taxMode = input.taxMode ?? (previousQuote ? previousQuote.taxRate === null ? 'unknown' : 'specified' : 'egypt');
  return {
    annualPricing: input.annualPricing??previousQuote?.annualPricing??'legacy12', employees, plan: input.plan, cycle: input.cycle, startDate: input.startDate,
    discount: n(input.discount), extraAmount: n(input.extraAmount), otherOnce: n(input.otherOnce),
    hardwareQty: n(input.hardwareQty), hardwareUnitPrice: n(input.hardwareUnitPrice, 2700),
    extraBasis: input.extraBasis ?? 'fixed', extraCadence: input.extraCadence ?? 'monthly',
    complex, customImplementation: custom ? input.customImplementation === '' || input.customImplementation == null ? null : n(input.customImplementation) : null,
    taxMode, taxRate: taxMode === 'specified' ? n(input.taxRate, previousQuote?.taxRate) : null,
  };
}

export function savedQuoteForInputs(previous, input) {
  // Metadata/approval/collection updates must not silently reprice an issued
  // quotation because JSONB changed key order or HTML inputs returned strings.
  if (previous?.quote && JSON.stringify(canonicalData(normalizedInputs(previous.input, previous.quote))) === JSON.stringify(canonicalData(normalizedInputs(input, previous.quote)))) return previous.quote;
  return calculate({...input,annualPricing:input.annualPricing??previous?.quote?.annualPricing??(previous?'legacy12':'ten-month')});
}
