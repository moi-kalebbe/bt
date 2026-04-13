import express, { Request, Response } from 'express';
import { processVideo } from './processor';
import { validateWebhookSignature } from './auth';

const app = express();
app.use(express.json());

const CALLBACK_URL = process.env.CALLBACK_URL ?? 'http://localhost:3000/api/webhooks/process-complete';
const PORT = parseInt(process.env.PORT ?? '3001', 10);

interface ProcessRequest {
  contentId: string;
  originalVideoKey: string;
  processedVideoKey: string;
  trackId: string;
  profile: 'reels' | 'stories';
}

app.post('/process', async (req: Request, res: Response) => {
  try {
    const { contentId, originalVideoKey, processedVideoKey, trackId, profile } =
      req.body as ProcessRequest;

    if (!contentId || !originalVideoKey || !processedVideoKey || !trackId) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    console.log(`Processing video ${contentId} with profile ${profile}`);

    const result = await processVideo({
      contentId,
      originalVideoKey,
      processedVideoKey,
      trackId,
      profile: profile ?? 'reels',
      callbackUrl: CALLBACK_URL,
    });

    res.json(result);
  } catch (error) {
    console.error('Process error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`FFmpeg Worker listening on port ${PORT}`);
});
