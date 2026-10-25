import { ownerFromRequest } from '../../../lib/server/session.mjs';
import { getForOwner } from '../../../lib/server/database.mjs';
// @ts-ignore vendored PDF toolkit
import PDFLib from '../../../lib/vendor/pdf-lib.mjs';
// @ts-ignore vendored browser-safe fontkit
import fontkit from '../../../lib/vendor/fontkit.mjs';
// @ts-ignore
import {generateProposal} from '../../../lib/proposal.mjs';
// @ts-ignore source-embedded template assets
import assets from '../../../lib/proposal-assets.mjs';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const decode=(s:string)=>Uint8Array.from(Buffer.from(s,'base64'));
function expiry(start:string){const d=new Date(start+'T12:00:00Z');let n=0;while(n<7){d.setUTCDate(d.getUTCDate()+1);if(![5,6].includes(d.getUTCDay()))n++;}return d.toISOString().slice(0,10);}
export async function GET(request:Request){
 const owner=ownerFromRequest(request);if(!owner)return new Response('تسجيل الدخول مطلوب.',{status:401});
 const id=new URL(request.url).searchParams.get('id');if(!id||!/^[a-zA-Z0-9_-]{1,80}$/.test(id))return new Response('معرّف العرض مطلوب.',{status:400});
 try{const row:any=await getForOwner(owner,id);if(!row||row.kind!=='quote')return new Response('العرض غير موجود.',{status:404});
 const d=row.data,issued=d.issuedDate||row.created_at.slice(0,10),number='GIT-'+issued.replaceAll('-','')+'-'+id.slice(0,6).toUpperCase();
 const bytes=await generateProposal(PDFLib,{templateBytes:decode(assets.template),fontBytes:decode(assets.font),boldBytes:decode(assets.bold),semiBytes:decode(assets.semi),fontkit,quote:d.quote,approvalRecorded:!!d.approvalNote?.trim(),customer:d.customer,customerImage:d.customerImage||undefined,number,issuedDate:issued,expiresAt:expiry(issued)});
 return new Response(bytes,{headers:{'Content-Type':'application/pdf','Content-Disposition':(new URL(request.url).searchParams.get('preview')==='1'?'inline':'attachment')+'; filename="'+number+'.pdf"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch{return new Response('تعذر إنشاء البروپوزل؛ راجع البيانات وقاعدة التخزين.',{status:503});}}
