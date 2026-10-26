import test from'node:test';import assert from'node:assert/strict';
import{calculate,renewalFor,CALCULATION_VERSION}from'../lib/calculator.mjs';
const base={employees:60,plan:'full',cycle:'annual',discount:0,extraAmount:'',startDate:'2026-01-31'};
test('New quotes default to Egypt VAT 14%; none, custom and legacy unknown remain explicit choices',()=>{
 const q=calculate(base);assert.equal(q.taxMode,'egypt');assert.equal(q.taxRate,14);assert.equal(q.firstYearTotal,6518520);
 assert.equal(calculate({...base,taxMode:'none'}).firstYearTotal,5718000);
 assert.equal(calculate({...base,taxMode:'specified',taxRate:15}).firstYearTotal,6575700);
 assert.equal(calculate({...base,taxMode:'unknown'}).firstYearTotal,null);
 assert.equal(q.calculationVersion,CALCULATION_VERSION);
});
test('Published automatic setup tiers include 500; complex and over-500 deployments require a custom quote',()=>{
 for(const [employees,fee]of[[30,500000],[50,500000],[51,750000],[100,750000],[101,1000000],[250,1000000],[251,1500000],[500,1500000]])assert.equal(calculate({...base,employees}).implementation,fee);
 assert.equal(calculate({...base,employees:500}).customRequired,false);
 assert.equal(calculate({...base,employees:501}).implementation,null);
 assert.equal(calculate({...base,complex:true}).implementation,null);
});
for(const [cycle,date,subtotal,total]of[['annual','2027-01-31',4968000,5663520],['semiannual','2026-07-31',2558520,2916713],['quarterly','2026-04-30',1279260,1458356],['monthly','2026-02-28',447120,509717]]){
 test('Next '+cycle+' payment uses selected start date and only recurring charges',()=>{
  const q=calculate({...base,cycle,hardwareQty:2,hardwareUnitPrice:2700,otherOnce:1000,extraAmount:200,extraCadence:'once'}),r=renewalFor(q,base.startDate);
  assert.equal(r.date,date);assert.equal(r.subtotal,subtotal);assert.equal(r.total,total);assert.equal(r.implementation,0);assert.equal(r.once,0);assert.equal(r.anniversaryDate,'2027-01-31');
  assert.ok(q.schedule[0].subtotal>r.subtotal);
 });
}
test('Recurring extras and discounts stay in the next bill, and monthly penny allocation matches its actual schedule row',()=>{
 const q=calculate({...base,cycle:'monthly',discount:7.37,extraAmount:31.79,extraCadence:'annual'});
 const r=renewalFor(q,base.startDate);assert.equal(r.subtotal,q.schedule[1].core+q.schedule[1].extra);assert.equal(r.total,q.schedule[1].total);
});
test('Removing VAT gives a complete next-payment amount, while legacy unknown is clearly unresolved',()=>{
 const no=renewalFor(calculate({...base,taxMode:'none'}),base.startDate);assert.equal(no.total,no.subtotal);assert.equal(no.tax,0);
 const unknown=renewalFor(calculate({...base,taxMode:'unknown'}),base.startDate);assert.equal(unknown.total,null);assert.equal(unknown.tax,null);
});
test('Next recurring charge remains known even while an initial custom setup quote is incomplete',()=>{
 const q=calculate({...base,employees:501});assert.equal(q.firstYearTotal,null);assert.ok(renewalFor(q,base.startDate).total>0);
});
