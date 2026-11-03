import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import PDFLib from '../lib/vendor/pdf-lib.mjs';import fontkit from '../lib/vendor/fontkit.mjs';import fonts from '../lib/proposal-assets/workforce-fonts.mjs';
import {calculate} from '../lib/calculator.mjs';import {templateKindForPlan} from '../lib/server/quotation-templates.mjs';import {generateExactWorkforceQuotation} from '../lib/quotation-v2.mjs';
test('Full Platform and Operations automatically select Operations; Essentials selects Essentials',()=>{
 assert.equal(templateKindForPlan('full'),'operations');assert.equal(templateKindForPlan('combined'),'operations');assert.equal(templateKindForPlan('essentials'),'essentials');assert.equal(templateKindForPlan('invalid'),null);
});
test('The default Full Platform IMAGE HOME case uses five source pages, full pricing and no legacy generator',async t=>{
 if(!process.env.QUOTATION_TEMPLATE_DIR)return t.skip('Original template artifact required');
 const input={employees:60,plan:'full',cycle:'annual',annualPricing:'ten-month',discount:0,hardwareQty:2,taxMode:'egypt',startDate:'2026-11-03'};
 const quote=calculate(input);assert.equal(quote.baseRate,69);assert.equal(quote.schedule[0].total,6190200);
 const templateBytes=await readFile(process.env.QUOTATION_TEMPLATE_DIR+'/GeoInTime_Quotation_Workforce_Operations_Bank_Transfer.pdf');
 const bytes=await generateExactWorkforceQuotation(PDFLib,{templateBytes,quote,customer:'IMAGE HOME',number:'IMAGE_HOME',issuedDate:'2026-11-03',expiresAt:'2026-11-30',preparedBy:'Mahmoud Ammar',fontkit,fontBytes:Buffer.from(fonts.font,'base64'),boldBytes:Buffer.from(fonts.bold,'base64'),semiBytes:Buffer.from(fonts.semi,'base64')});
 const doc=await PDFLib.PDFDocument.load(bytes);assert.equal(doc.getPageCount(),5);assert.ok(Math.abs(doc.getPage(0).getWidth()-595.304)<.05);
});
test('PDF endpoint cannot invoke the legacy generator and quotation UI contains no upload controls',async()=>{
 const route=await readFile(new URL('../app/api/proposal/route.ts',import.meta.url),'utf8'),html=await readFile(new URL('../public/studio.html',import.meta.url),'utf8');
 assert.doesNotMatch(route,/import.*generateProposal/);assert.match(route,/await generateExactWorkforceQuotation/);
 assert.doesNotMatch(html,/type="file"|upload-essentials-template|upload-operations-template/);
 assert.doesNotMatch(html,/السنوي 12 شهر بدون زيادة/);assert.match(html,/لا تحتاج إلى رفع أي ملفات/);
});