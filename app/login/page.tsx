'use client';
import { useState, type FormEvent } from 'react';
export default function Login(){
 const [password,setPassword]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{
 const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({password})});
 const body=await r.json();if(!r.ok)throw Error(body.error||'تعذر تسجيل الدخول');window.location.replace('/studio.html');
 }catch(e){setError(e instanceof Error?e.message:'تعذر تسجيل الدخول');}finally{setBusy(false);}}
 return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'#0d1d21',color:'#fff',fontFamily:'Arial,sans-serif',padding:24}}><form onSubmit={submit} style={{width:'100%',maxWidth:390,background:'#163037',border:'1px solid #36525a',borderRadius:20,padding:32,display:'grid',gap:22}}><div style={{color:'#67e2b4',fontSize:15}}>GeoInTime / Commercial Studio</div><h1 style={{fontSize:26,margin:0}}>تسجيل الدخول</h1><p style={{margin:0,color:'#bfd1d2'}}>مساحة خاصة لعروض الأسعار والتارجت والعمولات.</p><label style={{display:'grid',gap:8}}>كلمة المرور<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} style={{padding:14,borderRadius:8,border:'1px solid #52727b',color:'#111',background:'white',fontSize:16}} /></label>{error&&<p role="alert" style={{color:'#ffb4b4',margin:0}}>{error}</p>}<button type="submit" disabled={busy} style={{padding:15,border:0,borderRadius:8,background:'#52e1a4',color:'#073326',fontWeight:700,cursor:'pointer'}}>{busy?'بيسجل دخول…':'دخول للوحة التحكم'}</button></form></main>;
}
