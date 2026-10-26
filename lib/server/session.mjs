import { createHmac, timingSafeEqual } from 'node:crypto';
export const COOKIE_NAME = 'geointime_session';
const SEVEN_DAYS = 60 * 60 * 24 * 7;
export function sessionConfigured() { return Boolean(process.env.APP_PASSWORD && process.env.SESSION_SECRET && process.env.APP_PASSWORD.length >= 10 && process.env.SESSION_SECRET.length >= 32); }
function signature(payload) { return createHmac('sha256', process.env.SESSION_SECRET).update(payload).digest('base64url'); }
function safeEqual(a,b) {const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length && timingSafeEqual(x,y);}
export function verifyPassword(password) {
 if (!sessionConfigured() || typeof password !== 'string') return false;
 return safeEqual(password, process.env.APP_PASSWORD);
}
export function createSession() {
 if (!sessionConfigured()) throw new Error('APP_PASSWORD or SESSION_SECRET not configured');
 const payload=Buffer.from(JSON.stringify({sub:'owner', exp:Math.floor(Date.now()/1000)+SEVEN_DAYS})).toString('base64url');
 return `${payload}.${signature(payload)}`;
}
export function verifySession(value) {
 if (!sessionConfigured() || typeof value !== 'string' || value.length > 2048) return false;
 const pieces=value.split('.');if(pieces.length!==2||!pieces[0]||!pieces[1])return false;
 if (!safeEqual(signature(pieces[0]),pieces[1]))return false;
 try {const data=JSON.parse(Buffer.from(pieces[0],'base64url').toString('utf8'));return data.sub==='owner'&&Number.isSafeInteger(data.exp)&&data.exp>Math.floor(Date.now()/1000);}catch{return false;}
}
export function ownerFromRequest(request) {
 const value=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE_NAME+'='))?.slice(COOKIE_NAME.length+1);
 return verifySession(value)?'owner':null;
}

