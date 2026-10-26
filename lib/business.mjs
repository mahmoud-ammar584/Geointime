import {addMonths} from './calculator.mjs';
// Policy source: Mahmoud 2026 Sales Target, Duties & Commission Plan, sections 4–5.
// Target and salary condition supplemented by Mahmoud on 2026-10-25.
export const DEFAULT_SETTINGS={plans:[{id:'target-2026',label:'تارجت نهاية 2026',start:'2026-01-01',end:'2026-12-31',target:400,opening:0,currentSalary:18000,targetSalary:25000,retroMonths:null}],allocationConfirmed:false};
const finite=(v,name,min=0,max=1e12)=>{const n=Number(v);if(!Number.isFinite(n)||n<min||n>max)throw Error('قيمة غير صحيحة: '+name);return n;};
export function validateSettings(input){
 if(!Array.isArray(input.plans)||!input.plans.length||input.plans.length>100)throw Error('أضف فترة تارجت واحدة على الأقل.');
 const plans=input.plans.map(p=>{if(!/^[\w-]{1,80}$/.test(p.id)||!String(p.label||'').trim())throw Error('اسم الفترة مطلوب.');if(!validDate(p.start)||!validDate(p.end)||p.start>p.end)throw Error('تواريخ فترة التارجت غير صحيحة.');return {...p,label:String(p.label).slice(0,100),target:finite(p.target,'التارجت',1,1000000),opening:finite(p.opening??0,'الرصيد السابق',0,1000000),currentSalary:finite(p.currentSalary??0,'المرتب الحالي'),targetSalary:finite(p.targetSalary??0,'المرتب المستهدف'),retroMonths:p.retroMonths==null||p.retroMonths===''?null:finite(p.retroMonths,'شهور الأثر الرجعي',0,120)};}).sort((a,b)=>a.start.localeCompare(b.start));
 for(let i=1;i<plans.length;i++)if(plans[i].start<=plans[i-1].end)throw Error('فترات التارجت متداخلة؛ اختار فترات منفصلة.');
 if(plans.some(p=>!Number.isInteger(p.target)||!Number.isInteger(p.opening)))throw Error('التارجت ورصيد الموظفين أعداد صحيحة.');
 if(new Set(plans.map(p=>p.id)).size!==plans.length)throw Error('معرّف الفترة مكرر.');
 return {plans,allocationConfirmed:input.allocationConfirmed===true};
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
 const customerImage=String(data.customerImage||'');if(customerImage&&(!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(customerImage)||customerImage.length>100000))throw Error('صورة اسم العميل غير صحيحة.');
 return {customer,customerImage,issuedDate:validDate(data.issuedDate)?data.issuedDate:null,input:data.input,status:data.status,dealType:data.dealType??'new',closingDate,activated,annualCommitment:data.annualCommitment===true,eligibleExtra:data.eligibleExtra===true,baselineMonthly:finite(data.baselineMonthly??0,'الاشتراك السابق'),share:finite(data.share??100,'نصيبك',0,100),renewalRate:data.renewalRate==null||data.renewalRate===''?null:finite(data.renewalRate,'عمولة التجديد المعتمدة',0,100),payoutRule:data.payoutRule??'auto',approvalNote:String(data.approvalNote||'').slice(0,1000),commissionPaid:finite(data.commissionPaid??0,'العمولة المصروفة'),adjustment:finite(data.adjustment??0,'تسوية العمولة',-1e10,1e10),adjustmentNote:String(data.adjustmentNote||'').slice(0,1000),notes:String(data.notes||'').slice(0,3000),lostNotes:String(data.lostNotes||'').trim().slice(0,3000),payments};
}
export function marginalCommission(value,employees,prior,target){
 if(employees<=0)return {amount:Math.round(value*.08),bands:[{employees:0,rate:8,value,commission:Math.round(value*.08)}],provisional:true};
 const edges=[target,target*1.5,target*2,Infinity],rates=[8,10,12,15];let cursor=prior,left=employees,allocated=0;const bands=[];
 for(let i=0;i<edges.length&&left>0;i++){const n=Math.min(left,Math.max(0,edges[i]-cursor));if(n<=0)continue;const next=allocated+n;const part=Math.round(value*next/employees)-Math.round(value*allocated/employees);const commission=Math.round(part*rates[i]/100);bands.push({employees:n,rate:rates[i],value:part,commission});cursor+=n;left-=n;allocated=next;}
 return {amount:bands.reduce((s,b)=>s+b.commission,0),bands,provisional:bands.some(b=>b.rate>8)};
}
export function buildReport(records,settings=DEFAULT_SETTINGS){
 const settingsOK=validateSettings(settings);const progress=Object.fromEntries(settingsOK.plans.map(p=>[p.id,p.opening]));
 const ordered=records.filter(r=>r.data.status==='won').sort((a,b)=>(a.data.closingDate||'').localeCompare(b.data.closingDate||'')||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
 const deals=ordered.map(record=>{
  const d=record.data,q=d.quote,plan=settingsOK.plans.find(p=>d.closingDate>=p.start&&d.closingDate<=p.end);const before=plan?progress[plan.id]:0;
  const eligible=Math.max(0,q.coreMonthly*12+(d.eligibleExtra?q.extrasAnnual:0)-(d.dealType==='expansion'?Math.round(d.baselineMonthly*100)*12:0));
  const col=d.payments.reduce((s,p)=>s+Math.round(p.amount*100),0);const collected=Math.min(col,eligible);let amount=null,bands=[],due=null,note='',provisional=false;
  if(d.dealType==='expansion'){amount=Math.round(eligible*.05);due=Math.round(col*.05);note='5% من التحصيل الإضافي؛ أدخل الزيادة فقط في سجل التحصيل.';}
  else if(d.dealType==='renewal'){if(d.renewalRate!==null){amount=Math.round(eligible*d.renewalRate/100);due=Math.round(col*d.renewalRate/100);note='نسبة تجديد مدخلة يدويًا؛ تتطلب اعتمادًا منفصلًا.';}else note='الملف لا يحدد عمولة التجديد؛ أدخل نسبة معتمدة لحسابها.';}
  else if(!plan)note='تاريخ الإغلاق خارج فترات التارجت؛ أضف الفترة من الإعدادات.';
  else {const result=marginalCommission(eligible,d.activated,before,plan.target);amount=result.amount;bands=result.bands;provisional=result.provisional&&!settingsOK.allocationConfirmed;
   let rule=d.payoutRule;
   if(rule==='auto'){if(q.cycle==='annual'&&d.annualCommitment)rule='annual';else if(['monthly','quarterly'].includes(q.cycle)&&d.annualCommitment)rule='installments';else if(q.cycle==='monthly'&&!d.annualCommitment)rule='rolling';}
   if(rule==='annual'){due=col>=eligible&&eligible>0?amount:0;note='100% من العمولة بعد تحصيل الاشتراك السنوي كاملًا.';}
   else if(rule==='installments'){
    const first=eligible*q.cycleMonths/12;
    due=col>=first&&first>0?Math.round(amount*(.5+.5*Math.min(1,(col-first)/(eligible-first||1)))):0;
    note='50% بعد تحصيل أول دفعة اشتراك كاملة؛ الباقي بنسبة التحصيل اللاحق.';
   }else if(rule==='rolling'){
    const monthly=eligible/12;const firstPaid=col>=monthly&&monthly>0;
    const boundary=addMonths(d.input.startDate,3);
    const after=d.payments.filter(p=>p.date>=boundary).reduce((s,p)=>s+Math.round(p.amount*100),0);
    const rate=eligible?amount/eligible:0;
    due=firstPaid?Math.round(monthly*3*rate+Math.min(after,monthly*9)*rate):0;
    note='سلفة 3 أشهر بعد أول اشتراك شهري كامل؛ عمولة التحصيل من الشهر الرابع. إجمالي السنة توقع قابل للتسوية.';
   }else{due=null;note='قاعدة صرف نصف السنوي غير محددة بالملف. اختر قاعدة متفقًا عليها وسجّل الاعتماد.';}
  }
  const share=d.share/100;amount=amount===null?null:Math.round(amount*share);due=due===null?null:Math.round(due*share)+Math.round(d.adjustment*100);
  if(d.dealType==='new'&&plan)progress[plan.id]+=d.activated;
  return {...record,eligible,collected:col,annualCommission:amount,due,paid:Math.round(d.commissionPaid*100),remaining:due===null?null:due-Math.round(d.commissionPaid*100),bands,provisional,note,planId:plan?.id,prior:before,closedMonth:d.closingDate.slice(0,7)};
 });
 const months=Object.values(deals.reduce((map,d)=>{const m=map[d.closedMonth]??={month:d.closedMonth,count:0,value:0,annualCommission:0,due:0,paid:0,unresolved:0,activated:0,deals:[]};m.count++;m.value+=d.data.quote.recurringAnnual;m.annualCommission+=d.annualCommission??0;m.due+=d.due??0;m.paid+=d.paid;m.unresolved+=d.due===null?1:0;m.activated+=d.data.dealType==='new'?d.data.activated:0;m.deals.push(d);return map;},{})).sort((a,b)=>b.month.localeCompare(a.month));
 const plans=settingsOK.plans.map(p=>{const achieved=progress[p.id],hit=achieved>=p.target,diff=Math.max(0,p.targetSalary-p.currentSalary);return {...p,achieved,remaining:Math.max(0,p.target-achieved),over:Math.max(0,achieved-p.target),percent:achieved/p.target*100,hit,salaryDifference:diff,retroactive:hit&&p.retroMonths!==null?Math.round(diff*p.retroMonths*100):null};});
 return {deals,months,plans};
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

