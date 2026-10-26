import pg from 'pg';
import { attachDatabasePool } from '@vercel/functions';

let pool;
export class DatabaseError extends Error {
  constructor(message) { super(message); this.name = 'DatabaseError'; }
}
export function configured() { return Boolean(process.env.DATABASE_URL); }
export function getPool() {
  if (pool) return pool;
  if (!configured()) throw new Error('قاعدة البيانات غير مهيأة. أضف DATABASE_URL الخاص بـNeon.');
  const url = new URL(process.env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('رابط قاعدة البيانات غير صحيح.');
  pool = new pg.Pool({connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 5000, connectionTimeoutMillis: 15000});
  pool.on('error', error => console.error('Postgres pool error', {code: error.code}));
  attachDatabasePool(pool);
  return pool;
}
function normalize(row) {
  if (!row) return null;
  return {...row, created_at: new Date(row.created_at).toISOString(), updated_at: new Date(row.updated_at).toISOString()};
}
async function query(text, values) {
  try { return (await getPool().query(text, values)).rows.map(normalize); }
  catch (error) {
    console.error('Postgres request failed', {code: error.code});
    throw new DatabaseError('تعذر الاتصال بقاعدة البيانات أو حفظ السجل. راجع إعداد Neon والمخطط.');
  }
}
export const listForOwner = owner => query('SELECT id, kind, data, revision, created_at, updated_at FROM geointime.records WHERE owner=$1 ORDER BY created_at DESC LIMIT 5000', [owner]);
export const getForOwner = (owner, id) => query('SELECT id, kind, data, revision, created_at, updated_at FROM geointime.records WHERE owner=$1 AND id=$2 LIMIT 1', [owner, id]).then(rows => rows[0] || null);
export const insertForOwner = (owner, id, kind, data, now) => query('INSERT INTO geointime.records (owner,id,kind,data,revision,created_at,updated_at) VALUES ($1,$2,$3,$4::jsonb,1,$5,$5) ON CONFLICT (owner,id) DO NOTHING RETURNING id,kind,data,revision,created_at,updated_at', [owner, id, kind, JSON.stringify(data), now]);
export const updateForOwner = (owner, id, revision, data, now) => query('UPDATE geointime.records SET data=$4::jsonb, revision=revision+1, updated_at=$5 WHERE owner=$1 AND id=$2 AND revision=$3 RETURNING id,kind,data,revision,created_at,updated_at', [owner, id, revision, JSON.stringify(data), now]);
export async function closeDatabase() { if (pool) { const active=pool; pool=undefined; await active.end(); } }
