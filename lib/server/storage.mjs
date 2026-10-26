import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
let client;
export const PROPOSAL_BUCKET = 'assets';
export function storageConfigured() {
  return ['AWS_ENDPOINT_URL_S3','AWS_REGION','AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY'].every(key => Boolean(process.env[key]));
}
function getStorage() {
  if (client) return client;
  if (!storageConfigured()) throw new Error('تخزين الملفات غير مهيأ. نفّذ neon deploy وأضف متغيرات AWS الخاصة بالفرع.');
  if (new URL(process.env.AWS_ENDPOINT_URL_S3).protocol !== 'https:') throw new Error('تخزين الملفات يحتاج HTTPS.');
  client = new S3Client({endpoint: process.env.AWS_ENDPOINT_URL_S3, region: process.env.AWS_REGION, forcePathStyle: true, credentials: {accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY}});
  return client;
}
export async function readProposal(key) {
  try {
    const object = await getStorage().send(new GetObjectCommand({Bucket: PROPOSAL_BUCKET, Key: key}));
    if (!object.Body) throw new Error('ملف البروبوزل المخزن غير مكتمل.');
    const bytes = await object.Body.transformToByteArray();
    if (Buffer.from(bytes.subarray(0,4)).toString() !== '%PDF') throw new Error('ملف البروبوزل المخزن غير صحيح.');
    return bytes;
  } catch (error) {
    if (error.name === 'NoSuchKey') return null;
    // A missing bucket or access denial is a configuration failure, not a cache miss.
    throw error;
  }
}
export async function writeProposal(key, bytes) {
  await getStorage().send(new PutObjectCommand({Bucket: PROPOSAL_BUCKET, Key: key, Body: bytes, ContentType: 'application/pdf', CacheControl: 'private, no-store'}));
}
