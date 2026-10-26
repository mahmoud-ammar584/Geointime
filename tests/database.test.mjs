import test from 'node:test';
import assert from 'node:assert/strict';
import {getPool,configured,listForOwner,updateForOwner,closeDatabase} from '../lib/server/database.mjs';
test('missing database configuration fails closed',()=>{
 const original=process.env.DATABASE_URL;delete process.env.DATABASE_URL;
 try{assert.equal(configured(),false);assert.throws(()=>getPool(),/DATABASE_URL/);}finally{if(original!==undefined)process.env.DATABASE_URL=original;}
});
test('owner identifiers remain bound parameters and timestamps retain ISO format',async()=>{
 process.env.DATABASE_URL='postgresql://test:unused@localhost/test';
 const pool=getPool(),original=pool.query;let captured;
 pool.query=async(text,values)=>{captured={text,values};return {rows:[{id:'one',created_at:new Date('2026-10-26T00:00:00Z'),updated_at:new Date('2026-10-26T00:00:00Z')}]};};
 try{const owner="owner' OR TRUE --",rows=await listForOwner(owner);assert.equal(captured.text.includes(owner),false);assert.deepEqual(captured.values,[owner]);assert.equal(rows[0].created_at,'2026-10-26T00:00:00.000Z');}finally{pool.query=original;await closeDatabase();}
});
test('stale revisions return no rows rather than overwrite a newer version',async()=>{
 const pool=getPool(),original=pool.query;let captured;
 pool.query=async(text,values)=>{captured={text,values};return {rows:[]};};
 try{assert.deepEqual(await updateForOwner('owner','quote',4,{customer:'Test'},'2026-10-26T00:00:00Z'),[]);assert.match(captured.text,/WHERE owner=\$1 AND id=\$2 AND revision=\$3/);assert.deepEqual(captured.values.slice(0,3),['owner','quote',4]);}finally{pool.query=original;await closeDatabase();}
});
