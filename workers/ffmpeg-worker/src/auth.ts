import { createHmac } from 'crypto';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

export function validateWebhookSignature(
  payload: string,
  signature: string | undefined
): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn('WEBHOOK_SECRET not configured, skipping validation');
    return true;
  }

  if (!signature) {
    return false;
  }

  const expectedSignature = createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return signature === expectedSignature;
}
