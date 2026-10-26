import test from 'node:test';import assert from 'node:assert/strict';
import{calculate}from'../lib/calculator.mjs';
import{DEFAULT_SETTINGS,validateSettings,validateRecord,buildReport}from'../lib/business.mjs';
import{DEFAULT_RULES,planRules,contextData,valueCase,managerSummary}from'../lib/management.mjs';
const input={employees:60,plan:'full',cycle:'annual',discount:0,extraAmount:'',taxMode:'unknown',startDate:'2026-10-25'};
function record(id,changes={}){
 const data=validateRecord({customer:id,input,status:'won',closingDate:'2026-10-25',activationDate:'2026-10-25',activated:60,annualCommitment:true,payments:[{id:'p1',date:'2026-10-25',amount:49680}],commissionReview:{contract:'annual',collectionCycle:'annual',netBasisConfirmed:true,answersConfirmed:true,incrementalConfirmed:true},...changes});
 return{id,createdAt:'2026-10-25T12:00:00Z',revision:1,data:{...data,quote:calculate(data.input)}};
}
test('Unreviewed legacy wins retain their value and target progress, but no definitive commission entitlement',()=>{
 const r=buildReport([record('old',{commissionReview:{},activationDate:null})]);
 assert.equal(r.deals[0].annualCommission,397440);assert.equal(r.deals[0].due,null);assert.ok(r.deals[0].reviewIssues.length>=3);assert.equal(r.plans[0].achieved,60);
});
test('A monthly price never implies a signed annual commitment',()=>{
 const r=buildReport([record('monthly',{input:{...input,cycle:'monthly'},commissionReview:{collectionCycle:'monthly',netBasisConfirmed:true,answersConfirmed:true}})]);
 assert.equal(r.deals[0].due,null);assert.ok(r.deals[0].reviewIssues.some(t=>t.includes('التعاقدي')));
});
test('Collected VAT, setup and hardware cannot silently inflate the eligible subscription ceiling',()=>{
 const r=buildReport([record('cap',{input:{...input,hardwareQty:4},payments:[{id:'p',date:'2026-10-25',amount:999999}]})]).deals[0];
 assert.equal(r.eligible,4968000);assert.equal(r.due,397440);
});
test('Expansion commission is capped to eligible incremental subscription and needs incremental collection confirmation',()=>{
 const r=record('expand',{dealType:'expansion',baselineMonthly:3300,payments:[{id:'p',date:'2026-10-25',amount:999999}]});
 assert.equal(buildReport([r]).deals[0].due,50400);
 r.data.commissionReview.incrementalConfirmed=false;assert.equal(buildReport([r]).deals[0].due,null);
});
test('Refunds reduce collected entitlement and expose a negative balance against already-paid commission',()=>{
 const r=buildReport([record('refund',{commissionPaid:3974.4,refunds:[{id:'refund',date:'2026-10-26',amount:49680,note:'إلغاء كامل'}]})]).deals[0];
 assert.equal(r.collected,0);assert.equal(r.due,0);assert.equal(r.remaining,-397440);
});
test('Refunds require both a valid date and reason',()=>{
 assert.throws(()=>record('bad',{refunds:[{id:'x',date:'2026-10-26',amount:10,note:''}]}),/سبب/);
});
test('A future quarter can have its own approved rates without changing 2026 rules or repeating a salary promise',()=>{
 const settings=structuredClone(DEFAULT_SETTINGS);
 settings.plans.push({id:'q1-2027',label:'2027 Q1',start:'2027-01-01',end:'2027-03-31',target:100,opening:0,rules:{...DEFAULT_RULES,rates:[9,11,13,16],approvalNote:'اعتماد مستقل'}});
 const q=record('future',{closingDate:'2027-01-10',activationDate:'2027-01-10',input:{...input,startDate:'2027-01-10'},payments:[{id:'p',date:'2027-01-10',amount:49680}]});
 const r=buildReport([record('2026'),q],settings);
 assert.equal(r.deals.find(d=>d.id==='2026').annualCommission,397440);assert.equal(r.deals.find(d=>d.id==='future').annualCommission,447120);
 assert.equal(r.compensation.events.length,1);assert.equal(r.compensation.events[0].planId,'target-2026');assert.equal(r.compensation.currentSalary,18000);
});
test('Changing quarter rules without documented approval is rejected',()=>{
 assert.throws(()=>planRules({rates:[9,10,12,15]}),/توثيق/);
 assert.throws(()=>planRules({thresholds:[100,99,200]}),/حدود/);
});
test('Acceleration above the base band remains pending until the value allocation method is confirmed',()=>{
 const settings=structuredClone(DEFAULT_SETTINGS);settings.plans[0].opening=390;
 const pending=buildReport([record('cross')],settings).deals[0];assert.equal(pending.due,null);
 settings.allocationConfirmed=true;const confirmed=buildReport([record('cross')],settings).deals[0];assert.ok(confirmed.due>397440);
});
test('Activation date controls target progress independently of close date',()=>{
 const settings=structuredClone(DEFAULT_SETTINGS);settings.plans.push({id:'q1',label:'2027 Q1',start:'2027-01-01',end:'2027-03-31',target:200,opening:0});
 const r=buildReport([record('late-activation',{activationDate:'2027-01-02'})],settings);
 assert.equal(r.plans[0].achieved,0);assert.equal(r.plans[1].achieved,60);assert.equal(r.deals[0].due,null);
});
test('The 21,000 salary promise does not become payable merely because a later quarter succeeds',()=>{
 const settings=structuredClone(DEFAULT_SETTINGS);settings.plans.push({id:'q1',label:'2027 Q1',start:'2027-01-01',end:'2027-03-31',target:10,opening:10});
 const r=buildReport([],settings);assert.equal(r.compensation.events[0].estimate,2100000);assert.equal(r.compensation.events[0].eligible,null);
});
test('New manual salary promises are independently linked and preserve previous promises',()=>{
 const settings=structuredClone(DEFAULT_SETTINGS);settings.plans.push({id:'q1',label:'2027 Q1',start:'2027-01-01',end:'2027-03-31',target:10,opening:10});
 settings.compensation.events.push({id:'raise2',label:'وعد جديد',planId:'q1',fromSalary:25000,toSalary:27000,retroMonths:2,retroLabel:'فترة معتمدة',approvalNote:'اعتماد',paid:0});
 const r=buildReport([],settings);assert.equal(r.compensation.events[1].eligible,400000);assert.equal(r.compensation.events[0].eligible,null);
});
test('Value scenarios use customer evidence, avoid adding implementation twice, and remain qualitative at Level C',()=>{
 const r=record('roi');r.data.context=contextData({value:{evidence:'estimated',monthlyExposure:55000,addressablePercent:35,note:'تقدير العميل'}});
 const v=valueCase(r.data);assert.equal(v.annualValue,23100000);assert.equal(v.investment,5718000);assert.ok(Math.abs(v.payback-5718000/(23100000/12))<.0001);
 r.data.context.value.evidence='strategic';assert.equal(valueCase(r.data),null);
});
test('Manager follow-ups use only open deals and keep lost/won deals out of overdue work',()=>{
 const settings=validateSettings(DEFAULT_SETTINGS);
 const active=record('active',{status:'sent',context:{nextAction:'متابعة المدير',nextActionDate:'2026-10-25',problem:'تسوية الرواتب',stakeholder:'HR'}});
 const lost=record('lost',{status:'lost',context:{nextAction:'خطوة قديمة',nextActionDate:'2026-10-01'}});
 const m=managerSummary([active,lost],settings,'2026-10-26');assert.equal(m.overdue.length,1);assert.equal(m.lost,1);assert.equal(m.unqualified.length,0);
});
test('Activity dates and count validation preserve an existing saved day',()=>{
 const s=validateSettings({...DEFAULT_SETTINGS,activityLog:[{date:'2026-10-26',calls:20,conversations:5,discoveries:2,demos:1,note:'اجتماعات'}]});
 assert.equal(s.activityLog[0].calls,20);assert.throws(()=>validateSettings({...s,activityLog:[{date:'2026-02-30'}]}));
 assert.throws(()=>validateSettings({...s,activityLog:[s.activityLog[0],s.activityLog[0]]}),/أكثر/);
});
