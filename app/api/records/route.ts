import { ownerFromRequest } from '../../../lib/server/session.mjs';
import { sameOriginWrite } from '../../../lib/access.mjs';
import { DatabaseError,listForOwner,getForOwner,insertForOwner,updateForOwner } from '../../../lib/server/database.mjs';
// @ts-ignore shared dependency-free model
import { calculate } from '../../../lib/calculator.mjs';
// @ts-ignore
import {validateRecord,validateSettings,DEFAULT_SETTINGS,buildReport} from '../../../lib/business.mjs';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const owner=(request:Request)=>ownerFromRequest(request);
export async function GET(request:Request){const user=owner(request);if(!user)return json({error:'تسجيل الدخول مطلوب.'},401);try{
 const rows=await listForOwner(user),records=rows.map((r:any)=>({id:r.id,kind:r.kind,data:r.data,revision:r.revision,createdAt:r.created_at,updatedAt:r.updated_at}));
 const settings=records.find((r:any)=>r.kind==='settings'),quotes=records.filter((r:any)=>r.kind==='quote');
 const effectiveSettings=validateSettings(settings?.data??DEFAULT_SETTINGS);return json({records:quotes,settings:effectiveSettings,settingsRevision:settings?.revision??0,report:buildReport(quotes,effectiveSettings)});
 }catch(e){return json({error:e instanceof Error?e.message:'تعذر تحميل السجل.'},503);}}
export async function POST(request:Request){const user=owner(request);if(!user)return json({error:'تسجيل الدخول مطلوب.'},401);if(!sameOriginWrite(request))return json({error:'طلب غير مسموح.'},403);
 try{if(Number(request.headers.get('content-length')||0)>200000)return json({error:'البيانات أكبر من المسموح.'},413);
 const text=await request.text();if(Buffer.byteLength(text,'utf8')>200000)return json({error:'البيانات أكبر من المسموح.'},413);
 const raw=JSON.parse(text);if(!raw||typeof raw!=='object')throw Error('بيانات الطلب غير صحيحة.');
 const body=raw as {kind:string;id?:string;revision:number;data:any};if(!['quote','settings'].includes(body.kind))return json({error:'نوع السجل غير صحيح.'},400);
 if(!Number.isInteger(body.revision)||body.revision<0)return json({error:'رقم النسخة غير صحيح.'},400);
 const id=body.kind==='settings'?'settings':String(body.id||'');if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id))return json({error:'معرّف غير صحيح.'},400);
 const existing:any=await getForOwner(user,id);
 if((existing?.revision??0)!==body.revision)return json({error:'السجل اتعدل من جلسة تانية. حدّث الصفحة وحاول من جديد.'},409);
 if(existing&&existing.kind!==body.kind)return json({error:'نوع السجل لا يمكن تغييره.'},409);
 let data:any;if(body.kind==='settings')data=validateSettings(body.data);
 else {data=validateRecord(body.data);const prev=existing?.data??null;
 const quote=prev&&JSON.stringify(prev.input)===JSON.stringify(data.input)?prev.quote:calculate(data.input);data.quote=quote;data.policyVersion='2026-10-25';
 if(['sent','won'].includes(data.status)&&(quote.implementation===null||((quote.approval.needsApproval||quote.customRequired)&&!data.approvalNote.trim())))throw Error('استكمل رسوم التهيئة واعتماد الاستثناء قبل إرسال العرض أو إغلاقه.');
 if((data.payoutRule!=='auto'||data.renewalRate!==null)&&!data.approvalNote.trim())throw Error('دوّن اعتماد قاعدة الصرف أو نسبة التجديد الخاصة.');
 if(data.adjustment&&!data.adjustmentNote.trim())throw Error('اكتب سبب تسوية العمولة.');if(data.share!==100&&!data.approvalNote.trim())throw Error('تقسيم العمولة يحتاج توثيق اعتماد الإدارة.');
 }
 const now=new Date().toISOString();const saved=existing?await updateForOwner(user,id,body.revision,data,now):await insertForOwner(user,id,body.kind,data,now);
 if(saved.length===0)return json({error:'السجل اتغير؛ حدّث الصفحة.'},409);
 return json({ok:true,id,revision:body.revision+1});
 }catch(error){return json({error:error instanceof Error?error.message:'تعذر حفظ السجل.'},error instanceof DatabaseError?503:400);}}

