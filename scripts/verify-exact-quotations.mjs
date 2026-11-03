import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import PDFLib from '../lib/vendor/pdf-lib.mjs';
import fontkit from '../lib/vendor/fontkit.mjs';
import fonts from '../lib/proposal-assets/workforce-fonts.mjs';
import { calculate } from '../lib/calculator.mjs';
import { generateExactWorkforceQuotation, WORKFORCE_FIELD_MASKS, WORKFORCE_OVERLAY_FIELDS } from '../lib/quotation-v2.mjs';
import { renderArabicName } from '../lib/server/customer-name.mjs';
import { verifyTemplateBytes } from '../lib/server/quotation-templates.mjs';

const dir = process.env.QUOTATION_TEMPLATE_DIR;
const output = process.env.QUOTATION_EVIDENCE_DIR;
if (!dir || !output) throw Error('Set QUOTATION_TEMPLATE_DIR and QUOTATION_EVIDENCE_DIR. No customer data is used.');
await fs.mkdir(output, {recursive:true});
const base = { annualPricing:'ten-month',employees:60, plan:'essentials', cycle:'annual', discount:0, taxMode:'egypt', startDate:'2026-11-03' };
const cases = [
  {name:'A-Essentials-Annual',customer:'QA Essentials 60',input:{...base}},
  {name:'B-Operations-Quarterly',customer:'QA Operations 90',input:{...base,plan:'combined',employees:90,cycle:'quarterly',hardwareQty:2,hardwareUnitPrice:2700}},
  {name:'C-Arabic-Monthly',customer:'شركة النيل GeoInTime',input:{...base,cycle:'monthly',discount:10},approvalRecorded:true},
  {name:'D-Operations-Unsupported-Fee',customer:'QA Optional Fee',input:{...base,plan:'combined',employees:90,cycle:'semiannual',extraAmount:100},blocked:'fees.unsupported'},
];
const results=[];
for (const item of cases) {
  const kind=item.input.plan==='essentials'?'essentials':'operations';
  const title=kind==='essentials'?'Essentials':'Operations';
  const bytes=await fs.readFile(path.join(dir,`GeoInTime_Quotation_Workforce_${title}_Bank_Transfer.pdf`));
  const sourceHash=verifyTemplateBytes(kind,bytes);
  const quote=calculate(item.input);
  try {
    const pdf=await generateExactWorkforceQuotation(PDFLib,{
      templateBytes:bytes,quote,customer:item.customer,customerImage:await renderArabicName(item.customer),
      number:`GIT-20261103-${item.name[0]}TEST1`,issuedDate:'2026-11-03',expiresAt:'2026-11-12',
      fontBytes:Buffer.from(fonts.font,'base64'),semiBytes:Buffer.from(fonts.semi,'base64'),boldBytes:Buffer.from(fonts.bold,'base64'),
      fontkit,approvalRecorded:item.approvalRecorded===true,timezone:item.name[0]==='C'?'Asia/Riyadh':'Africa/Cairo',
    });
    assert.equal(item.blocked,undefined,'Unsupported fee unexpectedly issued.');
    assert.equal((await PDFLib.PDFDocument.load(pdf)).getPageCount(),5);
    await fs.writeFile(path.join(output,item.name+'.pdf'),pdf);
    results.push({case:item.name,kind,sourceHash,status:'generated',bytes:pdf.length,input:item.input,quote});
    console.log('PASS',item.name,'five original A4 pages');
  } catch(error) {
    if(!item.blocked || error.code!==item.blocked) throw error;
    results.push({case:item.name,kind,sourceHash,status:'blocked',code:error.code,input:item.input,quote});
    console.log('PASS',item.name,'blocked safely:',error.code);
  }
}
await fs.writeFile(path.join(output,'scenario-results.json'),JSON.stringify(results,null,2)+'\n');
await fs.writeFile(path.join(output,'field-geometry.json'),JSON.stringify({masks:WORKFORCE_FIELD_MASKS,overlays:WORKFORCE_OVERLAY_FIELDS},null,2)+'\n');
