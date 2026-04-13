import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Lazy singleton — avoids build-time throw when R2 secrets are absent
let _r2Client: S3Client | null = null;
let _r2BucketName: string | null = null;

function getR2Client(): { client: S3Client; bucket: string } {
  if (_r2Client && _r2BucketName) return { client: _r2Client, bucket: _r2BucketName };

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error('Missing R2 environment variables');
  }

  _r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  _r2BucketName = bucketName;

  return { client: _r2Client, bucket: _r2BucketName };
}

export interface R2UploadOptions {
  contentType?: string;
  cacheControl?: string;
}

export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array,
  options: R2UploadOptions = {}
): Promise<string> {
  const { client, bucket } = getR2Client();
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: options.contentType,
    CacheControl: options.cacheControl,
  }));
  return key;
}

export async function getPresignedDownloadUrl(
  key: string,
  expiresInSeconds = 3600
): Promise<string> {
  const { client, bucket } = getR2Client();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: expiresInSeconds,
  });
}

export function getPublicUrl(key: string): string {
  const r2PublicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (!r2PublicUrl) throw new Error('Missing NEXT_PUBLIC_R2_PUBLIC_URL');
  return `${r2PublicUrl}/${key}`;
}

export async function deleteFromR2(keys: string[]): Promise<void> {
  const validKeys = keys.filter(Boolean);
  if (validKeys.length === 0) return;
  const { client, bucket } = getR2Client();
  await client.send(new DeleteObjectsCommand({
    Bucket: bucket,
    Delete: { Objects: validKeys.map((Key) => ({ Key })) },
  }));
}
