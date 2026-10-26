import { readFile } from 'node:fs/promises';
import { loadEnvFile } from 'node:process';
import pg from 'pg';
for (const file of ['.env','.env.local']) { try { loadEnvFile(file); } catch(error) { if(error.code!=='ENOENT') throw error; } }
const url=process.env.DATABASE_URL_UNPOOLED;
if (!url) throw new Error('DATABASE_URL_UNPOOLED is required for migrations. Run neon deploy or neon env pull first.');
if (new URL(url).hostname.includes('-pooler')) throw new Error('Use a direct/unpooled URL for migrations.');
const client=new pg.Client({connectionString:url,connectionTimeoutMillis:15000});
try {
  await client.connect();
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(hashtext('geointime-schema-migrations'))");
  const sql=await readFile(new URL('../db/migrations/001_records.sql',import.meta.url),'utf8');
  await client.query(sql);
  await client.query('COMMIT');
  const result=await client.query("SELECT to_regclass('geointime.records')::text AS table_name");
  console.log('Migration applied:',result.rows[0].table_name);
} catch(error) { await client.query('ROLLBACK').catch(()=>{}); console.error('Migration failed',{code:error.code}); process.exitCode=1; }
finally { await client.end(); }
