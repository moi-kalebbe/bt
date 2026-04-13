import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

const r2AccountId = process.env.R2_ACCOUNT_ID!;
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID!;
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY!;
const r2BucketName = process.env.R2_BUCKET_NAME!;

export const r2WorkerClient = new S3Client({
  region: 'auto',
  endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: r2AccessKeyId,
    secretAccessKey: r2SecretAccessKey,
  },
});

export interface ProcessOptions {
  contentId: string;
  originalVideoKey: string;
  processedVideoKey: string;
  trackId: string;
  profile: 'reels' | 'stories';
  callbackUrl: string;
}

export async function processVideo(options: ProcessOptions): Promise<{
  success: boolean;
  contentId: string;
  processedVideoKey?: string;
  error?: string;
}> {
  const { contentId, originalVideoKey, processedVideoKey, trackId, profile, callbackUrl } =
    options;

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ffmpeg-'));
  const inputPath = path.join(tempDir, 'input.mp4');
  const outputPath = path.join(tempDir, 'output.mp4');
  const trackPath = path.join(tempDir, 'track.mp3');

  try {
    console.log(`Downloading original video from R2: ${originalVideoKey}`);
    await downloadFromR2(originalVideoKey, inputPath);

    console.log(`Downloading track from R2: ${trackId}`);
    await downloadTrack(trackId, trackPath);

    console.log(`Processing video with profile: ${profile}`);
    await runFFmpeg(inputPath, trackPath, outputPath, profile);

    console.log(`Uploading processed video to R2: ${processedVideoKey}`);
    await uploadToR2(outputPath, processedVideoKey);

    console.log(`Calling callback: ${callbackUrl}`);
    await fetch(callbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contentId,
        success: true,
        processedVideoKey,
      }),
    });

    return { success: true, contentId, processedVideoKey };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Processing failed: ${errorMessage}`);

    await fetch(callbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contentId,
        success: false,
        error: errorMessage,
      }),
    }).catch(console.error);

    return { success: false, contentId, error: errorMessage };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function downloadFromR2(key: string, destPath: string): Promise<void> {
  const command = new GetObjectCommand({
    Bucket: r2BucketName,
    Key: key,
  });

  const url = await getSignedUrl(r2WorkerClient, command, { expiresIn: 3600 });
  await downloadFile(url, destPath);
}

async function downloadTrack(trackId: string, destPath: string): Promise<void> {
  const trackKey = `tracks/${trackId}.mp3`;

  try {
    await downloadFromR2(trackKey, destPath);
  } catch {
    console.warn(`Track not found in R2, proceeding without audio track`);
    await fs.writeFile(destPath, '');
  }
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  await fs.writeFile(destPath, Buffer.from(buffer));
}

async function uploadToR2(filePath: string, key: string): Promise<void> {
  const fileContent = await fs.readFile(filePath);

  const command = new PutObjectCommand({
    Bucket: r2BucketName,
    Key: key,
    Body: fileContent,
    ContentType: 'video/mp4',
  });

  await r2WorkerClient.send(command);
}

async function runFFmpeg(
  inputPath: string,
  trackPath: string,
  outputPath: string,
  profile: 'reels' | 'stories'
): Promise<void> {
  // Verificar se o arquivo de trilha existe e tem conteúdo ANTES do callback síncrono
  let hasTrack = false;
  try {
    const stat = await fs.stat(trackPath);
    hasTrack = stat.size > 0;
  } catch {
    console.log('No track file, processing video only');
  }

  return new Promise((resolve, reject) => {
    let command = ffmpeg(inputPath);

    if (hasTrack) {
      command = command.input(trackPath);
    }

    if (profile === 'reels') {
      command = command
        .videoFilters('scale=1080:1920:force_original_aspect_ratio=decrease')
        .videoFilters('pad=1080:1920:(ow-iw)/2:(oh-ih)/2')
        .videoFilters('setsar=1')
        .aspect('9:16');
    } else {
      command = command
        .videoFilters('scale=1080:1080:force_original_aspect_ratio=decrease')
        .videoFilters('setsar=1')
        .aspect('1:1');
    }

    command
      .outputOptions([
        '-c:v libx264',
        '-preset fast',
        '-crf 23',
        '-c:a aac',
        '-b:a 128k',
        '-movflags +faststart',
      ])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}
