// Overlay only the variable fields on the *original* five-page Workforce PDF.
// No page, visual component, body copy, table, icon or branding is redrawn.
export async function generateExactWorkforceQuotation(PDFLib, {
  templateBytes, quote, customer = 'Customer', customerImage,
  number, issuedDate, expiresAt, fontBytes, boldBytes,
  semiBytes, fontkit, approvalRecorded = false
}) {
  if (!templateBytes) throw Error('Workforce PDF template has not been installed.');
  if (quote.implementation === null) throw Error('Implementation price is required.');
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const doc = await PDFDocument.load(templateBytes);
  if (doc.getPageCount() !== 5) throw Error('Unexpected original Workforce template page count.');
  if (fontkit) doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(fontBytes || StandardFonts.Helvetica, {subset: !!fontBytes});
  const semibold = semiBytes ? await doc.embedFont(semiBytes,{subset: true}) : regular;
  const bold = await doc.embedFont(boldBytes || StandardFonts.HelveticaBold,{subset: !!boldBytes});
  const white = rgb(1,1,1), navy = rgb(.105,.145,.265), gray = rgb(.34,.39,.46);
  const dark = rgb(.11,.15,.27);
  const months = Number(quote.cycleMonths || 1);
  const employees = Number(quote.billedEmployees || quote.employees || 1);
  const first = quote.schedule?.[0];
  if (!first || first.subtotal === null) throw Error('Incomplete quotation payment schedule.');
  const m = cents => (Number(cents||0)/100).toLocaleString('en-US',
    {minimumFractionDigits:2,maximumFractionDigits:2})+' EGP';
  const fixed = s => String(s ?? '').replace(/[\r\n\t]/g,' ').trim();
  // top coordinates use the same A4 coordinate system as the source PDF.
  const put = (index, value, x, top, maxWidth, options = {}) => {
    if (value === undefined || value === null || value === '') return;
    const page=doc.getPage(index), font=options.bold?bold:options.semi?semibold:regular,
      color=options.color||navy;
    const str=fixed(value), max=options.size||10;
    let size=max;
    while(size>6.3&&font.widthOfTextAtSize(str,size)>maxWidth) size-=.25;
    const width=font.widthOfTextAtSize(str,size);
    const realX=options.align==='right'?x+maxWidth-width:x;
    page.drawText(str,{x:realX,y:page.getHeight()-top-size,size,font,color});
  };
  const badge = (page,x,top,width,height,color) =>
    page.drawRectangle({x,y:page.getHeight()-top-height,width,height,color});
  // First page: every original vector graphic remains untouched.
  const cover=doc.getPage(0);
  if(customerImage){
    try{
      const image=await doc.embedPng(customerImage);
      const width=Math.min(250, image.width * .36),
        height=Math.min(24,image.height*width/image.width);
      cover.drawImage(image,{x:85,y:cover.getHeight()-710-height,width,height});
    } catch { put(0,customer,85,713,250,{color:white,bold:true,size:12}); }
  } else put(0,customer,85,713,250,{color:white,bold:true,size:12});
  put(0,number,45,790,122,{color:white,bold:true,size:9});
  put(0,issuedDate,175,790,124,{color:white,size:9});
  put(0,expiresAt,306,790,124,{color:white,size:9});
  put(0,'Mahmoud Ammar',436,790,114,{color:white,size:9});
  // Page 2: use exactly the existing "Users" placeholder.
  put(1,String(employees),483,79,66,{align:'right',bold:true,size:10,color:dark});
  // Page 3: only fill the fixed price placeholders.
  const billing={annual:'Yearly',semiannual:'6 months',
    quarterly:'Quarterly',monthly:'Monthly'}[quote.cycle]||'Custom';
  put(2,billing,473,76,77,{align:'right',size:9,color:gray});
  put(2,m(Math.round(quote.coreMonthly/employees)),69,179,188,
    {color:white,bold:true,size:19});
  put(2,m(Math.round(quote.beforeDiscountMonthly/employees)),443,165,99,
    {align:'right',size:8.7,color:dark});
  put(2,Number(quote.discount||0).toFixed(2)+'%',443,219,99,
    {align:'right',size:9,color:dark});
  put(2,m(Math.round(quote.coreMonthly/employees)),443,273,99,
    {align:'right',semi:true,size:8.7,color:dark});
  const priceBeforeDiscount=Number(quote.beforeDiscountMonthly)*months;
  const periodDiscount=Number(quote.discountMonthly)*months;
  const hardware=Number(quote.hardwareTotal||0);
  const totalBeforeVAT=Number(first.subtotal);
  const tax=quote.taxRate===null?null:Number(first.tax ?? 0);
  const payable=tax===null?totalBeforeVAT:Number(first.total);
  // Keep the original line item labels and rows. Record the full calculator
  // totals to avoid silently removing setup or optional services.
  const rows=[
    [391,priceBeforeDiscount],
    [426,hardware],
    [461,totalBeforeVAT+periodDiscount],
    [496,periodDiscount ? -periodDiscount : 0],
    [531,tax],
    [566,payable]
  ];
  rows.forEach(([y,val],i)=>{
    const valText=val===null?'See agreement':val<0?'-'+m(-val):m(val);
    put(2,valText,i===5?413:435,y+1,i===5?129:107,
      {align:'right',size:i===5?11:9.5,bold:i===5,color:i===5?white:dark});
  });
  // When the calculator includes setup or service extras, disclose those
  // components in the small unused space below the original table.
  const setup=Number(quote.implementation||0),
    recurring=Number(first.extra||0),
    once=Math.max(0,Number(quote.extrasOnce||0)-hardware);
  if(setup||recurring||once){
    const info=[];
    if(setup)info.push('Setup '+m(setup));
    if(recurring)info.push('Other recurring '+m(recurring));
    if(once)info.push('Other one-time '+m(once));
    put(2,info.join('  |  '),45,619,503,{size:7,color:gray});
  }
  if(quote.hardwareQty){
    put(2,String(quote.hardwareQty)+' device(s) x '+m(Math.round(Number(quote.hardwareUnitPrice||0)*100)),
      457,648,89,{align:'right',size:7.3,color:gray});
  }
  // Page 4 keeps the exact SLA table and its full original body.
  put(3,'Africa/Cairo',216,604,85,{size:9.5,color:dark});
  // Page 5: quotation number and term validity occupy the original blanks.
  put(4,number,451,77,99,{align:'right',size:8,color:dark});
  put(4,'7',89,140,27,{align:'right',bold:true,size:12,color:dark});
  put(4,expiresAt,298,143,225,{bold:true,size:11,color:dark});
  const draft=(quote.approval?.needsApproval||quote.customRequired)&&!approvalRecorded;
  if(draft){
    // Draft watermark is only applied when explicit commercial approval is missing.
    put(4,'DRAFT - COMMERCIAL APPROVAL REQUIRED',45,784,415,
      {size:8.5,bold:true,color:rgb(.78,.35,.12)});
  }
  doc.setTitle('GeoInTime - '+fixed(number));
  doc.setAuthor('GeoInTime');
  doc.setProducer('GeoInTime Commercial Studio');
  return doc.save();
}
