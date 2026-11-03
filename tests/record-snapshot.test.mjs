import test from 'node:test';
import assert from 'node:assert/strict';
import { savedQuoteForInputs } from '../lib/server/record-snapshot.mjs';
import { calculate } from '../lib/calculator.mjs';
const input = {employees:60, plan:'essentials', cycle:'annual', discount:0, taxMode:'egypt', startDate:'2026-11-03'};
test('input key ordering cannot silently reprice a saved quotation', () => {
  const previous = { input: Object.fromEntries(Object.entries(input).reverse()), quote: {...calculate(input), calculationVersion:'historical-approved-policy', legacyValue:123} };
  assert.equal(savedQuoteForInputs(previous, input), previous.quote);
});
test('actual financial input changes use the authoritative calculator', () => {
  const previous = {input, quote:calculate(input)};
  const changed = {...input,employees:90};
  assert.deepEqual(savedQuoteForInputs(previous, changed), calculate(changed));
  assert.deepEqual(savedQuoteForInputs(null, input), calculate(input));
});
test('HTML numeric strings and optional blank defaults preserve historical prices', () => {
  const previous = {input, quote:{...calculate(input),calculationVersion:'historical-approved-policy'}};
  const browser = {...input,employees:'60',discount:'0',extraAmount:'',otherOnce:'',hardwareQty:'0',hardwareUnitPrice:'2700',extraBasis:'fixed',extraCadence:'monthly',complex:false,customImplementation:'',taxRate:'14'};
  assert.equal(savedQuoteForInputs(previous,browser),previous.quote);
});
test('legacy tax mode inheritance preserves the saved tax treatment', () => {
  const historicalInput = {...input}; delete historicalInput.taxMode;
  const previous = {input:historicalInput,quote:{...calculate({...input,taxMode:'none'}),calculationVersion:'historical-approved-policy'}};
  const browser = {...input,taxMode:'specified',taxRate:'0'};
  assert.equal(savedQuoteForInputs(previous,browser),previous.quote);
});
