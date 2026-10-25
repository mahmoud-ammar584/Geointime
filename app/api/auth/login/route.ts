import { NextResponse } from 'next/server';
import { COOKIE_NAME,createSession,verifyPassword,sessionConfigured } from '../../../../lib/server/session.mjs';
import { sameOriginWrite } from '../../../../lib/access.mjs';
export async function POST(request:Request){
 if(!sameOriginWrite(request))return NextResponse.json({error:'طلب غير مسموح.'},{status:403});
 if(!sessionConfigured())return NextResponse.json({error:'لم يتم إعداد كلمة المرور ومفتاح الجلسة على Vercel.'},{status:503});
 if(Number(request.headers.get('content-length')||0)>10000)return NextResponse.json({error:'طلب أكبر من المسموح.'},{status:413});
 let password='';try{password=(await request.json()).password;}catch{return NextResponse.json({error:'طلب غير صحيح.'},{status:400});}
 if(!verifyPassword(password))return NextResponse.json({error:'كلمة المرور غير صحيحة.'},{status:401,headers:{'Cache-Control':'no-store'}});
 const response=NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 response.cookies.set(COOKIE_NAME,createSession(),{httpOnly:true,secure:new URL(request.url).protocol==='https:',sameSite:'strict',path:'/',maxAge:7*24*60*60});
 return response;
}
