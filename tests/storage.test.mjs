import test from 'node:test';
import assert from 'node:assert/strict';
import {S3Client} from '@aws-sdk/client-s3';
import {readProposal,writeProposal} from '../lib/server/storage.mjs';
Object.assign(process.env,{AWS_ENDPOINT_URL_S3:'https://example.invalid',AWS_REGION:'us-east-2',AWS_ACCESS_KEY_ID:'test',AWS_SECRET_ACCESS_KEY:'test'});
test('only missing objects are treated as archive misses',async()=>{
 const original=S3Client.prototype.send;
 try {
  S3Client.prototype.send=async()=>{throw Object.assign(new Error('missing'),{name:'NoSuchKey'});};
  assert.equal(await readProposal('proposals/test.pdf'),null);
  for(const name of ['AccessDenied','NoSuchBucket']){
   S3Client.prototype.send=async()=>{throw Object.assign(new Error(name),{name});};
   await assert.rejects(readProposal('proposals/test.pdf'),{name});
  }
 }finally{S3Client.prototype.send=original;}
});
test('corrupt archived files are never delivered as proposal PDFs',async()=>{
 const original=S3Client.prototype.send;
 S3Client.prototype.send=async()=>({Body:{transformToByteArray:async()=>Buffer.from('<html>Error</html>')}});
 try{await assert.rejects(readProposal('proposals/test.pdf'),/غير صحيح/);}finally{S3Client.prototype.send=original;}
});
test('PDF writes use the private bucket and prevent shared caching',async()=>{
 const original=S3Client.prototype.send;let input;
 S3Client.prototype.send=async(command)=>{input=command.input;return {};};
 try{await writeProposal('proposals/test.pdf',Buffer.from('%PDF-1.7'));assert.equal(input.Bucket,'assets');assert.equal(input.CacheControl,'private, no-store');assert.equal(input.ContentType,'application/pdf');assert.equal(input.ACL,undefined);}finally{S3Client.prototype.send=original;}
});
