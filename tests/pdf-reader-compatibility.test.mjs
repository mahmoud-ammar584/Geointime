import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import PDFLib from '../lib/vendor/pdf-lib.mjs';import fontkit from '../lib/vendor/fontkit.mjs';import fonts from '../lib/proposal-assets/workforce-fonts.mjs';
import {calculate} from '../lib/calculator.mjs';import {generateExactWorkforceQuotation} from '../lib/quotation-v2.mjs';
for(const plan of ['essentials','combined','full'])test(`Generated ${plan} PDF renumbers original nonzero generation references for reader compatibility`,async t=>{
 if(!process.env.QUOTATION_TEMPLATE_DIR)return t.skip('Original template artifact required');
 const title=plan==='essentials'?'Essentials':'Operations',templateBytes=await readFile(process.env.QUOTATION_TEMPLATE_DIR+'/GeoInTime_Quotation_Workforce_'+title+'_Bank_Transfer.pdf');
 const source=await PDFLib.PDFDocument.load(templateBytes);
 assert.equal(source.context.trailerInfo.Root.generationNumber,1,'Fixture must reproduce the original nonzero-generation catalog');
 const quote=calculate({employees:96,plan,cycle:'annual',annualPricing:'ten-month',hardwareQty:4,taxMode:'egypt',startDate:'2026-11-03'});
 const bytes=await generateExactWorkforceQuotation(PDFLib,{templateBytes,quote,customer:'ELTAYEBI Developement',number:'ELTAYEBI-Developement',issuedDate:'2026-11-03',expiresAt:'2026-11-30',fontkit,fontBytes:Buffer.from(fonts.font,'base64'),boldBytes:Buffer.from(fonts.bold,'base64'),semiBytes:Buffer.from(fonts.semi,'base64')});
 const doc=await PDFLib.PDFDocument.load(bytes);assert.equal(doc.getPageCount(),5);assert.equal(doc.context.trailerInfo.Root.generationNumber,0);
 for(const [ref] of doc.context.enumerateIndirectObjects())assert.equal(ref.generationNumber,0,ref.toString());
 assert.match(Buffer.from(bytes).toString('latin1'),/xref[\r\n]/);
});