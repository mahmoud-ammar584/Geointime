import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { calculate } from '../lib/calculator.mjs';
import { proposalContext, proposalArchiveKey, quotationExpiry } from '../lib/server/proposal-context.mjs';
import { verifyTemplateBytes, templateKindForPlan, WORKFORCE_TEMPLATES } from '../lib/server/quotation-templates.mjs';

function fixture() {
  const input = { employees: 60, plan: 'essentials', cycle: 'annual', discount: 0, taxMode: 'egypt', startDate: '2026-11-03' };
  return { id: 'qa-test', revision: 1, kind: 'quote', created_at: '2026-11-03T09:00:00Z', data: {
    input, quote: calculate(input), customer: 'QA Test', issuedDate: '2026-11-03', approvalNote: '',
  } };
}

test('all supported plans route to their original Workforce template', () => {
  assert.equal(templateKindForPlan('essentials'), 'essentials');
  assert.equal(templateKindForPlan('combined'), 'operations');
  assert.equal(templateKindForPlan('full'), 'operations');
});
test('missing, swapped and unapproved PDF bytes fail closed', () => {
  assert.throws(() => verifyTemplateBytes('essentials', null), /تعذر تحميل/);
  assert.throws(() => verifyTemplateBytes('essentials', Buffer.from('%PDF-corrupt')), /بصمة/);
  assert.throws(() => verifyTemplateBytes('wrong', Buffer.from('%PDF')), /نوع/);
});
test('actual supplied source hashes match the approved manifest', async t => {
  if (!process.env.QUOTATION_TEMPLATE_DIR) return t.skip('Run with QUOTATION_TEMPLATE_DIR to verify the supplied original artifacts.');
  for (const [kind, title] of [['essentials', 'Essentials'], ['operations', 'Operations']]) {
    const bytes = await readFile(process.env.QUOTATION_TEMPLATE_DIR + '/GeoInTime_Quotation_Workforce_' + title + '_Bank_Transfer.pdf');
    assert.equal(verifyTemplateBytes(kind, bytes), WORKFORCE_TEMPLATES[kind].sha256);
    assert.throws(() => verifyTemplateBytes(kind === 'essentials' ? 'operations' : 'essentials', bytes), /بصمة/);
  }
});
test('saved calculator snapshot is verified without mutating any data', () => {
  const row = fixture(), original = JSON.stringify(row);
  const context = proposalContext(row);
  assert.equal(context.quote, row.data.quote);
  assert.equal(context.preparedBy, 'Mahmoud Ammar');
  assert.equal(context.workingHoursTimezone, 'Africa/Cairo');
  assert.equal(JSON.stringify(row), original);
  row.data.quote.schedule[0].total++;
  assert.throws(() => proposalContext(row), /لا تطابق/);
});
test('Postgres JSONB key ordering does not reject a valid saved calculation', () => {
  const row = fixture();
  row.data.quote.schedule = row.data.quote.schedule.map(item => Object.fromEntries(Object.entries(item).reverse()));
  assert.equal(proposalContext(row).quote.schedule[0].total, calculate(row.data.input).schedule[0].total);
});
test('older saved pricing is preserved rather than silently repriced', () => {
  const row = fixture();
  row.data.quote.calculationVersion = 'historical-approved-policy';
  row.data.quote.beforeDiscountMonthly = 123456;
  assert.equal(proposalContext(row).quote.beforeDiscountMonthly, 123456);
});
test('expiry uses seven working days and accepts valid saved dates', () => {
  assert.equal(quotationExpiry('2026-11-03'), '2026-11-12');
  assert.throws(() => quotationExpiry('2026-02-30'), /تاريخ/);
  const row = fixture();
  row.data.quotationDetails = { expiresAt: '2026-11-15', preparedBy: 'QA Engineer', reference: 'QA-A', timezone: 'Asia/Riyadh' };
  assert.equal(proposalContext(row).expiresAt, '2026-11-15');
  assert.equal(proposalContext(row).number, 'QA-A');
  row.data.quotationDetails.expiresAt = '2026-11-02';
  assert.throws(() => proposalContext(row), /انتهاء/);
});
test('quotation revision, approved template bytes and generator version partition archives', () => {
  const row = fixture(), context = proposalContext(row), key = proposalArchiveKey('owner', row, context, 'v4-source');
  assert.notEqual(proposalArchiveKey('owner', row, context, 'v5-source'), key);
  assert.notEqual(proposalArchiveKey('owner', row, context, 'v4-other-source'), key);
  row.revision++;
  assert.notEqual(proposalArchiveKey('owner', row, context, 'v4-source'), key);
  assert.notEqual(proposalArchiveKey('different-owner', row, context, 'v4-source'), key);
});
