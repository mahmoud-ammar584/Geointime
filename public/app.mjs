import { calculate, approvalFor, POLICY } from './calculator.mjs';
const $ = id => document.getElementById(id);
const money = value => value === null ? 'بانتظار التسعير' : new Intl.NumberFormat('en-US', {minimumFractionDigits: value % 100 ? 2 : 0,maximumFractionDigits:2}).format(value / 100);
const price = value => `${money(value)} <small>ج.م</small>`;
const escape = s => String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateText = date => new Intl.DateTimeFormat('ar-EG',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
export let latest = null;
let beforeExport = async () => true;
export function registerSaver(fn){beforeExport=fn;}
export function state() {
  return { employees: $('employees').value, plan: document.querySelector('[name=plan]:checked')?.value, cycle: document.querySelector('[name=billing]:checked')?.value, startDate: $('startDate').value, discount: $('discount').value || 0, extraAmount: $('extraAmount').value, extraBasis: $('extraBasis').value, extraCadence: $('extraCadence').value, otherOnce: $('otherOnce').value, hardwareQty:$('hardwareQty').value, hardwareUnitPrice:$('hardwareUnitPrice').value, complex: $('complex').checked, customImplementation: $('customImplementation').value, taxMode: $('taxMode').value, taxRate: $('taxRate').value };
}
function row(label,value,cls='') { return `<div class="breakdown-row ${cls}"><span class="row-label">${label}</span><strong>${value}</strong></div>`; }
export function render() {
  const input = state();
  const custom = Number(input.employees) >= 500 || Number(input.employees) < 30 || input.complex;
  $('custom-wrap').hidden = !custom;
  $('tax-wrap').hidden = input.taxMode !== 'specified';
  if (custom || input.taxMode === 'specified') document.querySelector('.settings').open = true;
  const min = Number(input.employees) > 0 && Number(input.employees) < 30;
  $('minimum-note').hidden = !min;
  $('minimum-note').textContent = 'الحد التجاري 30 موظفًا؛ سيتم احتساب 30 بدلًا من '+input.employees+'.';
  const ap = approvalFor(Number(input.discount));
  $('approval').textContent = ap.text;
  $('approval').classList.toggle('caution',ap.needsApproval);
  const count = Math.max(30,Number(input.employees)||30);
  const tier = POLICY.tiers.find(t=>count>=t.from&&count<=t.to);
  for (const node of document.querySelectorAll('[data-rate]')) {
    const key=node.dataset.rate;
    node.innerHTML = `${key==='combined'?tier.essentials+tier.operations:tier[key]} <small>ج.م</small>`;
  }
  try {
    latest = calculate(input);
  } catch(error) {
    latest=null;
    $('quote-results').hidden=true;
    $('error').hidden=false;
    $('error').textContent=error.message;
    return;
  }
  $('error').hidden=true;
  $('quote-results').hidden=false;
  const q=latest, first=q.schedule[0];
  document.querySelectorAll('[data-tier]').forEach(node=>node.classList.toggle('active',Number(node.dataset.tier)===tier.from));
  document.querySelectorAll('[data-discount]').forEach(node=>node.classList.toggle('active',Number(node.dataset.discount)===q.discount));
  $('sidebar-tier').textContent='شريحتك الحالية: '+q.tier;
  $('sidebar-setup').innerHTML=q.implementation===null?'نطاق خاص':price(q.implementation);
  $('quote-context').textContent=q.planName+' · '+q.cycleLabel+' · '+q.billedEmployees+' موظف';
  $('net-employee').innerHTML=price(Math.round(q.coreMonthly/q.billedEmployees));
  $('annual-kpi').innerHTML=q.implementation===null?'غير مكتمل':price(q.taxRate===null?q.firstYearSubtotal:q.firstYearTotal);
  $('annual-kpi-note').textContent=q.taxRate===null?'قبل الضريبة':'بالضريبة المدخلة '+q.taxRate+'%';
  const taxed=q.taxRate!==null;
  const incomplete=q.implementation===null;
  $('quote-title').textContent=$('customer').value.trim() || 'ملخص عرض السعر';
  $('status-badge').textContent=q.approval.needsApproval||q.customRequired?'مسودة · تحتاج اعتماد':(q.extraAmount>0||q.extrasOnce>0)?'إضافة يدوية · راجع النطاق':'حساب وفق السياسة';
  $('first-due').textContent=incomplete?'غير مكتمل':money(taxed?first.total:first.subtotal);
  $('hero-caption').textContent=incomplete?'أدخل رسوم تهيئة النطاق الخاص لاستكمال الإجمالي':`الدفعة الأولى + رسوم التهيئة${q.extrasOnce?' + إضافة لمرة واحدة':''} · ${taxed?'شامل الضريبة المدخلة '+q.taxRate+'%':'قبل الضريبة'}`;
  $('recurring-label').textContent=`اشتراك ${q.cycleMonths===12?'السنة':q.cycleMonths===6?'6 أشهر':q.cycleMonths===3?'3 أشهر':'شهر'}${q.extrasAnnual?' والإضافات':''}`;
  $('recurring-due').textContent=money(first.core+first.extra);
  $('implementation-summary').innerHTML=q.implementation===null?'عرض نطاق خاص':price(q.implementation);
  $('employee-label').textContent=q.billedEmployees.toLocaleString('en-US')+' موظفًا محتسبًا';
  $('cycle-summary').textContent=q.cycleLabel;
  let breakdown='';
  breakdown+=row(`${q.billedEmployees.toLocaleString('en-US')} موظف × ${q.baseRate} ج.م / شهر`,money(q.baseMonthly),'subtle');
  breakdown+=row(`زيادة ${q.cycleLabel} (${q.upliftRate}%)`,q.upliftMonthly?'+'+money(q.upliftMonthly):'0');
  breakdown+=row(`خصم الباقة (${q.discount}%)`,`<span class="discount-value">${q.discountMonthly?'−':''}${money(q.discountMonthly)}</span>`);
  breakdown+=row('صافي الباقة / شهر',money(q.coreMonthly),'subtle');
  if(q.extrasAnnual) breakdown+=row('إضافات متكررة / سنة',money(q.extrasAnnual));
  breakdown+=row('الاشتراك والإضافات / 12 شهرًا',money(q.recurringAnnual));
  breakdown+=row('تهيئة لمرة واحدة',q.implementation===null?'غير محددة':money(q.implementation));
  if(q.hardwareTotal)breakdown+=row(`Locator: ${q.hardwareQty} × ${q.hardwareUnitPrice} ج.م`,money(q.hardwareTotal));
  if(q.extrasOnce-q.hardwareTotal) breakdown+=row('إضافات لمرة واحدة',money(q.extrasOnce-q.hardwareTotal));
  if(taxed) breakdown+=row(`الضريبة المدخلة (${q.taxRate}%) / السنة`,incomplete?'غير مكتملة':money(q.firstYearTax));
  $('breakdown').innerHTML=breakdown;
  $('year-total-label').textContent=taxed?'إجمالي أول سنة بالضريبة المدخلة':'إجمالي أول سنة قبل الضريبة';
  $('year-total').innerHTML=incomplete?'غير مكتمل':price(taxed?q.firstYearTotal:q.firstYearSubtotal);
  $('year-note').textContent=incomplete?`البنود المعروفة: ${money(q.knownFirstYearSubtotal)} ج.م قبل الضريبة، ولا تشمل رسوم التهيئة غير المحددة.`:q.cycle==='monthly'?'تقدير استمرار 12 شهرًا؛ لا يمثل التزامًا سنويًا. يتضمن التهيئة مرة واحدة.':'يتضمن رسوم التهيئة والإضافات المدخلة، وفق جدول أول 12 شهرًا.';
  $('insight-title').textContent=q.plan==='full'?'قيمة المنصة الكاملة':'مقارنة بالمنصة الكاملة';
  $('insight-body').textContent=q.plan==='full'?'توفيرك مقارنة بشراء Essentials وإضافة Operations بشكل منفصل.':'Full Platform أقل من جمع الباقة الأساسية وإضافة العمليات بالسعر الأساسي.';
  $('insight-value').innerHTML=price(q.fullSavingAnnual)+' <small>/ سنة</small>';
  $('insight-footnote').textContent='مقارنة بالسعر الأساسي لنفس العدد، قبل زيادة الدورية والخصم والضريبة.';
  $('tier-label').textContent=q.tier+' موظف';
  $('actual-label').textContent=q.employees.toLocaleString('en-US');
  $('payment-count').textContent=q.schedule.length+' '+(q.schedule.length===1?'دفعة':'دفعات');
  $('schedule-note').textContent=q.cycle==='monthly'?'تقدير 12 شهرًا · الحد الأدنى الموصى به: 3 أشهر':'الدفع مقدمًا في بداية كل فترة · تقدير أول سنة';
  $('total-column').textContent=taxed?'المستحق شامل الضريبة':'المستحق قبل الضريبة';
  $('schedule-body').innerHTML=q.schedule.map((r,i)=>`<tr><td>${i===0?'الأولى':'دفعة '+r.number}${i===0?'<small>عند البداية</small>':''}</td><td>${dateText(r.date)}</td><td>${money(r.core+r.extra)}</td><td>${r.implementation===null?'بانتظار التسعير':money(r.implementation+r.once)}</td><td>${r.tax===null?'غير محددة':r.implementation===null?'غير مكتملة':money(r.tax)}</td><td>${r.subtotal===null?'غير مكتمل':money(taxed?r.total:r.subtotal)}</td></tr>`).join('');
  const warnings=[...q.warnings];
  if(!q.approval.needsApproval) warnings.unshift('الخصم ضمن صلاحية المبيعات (0–5%)، مع الالتزام بالسياسة المعتمدة.');
  if(q.cycle==='quarterly') warnings.push('الربع سنوي بزيادة 3%، وفق توضيحك التجاري بتاريخ 25 أكتوبر 2026، كمعلومة مكمّلة لملف السياسة.');
  if(q.billedEmployees===500) warnings.push('عند 500 موظف استُخدمت شريحة 251–500 (15,000 ج.م). صياغة 500+ متداخلة في الملف؛ أكّد التطبيق تجاريًا.');
  $('warnings').innerHTML=warnings.map(w=>`<li>${escape(w)}</li>`).join('');
  $('compare-body').innerHTML=Object.keys(POLICY.cycles).map(cycle=>{
    const option=calculate({...input,cycle}), payment=option.schedule[0];
    return `<tr class="${cycle===q.cycle?'selected-cycle':''}"><td>${option.cycleLabel}${cycle===q.cycle?'<small>اختيارك الحالي</small>':''}</td><td>+${option.upliftRate}%</td><td>${payment.subtotal===null?'غير مكتمل':money(taxed?payment.total:payment.subtotal)}</td><td>${money(option.recurringAnnual)}</td></tr>`;
  }).join('');
  $('compare-note').textContent=`أول دفعة ${taxed?'بالضريبة المدخلة':'قبل الضريبة'} وتشمل بنود البداية؛ المتكرر السنوي قبل الضريبة والتهيئة. الشهري تقدير 12 شهرًا.`;
}
function summary() {
  const q=latest,first=q.schedule[0];
  const val=n=>money(n)+' ج.م';
  const lines=['GeoInTime — ملخص عرض السعر', $('customer').value.trim() ? 'الشركة: '+$('customer').value.trim():'', 'الحالة: '+$('status-badge').textContent, 'الباقة: '+q.planName, `الموظفون: ${q.employees} فعلي / ${q.billedEmployees} محتسب`, 'دورية الدفع: '+q.cycleLabel, 'البداية: '+dateText(first.date), `السعر الأساسي: ${q.baseRate} ج.م / موظف / شهر`, `زيادة الدورية: ${q.upliftRate}% | خصم الباقة: ${q.discount}%`, 'صافي الباقة الشهري: '+val(q.coreMonthly), 'الإضافات المتكررة / سنة: '+val(q.extrasAnnual), 'الإضافات والأجهزة لمرة واحدة: '+val(q.extrasOnce), q.hardwareQty?`أجهزة Locator: ${q.hardwareQty} × ${q.hardwareUnitPrice} ج.م = ${val(q.hardwareTotal)}`:'', q.extraAmount>0?'وصف الإضافة: '+($('extraName').value.trim()||'إضافة يدوية غير موصوفة'):'', 'التهيئة: '+val(q.implementation), 'الضريبة: '+(q.taxRate===null?'غير محددة؛ الأرقام قبل الضريبة':q.taxRate+'% مدخلة يدويًا'), 'المستحق عند البداية: '+(first.subtotal===null?'غير مكتمل':val(q.taxRate===null?first.subtotal:first.total)), 'إجمالي أول سنة: '+val(q.taxRate===null?q.firstYearSubtotal:q.firstYearTotal), '', 'جدول الدفعات:', ...q.schedule.map(r=>`${r.number}. ${dateText(r.date)} — ${r.subtotal===null?'غير مكتمل':val(q.taxRate===null?r.subtotal:r.total)}`), '', ...Array.from($('warnings').children,x=>'• '+x.textContent), '• الأجهزة والتركيب والتكاملات والعمل المخصص تُسعّر منفصلًا، ما لم يُتفق خلاف ذلك.', 'المصدر: سياسة GeoInTime للتسعير والخصومات والشروط التجارية 2026، ص2–3.'];
  return lines.filter(x=>x!==null).join('\n');
}
$('startDate').value=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
$('calculator-form').addEventListener('submit',e=>e.preventDefault());
$('calculator-form').addEventListener('input',render);
$('calculator-form').addEventListener('change',render);
for(const [id,delta] of [['plus',1],['minus',-1]]) $(id).addEventListener('click',()=>{$('employees').value=Math.max(1,Math.min(1000000,(Number($('employees').value)||1)+delta));render();});
document.querySelectorAll('[data-discount]').forEach(button=>button.addEventListener('click',()=>{$('discount').value=button.dataset.discount;render();}));
$('presentation').addEventListener('click',()=>{const active=document.body.classList.toggle('presentation-mode');$('presentation').setAttribute('aria-pressed',String(active));$('presentation').textContent=active?'↙ الرجوع لتعديل العرض':'وضع عرض العميل ↗';});
$('reset').addEventListener('click',()=>{HTMLFormElement.prototype.reset.call($('calculator-form'));$('startDate').value=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());document.querySelector('.settings').open=false;$('copy-status').textContent='';render();window.dispatchEvent(new Event('quote-reset'));});
$('copy').addEventListener('click',async()=>{if(!latest||!(await beforeExport()))return;const text=summary();try{await navigator.clipboard.writeText(text);$('copy-status').textContent='تم نسخ الملخص ✓';}catch{$('copy-text').value=text;$('copy-fallback').showModal();$('copy-text').select();}});
$('close-dialog').addEventListener('click',()=>$('copy-fallback').close());
$('print').addEventListener('click',async()=>{if(latest&&await beforeExport())window.print();});
window.addEventListener('beforeprint',()=>{document.querySelector('.policy-notes').open=true;});
render();

export function loadQuote(d){
 HTMLFormElement.prototype.reset.call($('calculator-form'));
 for(const [key,value] of Object.entries(d.input)){const el=document.getElementById(key);if(el){if(el.type==='checkbox')el.checked=value;else el.value=value??'';}}
 for(const [name,value] of [['plan',d.input.plan],['billing',d.input.cycle]]){const radio=document.querySelector(`input[name="${name}"][value="${value}"]`);if(radio)radio.checked=true;}
 $('customer').value=d.customer;document.body.classList.remove('presentation-mode');$('presentation').textContent='وضع عرض العميل ↗';render();
}
