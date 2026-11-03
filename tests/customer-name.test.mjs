import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { renderArabicName, hasArabic } from '../lib/server/customer-name.mjs';

test('plain Latin names retain embedded source-family typography rather than rasterizing', async () => {
  assert.equal(hasArabic('Acme Workforce'), false);
  assert.equal(await renderArabicName('Acme Workforce'), undefined);
});
test('Arabic and mixed names render as bounded white transparent server PNGs', async () => {
  for (const name of ['شركة النيل للمشروعات', 'شركة النيل GeoInTime', 'شركة <النيل> & Co']) {
    const bytes = await renderArabicName(name);
    assert.ok(bytes instanceof Uint8Array);
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.format, 'png');
    assert.ok(metadata.width <= 750 && metadata.height <= 72);
    assert.equal(metadata.hasAlpha, true);
    const {data,info} = await sharp(bytes).raw().toBuffer({resolveWithObject:true});
    assert.equal(info.channels,4);
    for(let i=0;i<data.length;i+=4) if(data[i+3]) assert.deepEqual([...data.slice(i,i+3)],[255,255,255]);
  }
});
test('unrepresentable Arabic names block issuance instead of clipping or tiny shrinking', async () => {
  await assert.rejects(renderArabicName('شركة '.repeat(40)), /150 حرف/);
  await assert.rejects(renderArabicName('شركة طويلة جدًا للمشروعات والتوريدات والنقل والتشغيل المتكامل والخدمات العالمية والأنظمة التشغيلية المتخصصة'), /أطول من المساحة/);
});
