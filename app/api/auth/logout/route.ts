import { NextResponse } from 'next/server';
import { sameOriginWrite } from '../../../../lib/access.mjs';
import { COOKIE_NAME } from '../../../../lib/server/session.mjs';
export async function POST(request:Request){if(!sameOriginWrite(request))return NextResponse.json({error:'طلب غير مسموح.'},{status:403});const r=NextResponse.json({ok:true});r.cookies.set(COOKIE_NAME,'',{path:'/',maxAge:0});return r;}
