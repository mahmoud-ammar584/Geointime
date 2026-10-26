// Grounded in the supplied 2026 Sales Plan §§4–9, Value Framework and Messaging Framework.
// Target/salary promise: Mahmoud's explicit clarification, 26 October 2026.
export const DEFAULT_RULES={rates:[8,10,12,15],thresholds:[100,150,200],expansionRate:5,installmentAdvance:50,rollingAdvanceMonths:3,approvalNote:''};
export const DEFAULT_COMPENSATION={currentSalary:18000,events:[{id:'promise-q4-2026',label:'وعد تحقيق تارجت الربع الأخير 2026',planId:'target-2026',fromSalary:18000,toSalary:25000,retroMonths:3,retroLabel:'أكتوبر ونوفمبر وديسمبر 2026',approvalNote:'وعد مشروط بتحقيق 400 موظف؛ وفق توضيح محمود',paid:0}]};
const num=(v,name,min=0,max=1e12)=>{const n=Number(v);if(!Number.isFinite(n)||n<min||n>max)throw Error('قيمة غير صحيحة: '+name);return n;};
const text=(v,max=1000)=>String(v??'').trim().slice(0,max);
export function planRules(input={}){
 const rates=(input.rates??DEFAULT_RULES.rates).map(v=>num(v,'نسبة العمولة',0,100));
 const thresholds=(input.thresholds??DEFAULT_RULES.thresholds).map(v=>num(v,'حد الشريحة',1,10000));
 if(rates.length!==4||thresholds.length!==3||thresholds[0]!==100||thresholds[1]<=100||thresholds[2]<=thresholds[1])throw Error('حدود الشرائح تبدأ بـ100% ثم تتزايد.');
 const result={rates,thresholds,expansionRate:num(input.expansionRate??5,'عمولة التوسع',0,100),installmentAdvance:num(input.installmentAdvance??50,'سلفة الالتزام السنوي',0,100),rollingAdvanceMonths:num(input.rollingAdvanceMonths??3,'شهور السلفة',0,12),approvalNote:text(input.approvalNote)};
 if(!Number.isInteger(result.rollingAdvanceMonths))throw Error('شهور سلفة العمولة عدد صحيح.');
 const changed=JSON.stringify({...result,approvalNote:''})!==JSON.stringify(DEFAULT_RULES);
 if(changed&&!result.approvalNote)throw Error('تغيير قواعد العمولة يحتاج توثيق القاعدة المعتمدة.');
 return result;
}
export function compensation(input,plans){
 const source=input??{...DEFAULT_COMPENSATION,events:DEFAULT_COMPENSATION.events.filter(e=>plans.some(p=>p.id===e.planId))};
 const events=(source.events??[]).map(e=>{
  const event={id:text(e.id,80),label:text(e.label,150),planId:text(e.planId,80),fromSalary:num(e.fromSalary,'المرتب السابق'),toSalary:num(e.toSalary,'المرتب الموعود'),retroMonths:e.retroMonths==null||e.retroMonths===''?null:num(e.retroMonths,'شهور الأثر الرجعي',0,120),retroLabel:text(e.retroLabel,200),approvalNote:text(e.approvalNote),paid:num(e.paid??0,'الأثر الرجعي المصروف')};
  if(!/^[\w-]{1,80}$/.test(event.id)||!plans.some(p=>p.id===event.planId))throw Error('اربط وعد المرتب بفترة تارجت محفوظة.');
  return event;
 });
 if(events.length>100||new Set(events.map(e=>e.id)).size!==events.length)throw Error('وعود المرتب مكررة أو كثيرة.');
 return {currentSalary:num(source.currentSalary??18000,'المرتب الحالي'),events};
}
export function compensationReport(settings,plans){
 const c=settings.compensation;
 return {...c,events:c.events.map(e=>{const plan=plans.find(p=>p.id===e.planId);const difference=Math.max(0,e.toSalary-e.fromSalary);const estimate=e.retroMonths==null?null:Math.round(difference*e.retroMonths*100);return {...e,hit:plan?.hit===true,difference,estimate,eligible:plan?.hit&&estimate!==null?estimate:null,remaining:plan?.hit&&estimate!==null?estimate-Math.round(e.paid*100):null};})};
}
export function reviewAnswers(input={}){
 const contract=['annual','rolling','other'].includes(input.contract)?input.contract:'unknown';
 const collectionCycle=['annual','semiannual','quarterly','monthly'].includes(input.collectionCycle)?input.collectionCycle:'unknown';
 return {contract,collectionCycle,netBasisConfirmed:input.netBasisConfirmed===true,incrementalConfirmed:input.incrementalConfirmed===true,answersConfirmed:input.answersConfirmed===true};
}
export function commissionIssues(data,quote,plan,allocationConfirmed){
 const a=reviewAnswers(data.commissionReview),issues=[];
 if(!a.answersConfirmed)issues.push('راجع إجابات مساعد العمولة وأكّدها.');
 if(!a.netBasisConfirmed)issues.push('أكّد أن التحصيل صافي اشتراك مؤهل بعد الخصم وبدون ضريبة أو تهيئة أو أجهزة.');
 if(data.dealType==='new'){
  if(a.contract==='unknown')issues.push('حدد الالتزام التعاقدي الفعلي.');
  if(a.collectionCycle==='unknown')issues.push('حدد دورية التحصيل المتفق عليها.');
  if(a.contract==='other'&&data.payoutRule==='auto')issues.push('الالتزام الخاص يحتاج قاعدة صرف معتمدة.');
  if(!plan)issues.push('تاريخ الإغلاق خارج فترات التارجت.');
  if(data.activated<=0||!data.activationDate)issues.push('حدد الموظفين المفعّلين فعليًا وتاريخ التفعيل.');
  if(plan&&data.activationDate&&(data.activationDate<plan.start||data.activationDate>plan.end))issues.push('التفعيل خارج فترة الإغلاق؛ يلزم تحديد فترة اعتماد العمولة.');
  if(a.contract==='rolling'&&a.collectionCycle!=='monthly'&&data.payoutRule==='auto')issues.push('قاعدة الالتزام غير السنوي بهذه الدورية تحتاج اعتمادًا.');
  if(a.contract==='annual'&&a.collectionCycle==='semiannual'&&data.payoutRule==='auto')issues.push('الخطة لا تحدد صرف النصف سنوي؛ سجّل قاعدة معتمدة.');
  if(plan&&plan.accelerated&&!allocationConfirmed)issues.push('توزيع قيمة الصفقة على شرائح التجاوز يحتاج تأكيد اعتماد الإدارة.');
 }
 if(data.dealType==='expansion'&&!a.incrementalConfirmed)issues.push('أكّد أن التحصيل المسجل للزيادة فقط وليس كامل فاتورة العميل.');
 if(data.dealType==='renewal'&&(data.renewalRate===null||!data.approvalNote?.trim()))issues.push('نسبة وقاعدة التجديد غير محددة بالملف؛ سجّل الاعتماد.');
 if((data.payoutRule!=='auto'||data.share!==100)&&!data.approvalNote?.trim())issues.push('سجّل اعتماد الاستثناء أو تقسيم العمولة.');
 return issues;
}
export function contextData(input={}){
 const value=input.value??{};
 return {problem:text(input.problem),stakeholder:text(input.stakeholder,200),nextAction:text(input.nextAction,500),nextActionDate:text(input.nextActionDate,10),expectedClose:text(input.expectedClose,10),locations:input.locations==null||input.locations===''?null:num(input.locations,'عدد المواقع',0,100000),competitor:text(input.competitor,200),persona:['hr','operations','finance','owner','it','supervisor'].includes(input.persona)?input.persona:'hr',value:{evidence:['measured','estimated','strategic'].includes(value.evidence)?value.evidence:'unknown',monthlyExposure:value.monthlyExposure==null||value.monthlyExposure===''?null:num(value.monthlyExposure,'التكلفة الشهرية الحالية'),addressablePercent:value.addressablePercent==null||value.addressablePercent===''?null:num(value.addressablePercent,'النسبة القابلة للتحسين',0,100),note:text(value.note)}};
}
export function valueCase(record){
 const v=record.context?.value;if(!v||!['measured','estimated'].includes(v.evidence)||v.monthlyExposure===null||v.addressablePercent===null)return null;
 const annualExposure=Math.round(v.monthlyExposure*1200),annualValue=Math.round(annualExposure*v.addressablePercent/100);
 const investment=record.quote.firstYearSubtotal;
 return {annualExposure,annualValue,investment,net:investment===null?null:annualValue-investment,roi:investment?((annualValue-investment)/investment*100):null,payback:annualValue&&investment!==null?investment/(annualValue/12):null,evidence:v.evidence};
}
export function activityLog(input=[]){
 if(!Array.isArray(input)||input.length>2000)throw Error('سجل النشاط غير صحيح.');
 const log=input.map(a=>{if(!/^20\d\d-\d\d-\d\d$/.test(a.date)||new Date(a.date+'T12:00:00Z').toISOString().slice(0,10)!==a.date)throw Error('تاريخ النشاط غير صحيح.');const row={date:a.date,note:text(a.note,1000)};for(const k of ['calls','conversations','discoveries','demos']){row[k]=num(a[k]??0,'عدد الأنشطة',0,100000);if(!Number.isInteger(row[k]))throw Error('النشاط عدد صحيح.');}return row;});
 if(new Set(log.map(a=>a.date)).size!==log.length)throw Error('يوجد أكثر من سجل لنفس اليوم.');return log;
}
export function managerSummary(records,settings,today){
 const active=records.filter(r=>['draft','sent'].includes(r.data.status));
 const followups=active.map(r=>({...r,context:contextData(r.data.context)}));
 return {active:active.length,won:records.filter(r=>r.data.status==='won').length,lost:records.filter(r=>r.data.status==='lost').length,sent:records.filter(r=>r.data.status==='sent').length,followups:followups.filter(r=>r.context.nextAction&&r.context.nextActionDate).sort((a,b)=>a.context.nextActionDate.localeCompare(b.context.nextActionDate)),missingNext:followups.filter(r=>!r.context.nextAction||!r.context.nextActionDate),unqualified:followups.filter(r=>!r.context.problem||!r.context.stakeholder),overdue:followups.filter(r=>r.context.nextActionDate&&r.context.nextActionDate<today),activity:settings.activityLog.find(a=>a.date===today)??{date:today,calls:0,conversations:0,discoveries:0,demos:0,note:''}};
}
export const PERSONA_GUIDANCE={hr:'ابدأ بدقة الحضور وتسوية الرواتب ووقت المراجعة، ثم اكتشف الاحتياج التشغيلي.',operations:'اسأل عن فجوات التغطية والبدائل ووقت المشرفين وإثبات إنجاز العمل.',finance:'ناقش التسرب والتكاليف الفعلية والتحكم والعائد المبني على بيانات العميل.',owner:'اربط الرؤية التشغيلية بقابلية التوسع ومخاطر الخدمة وقيمة قابلة للقياس.',it:'تحقق من النظام الحالي ونطاق التكامل؛ لا تفترض وجود تكامل جاهز.',supervisor:'ركّز على تقليل المتابعة اليدوية وسرعة التعامل مع الاستثناءات.'};

