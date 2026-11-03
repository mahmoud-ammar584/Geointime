import { ownerFromRequest } from '../../../lib/server/session.mjs';
import { sameOriginWrite } from '../../../lib/access.mjs';
import { readProposal, writeProposal } from '../../../lib/server/storage.mjs';
import { WORKFORCE_TEMPLATES, verifyTemplateBytes, verifyTemplateGeometry, TemplateIntegrityError } from '../../../lib/server/quotation-templates.mjs';
import PDFLib from '../../../lib/vendor/pdf-lib.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const res = (data: unknown, status = 200) => Response.json(data, {
  status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
});

export async function GET(request: Request) {
  if (!ownerFromRequest(request)) return res({ error: 'Authentication required' }, 401);
  try {
    const entries = await Promise.all(Object.entries(WORKFORCE_TEMPLATES).map(async ([kind, spec]) => {
      const bytes = await readProposal(spec.key);
      if (!bytes) return [kind, { installed: false, sha256: null, verified: false }];
      const sha256 = verifyTemplateBytes(kind, bytes);
      const pages = await verifyTemplateGeometry(PDFLib, bytes);
      return [kind, { installed: true, sha256, verified: true, pages, bytes: bytes.length }];
    }));
    const templates = Object.fromEntries(entries);
    return res({ essentials: templates.essentials.installed, operations: templates.operations.installed, templates });
  } catch (error) {
    if (error instanceof TemplateIntegrityError) return res({ error: error.message, code: error.code }, error.status);
    return res({ error: 'تعذر قراءة التخزين الخاص بالقوالب.' }, 503);
  }
}

export async function POST(request: Request) {
  if (!ownerFromRequest(request)) return res({ error: 'Authentication required' }, 401);
  if (!sameOriginWrite(request)) return res({ error: 'Cross-origin upload denied' }, 403);
  if (Number(request.headers.get('content-length') || 0) > 4_100_000) return res({ error: 'PDF file size must be 1KB to 4MB.' }, 413);
  try {
    const body = await request.formData();
    const kind = String(body.get('kind') || '');
    if (!Object.hasOwn(WORKFORCE_TEMPLATES, kind)) return res({ error: 'Invalid template type' }, 400);
    const item = body.get('file');
    if (!(item instanceof File)) return res({ error: 'Choose an original PDF template.' }, 400);
    if (item.size > 4_000_000 || item.size < 1000) return res({ error: 'PDF file size must be 1KB to 4MB.' }, 413);
    const bytes = new Uint8Array(await item.arrayBuffer());
    const sha256 = verifyTemplateBytes(kind, bytes);
    const pages = await verifyTemplateGeometry(PDFLib, bytes);
    const spec = WORKFORCE_TEMPLATES[kind as keyof typeof WORKFORCE_TEMPLATES];
    await writeProposal(spec.key, bytes);
    const stored = await readProposal(spec.key);
    verifyTemplateBytes(kind, stored);
    return res({ ok: true, kind, pages, bytes: bytes.length, sha256, verified: true });
  } catch (error) {
    if (error instanceof TemplateIntegrityError) return res({ error: error.message, code: error.code }, error.status);
    return res({ error: 'تعذر رفع القالب أو التحقق من قراءته من التخزين. حاول تاني.' }, 503);
  }
}
