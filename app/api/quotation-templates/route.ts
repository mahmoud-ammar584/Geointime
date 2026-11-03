import { ownerFromRequest } from '../../../lib/server/session.mjs';
import { sameOriginWrite } from '../../../lib/access.mjs';
import { readProposal, writeProposal } from '../../../lib/server/storage.mjs';
// @ts-ignore vendored PDF library
import PDFLib from '../../../lib/vendor/pdf-lib.mjs';
export const dynamic='force-dynamic';
export const runtime='nodejs';

const KEY: Record<string,string> = {
 essentials: 'quotation-templates/workforce-essentials-original.pdf',
 operations: 'quotation-templates/workforce-operations-original.pdf'
};
const res = (data:unknown, status=200) => Response.json(data,{
 status, headers:{'Cache-Control':'private, no-store'}
});
export async function GET(request:Request){
 if(!ownerFromRequest(request)) return res({error:'Authentication required'},401);
 try {
  const entries=await Promise.all(Object.entries(KEY).map(async ([k,v])=>[k,!!(await readProposal(v))]));
  return res(Object.fromEntries(entries));
 }catch {return res({error:'Could not check the template storage.'},503);}
}
export async function POST(request:Request){
 if(!ownerFromRequest(request)) return res({error:'Authentication required'},401);
 if(!sameOriginWrite(request)) return res({error:'Cross-origin upload denied'},403);
 try{
  const body=await request.formData();
  const kind=String(body.get('kind')||'');
  if(!Object.hasOwn(KEY,kind))return res({error:'Invalid template type'},400);
  const item=body.get('file');
  if(!(item instanceof File))return res({error:'Choose an original PDF template.'},400);
  if(item.size>4_000_000||item.size<1000)return res({error:'PDF file size must be 1KB to 4MB.'},413);
  const bytes=new Uint8Array(await item.arrayBuffer());
  if(Buffer.from(bytes.subarray(0,5)).toString('latin1')!=='%PDF-')return res({error:'Invalid PDF header'},400);
  const doc=await PDFLib.PDFDocument.load(bytes,{ignoreEncryption:false});
  if(doc.getPageCount()!==5)return res({error:'The original Workforce PDF must have five A4 pages.'},400);
  const first=doc.getPage(0);
  if(Math.abs(first.getWidth()-595)>3||Math.abs(first.getHeight()-842)>3)return res({error:'Expected A4 original quotation PDF'},400);
  await writeProposal(KEY[kind],bytes);
  return res({ok:true,kind,pages:doc.getPageCount(),bytes:bytes.length});
 }catch (e){return res({error:e instanceof Error?e.message:'Template upload failed'},500);}
}
