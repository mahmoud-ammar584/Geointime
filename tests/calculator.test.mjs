import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, addMonths, approvalFor } from '../lib/calculator.mjs';
const base = { employees:60, plan:'full', cycle:'annual', discount:0, extraAmount:'', taxMode:'unknown', startDate:'2026-10-25' };
const calc = changes => calculate({...base,...changes});
test('PDF commercial example: 60 Full Platform, annual prepaid',()=>{
  const q=calc({});
  assert.equal(q.baseMonthly,414000);
  assert.equal(q.recurringAnnual,4968000);
  assert.equal(q.implementation,750000);
  assert.equal(q.firstYearSubtotal,5718000);
  assert.equal(q.schedule[0].subtotal,5718000);
  assert.equal(q.fullSavingAnnual,288000);
  assert.equal(calc({plan:'essentials'}).baseMonthly,330000);
  assert.equal(calc({plan:'combined'}).baseMonthly,438000);
});
// Independent published-rate fixtures at every meaningful rate/setup boundary.
const fixtures=[
 [1,30,60,80,75,null],[29,30,60,80,75,null],[30,30,60,80,75,5000],
 [49,49,60,80,75,5000],[50,50,55,73,69,5000],[51,51,55,73,69,7500],
 [99,99,55,73,69,7500],[100,100,50,65,62,7500],[101,101,50,65,62,10000],
 [250,250,50,65,62,10000],[251,251,50,65,62,15000],[500,500,50,65,62,15000],
 [501,501,50,65,62,null],
];
for(const [employees,billed,essentials,combined,full,implementation] of fixtures){
  test(`Rate/setup boundary at ${employees} employees`,()=>{
    for(const [plan,rate] of Object.entries({essentials,combined,full})){
      const q=calc({employees,plan});
      assert.equal(q.billedEmployees,billed);
      assert.equal(q.baseRate,rate);
      assert.equal(q.recurringAnnual,billed*rate*1200);
      assert.equal(q.implementation,implementation===null?null:implementation*100);
    }
  });
}
test('Semiannual +3% and twice-yearly payments',()=>{
  const q=calc({cycle:'semiannual'});
  assert.equal(q.coreMonthly,426420);
  assert.equal(q.recurringAnnual,5117040);
  assert.deepEqual(q.schedule.map(x=>x.subtotal),[3308520,2558520]);
  assert.deepEqual(q.schedule.map(x=>x.date),['2026-10-25','2027-04-25']);
  assert.equal(q.firstYearSubtotal,5867040);
});
test('Monthly +8%: 12 forecast payments, setup only on first',()=>{
  const q=calc({cycle:'monthly'});
  assert.equal(q.coreMonthly,447120);
  assert.equal(q.recurringAnnual,5365440);
  assert.equal(q.schedule.length,12);
  assert.equal(q.schedule[0].subtotal,1197120);
  assert.ok(q.schedule.slice(1).every(x=>x.subtotal===447120&&x.implementation===0));
  assert.equal(q.firstYearSubtotal,6115440);
  assert.ok(q.warnings.some(x=>x.includes('3 أشهر')));
});
test('5% discount applies to core including term uplift, excludes setup/extras',()=>{
  const q=calc({cycle:'semiannual',discount:5,extraAmount:100});
  assert.equal(q.discountMonthly,21321);
  assert.equal(q.coreMonthly,405099);
  assert.equal(q.extrasAnnual,120000);
  assert.equal(q.implementation,750000);
  assert.equal(q.schedule[0].subtotal,3240594);
  assert.equal(q.firstYearSubtotal,5731188);
});
for(const [discount,level] of [[0,'sales'],[5,'sales'],[5.01,'manager'],[10,'manager'],[10.01,'finance'],[15,'finance'],[15.01,'exception'],[100,'exception']]){
  test(`Discount authority at ${discount}%`,()=>assert.equal(approvalFor(discount).level,level));
}
test('Manual 14% tax on full invoice, not presumed by default',()=>{
  const q=calc({taxMode:'specified',taxRate:14});
  assert.equal(q.firstYearTax,800520);
  assert.equal(q.firstYearTotal,6518520);
  assert.equal(calc({}).firstYearTax,null);
  assert.equal(calc({}).schedule[0].total,null);
  const zero=calc({taxMode:'specified',taxRate:0});
  assert.equal(zero.firstYearTotal,5718000);
});
test('Fixed/employee recurring and once extras use the billed minimum',()=>{
  assert.equal(calc({extraAmount:100}).extrasAnnual,120000);
  assert.equal(calc({employees:10,extraAmount:10,extraBasis:'employee'}).extrasAnnual,360000);
  const once=calc({extraAmount:1000,extraCadence:'once',cycle:'monthly'});
  assert.equal(once.extrasOnce,100000);
  assert.equal(once.extrasAnnual,0);
  assert.equal(once.schedule[0].once,100000);
  assert.ok(once.schedule.slice(1).every(x=>x.once===0));
});
test('Annual extra allocated to payment periods, preserving pennies',()=>{
  const q=calc({extraAmount:100,extraCadence:'annual',cycle:'monthly'});
  assert.equal(q.extrasAnnual,10000);
  assert.equal(q.schedule[0].extra,833);
  assert.equal(q.schedule[11].extra,833);
  assert.equal(q.schedule.reduce((a,r)=>a+r.extra,0),10000);
  const tiny=calc({extraAmount:0.06,extraCadence:'annual',cycle:'monthly'});
  assert.ok(tiny.schedule.every(r=>r.extra>=0));
  assert.equal(tiny.schedule.reduce((a,r)=>a+r.extra,0),6);
});
test('Custom setup missing never produces a complete first invoice or total',()=>{
  const q=calc({employees:501,cycle:'semiannual',taxMode:'specified',taxRate:14});
  assert.equal(q.implementation,null);
  assert.equal(q.schedule[0].subtotal,null);
  assert.equal(q.schedule[0].total,null);
  assert.equal(q.firstYearSubtotal,null);
  assert.equal(q.firstYearTotal,null);
  assert.notEqual(q.schedule[1].total,null);
  const supplied=calc({employees:501,customImplementation:20000});
  assert.equal(supplied.implementation,2000000);
  assert.ok(supplied.customRequired);
  const complex=calc({complex:true});
  assert.equal(complex.implementation,null);
});
test('Quarterly uses user-confirmed +3%, four 3-month payments',()=>{
  const q=calc({cycle:'quarterly'}), semi=calc({cycle:'semiannual'});
  assert.equal(q.coreMonthly,426420);
  assert.equal(q.recurringAnnual,5117040);
  assert.equal(q.recurringAnnual,semi.recurringAnnual);
  assert.equal(q.schedule.length,4);
  assert.deepEqual(q.schedule.map(r=>r.subtotal),[2029260,1279260,1279260,1279260]);
  assert.deepEqual(q.schedule.map(r=>r.date),['2026-10-25','2027-01-25','2027-04-25','2027-07-25']);
  assert.equal(q.firstYearSubtotal,5867040);
});
test('Separate one-off fee stacks with recurring and once extras only on first bill',()=>{
  const q=calc({cycle:'quarterly',extraAmount:100,otherOnce:500});
  assert.equal(q.extrasOnce,50000);
  assert.equal(q.schedule[0].subtotal,2109260);
  assert.equal(q.schedule[1].subtotal,1309260);
  assert.throws(()=>calc({otherOnce:-1}));
});
test('Date arithmetic retains original anchor and clamps at month end',()=>{
  assert.equal(addMonths('2026-01-31',1),'2026-02-28');
  assert.equal(addMonths('2026-01-31',2),'2026-03-31');
  assert.equal(addMonths('2028-01-31',1),'2028-02-29');
  assert.equal(addMonths('2028-02-29',12),'2029-02-28');
  assert.equal(calc({startDate:'2026-01-31',cycle:'monthly'}).schedule[2].date,'2026-03-31');
});
const invalids=[
 {employees:''},{employees:0},{employees:-1},{employees:1.5},{employees:Infinity},{employees:1000001},
 {extraAmount:-1},{extraAmount:'abc'},{discount:-1},{discount:101},{discount:NaN},
 {taxMode:'specified',taxRate:''},{taxMode:'specified',taxRate:-1},{taxMode:'specified',taxRate:101},
 {startDate:'2026-02-30'},{startDate:'2026-13-01'},{startDate:''},{startDate:'1999-12-31'},
 {plan:'operations'},{plan:'toString'},{cycle:'weekly'},{cycle:'constructor'},
 {extraBasis:'other'},{extraCadence:'other'},{complex:true,customImplementation:0},
 {employees:1000000,extraBasis:'employee',extraAmount:1000000000},
];
invalids.forEach((input,i)=>test(`Reject invalid input ${i+1}: ${JSON.stringify(input)}`,()=>assert.throws(()=>calc(input))));
test('All plans/cycles: invoice sums reconcile and amounts are integer piastres',()=>{
  for(const plan of ['essentials','combined','full'])for(const cycle of ['annual','semiannual','quarterly','monthly']){
    const q=calc({plan,cycle,employees:99,discount:7.37,extraAmount:31.79,extraCadence:'annual',taxMode:'specified',taxRate:14});
    assert.equal(q.firstYearSubtotal,q.schedule.reduce((s,r)=>s+r.subtotal,0));
    assert.equal(q.firstYearTotal,q.schedule.reduce((s,r)=>s+r.total,0));
    assert.equal(q.firstYearSubtotal,q.recurringAnnual+q.implementation+q.extrasOnce);
    assert.ok(q.schedule.every(r=>Number.isSafeInteger(r.total)&&Number.isSafeInteger(r.tax)));
    assert.ok(q.schedule.every(r=>r.total===r.subtotal+r.tax));
  }
});

test('Locator quantity and editable unit price add once and reconcile with tax',()=>{const q=calc({hardwareQty:2,hardwareUnitPrice:2700,taxMode:'specified',taxRate:14});assert.equal(q.hardwareTotal,540000);assert.equal(q.firstYearSubtotal,6258000);assert.equal(q.firstYearTotal,7134120);assert.equal(calc({hardwareQty:0}).hardwareTotal,0);assert.throws(()=>calc({hardwareQty:1.5}));assert.throws(()=>calc({hardwareQty:1,hardwareUnitPrice:0}));});

