import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const r2AccountId = process.env.R2_ACCOUNT_ID;
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const r2BucketName = process.env.R2_BUCKET_NAME;
const r2PublicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey || !r2BucketName) {
  throw new Error('Missing R2 environment variables');
}

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: r2AccessKeyId,
    secretAccessKey: r2SecretAccessKey,
  },
});

export interface R2UploadOptions {
  contentType?: string;
  cacheControl?: string;
}

export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array,
  options: R2UploadOptions = {}
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: r2BucketName,
    Key: key,
    Body: body,
    ContentType: options.contentType,
    CacheControl: options.cacheControl,
  });

  await r2Client.send(command);
  return key;
}

export async function getPresignedDownloadUrl(
  key: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: r2BucketName,
    Key: key,
  });

  return getSignedUrl(r2Client, command, { expiresIn: expiresInSeconds });
}

export function getPublicUrl(key: string): string {
  if (!r2PublicUrl) {
    throw new Error('Missing NEXT_PUBLIC_R2_PUBLIC_URL');
  }
  return `${r2PublicUrl}/${key}`;
}

export async function deleteFromR2(keys: string[]): Promise<void> {
  const validKeys = keys.filter(Boolean);
  if (validKeys.length === 0) return;

  await r2Client.send(new DeleteObjectsCommand({
    Bucket: r2BucketName,
    Delete: { Objects: validKeys.map((Key) => ({ Key })) },
  }));
}
