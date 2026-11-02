// GeoInTime Workforce quotation (2026). Seven-page, vector PDF design.
// All prices come from the saved calculator snapshot; the PDF never recalculates policy.
export async function generateWorkforceQuotation(PDFLib, options) {
  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  const { quote: q, customer = 'Customer', customerImage, number, issuedDate,
    expiresAt, fontBytes, boldBytes, semiBytes, fontkit, approvalRecorded = false } = options;
  if (q.implementation === null) throw new Error('Implementation price must be confirmed.');
  if (!['essentials', 'combined'].includes(q.plan)) {
    throw new Error('A matching Workforce quotation template is not available for this plan.');
  }
  if (!Array.isArray(q.schedule) || !q.schedule.length || q.schedule[0].subtotal === null) {
    throw new Error('Saved price schedule is incomplete.');
  }
  const operations = q.plan === 'combined';
  const plan = operations ? 'Workforce Operations' : 'Workforce Essentials';
  const headline = operations
    ? 'Everything you need to run your operations.'
    : 'Everything you need to run your workforce.';
  const W = 595.28, H = 841.89, M = 36, R = W - M;
  const C = {
    navy: rgb(0.105, 0.145, 0.265), navyDeep: rgb(0.075, 0.110, 0.215),
    green: rgb(0.08, 0.76, 0.59), greenDeep: rgb(0.045, 0.56, 0.43),
    mint: rgb(0.9, 0.975, 0.947), light: rgb(0.964, 0.971, 0.982),
    white: rgb(1, 1, 1), ink: rgb(0.115, 0.15, 0.24),
    gray: rgb(0.39, 0.43, 0.49), border: rgb(0.84, 0.865, 0.89),
    orange: rgb(0.965, 0.62, 0.14), purple: rgb(0.46, 0.39, 0.82),
    pink: rgb(0.88, 0.26, 0.44), steel: rgb(0.56, 0.61, 0.7)
  };
  const doc = await PDFDocument.create();
  doc.setTitle('GeoInTime - ' + plan + ' - ' + number);
  doc.setAuthor('GeoInTime');
  doc.setSubject('Workforce software quotation');
  doc.setCreator('GeoInTime Commercial Studio');
  if (fontkit) doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(fontBytes || StandardFonts.Helvetica, { subset: !!fontBytes });
  const bold = await doc.embedFont(boldBytes || StandardFonts.HelveticaBold, { subset: !!boldBytes });
  const semibold = semiBytes ? await doc.embedFont(semiBytes, { subset: true }) : bold;
  const textValue = v => String(v ?? '').replace(/[\r\n\t]+/g, ' ').trim();
  const money = n => (Number(n || 0) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  }) + ' EGP';
  const pct = n => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }) + '%';
  const cycling = { annual: 'Yearly', semiannual: 'Every 6 months',
    quarterly: 'Quarterly', monthly: 'Monthly' };
  const billing = cycling[q.cycle] || 'As agreed';
  const first = q.schedule[0];
  const bEmployees = Number(q.billedEmployees || q.employees || 1);
  const periods = Number(q.cycleMonths || 1);
  const before = Number(q.beforeDiscountMonthly || 0) * periods;
  const discount = Number(q.discountMonthly || 0) * periods;
  const firstTax = q.taxRate === null ? null : Number(first.tax || 0);
  const payable = q.taxRate === null ? Number(first.subtotal) : Number(first.total);
  const draft = (!!q.approval?.needsApproval || !!q.customRequired) && !approvalRecorded;
  const draw = p => doc.addPage([W, H]);
  const rect = (p, x, top, w, h, fill, stroke = null, sw = 0.65) =>
    p.drawRectangle({ x, y: H - top - h, width: w, height: h, color: fill,
      ...(stroke ? { borderColor: stroke, borderWidth: sw } : {}) });
  const rule = (p, x1, top1, x2, top2, color = C.border, thickness = 0.8) =>
    p.drawLine({ start: { x: x1, y: H - top1 }, end: { x: x2, y: H - top2 },
      color, thickness });
  const t = (p, value, x, top, size = 10, weight = regular,
    color = C.ink, maxWidth = null) => {
    const s = textValue(value);
    let fs = size;
    if (maxWidth) {
      while (fs > 6.5 && weight.widthOfTextAtSize(s, fs) > maxWidth) fs -= 0.3;
    }
    p.drawText(s, { x, y: H - top - fs, font: weight, size: fs, color });
  };
  const right = (p, value, x, top, size = 10, weight = regular,
    color = C.ink) => {
    const s = textValue(value);
    t(p, s, x - weight.widthOfTextAtSize(s, size), top, size, weight, color);
  };
  const wrap = (text, font, fontSize, maxWidth) => {
    const result = [];
    for (const paragraph of String(text).split('\n')) {
      let line = '';
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const next = line ? line + ' ' + word : word;
        if (line && font.widthOfTextAtSize(next, fontSize) > maxWidth) {
          result.push(line); line = word;
        } else line = next;
      }
      if (line) result.push(line);
    }
    return result;
  };
  const para = (p, value, x, top, maxWidth, size = 10, lineHeight = 15,
    weight = regular, color = C.gray, maxLines = 4) => {
    const lines = wrap(value, weight, size, maxWidth).slice(0, maxLines);
    lines.forEach((line, i) => t(p, line, x, top + lineHeight * i, size, weight, color));
  };
  const section = (p, index, eyebrow, title, aside = '', pageNo = 2) => {
    rect(p, 0, 0, W, H, C.white);
    t(p, index + '  /  ' + eyebrow.toUpperCase(), M, 24, 8, bold, C.gray);
    t(p, title, M, 49, 22, bold, C.navy);
    if (aside) right(p, aside, R, 57, 9, semibold, C.gray);
    rule(p, M, 89, R, 89, C.navy, 1.6);
    rule(p, M, H - 32, R, H - 32);
    t(p, 'GeoInTime - Software quotation', M, H - 24, 8, regular, C.gray);
    right(p, pageNo + '/7', R, H - 24, 8, regular, C.gray);
  };
  const feature = (p, x, top, w, h, title, description) => {
    rect(p, x, top, w, h, C.white, C.border);
    rect(p, x + 15, top + 14, 22, 22, C.mint, C.border);
    t(p, '+', x + 21, top + 14.5, 15, bold, C.greenDeep);
    t(p, title, x + 15, top + 45, 10.5, bold, C.ink, w - 30);
    para(p, description, x + 15, top + 67, w - 30, 9, 13.5, regular, C.gray, 4);
  };
  const labelBox = (p, x, top, w, h, title, val, emphasis = false) => {
    rect(p, x, top, w, h, emphasis ? C.mint : C.white,
      emphasis ? C.green : C.border, emphasis ? 1 : .65);
    para(p, title, x + 12, top + 9, w - 24, 9, 12, regular, C.gray, 2);
    t(p, val, x + 12, top + h - 28, 12, bold, C.navy, w - 24);
  };

  // 1 / 7: dark branded cover.
  {
    const p = draw();
    rect(p, 0, 0, W, H, C.navyDeep);
    for (let i = 0; i < 10; i++) {
      const radius = 24 + i * 16;
      p.drawCircle({ x: W - 135, y: H - 140, size: radius,
        borderColor: C.gray, borderWidth: .4, opacity: 0, borderOpacity: .14 });
      p.drawCircle({ x: 140, y: H - 310, size: radius,
        borderColor: C.gray, borderWidth: .4, opacity: 0, borderOpacity: .11 });
    }
    rule(p, 0, 715, W, 700, C.greenDeep, 1.1);
    rect(p, 44, 48, 9, 9, C.green);
    t(p, 'GeoInTime', 60, 42, 13, bold, C.white);
    t(p, 'Deskless workforce platform', 155, 46, 9, regular, C.steel);
    t(p, 'S O F T W A R E   Q U O T A T I O N', 44, 470, 10, bold, C.green);
    rect(p, 44, 501, 34, 34, C.green);
    t(p, operations ? 'O' : 'E', 55, 506, 20, bold, C.navyDeep);
    t(p, plan, 44, 558, 36, bold, C.white, 515);
    t(p, headline, 44, 616, 14, regular, C.white, 505);
    if (operations) {
      rect(p, 44, 650, 276, 27, C.navy, C.greenDeep, .8);
      t(p, 'Includes all of Workforce Essentials', 55, 655, 10, semibold, C.white);
    }
    t(p, 'PREPARED FOR', 44, 704, 8, bold, C.steel);
    if (customerImage) {
      try {
        const img = await doc.embedPng(customerImage);
        const w = Math.min(300, img.width * 0.5);
        const h = Math.min(34, img.height * w / img.width);
        p.drawImage(img, { x: 44, y: H - 723 - h, width: w, height: h });
      } catch {
        t(p, customer, 44, 719, 14, semibold, C.white, 400);
      }
    } else t(p, customer, 44, 719, 14, semibold, C.white, 400);
    rule(p, 44, 754, 551, 754, C.gray, 0.7);
    const meta = [['QUOTATION', number], ['DATE', issuedDate],
      ['VALID UNTIL', expiresAt], ['PREPARED BY', 'GeoInTime']];
    meta.forEach((r, i) => {
      const x = 44 + i * 128;
      t(p, r[0], x, 767, 7.4, bold, C.steel);
      t(p, r[1], x, 787, 8.3, semibold, C.white, 122);
    });
    rect(p, 0, H - 7, W / 3, 7, C.green);
    rect(p, W / 3, H - 7, W / 3, 7, C.orange);
    rect(p, W * 2 / 3, H - 7, W / 3, 7, C.purple);
  }

  // 2 / 7: feature descriptions appropriate to the sold plan.
  {
    const p = draw();
    section(p, '01', 'What you are buying', plan,
      bEmployees.toLocaleString('en-US') + ' Users', 2);
    t(p, headline, M, 112, 13, bold, C.greenDeep);
    if (!operations) {
      para(p, 'A complete HR foundation for employees with predictable schedules - attendance, records, approvals and payroll in one place.',
        M, 137, W - 2 * M, 11, 17, regular, C.gray, 3);
      t(p, 'Six capability areas, all included', M, 195, 11, bold, C.navy);
      const es = [
        ['Time & attendance', 'Clock-in and clock-out, breaks, buffers and the full attendance record'],
        ['Fixed work schedules', 'Fixed shifts assigned to teams, employees and sites'],
        ['Leave & approvals', 'Requests, day-off types and approval layers'],
        ['People & documents', 'Employee directory, profiles, documents and offboarding'],
        ['Payroll management', 'Salary configuration, allowances, deductions and payroll cycles'],
        ['Reports & integrations', 'Monthly and yearly reports and data export']
      ];
      es.forEach((v, i) => feature(p, M + (i % 2) * 265, 220 + Math.floor(i / 2) * 164,
        253, 150, v[0], v[1]));
    } else {
      para(p, 'Flexible labor scheduling and the tools to plan, execute and verify field work - on top of the full Essentials foundation.',
        M, 137, W - 2 * M, 10.8, 16, regular, C.gray, 3);
      t(p, 'INCLUDED IN FULL - THE FOUNDATION', M, 194, 8.5, bold, C.gray);
      t(p, 'Workforce Essentials', M, 213, 12, bold, C.navy);
      rect(p, M, 238, W - 2 * M, 81, C.light, C.border);
      const found = ['Time & attendance', 'Fixed work schedules', 'Leave & approvals',
        'People & documents', 'Payroll management', 'Reports & integrations'];
      found.forEach((name, i) => {
        const x = M + 14 + (i % 3) * 169;
        const y = 253 + Math.floor(i / 3) * 24;
        t(p, '+', x, y, 11, bold, C.greenDeep);
        t(p, name, x + 14, y, 9.1, semibold, C.gray, 152);
      });
      t(p, 'Every Essentials capability is included. Nothing is charged twice.',
        M + 10, 326, 9.1, regular, C.gray);
      t(p, 'AND THIS PLAN ADDS', M, 366, 9, bold, C.greenDeep);
      t(p, 'Workforce Operations', M, 382, 12, bold, C.navy);
      const extra = [
        ['Flexible workforce scheduling', 'Shifts that repeat once, weekly or monthly, drafted then published'],
        ['Task execution', 'Tasks and subtasks with priority, owner and deadline'],
        ['Proof of work', 'Evidence, location-confirmed check-points and required documents'],
        ['Work orders', 'Work grouped under one deadline and one owner']
      ];
      extra.forEach((v, i) => feature(p, M + (i % 2) * 265,
        411 + Math.floor(i / 2) * 154, 253, 140, v[0], v[1]));
    }
  }

  // 3 / 7: continuation / upgrade explanation, intentionally spacious like source.
  {
    const p = draw();
    section(p, '01', 'What you are buying', plan, '', 3);
    if (operations) {
      feature(p, M, 145, 253, 150, 'Operational control',
        'Operational map, live attendance and site risk across every site');
      feature(p, M + 265, 145, 253, 150, 'Client visibility',
        'Client section on tasks and confirmation by client PIN');
    } else {
      t(p, 'NOT IN THIS PLAN - WORKFORCE OPERATIONS ADDS', M, 148, 10, bold, C.navy);
      rect(p, M, 177, W - 2 * M, 115, C.light, C.border);
      const additional = ['Flexible workforce scheduling', 'Task execution',
        'Proof of work', 'Work orders', 'Operational control', 'Client visibility'];
      additional.forEach((name, i) => {
        const x = M + 14 + (i % 3) * 169;
        const y = 196 + Math.floor(i / 3) * 33;
        t(p, '+', x, y, 12, bold, C.greenDeep);
        t(p, name, x + 14, y + 1, 8.6, semibold, C.gray, 154);
      });
      para(p, 'Ask us about moving up to Workforce Operations. Any credit for unused service is subject to the agreed commercial terms.',
        M, 315, W - 2 * M, 10.5, 16, regular, C.gray, 3);
    }
  }

  // 4 / 7: calculator-authoritative price, itemization, VAT and amount due.
  {
    const p = draw();
    section(p, '02', 'Your price', 'Pricing', 'Billing: ' + billing, 4);
    rect(p, M, 119, 260, 248, C.navy);
    t(p, plan.toUpperCase(), M + 15, 142, 10, bold, C.green);
    t(p, money(Math.round(Number(q.coreMonthly) / bEmployees)), M + 15, 189,
      24, bold, C.white, 228);
    t(p, 'per user / month', M + 15, 231, 10, regular, C.white);
    rule(p, M + 15, 256, M + 242, 256, C.gray);
    para(p, 'Billed ' + billing.toLowerCase() + '. The approved calculator pricing policy applies.',
      M + 15, 271, 228, 9.7, 15, regular, C.white, 3);
    t(p, 'Cycle: ' + periods + ' month(s) / invoice', M + 15, 334,
      9.2, regular, C.steel, 230);
    labelBox(p, 307, 119, 252, 73, 'Regular, per user / month',
      money(Math.round(Number(q.beforeDiscountMonthly) / bEmployees)));
    labelBox(p, 307, 204, 252, 73, 'Negotiated subscription discount',
      pct(q.discount));
    labelBox(p, 307, 289, 252, 78, 'Your price, per user / month',
      money(Math.round(Number(q.coreMonthly) / bEmployees)), true);
    rect(p, M, 394, W - 2 * M, 34, C.light);
    t(p, 'LINE', M + 10, 404, 9, bold, C.navy);
    right(p, 'AMOUNT', R - 8, 404, 9, bold, C.navy);
    const rows = [
      [plan + ' x ' + bEmployees + ' users / ' + periods + ' month(s)', before]
    ];
    if (Number(first.extra || 0)) rows.push(['Additional recurring services', first.extra]);
    if (Number(q.hardwareTotal || 0)) rows.push(['GeoInTime Locator x ' + q.hardwareQty, q.hardwareTotal]);
    rows.push(['Implementation - one-time', q.implementation]);
    const other = Number(q.extrasOnce || 0) - Number(q.hardwareTotal || 0);
    if (other > 0) rows.push(['Other one-time fees', other]);
    let pos = 436;
    for (const [name, amount] of rows) {
      t(p, name, M + 9, pos + 4, 9.3, regular, C.ink, 343);
      right(p, money(amount), R - 8, pos + 4, 9.4, semibold, C.ink);
      rule(p, M, pos + 26, R, pos + 26);
      pos += 29;
    }
    const totals = [
      ['Gross amount before discount', Number(first.subtotal) + discount],
      ['Subscription discount', -discount],
      ['Subtotal', Number(first.subtotal)],
      ['VAT ' + (firstTax === null ? '(not specified)' : '(' + pct(q.taxRate) + ')'), firstTax]
    ];
    pos += 9;
    for (const [label, val] of totals) {
      t(p, label, M + 10, pos, 9, regular, C.gray);
      right(p, val === null ? 'Not specified' : (val < 0 ? '-' + money(-val) : money(val)),
        R - 10, pos, 9.5, semibold, C.ink);
      pos += 26;
    }
    rect(p, M, pos + 4, W - 2 * M, 42, C.navy);
    t(p, firstTax === null ? 'TOTAL BEFORE VAT' : 'TOTAL TO PAY', M + 10,
      pos + 14, 11.5, bold, C.white);
    right(p, money(payable), R - 10, pos + 13, 13, bold, C.white);
    para(p, 'The amount shown is the first invoice, not necessarily the full-year total. '
      + 'The subscription period and renewal terms are governed by the agreement.',
      M, Math.min(pos + 60, 786), W - 2 * M, 8.2, 12, regular, C.gray, 3);
    if (draft) t(p, 'DRAFT - commercial approval must be recorded before sending',
      M, 772, 8.5, bold, C.orange, 520);
  }

  // 5 / 7: optional hardware page from both supplied variants.
  {
    const p = draw();
    rect(p, 0, 0, W, H, C.white);
    rect(p, M, 43, W - 2 * M, 158, C.white, C.border);
    rect(p, M, 43, 3, 158, C.purple);
    rect(p, M + 18, 63, 27, 30, C.light, C.border);
    t(p, 'L', M + 27, 69, 15, semibold, C.purple);
    t(p, 'GeoInTime Locator - optional', M + 60, 61, 12, bold, C.navy);
    para(p, 'A small device for sites with no fixed terminal. Charged once per device, with no monthly fee.',
      M + 60, 83, 423, 10, 15, regular, C.gray, 2);
    t(p, 'Wireless  /  Moveable  /  Bluetooth-based  /  Long-lasting battery  /  No wiring on site',
      M + 60, 138, 8.2, regular, C.gray, 423);
    if (Number(q.hardwareQty || 0)) {
      t(p, 'Included in this quote: ' + q.hardwareQty + ' device(s) x '
        + money(Math.round(Number(q.hardwareUnitPrice || 0) * 100)),
        M + 60, 171, 9, semibold, C.navy, 420);
    } else {
      t(p, 'Not included in this quotation.', M + 60, 171, 9, semibold, C.gray);
    }
    rule(p, M, H - 32, R, H - 32);
    t(p, 'GeoInTime - Software quotation', M, H - 24, 8, regular, C.gray);
    right(p, '5/7', R, H - 24, 8, regular, C.gray);
  }

  // 6 / 7: post-sale support, priority response, reachability.
  {
    const p = draw();
    section(p, '03', 'After you go live', 'Support', 'Sun - Thu / 8:00 - 16:00', 6);
    para(p, 'Every subscription includes support. Raise a ticket from Help in your GeoInTime portal, or by email. Each ticket receives a priority that sets the first-response target.',
      M, 113, W - 2 * M, 11, 17, regular, C.gray, 4);
    const top = 197, col = [M, 151, 301, 467, R], widths = [115, 150, 166, 92];
    rect(p, M, top, W - 2 * M, 44, C.navy);
    ['PRIORITY', 'WHAT IT MEANS', 'EXAMPLE', 'FIRST RESPONSE'].forEach((heading, i) =>
      t(p, heading, col[i] + 8, top + 15, i === 3 ? 7.4 : 8, bold, C.white, widths[i] - 12));
    const rs = [
      ['1 - Urgent', 'A core function is down for everyone and business stops.',
        'Nobody can clock in; payroll cannot run on its due date.', '1 business hour', C.pink],
      ['2 - High', 'A core feature is broken for a group with no workaround.',
        'Requests cannot be approved; overtime is wrong.', '4 business hours', C.orange],
      ['3 - Normal', 'One screen or user has a problem, but work continues.',
        'A report is wrong; a filter fails.', '1 business day', C.purple],
      ['4 - Low', 'A question or a cosmetic problem without work impact.',
        'How to set a buffer; documentation request.', '1 business day', C.steel]
    ];
    rs.forEach((r, i) => {
      const y = top + 44 + i * 82;
      rect(p, M, y, W - 2 * M, 82, i % 2 ? C.light : C.white, C.border, .4);
      rect(p, M + 11, y + 13, 98, 24, r[4]);
      t(p, r[0], M + 20, y + 18, 9, bold, C.white, 86);
      para(p, r[1], col[1] + 7, y + 15, widths[1] - 14, 9, 13, regular, C.gray, 4);
      para(p, r[2], col[2] + 7, y + 15, widths[2] - 14, 8.7, 13, regular, C.gray, 4);
      para(p, r[3], col[3] + 7, y + 15, widths[3] - 12, 8.5, 13,
        bold, C.navy, 3);
    });
    const y = 600;
    rect(p, M, y, 254, 178, C.white, C.border);
    rect(p, 305, y, 254, 178, C.white, C.border);
    t(p, 'Working hours', M + 15, y + 18, 11, bold, C.navy);
    t(p, 'Days', M + 15, y + 56, 9, regular, C.gray);
    right(p, 'Sunday to Thursday', M + 238, y + 56, 9, bold);
    t(p, 'Hours', M + 15, y + 85, 9, regular, C.gray);
    right(p, '8:00 - 16:00', M + 238, y + 85, 9, bold);
    para(p, 'Tickets raised outside working hours are picked up at the start of the next working day.',
      M + 15, y + 118, 220, 9, 14, regular, C.gray, 3);
    t(p, 'How to reach us', 321, y + 18, 11, bold, C.navy);
    para(p, 'From the portal: open Help, raise a ticket and follow its status.',
      321, y + 50, 215, 9, 14, regular, C.gray, 3);
    para(p, 'Email: support@geointime.com from your registered account.',
      321, y + 100, 215, 9, 14, regular, C.gray, 3);
  }

  // 7 / 7: bank transfer instructions & existing commercial caveats.
  {
    const p = draw();
    section(p, '04', 'Offer validity and payment', 'How to pay',
      'Reference: ' + number, 7);
    rect(p, M, 122, 106, 84, C.orange);
    t(p, 'VALID TO', M + 16, 142, 10, bold, C.navy);
    t(p, expiresAt, M + 8, 169, 11, bold, C.navy, 98);
    rect(p, M + 106, 122, W - 2 * M - 106, 84, rgb(.996, .965, .915), C.orange);
    t(p, 'This quotation expires on ' + expiresAt, M + 123, 142,
      12, bold, C.navy, 355);
    para(p, 'After that date prices may change and the quotation may need to be issued again.',
      M + 123, 164, 348, 9.5, 14, regular, C.gray, 2);
    t(p, 'Three steps to activate', M, 237, 12.5, bold, C.navy);
    const steps = [
      ['1', 'Transfer the amount', 'Pay the total on page 4 by bank transfer to the IBAN below.'],
      ['2', 'Add the reference', 'Write the quotation number as the transfer reference.'],
      ['3', 'Upload the receipt', 'Upload it in Billing > Quotations. Activation follows confirmation.']
    ];
    steps.forEach((s, i) => {
      const x = M + i * 178;
      p.drawCircle({ x: x + 16, y: H - 281, size: 16, color: C.navy });
      t(p, s[0], x + 12, 273, 10, bold, C.green);
      t(p, s[1], x, 310, 10.2, bold, C.navy, 170);
      para(p, s[2], x, 332, 160, 8.9, 13, regular, C.gray, 4);
      if (i < 2) rule(p, x + 37, 281, x + 164, 281, C.border, 1.6);
    });
    rect(p, M, 412, 254, 159, C.white, C.border);
    rect(p, 305, 412, 254, 159, C.white, C.border);
    t(p, 'Transfer to this IBAN', M + 15, 428, 11, bold, C.navy);
    t(p, 'EG100014006400001019797819901', M + 15, 467,
      10, semibold, C.ink, 225);
    para(p, 'Transfer the full amount in one payment. Use the quotation number as the transfer reference.',
      M + 15, 495, 222, 9, 14, regular, C.gray, 3);
    t(p, 'Sending us the receipt', 321, 428, 11, bold, C.navy);
    para(p, 'Sign in to your GeoInTime portal and open Billing > Quotations. Upload the transfer receipt against this quotation. Status becomes Paid after verification.',
      321, 455, 220, 9, 14, regular, C.gray, 5);
    t(p, 'billing@geointime.com  /  www.geointime.com', 321, 540,
      8.3, semibold, C.gray, 220);
    rect(p, M, 598, W - 2 * M, 191, C.navy);
    t(p, 'G O O D   T O   K N O W', M + 18, 614, 9, bold, C.green);
    t(p, 'Four things worth knowing before you sign', M + 18, 634,
      14, bold, C.white, 470);
    const notes = [
      ['Adding users mid-term', 'Users can be added, charged for the remaining agreed term.'],
      ['Monthly to yearly', 'Switching billing frequency follows the agreed commercial terms.'],
      ['Moving to a lower plan', 'Contact support so data and setup are not lost by mistake.'],
      ['VAT', 'VAT is added where applicable and as shown in the price section.']
    ];
    notes.forEach((n, i) => {
      const x = M + 20 + (i % 2) * 252, y = 677 + Math.floor(i / 2) * 56;
      rect(p, x, y, 22, 22, C.greenDeep);
      t(p, '+', x + 7, y + 3, 12, bold, C.white);
      t(p, n[0], x + 31, y, 10.1, bold, C.white, 205);
      para(p, n[1], x + 31, y + 19, 194, 8.1, 11.2, regular, C.white, 3);
    });
  }
  return doc.save();
}
