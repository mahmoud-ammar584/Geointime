import { createHash } from 'node:crypto';

export const WORKFORCE_TEMPLATES = Object.freeze({
  essentials: Object.freeze({
    key: 'quotation-templates/workforce-essentials-original.pdf',
    sha256: '54c8167727af57326eb952d15f5e00e603cd50279ac6a5fee36c77584a856988',
  }),
  operations: Object.freeze({
    key: 'quotation-templates/workforce-operations-original.pdf',
    sha256: 'b7b25a3ad4ab22511a48004d6ab286babc3b4ef08ee03290814e545aec6ea07a',
  }),
});

export function templateKindForPlan(plan) {
  return plan === 'essentials' ? 'essentials' : ['combined','full'].includes(plan) ? 'operations' : null;
}

export class TemplateIntegrityError extends Error {
  constructor(message, code = 'TEMPLATE_INTEGRITY') {
    super(message);
    this.name = 'TemplateIntegrityError';
    this.code = code;
    this.status = 409;
  }
}

export function verifyTemplateBytes(kind, bytes) {
  const spec = WORKFORCE_TEMPLATES[kind];
  if (!spec) throw new TemplateIntegrityError('نوع القالب غير صحيح.', 'TEMPLATE_KIND');
  if (!bytes) throw new TemplateIntegrityError('تعذر تحميل القالب الرسمي المحفوظ. حاول مرة أخرى؛ لا تحتاج إلى رفع أي ملفات.', 'TEMPLATE_MISSING');
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== spec.sha256) {
    throw new TemplateIntegrityError('بصمة ملف القالب لا تطابق النسخة الرسمية المعتمدة للباقة. ارفع ملف PDF الأصلي؛ لن يتم استخدام التصميم القديم بدلًا منه.');
  }
  return actual;
}

export async function verifyTemplateGeometry(PDFLib, bytes) {
  const doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: false });
  if (doc.getPageCount() !== 5 || doc.getPages().some(page =>
    Math.abs(page.getWidth() - 595.304) > 0.05 ||
    Math.abs(page.getHeight() - 841.89) > 0.05 || page.getRotation().angle !== 0
  )) throw new TemplateIntegrityError('القالب الرسمي لازم يكون خمس صفحات A4 بنفس الأبعاد والاتجاه الأصليين.');
  return doc.getPageCount();
}
