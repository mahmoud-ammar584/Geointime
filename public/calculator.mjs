// GeoInTime 2026 commercial policy. All monetary outputs are integer piastres.
export const POLICY = Object.freeze({
  source: 'GeoInTime_Pricing_Discount_Commercial_Policy_2026(1).pdf',
  tiers: [
    { from: 30, to: 49, essentials: 60, operations: 20, full: 75 },
    { from: 50, to: 99, essentials: 55, operations: 18, full: 69 },
    { from: 100, to: Infinity, essentials: 50, operations: 15, full: 62 },
  ],
  plans: { essentials: 'Essentials', combined: 'Essentials + Operations', full: 'Full Platform' },
  // Quarterly +3% confirmed by the user on 2026-10-25, supplementing the PDF.
  cycles: { annual: { months: 12, uplift: 0, label: 'سنوي مقدمًا' }, semiannual: { months: 6, uplift: 3, label: 'نصف سنوي' }, quarterly: { months: 3, uplift: 3, label: 'ربع سنوي' }, monthly: { months: 1, uplift: 8, label: 'شهري' } },
});
const round = n => Math.round(n);
const money = n => round(n * 100);
function number(value, name, { min = 0, max = 1000000000, integer = false, optional = false } = {}) {
  if ((value === '' || value === undefined || value === null) && optional) return 0;
  if (value === '' || value === undefined || value === null) throw new Error(`أدخل ${name}.`);
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) throw new Error(`قيمة ${name} غير صحيحة${integer ? '؛ استخدم عددًا صحيحًا' : ''}.`);
  return n;
}
export function approvalFor(discount) {
  if (discount <= 5) return { level: 'sales', text: 'ضمن صلاحية المبيعات (0–5%)', needsApproval: false };
  if (discount <= 10) return { level: 'manager', text: 'يتطلب مدير المبيعات / المفوّض من CEO', needsApproval: true };
  if (discount <= 15) return { level: 'finance', text: 'يتطلب اعتماد CEO + Finance', needsApproval: true };
  return { level: 'exception', text: 'استثناء صريح من CEO + مبرر تجاري موثّق', needsApproval: true };
}
export function implementationFor(employees) {
  if (employees <= 50) return 500000;
  if (employees <= 100) return 750000;
  if (employees <= 250) return 1000000;
  if (employees <= 500) return 1500000;
  return null;
}
export function addMonths(date, months) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  if (!match) throw new Error('أدخل تاريخ بداية صحيح.');
  const year = +match[1], month = +match[2] - 1, day = +match[3];
  const original = new Date(Date.UTC(year, month, day));
  if (year < 2000 || year > 2100 || original.getUTCFullYear() !== year || original.getUTCMonth() !== month || original.getUTCDate() !== day) throw new Error('أدخل تاريخ بداية صحيح بين 2000 و2100.');
  const target = new Date(Date.UTC(year, month + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}
export function calculate(input) {
  const employees = number(input.employees, 'عدد الموظفين', { min: 1, max: 1000000, integer: true });
  if (!Object.hasOwn(POLICY.plans, input.plan)) throw new Error('اختر باقة صحيحة.');
  if (!Object.hasOwn(POLICY.cycles, input.cycle)) throw new Error('اختر دورية دفع صحيحة.');
  const discount = number(input.discount ?? 0, 'الخصم', { max: 100 });
  if (!['unknown', 'specified'].includes(input.taxMode ?? 'unknown')) throw new Error('اختر حالة الضريبة.');
  const taxRate = input.taxMode === 'specified' ? number(input.taxRate, 'نسبة الضريبة', { max: 100 }) : null;
  const extraAmount = number(input.extraAmount, 'قيمة الإضافة', { optional: true });
  const otherOnce = money(number(input.otherOnce, 'الرسوم الأخرى لمرة واحدة', { optional: true }));
  const hardwareQty=number(input.hardwareQty??0,'عدد أجهزة Locator',{integer:true,max:1000000});
  const hardwareUnitPrice=number(input.hardwareUnitPrice??2700,'سعر جهاز Locator',{min:hardwareQty>0?.01:0});
  const hardwareTotal=money(hardwareUnitPrice)*hardwareQty;
  const extraBasis = input.extraBasis ?? 'fixed';
  const extraCadence = input.extraCadence ?? 'monthly';
  if (!['fixed', 'employee'].includes(extraBasis) || !['monthly', 'annual', 'once'].includes(extraCadence)) throw new Error('حدد طريقة احتساب الإضافة.');
  const startDate = input.startDate;
  addMonths(startDate, 0);
  const billedEmployees = Math.max(30, employees);
  const tier = POLICY.tiers.find(t => billedEmployees >= t.from && billedEmployees <= t.to);
  const baseRate = input.plan === 'combined' ? tier.essentials + tier.operations : tier[input.plan === 'full' ? 'full' : 'essentials'];
  const cycle = POLICY.cycles[input.cycle];
  const baseMonthly = money(baseRate * billedEmployees);
  const upliftMonthly = round(baseMonthly * cycle.uplift / 100);
  const beforeDiscountMonthly = baseMonthly + upliftMonthly;
  const discountMonthly = round(beforeDiscountMonthly * discount / 100);
  const coreMonthly = beforeDiscountMonthly - discountMonthly;
  const extraUnit = money(extraAmount) * (extraBasis === 'employee' ? billedEmployees : 1);
  const extrasAnnual = extraCadence === 'once' ? 0 : extraUnit * (extraCadence === 'monthly' ? 12 : 1);
  const extrasOnce = (extraCadence === 'once' ? extraUnit : 0) + otherOnce + hardwareTotal;
  if (![extraUnit, extrasAnnual, extrasOnce, coreMonthly * 12 + extrasAnnual + extrasOnce].every(Number.isSafeInteger)) throw new Error('القيم تتجاوز الحد الآمن للحساب؛ راجع قيمة الإضافة وعدد الموظفين.');
  const customRequired = employees < 30 || billedEmployees >= 500 || input.complex === true;
  let implementation = implementationFor(billedEmployees);
  if (customRequired) implementation = input.customImplementation === '' || input.customImplementation === undefined || input.customImplementation === null ? null : money(number(input.customImplementation, 'رسوم التهيئة الخاصة', { min: .01 }));
  const invoices = 12 / cycle.months;
  const schedule = [];
  for (let i = 0; i < invoices; i++) {
    const core = coreMonthly * cycle.months;
    const extra = round(extrasAnnual * (i + 1) / invoices) - round(extrasAnnual * i / invoices);
    const once = i === 0 ? extrasOnce : 0;
    const setup = i === 0 ? implementation : 0;
    const knownSubtotal = core + extra + once + (setup ?? 0);
    const tax = taxRate === null ? null : round(knownSubtotal * taxRate / 100);
    schedule.push({ number: i + 1, date: addMonths(startDate, i * cycle.months), core, extra, once, implementation: setup, knownSubtotal, subtotal: i === 0 && implementation === null ? null : knownSubtotal, tax, total: (i === 0 && implementation === null) || tax === null ? null : knownSubtotal + tax });
  }
  const sum = key => schedule.reduce((acc, row) => acc + (row[key] ?? 0), 0);
  if (![sum('knownSubtotal'), sum('total')].every(Number.isSafeInteger)) throw new Error('الإجمالي يتجاوز الحد الآمن للحساب؛ راجع المدخلات.');
  const approval = approvalFor(discount);
  const warnings = [];
  if (employees < 30) warnings.push('عددك أقل من الحد التجاري: الاحتساب على 30 موظفًا. أي استثناء يحتاج موافقة.');
  if (input.cycle === 'monthly') warnings.push('السياسة توصي بالتزام 3 أشهر على الأقل للشهري. جدول 12 شهرًا للتقدير فقط، وليس التزامًا سنويًا.');
  if (approval.needsApproval) warnings.push(approval.text + '؛ العرض مسودة لحين الاعتماد.');
  if (customRequired) warnings.push('رسوم التهيئة تحتاج عرض نطاق خاص واعتمادًا؛ القيمة المدخلة يدويًا لا تعني أنها معتمدة.');
  if (extraAmount > 0 || otherOnce > 0) warnings.push('الإضافة مدخلة يدويًا؛ يجب توثيق نطاقها وسعرها. لا يُطبق عليها خصم الباقة أو زيادة دورية الدفع.');
  if(hardwareQty>0) warnings.push('سعر جهاز Locator مدخل يدويًا، يبدأ من 2,700 ج.م للوحدة كتقدير حسب توضيحك؛ الأجهزة بند مستقل غير مؤهل للعمولة.');
  if (taxRate === null) warnings.push('نسبة الضريبة غير محددة: جميع المجاميع قبل الضريبة، وليست المبلغ النهائي للفاتورة.');
  return { employees, billedEmployees, tier: `${tier.from}–${tier.to === Infinity ? 'أكثر' : tier.to}`, plan: input.plan, planName: POLICY.plans[input.plan], cycle: input.cycle, cycleLabel: cycle.label, cycleMonths: cycle.months, upliftRate: cycle.uplift, baseRate, baseMonthly, upliftMonthly, beforeDiscountMonthly, discount, discountMonthly, coreMonthly, extrasAnnual, extrasOnce, implementation, customRequired, taxRate, approval, schedule, warnings,
    recurringAnnual: coreMonthly * 12 + extrasAnnual,
    firstYearSubtotal: implementation === null ? null : sum('knownSubtotal'),
    knownFirstYearSubtotal: sum('knownSubtotal'),
    firstYearTax: taxRate === null || implementation === null ? null : sum('tax'),
    firstYearTotal: taxRate === null || implementation === null ? null : sum('total'),
    fullSavingAnnual: money((tier.essentials + tier.operations - tier.full) * billedEmployees * 12),
    extraAmount, extraBasis, extraCadence, hardwareQty, hardwareUnitPrice, hardwareTotal,
  };
}
