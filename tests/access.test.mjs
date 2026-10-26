import {test} from 'node:test';import assert from 'node:assert/strict';
import {sameOriginWrite} from '../lib/access.mjs';
import {createSession,verifySession,verifyPassword,ownerFromRequest,sessionConfigured} from '../lib/server/session.mjs';
test('Cross-origin writes are rejected and same-origin writes accepted',()=>{
 assert.equal(sameOriginWrite(new Request('https://app.example/api/records',{headers:{origin:'https://other.example'}})),false);
 assert.equal(sameOriginWrite(new Request('https://app.example/api/records',{headers:{origin:'https://app.example'}})),true);
});
test('configured owner passwords of 10 or more characters allow login and retain signed sessions',()=>{
 const originalPassword=process.env.APP_PASSWORD,originalSecret=process.env.SESSION_SECRET;
 try{
  process.env.APP_PASSWORD='Private@Geo';process.env.SESSION_SECRET='0123456789abcdef0123456789abcdef0123456789abcdef';
  assert.equal(sessionConfigured(),true);assert.equal(verifyPassword('Private@Geo'),true);
  assert.equal(verifySession(createSession()),true);
  process.env.APP_PASSWORD='short';assert.equal(sessionConfigured(),false);
 }finally{
  if(originalPassword===undefined)delete process.env.APP_PASSWORD;else process.env.APP_PASSWORD=originalPassword;
  if(originalSecret===undefined)delete process.env.SESSION_SECRET;else process.env.SESSION_SECRET=originalSecret;
 }
});
test('Session rejects anonymous and spoofed Sites identity headers',()=>{
 process.env.APP_PASSWORD='an-extremely-long-private-password';process.env.SESSION_SECRET='0123456789abcdef0123456789abcdef0123456789abcdef';
 assert.equal(ownerFromRequest(new Request('https://app.example/api/records',{headers:{'oai-authenticated-user-id':'owner'}})),null);
 assert.equal(verifyPassword('wrong'),false);assert.equal(verifyPassword(process.env.APP_PASSWORD),true);
 const good=createSession();assert.equal(verifySession(good),true);
 assert.equal(verifySession(good.replace(/.$/,'a')),false);
 assert.equal(ownerFromRequest(new Request('https://app.example/api/records',{headers:{cookie:'geointime_session='+good}})),'owner');
});

