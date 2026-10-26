import {loadEnvFile} from 'node:process';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import assert from 'node:assert/strict';
import {S3Client,HeadBucketCommand,GetObjectCommand,DeleteObjectCommand} from '@aws-sdk/client-s3';
import pg from 'pg';
for(const file of ['.env','.env.local']){try{loadEnvFile(file);}catch(error){if(error.code!=='ENOENT')throw error;}}
const required=['DATABASE_URL','AWS_ENDPOINT_URL_S3','AWS_REGION','AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY'];
const missing=required.filter(key=>!process.env[key]);
if(missing.length)throw new Error('Missing configuration names: '+missing.join(', '));
const password=randomBytes(24).toString('base64url'),sessionSecret=randomBytes(48).toString('base64url');
const id='neon-verify-'+randomUUID(),pool=new pg.Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:8000});
const s3=new S3Client({forcePathStyle:true,endpoint:process.env.AWS_ENDPOINT_URL_S3,region:process.env.AWS_REGION,credentials:{accessKeyId:process.env.AWS_ACCESS_KEY_ID,secretAccessKey:process.env.AWS_SECRET_ACCESS_KEY},maxAttempts:1});
const port=await new Promise(resolve=>{const server=net.createServer();server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});});
const origin='http://127.0.0.1:'+port;
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p',String(port)],{env:{...process.env,APP_PASSWORD:password,SESSION_SECRET:sessionSecret},stdio:['ignore','pipe','pipe']});
let terminal='';child.stdout.on('data',chunk=>{terminal+=chunk;});child.stderr.on('data',chunk=>{terminal+=chunk;});
function request(path,{method='GET',body,cookie}={}){return new Promise((resolve,reject)=>{
 const req=http.request(origin+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},timeout:20000},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,bytes:Buffer.concat(chunks)}));});
 req.on('error',reject);req.on('timeout',()=>req.destroy(new Error('HTTP request timed out')));if(body)req.write(JSON.stringify(body));req.end();});}
let objectKey,created=false,failures=0;
try{
 for(let attempt=0;attempt<80;attempt++){try{if((await request('/login')).status===200)break;}catch{}if(child.exitCode!==null)throw Error('App exited before startup');await new Promise(resolve=>setTimeout(resolve,200));}
 console.log('PASS production app started');
 assert.equal((await request('/api/records')).status,401);console.log('PASS anonymous data access rejected (401)');
 const login=await request('/api/auth/login',{method:'POST',body:{password}});assert.equal(login.status,200);
 const cookie=login.headers['set-cookie'][0].split(';')[0];console.log('PASS owner login (200)');
 assert.equal((await request('/studio.html',{cookie})).status,200);console.log('PASS authenticated workspace (200)');
 try{await pool.query('SELECT 1');console.log('PASS Neon Postgres connection');}catch(error){failures++;console.log('FAIL Neon Postgres connection:',error.code||error.name);}
 try{await s3.send(new HeadBucketCommand({Bucket:'assets'}));console.log('PASS private Neon bucket reachable');}catch(error){failures++;console.log('FAIL Neon Object Storage connection:',error.code||error.name);}
 const listing=await request('/api/records',{cookie});console.log('Records API HTTP status:',listing.status);assert.equal(listing.status,200,'Cannot continue data flow while records API is unavailable');
 const data={customer:'Neon verification',input:{employees:60,plan:'full',cycle:'annual',discount:0,extraAmount:'',taxMode:'unknown',startDate:'2026-10-26'},status:'draft'};
 const save=await request('/api/records',{method:'POST',cookie,body:{id,kind:'quote',revision:0,data}});assert.equal(save.status,200);created=true;
 assert.equal((await request('/api/records',{method:'POST',cookie,body:{id,kind:'quote',revision:0,data}})).status,409);console.log('PASS create and stale-revision conflict');
 const records=JSON.parse((await request('/api/records',{cookie})).bytes).records,row=records.find(record=>record.id===id);assert.ok(row);
 const pdf=await request('/api/proposal?id='+id,{cookie});assert.equal(pdf.status,200);assert.equal(pdf.bytes.subarray(0,4).toString(),'%PDF');
 const dbRow=(await pool.query('SELECT * FROM geointime.records WHERE owner=$1 AND id=$2',['owner',id])).rows[0];
 const issued=dbRow.data.issuedDate||dbRow.created_at.toISOString().slice(0,10);
 objectKey='proposals/owner/'+id+'/'+createHash('sha256').update(JSON.stringify({revision:dbRow.revision,data:dbRow.data,issued,format:'geointime-pdf-v1'})).digest('hex')+'.pdf';
 const stored=await s3.send(new GetObjectCommand({Bucket:'assets',Key:objectKey}));assert.deepEqual(Buffer.from(await stored.Body.transformToByteArray()),pdf.bytes);console.log('PASS generated PDF persisted in private Neon Object Storage');
 const cached=await request('/api/proposal?id='+id,{cookie});assert.equal(cached.status,200);assert.equal(cached.headers['x-geointime-pdf-source'],'archive');assert.deepEqual(cached.bytes,pdf.bytes);console.log('PASS archived PDF download through authenticated API');
}catch(error){failures++;console.error('FAIL verification:',error.message);}
finally{
 if(objectKey)await s3.send(new DeleteObjectCommand({Bucket:'assets',Key:objectKey})).catch(()=>{failures++;console.error('FAIL cleanup: test PDF');});
 if(created)await pool.query('DELETE FROM geointime.records WHERE owner=$1 AND id=$2',['owner',id]).catch(()=>{failures++;console.error('FAIL cleanup: test row');});
 child.kill('SIGTERM');await pool.end();s3.destroy();
}
if(failures)process.exitCode=1;
