import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate} from '../lib/calculator.mjs';
import {buildReport,validateRecord,DEFAULT_SETTINGS} from '../lib/business.mjs';
const input={employees:60,plan:'full',cycle:'annual',discount:0,taxMode:'egypt',startDate:'2026-10-01'};
function record(changes={}){
 const data=validateRecord({customer:'Monthly payroll',input,status:'won',closingDate:'2026-10-10',activationDate:'2026-10-10',activated:60,commissionReview:{contract:'annual',collectionCycle:changes.input?.cycle||'annual',netBasisConfirmed:true,answersConfirmed:true},payments:[{id:'p',date:'2026-10-10',amount:49680}],...changes});
 return {id:changes.customer||'payroll',createdAt:'2026-10-01T10:00:00Z',revision:1,data:{...data,quote:calculate(data.input)}};
}
test('October close counts toward Q4 employees, while commission is scheduled in November',()=>{
 const r=buildReport([record()]);assert.equal(r.plans[0].achieved,60);assert.equal(r.months[0].month,'2026-10');assert.equal(r.deals[0].payrollMonth,'2026-11');assert.equal(r.payrollMonths[0].month,'2026-11');assert.equal(r.payrollMonths[0].due,397440);assert.equal(r.payrollMonths[0].paid,0);
});
test('December closes remain in Q4 and pay in January without needing a new target',()=>{
 const r=buildReport([record({closingDate:'2026-12-31',activationDate:'2026-12-31',payments:[{id:'p',date:'2026-12-31',amount:49680}]})]);
 assert.equal(r.plans[0].achieved,60);assert.equal(r.deals[0].planId,'target-2026');assert.equal(r.payrollMonths[0].month,'2027-01');assert.equal(r.payrollMonths[0].due,397440);
});
test('Quarter bands do not reset when the closing or payroll month changes',()=>{
 const settings=structuredClone(DEFAULT_SETTINGS);settings.plans[0].opening=340;settings.allocationConfirmed=true;
 const r=buildReport([record({customer:'October'}),record({customer:'November',closingDate:'2026-11-10'})],settings);
 assert.equal(r.plans[0].achieved,460);assert.equal(r.deals[0].bands[0].rate,8);assert.equal(r.deals[1].prior,400);assert.equal(r.deals[1].bands[0].rate,10);assert.equal(r.payrollMonths[1].month,'2026-12');
});
test('Late collection defers entitlement rather than fabricating payment in the first payroll month',()=>{
 const r=buildReport([record({payments:[{id:'p',date:'2026-11-20',amount:49680}]})]);
 assert.deepEqual(r.payrollMonths.map(m=>[m.month,m.due]),[['2026-11',0],['2026-12',397440]]);
 assert.equal(r.payrollMonths.reduce((s,m)=>s+m.paid,0),0);
});
test('Pre-close collections never create a payroll period earlier than the closing month plus one',()=>{
 const r=buildReport([record({payments:[{id:'p',date:'2026-09-20',amount:49680}]})]);assert.equal(r.payrollMonths.length,1);assert.equal(r.payrollMonths[0].month,'2026-11');
});
test('Annual monthly installments schedule only each new entitlement delta, preserving the advance',()=>{
 const q={...input,cycle:'monthly'},quote=calculate(q),monthly=quote.coreMonthly/100;
 const r=buildReport([record({input:q,payments:[{id:'p1',date:'2026-10-10',amount:monthly},{id:'p2',date:'2026-11-10',amount:monthly},{id:'p3',date:'2026-12-10',amount:monthly}]})]);
 const due=r.payrollMonths.map(m=>m.due);assert.equal(due.length,3);assert.equal(due[0],Math.round(r.deals[0].annualCommission*.5));assert.ok(due[1]<due[0]);assert.equal(due.reduce((s,n)=>s+n,0),r.deals[0].due);
});
test('A later refund creates a negative adjustment in the following payroll month',()=>{
 const r=buildReport([record({refunds:[{id:'r',date:'2026-11-10',amount:49680,note:'إلغاء'}]})]);
 assert.deepEqual(r.payrollMonths.map(m=>[m.month,m.due]),[['2026-11',397440],['2026-12',-397440]]);assert.equal(r.deals[0].due,0);
});
test('Dated actual commission receipts use their receipt month, independent of scheduled month',()=>{
 const r=buildReport([record({commissionPayouts:[{id:'paid',date:'2026-12-05',amount:1000,note:'دفعة'}]})]);
 assert.equal(r.payrollMonths[0].paid,0);assert.equal(r.payrollMonths[1].paid,100000);assert.equal(r.payrollMonths[1].month,'2026-12');assert.equal(r.deals[0].paid,100000);assert.equal(r.deals[0].remaining,297440);
});
test('Legacy undated payouts and adjustments are preserved without inventing payroll dates',()=>{
 const r=buildReport([record({commissionPaid:100,adjustment:-20})]);
 assert.equal(r.undatedPaid,10000);assert.equal(r.undatedAdjustment,-2000);assert.equal(r.hasUndatedAdjustment,true);assert.equal(r.payrollMonths[0].paid,0);assert.equal(r.payrollMonths[0].due,397440);assert.equal(r.deals[0].due,395440);assert.equal(r.deals[0].remaining,385440);
});
test('A dated approved adjustment enters the next month and reconciles with lifetime entitlement',()=>{
 const r=buildReport([record({adjustment:-20,adjustmentDate:'2026-12-15',adjustmentNote:'اعتماد'})]);
 assert.deepEqual(r.payrollMonths.map(m=>[m.month,m.due]),[['2026-11',397440],['2027-01',-2000]]);
 assert.equal(r.payrollMonths.reduce((s,m)=>s+m.due,0),r.deals[0].due);assert.equal(r.undatedAdjustment,0);
});
test('Incomplete answers retain the planned month but never claim a payable commission',()=>{
 const r=buildReport([record({commissionReview:{}})]);assert.equal(r.deals[0].due,null);assert.equal(r.payrollMonths[0].unresolved,1);assert.equal(r.payrollMonths[0].deals[0].due,null);
});
test('Commission receipts reject invalid dates, negative money, and duplicate identifiers',()=>{
 for(const commissionPayouts of [[{id:'a',date:'2026-02-30',amount:10}],[{id:'a',date:'2026-11-01',amount:-1}],[{id:'a',date:'2026-11-01',amount:1},{id:'a',date:'2026-11-02',amount:2}]]){
  assert.throws(()=>record({commissionPayouts}));
 }
 assert.throws(()=>record({adjustmentDate:'2026-02-30'}));
});
test('Server and browser share identical payroll and management rules',()=>{
 return Promise.all([import('node:fs/promises')]).then(async([fs])=>{
  for(const file of ['business.mjs','management.mjs'])assert.equal(await fs.readFile(new URL('../lib/'+file,import.meta.url),'utf8'),await fs.readFile(new URL('../public/'+file,import.meta.url),'utf8'));
 });
});
