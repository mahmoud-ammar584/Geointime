import test from 'node:test';
import assert from 'node:assert/strict';
import { requestDb } from '../lib/server/database.mjs';

function setup(t, overrides) {
  const original = {
    fetch: globalThis.fetch,
    url: process.env.SUPABASE_URL,
    secret: process.env.SUPABASE_SECRET_KEY,
    legacy: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  Object.assign(process.env, overrides);
  t.after(() => {
    globalThis.fetch = original.fetch;
    for (const [key, val] of [['SUPABASE_URL', original.url], ['SUPABASE_SECRET_KEY', original.secret], ['SUPABASE_SERVICE_ROLE_KEY', original.legacy]]) {
      if (val === undefined) delete process.env[key]; else process.env[key] = val;
    }
  });
}

test('new Supabase secret key authenticates using apikey without JWT Authorization', async t => {
  setup(t, { SUPABASE_SECRET_KEY: 'sb_secret_testkey' });
  let headers;
  globalThis.fetch = async (_url, options) => { headers=options.headers; return {ok:true,status:200,json:async()=>[]}; };
  assert.deepEqual(await requestDb('GET', 'records'), []);
  assert.equal(headers.apikey, 'sb_secret_testkey');
  assert.equal(headers.Authorization, undefined);
});

test('legacy service-role JWT is supported using both headers', async t => {
  setup(t, { SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiJ9.test.signature' });
  let headers;
  globalThis.fetch = async (_url, options) => { headers=options.headers; return {ok:true,status:200,json:async()=>[]}; };
  assert.deepEqual(await requestDb('GET', 'records'), []);
  assert.equal(headers.apikey, 'eyJhbGciOiJIUzI1NiJ9.test.signature');
  assert.equal(headers.Authorization, `Bearer ${headers.apikey}`);
});

test('rejects publishable API key configured as backend secret', async t => {
  setup(t, { SUPABASE_SECRET_KEY: 'sb_publishable_publickey' });
  globalThis.fetch = async () => { throw Error('must not send request'); };
  await assert.rejects(requestDb('GET', 'records'), /السري/);
});
