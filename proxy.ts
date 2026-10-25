import { NextRequest, NextResponse } from 'next/server';
// Protected workspace: no unauthenticated access to HTML, JS bundles or API routes.
// The signing key stays in server-only environment variables.
import { verifySession, COOKIE_NAME } from './lib/server/session.mjs';
export function proxy(request: NextRequest) {
 const path=request.nextUrl.pathname;
 if(path==='/login'||path==='/api/auth/login'||path==='/api/auth/logout'||path.startsWith('/_next/')||path==='/favicon.ico')return NextResponse.next();
 const cookie=request.cookies.get(COOKIE_NAME)?.value;
 if(verifySession(cookie))return NextResponse.next();
 if(path.startsWith('/api/'))return NextResponse.json({error:'تسجيل الدخول مطلوب.'},{status:401,headers:{'Cache-Control':'no-store'}});
 return NextResponse.redirect(new URL('/login',request.url));
}
export const config={matcher:['/((?!_next/static|_next/image).*)']};
