// Supabase REST adapter: server-only, no public anon key or RLS bypass sent to browser.
export function configured(){return Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));}
export async function requestDb(method,table,query='',body){
 if(!configured())throw new Error('قاعدة البيانات غير مهيأة. أضف SUPABASE_URL وSUPABASE_SECRET_KEY.');
 const key=process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(key.startsWith('sb_publishable_'))throw new Error('استخدم مفتاح Supabase السري من السيرفر، وليس المفتاح العام.');
 const base=new URL(process.env.SUPABASE_URL);
 if(!['https:','http:'].includes(base.protocol))throw new Error('إعداد قاعدة البيانات غير صحيح.');
 if(base.protocol!=='https:' && process.env.NODE_ENV==='production')throw new Error('قاعدة البيانات تحتاج HTTPS.');
 const headers={'apikey':key,'Content-Type':'application/json','Accept':'application/json','Prefer':method==='POST'?'resolution=ignore-duplicates,return=representation':'return=representation'};
 // Opaque sb_secret_ credentials belong in apikey only; legacy service-role JWTs also need Bearer auth.
 if(!key.startsWith('sb_secret_'))headers.Authorization='Bearer '+key;
 const res=await fetch(`${base.origin}/rest/v1/${table}${query?'?'+query:''}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 if(!res.ok)throw new Error('تعذر الاتصال بقاعدة البيانات ('+res.status+').');
 return res.status===204?[]:await res.json();
}
function q(value){return encodeURIComponent(value);}
export const listForOwner=owner=>requestDb('GET','records',`select=id,kind,data,revision,created_at,updated_at&owner=eq.${q(owner)}&order=created_at.desc&limit=5000`);
export const getForOwner=(owner,id)=>requestDb('GET','records',`select=id,kind,data,revision,created_at,updated_at&owner=eq.${q(owner)}&id=eq.${q(id)}&limit=1`).then(r=>r[0]||null);
export const insertForOwner=(owner,id,kind,data,now)=>requestDb('POST','records','',{owner,id,kind,data,revision:1,created_at:now,updated_at:now});
export const updateForOwner=(owner,id,revision,data,now)=>requestDb('PATCH','records',`owner=eq.${q(owner)}&id=eq.${q(id)}&revision=eq.${revision}`,{data,revision:revision+1,updated_at:now});
