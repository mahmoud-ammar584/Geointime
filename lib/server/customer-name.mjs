import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import arabicFont from '../proposal-assets/arabic-font.mjs';
import { ProposalDataError } from './proposal-context.mjs';

export const hasArabic = text => /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/u.test(String(text));
const escapeMarkup = text => text.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' })[c]);
const fontPath = join(tmpdir(), 'geointime-noto-sans-arabic-20261103.ttf');
let fontReady;
async function ensureFont() {
  if (!fontReady) fontReady = writeFile(fontPath, Buffer.from(arabicFont, 'base64'), { mode: 0o600 }).catch(error => { fontReady = undefined; throw error; });
  await fontReady;
  return fontPath;
}

export async function renderArabicName(text, { width = 250, fontSize = 11, minSize = 8 } = {}) {
  const name = String(text || '').replace(/[\r\n\t]+/g, ' ').trim();
  if (!hasArabic(name)) return undefined;
  if (!name || name.length > 150) throw new ProposalDataError('الاسم العربي لازم يكون من 1 إلى 150 حرف.');
  const fontfile = await ensureFont();
  // Pango performs both Arabic contextual shaping and Unicode bidi on the
  // server. Plain text is escaped so saved names cannot inject Pango markup.
  for (let size = fontSize; size >= minSize; size -= 0.5) {
    const { data, info } = await sharp({
      text: { text: `<span foreground="#ffffff">${escapeMarkup(name)}</span>`,
        font: `Noto Sans Arabic ${size}`, fontfile, rgba: true, dpi: 216 },
      limitInputPixels: 1_000_000,
    }).png().toBuffer({ resolveWithObject: true });
    if (info.width <= width * 3 && info.height <= 72) return new Uint8Array(data);
  }
  throw new ProposalDataError('الاسم أطول من المساحة الأصلية في القالب. استخدم الاسم التجاري المختصر عشان يفضل مقروء من غير قص أو تداخل.');
}
