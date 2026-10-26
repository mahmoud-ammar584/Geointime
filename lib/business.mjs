import {addMonths} from './calculator.mjs';
import {DEFAULT_COMPENSATION,planRules,compensation,compensationReport,reviewAnswers,commissionIssues,contextData,activityLog} from './management.mjs';
// Policy source: Mahmoud 2026 Sales Target, Duties & Commission Plan, sections 4–5.
// Target and salary promise clarified by Mahmoud on 2026-10-26.
/** @type {{plans: any[], allocationConfirmed: boolean, compensation: any, activityLog: any[]}} */
export const DEFAULT_SETTINGS={plans:[{id:'target-2026',label:'تارجت Q4 / 2026',start:'2026-10-01',end:'2026-12-31',target:400,opening:0}],allocationConfirmed:false,compensation:structuredClone(DEFAULT_COMPENSATION),activityLog:[]};
const finite=(v,name,min=0,max=1e12)=>{const n=Number(v);if(!Number.isFinite(n)||n<min||n>max)throw Error('قيمة غير صحيحة: '+name);return n;};
export function validateSettings(input){
 if(!Array.isArray(input.plans)||!input.plans.length||input.plans.length>100)throw Error('أضف فترة تارجت واحدة على الأقل.');
 const plans=input.plans.map(p=>{if(!/^[\w-]{1,80}$/.test(p.id)||!String(p.label||'').trim())throw Error('اسم الفترة مطلوب.');if(!validDate(p.start)||!validDate(p.end)||p.start>p.end)throw Error('تواريخ فترة التارجت غير صحيحة.');return {...p,start:p.id==='target-2026'&&p.start==='2026-01-01'&&p.end==='2026-12-31'?'2026-10-01':p.start,rules:planRules(p.rules),label:String(p.label).slice(0,100),target:finite(p.target,'التارجت',1,1000000),opening:finite(p.opening??0,'الرصيد السابق',0,1000000),currentSalary:finite(p.currentSalary??0,'المرتب الحالي'),targetSalary:finite(p.targetSalary??0,'المرتب المستهدف'),retroMonths:p.retroMonths==null||p.retroMonths===''?null:finite(p.retroMonths,'شهور الأثر الرجعي',0,120)};}).sort((a,b)=>a.start.localeCompare(b.start));
 for(let i=1;i<plans.length;i++)if(plans[i].start<=plans[i-1].end)throw Error('فترات التارجت متداخلة؛ اختار فترات منفصلة.');
 if(plans.some(p=>!Number.isInteger(p.target)||!Number.isInteger(p.opening)))throw Error('التارجت ورصيد الموظفين أعداد صحيحة.');
 if(new Set(plans.map(p=>p.id)).size!==plans.length)throw Error('معرّف الفترة مكرر.');
 return {plans,allocationConfirmed:input.allocationConfirmed===true,compensation:compensation(input.compensation,plans),activityLog:activityLog(input.activityLog??[])};
}
export function validDate(s){return /^20\d\d-\d\d-\d\d$/.test(s||'')&&!Number.isNaN(Date.parse(s))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;}
export function validateRecord(data){
 if(!data||typeof data!=='object'||!data.input)throw Error('بيانات العرض ناقصة.');
 const customer=String(data.customer||'').trim().slice(0,150);if(!customer)throw Error('اكتب اسم العميل قبل حفظ العرض.');
 if(!['draft','sent','won','lost','archived'].includes(data.status))throw Error('حالة العرض غير صحيحة.');
 if(!['new','expansion','renewal'].includes(data.dealType??'new'))throw Error('نوع الصفقة غير صحيح.');
 if(data.status==='won'&&!validDate(data.closingDate))throw Error('حدد تاريخ الإغلاق لتوزيع الصفقة على شهرها.');
 const closingDate=validDate(data.closingDate)?data.closingDate:null;
 const activated=finite(data.activated??0,'الموظفين المفعّلين',0,1000000);if(!Number.isInteger(activated))throw Error('الموظفون المفعّلون عدد صحيح.');
 if(activated>Number(data.input.employees))throw Error('الموظفون المفعّلون يتجاوزون عدد الموظفين الفعلي بالعرض.');
 if(!['auto','annual','installments','rolling'].includes(data.payoutRule??'auto'))throw Error('قاعدة صرف العمولة غير صحيحة.');
 const payments=(data.payments??[]).map(p=>{if(!validDate(p.date))throw Error('تاريخ التحصيل غير صحيح.');return {id:String(p.id).slice(0,80),date:p.date,amount:finite(p.amount,'صافي تحصيل الاشتراك',.01)};});
 if(payments.length>500||new Set(payments.map(p=>p.id)).size!==payments.length)throw Error('سجلات التحصيل مكررة أو كثيرة جدًا.');
 const context=contextData(data.context);for(const d of [context.nextActionDate,context.expectedClose])if(d&&!validDate(d))throw Error('تاريخ المتابعة أو الإغلاق المتوقع غير صحيح.');
 const activationDate=validDate(data.activationDate)?data.activationDate:null;
 const refunds=(data.refunds??[]).map(p=>{if(!validDate(p.date)||!String(p.note||'').trim())throw Error('تاريخ وسبب الاسترداد مطلوبان.');return {id:String(p.id).slice(0,80),date:p.date,amount:finite(p.amount,'صافي الاشتراك المسترد',.01),note:String(p.note).slice(0,500)};});
 if(refunds.length>500||new Set(refunds.map(p=>p.id)).size!==refunds.length)throw Error('الاستردادات مكررة أو كثيرة.');
 const customerImage=String(data.customerImage||'');if(customerImage&&(!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(customerImage)||customerImage.length>100000))throw Error('صورة اسم العميل غير صحيحة.');
 return {context,activationDate,refunds,commissionReview:reviewAnswers(data.commissionReview),customer,customerImage,issuedDate:validDate(data.issuedDate)?data.issuedDate:null,input:data.input,status:data.status,dealType:data.dealType??'new',closingDate,activated,annualCommitment:data.annualCommitment===true,eligibleExtra:data.eligibleExtra===true,baselineMonthly:finite(data.baselineMonthly??0,'الاشتراك السابق'),share:finite(data.share??100,'نصيبك',0,100),renewalRate:data.renewalRate==null||data.renewalRate===''?null:finite(data.renewalRate,'عمولة التجديد المعتمدة',0,100),payoutRule:data.payoutRule??'auto',approvalNote:String(data.approvalNote||'').slice(0,1000),commissionPaid:finite(data.commissionPaid??0,'العمولة المصروفة'),adjustment:finite(data.adjustment??0,'تسوية العمولة',-1e10,1e10),adjustmentNote:String(data.adjustmentNote||'').slice(0,1000),notes:String(data.notes||'').slice(0,3000),lostNotes:String(data.lostNotes||'').trim().slice(0,3000),payments};
}
export function marginalCommission(value,employees,prior,target,rules=planRules()){
 const edges=[...rules.thresholds.map(p=>target*p/100),Infinity],rates=rules.rates;
 if(employees<=0)return {amount:Math.round(value*rates[0]/100),bands:[{employees:0,rate:rates[0],value,commission:Math.round(value*rates[0]/100)}],provisional:true};
 let cursor=prior,left=employees,allocated=0;const bands=[];
 for(let i=0;i<edges.length&&left>0;i++){const n=Math.min(left,Math.max(0,edges[i]-cursor));if(n<=0)continue;const next=allocated+n;const part=Math.round(value*next/employees)-Math.round(value*allocated/employees);const commission=Math.round(part*rates[i]/100);bands.push({employees:n,rate:rates[i],value:part,commission});cursor+=n;left-=n;allocated=next;}
 return {amount:bands.reduce((s,b)=>s+b.commission,0),bands,provisional:bands.some(b=>b.rate!==rates[0])};
}
export function buildReport(records,settings=DEFAULT_SETTINGS){
 const settingsOK=validateSettings(settings),won=records.filter(r=>r.data.status==='won');
 const activation=r=>r.data.activationDate||r.data.closingDate;
 const ordered=[...won].sort((a,b)=>activation(a).localeCompare(activation(b))||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
 const plans=settingsOK.plans.map(p=>{const activated=won.filter(r=>r.data.dealType==='new'&&activation(r)>=p.start&&activation(r)<=p.end).reduce((s,r)=>s+r.data.activated,0);const achieved=p.opening+activated;return {...p,achieved,remaining:Math.max(0,p.target-achieved),over:Math.max(0,achieved-p.target),percent:achieved/p.target*100,hit:achieved>=p.target};});
 const seen=[];
 const deals=ordered.map(record=>{
  const d=record.data,q=d.quote,plan=settingsOK.plans.find(p=>d.closingDate>=p.start&&d.closingDate<=p.end),rules=plan?.rules??planRules();
  const before=(plan?.opening??0)+seen.filter(r=>r.data.dealType==='new'&&activation(r)>=plan?.start&&activation(r)<=plan?.end).reduce((s,r)=>s+r.data.activated,0);
  const eligible=Math.max(0,q.coreMonthly*12+(d.eligibleExtra?q.extrasAnnual:0)-(d.dealType==='expansion'?Math.round(d.baselineMonthly*100)*12:0));
  const gross=d.payments.reduce((s,p)=>s+Math.round(p.amount*100),0),refunded=(d.refunds??[]).reduce((s,p)=>s+Math.round(p.amount*100),0);
  const col=Math.max(0,gross-refunded),collected=Math.min(col,eligible);let amount=null,bands=[],due=null,note='',provisional=false;
  const review=reviewAnswers(d.commissionReview),cycle=review.collectionCycle!=='unknown'?review.collectionCycle:q.cycle;
  const cycleMonths={annual:12,semiannual:6,quarterly:3,monthly:1}[cycle];
  let rule=d.payoutRule;
  if(rule==='auto'){
   if(review.contract==='annual'&&cycle==='annual')rule='annual';
   else if(review.contract==='annual'&&['monthly','quarterly'].includes(cycle))rule='installments';
   else if(review.contract==='rolling'&&cycle==='monthly')rule='rolling';
  }
  if(d.dealType==='expansion'){amount=Math.round(eligible*rules.expansionRate/100);due=Math.round(collected*rules.expansionRate/100);note=rules.expansionRate+'% من صافي تحصيل الزيادة فقط، في حدود اشتراك السنة المؤهل.';}
  else if(d.dealType==='renewal'){if(d.renewalRate!==null){amount=Math.round(eligible*d.renewalRate/100);due=Math.round(collected*d.renewalRate/100);note='نسبة التجديد المعتمدة × صافي التحصيل المؤهل؛ بدون افتراض سلفة.';}else note='نسبة وقاعدة التجديد غير محددتين بالملف.';}
  else if(plan){
   const result=marginalCommission(eligible,d.activated,before,plan.target,rules);amount=result.amount;bands=result.bands;provisional=result.provisional;
   if(rule==='annual'){due=collected>=eligible&&eligible>0?amount:0;note='صرف كامل العمولة بعد تحصيل الاشتراك السنوي المؤهل كاملًا.';}
   else if(rule==='installments'){
    const first=eligible*cycleMonths/12,advance=rules.installmentAdvance/100;
    due=collected>=first&&first>0?Math.round(amount*(advance+(1-advance)*Math.min(1,(collected-first)/(eligible-first||1)))):0;
    note=rules.installmentAdvance+'% بعد اكتمال أول دفعة؛ الباقي بنسبة صافي التحصيل اللاحق.';
   }else if(rule==='rolling'){
    const monthly=eligible/12,boundary=addMonths(d.input.startDate,rules.rollingAdvanceMonths);
    const after=Math.max(0,d.payments.filter(p=>p.date>=boundary).reduce((s,p)=>s+Math.round(p.amount*100),0)-(d.refunds??[]).reduce((s,p)=>s+Math.round(p.amount*100),0));
    due=collected>=monthly&&monthly>0?Math.min(amount,Math.round((monthly*rules.rollingAdvanceMonths+Math.min(after,monthly*(12-rules.rollingAdvanceMonths)))*(amount/(eligible||1)))):0;
    note='سلفة '+rules.rollingAdvanceMonths+' أشهر بعد اكتمال أول شهر؛ ثم التحصيل من الشهر '+(rules.rollingAdvanceMonths+1)+'. التوقع السنوي ليس استحقاقًا مضمونًا.';
   }else note='قاعدة الصرف غير محسومة؛ حدّد الالتزام والدورية أو سجّل الاستثناء المعتمد.';
  }else note='تاريخ الإغلاق خارج فترات التارجت.';
  const issues=commissionIssues(d,q,plan?{...plan,accelerated:provisional}:null,settingsOK.allocationConfirmed);
  if(due===null&&!issues.length)issues.push('قاعدة الصرف تحتاج اعتمادًا قبل تحديد المستحق.');
  const share=d.share/100;amount=amount===null?null:Math.round(amount*share);
  due=issues.length||due===null?null:Math.round(due*share)+Math.round(d.adjustment*100);
  seen.push(record);
  return {...record,eligible,collected:col,refunded,annualCommission:amount,due,paid:Math.round(d.commissionPaid*100),remaining:due===null?null:due-Math.round(d.commissionPaid*100),bands,provisional:issues.length>0,reviewIssues:issues,rule,note,planId:plan?.id,prior:before,closedMonth:d.closingDate.slice(0,7)};
 });
 const months=Object.values(deals.reduce((map,d)=>{const m=map[d.closedMonth]??={month:d.closedMonth,count:0,value:0,annualCommission:0,due:0,paid:0,unresolved:0,activated:0,deals:[]};m.count++;m.value+=d.data.quote.recurringAnnual;m.annualCommission+=d.annualCommission??0;m.due+=d.due??0;m.paid+=d.paid;m.unresolved+=d.due===null?1:0;m.activated+=d.data.dealType==='new'?d.data.activated:0;m.deals.push(d);return map;},{})).sort((a,b)=>b.month.localeCompare(a.month));
 return {deals,months,plans,compensation:compensationReport(settingsOK,plans)};
}


export function currentQuarter(today){
 if(!validDate(today))throw Error('تاريخ اليوم غير صحيح.');
 const year=Number(today.slice(0,4)),q=Math.floor((Number(today.slice(5,7))-1)/3)+1;
 return {id:`target-${year}-q${q}`,label:`تارجت Q${q} / ${year}`,start:`${year}-${String((q-1)*3+1).padStart(2,'0')}-01`,end:new Date(Date.UTC(year,q*3,0)).toISOString().slice(0,10)};
}
export function targetClock(settings,today){
 if(!validDate(today))throw Error('تاريخ اليوم غير صحيح.');
 const plan=settings.plans.find(p=>today>=p.start&&today<=p.end);
 return {planId:plan?.id??null,needsTarget:!plan,quarter:currentQuarter(today),daysRemaining:plan?Math.ceil((Date.parse(plan.end+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000):null};
}

