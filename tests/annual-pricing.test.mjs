import test from 'node:test';import assert from 'node:assert/strict';
import {calculate,renewalFor} from '../lib/calculator.mjs';
import {savedQuoteForInputs} from '../lib/server/record-snapshot.mjs';
import {validateRecord,buildReport} from '../lib/business.mjs';
import {validateWorkforceQuotation} from '../lib/quotation-v2.mjs';
const input={employees:60,plan:'essentials',cycle:'annual',discount:0,taxMode:'egypt',startDate:'2026-11-03',annualPricing:'ten-month'};
test('Annual prepaid charges ten months for twelve months of service, setup once and VAT 14%',()=>{
 const q=calculate(input);assert.equal(q.coreAnnual,3300000);assert.equal(q.schedule[0].core,3300000);assert.equal(q.firstYearTotal,4617000);assert.equal(q.schedule.length,1);assert.equal(q.cycleMonths,12);assert.equal(validateWorkforceQuotation(q).cycleMonths,12);
 const n=renewalFor(q,input.startDate);assert.equal(n.date,'2027-11-03');assert.equal(n.subtotal,3300000);assert.equal(n.total,3762000);
});
test('Subscription discount applies to ten charged months; extras and hardware do not get free months',()=>{
 const q=calculate({...input,discount:5,extraAmount:100,hardwareQty:2});
 assert.equal(q.coreAnnual,3135000);assert.equal(q.extrasAnnual,120000);assert.equal(q.hardwareTotal,540000);assert.equal(q.firstYearSubtotal,4545000);
});
test('Other payment cycles retain their prices, VAT and schedules',()=>{
 for(const cycle of ['monthly','quarterly','semiannual']){
  const old=calculate({...input,cycle,annualPricing:'legacy12'}),current=calculate({...input,cycle});
  assert.deepEqual(current.schedule,old.schedule);assert.equal(current.recurringAnnual,old.recurringAnnual);assert.equal(current.coreAnnual,old.coreAnnual);
 }
});
test('Commission and next-month payroll use ten-month net subscription while target uses actual employees',()=>{
 const quote=calculate(input),data=validateRecord({customer:'Annual pricing QA',input,status:'won',closingDate:'2026-11-03',activated:60,activationDate:'2026-11-03',commissionReview:{contract:'annual',collectionCycle:'annual',netBasisConfirmed:true,answersConfirmed:true},payments:[{id:'p',date:'2026-11-03',amount:33000}]});
 const r=buildReport([{id:'annual-qa',createdAt:'2026-11-03T12:00:00Z',data:{...data,quote}}]);
 assert.equal(r.deals[0].eligible,3300000);assert.equal(r.deals[0].due,264000);assert.equal(r.deals[0].payrollMonth,'2026-12');assert.equal(r.plans[0].achieved,60);
});
test('Historical input prices remain unchanged, new API quotes adopt ten-month annual pricing',()=>{
 const oldInput={...input};delete oldInput.annualPricing;const old=calculate(oldInput),previous={input:oldInput,quote:old};
 assert.equal(savedQuoteForInputs(previous,{...oldInput,annualPricing:'legacy12'}),old);assert.equal(savedQuoteForInputs(null,oldInput).coreAnnual,3300000);assert.equal(old.coreAnnual,3960000);
 assert.equal(savedQuoteForInputs(previous,{...oldInput,employees:90}).paidMonths,12);
});