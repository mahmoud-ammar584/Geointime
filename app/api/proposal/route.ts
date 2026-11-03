import { readProposal, writeProposal } from '../../../lib/server/storage.mjs';
import { ownerFromRequest } from '../../../lib/server/session.mjs';
import { getForOwner } from '../../../lib/server/database.mjs';
import PDFLib from '../../../lib/vendor/pdf-lib.mjs';
import fontkit from '../../../lib/vendor/fontkit.mjs';
import { generateExactWorkforceQuotation, GENERATOR_VERSION, validateWorkforceQuotation, QuotationValidationError } from '../../../lib/quotation-v2.mjs';
import workforceFonts from '../../../lib/proposal-assets/workforce-fonts.mjs';
import { renderArabicName } from '../../../lib/server/customer-name.mjs';
import { WORKFORCE_TEMPLATES, templateKindForPlan, verifyTemplateBytes, TemplateIntegrityError } from '../../../lib/server/quotation-templates.mjs';
import { proposalContext, proposalArchiveKey, ProposalDataError } from '../../../lib/server/proposal-context.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const decode = (value: string) => Uint8Array.from(Buffer.from(value, 'base64'));
const failure = (message: string, status: number, code?: string) => new Response(message, {
  status, headers: { 'Cache-Control': 'private, no-store', ...(code ? { 'X-GeoInTime-Error': code } : {}) },
});

export async function GET(request: Request) {
  const owner = ownerFromRequest(request);
  if (!owner) return failure('تسجيل الدخول مطلوب.', 401);
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id || !/^[a-zA-Z0-9_-]{1,80}$/.test(id)) return failure('معرّف العرض مطلوب.', 400);
  try {
    const row = await getForOwner(owner, id);
    if (!row || row.kind !== 'quote') return failure('العرض غير موجود.', 404);
    const kind = templateKindForPlan(row.data.quote?.plan);
    if(!kind)return failure('الباقة المحفوظة غير معروفة. راجع اختيار الباقة قبل إصدار العرض.',400);
    const context = proposalContext(row);
    const original = await readProposal(WORKFORCE_TEMPLATES[kind].key);
    const sourceHash = verifyTemplateBytes(kind, original);
    validateWorkforceQuotation(context.quote, { approvalRecorded: context.approvalRecorded });
    const format = GENERATOR_VERSION + '-' + sourceHash;
    const key = proposalArchiveKey(owner, row, context, format);
    let bytes = await readProposal(key);
    const source = bytes ? 'archive' : 'generated';
    if (!bytes) {
      const fonts = workforceFonts;
      const options = {
        ...context, templateBytes: original!,
        timezone: context.workingHoursTimezone,
        fontBytes: decode(fonts.font), boldBytes: decode(fonts.bold), semiBytes: decode(fonts.semi), fontkit,
        // Every supported plan uses the approved five-page original automatically.
        customerImage: await renderArabicName(context.customer),
        preparedByImage: await renderArabicName(context.preparedBy, { width: 114, fontSize: 9 }),
      };
      bytes = await generateExactWorkforceQuotation(PDFLib, options);
      await writeProposal(key, bytes);
    }
    const filename = context.number.replace(/[^a-zA-Z0-9_-]/g, '_') || 'GeoInTime-Quotation';
    return new Response(bytes, { headers: {
      'X-GeoInTime-PDF-Source': source,
      'X-GeoInTime-PDF-Template': kind,
      ...(sourceHash ? { 'X-GeoInTime-Template-SHA256': sourceHash } : {}),
      'X-GeoInTime-PDF-Version': GENERATOR_VERSION,
      'Content-Type': 'application/pdf',
      'Content-Disposition': (url.searchParams.get('preview') === '1' ? 'inline' : 'attachment') + '; filename="' + filename + '.pdf"',
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    } });
  } catch (error) {
    if (error instanceof QuotationValidationError) {
      const messages: Record<string, string> = {
        'fees.unsupported': 'الإضافات المتكررة أو الرسوم الأخرى لمرة واحدة مش لها مساحة واضحة في القالب الرسمي. اتمنع إصدار PDF عشان مفيش رسوم تتخبّى في الإجمالي. راجع نطاق الرسوم قبل الإصدار.',
        'tax.unknown': 'الضريبة غير محددة. اختار وضع ضريبة واضح قبل إصدار ملف العميل.',
        'approval.required': 'العرض محتاج اعتماد تجاري موثّق. افتح تفاصيل الديل وسجّل اعتماد الإدارة المختصة قبل إصدار الملف.',
        'implementation.missing': 'رسوم التهيئة ناقصة. استكمل رسوم النطاق المعتمدة قبل إصدار ملف العميل.',
        'layout.overflow': 'أحد الحقول أطول من مساحته الأصلية في القالب. اختصر اسم الشركة أو المرجع أو مُعدّ العرض؛ لن يتم قص النص أو تصغيره بشكل غير مقروء.',
      };
      return failure(messages[error.code] || error.message, error.status, error.code);
    }
    if (error instanceof TemplateIntegrityError || error instanceof ProposalDataError) {
      return failure(error.message, error.status, error.code);
    }
    console.error('Quotation generation failed', { name: error instanceof Error ? error.name : 'UnknownError' });
    return failure('تعذر إنشاء عرض السعر؛ راجع اتصال قاعدة البيانات والتخزين الخاص، وحاول تاني.', 503);
  }
}
