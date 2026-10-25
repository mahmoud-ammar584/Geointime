import { writeFileSync } from 'node:fs';
import assets from '../lib/proposal-assets.mjs';
// Restore the supplied PDF byte-for-byte for the static download.
writeFileSync(new URL('../public/proposal-template.pdf', import.meta.url), Buffer.from(assets.template, 'base64'));
