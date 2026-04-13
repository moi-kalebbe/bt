import { Redis } from '@upstash/redis';

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!redisUrl || !redisToken) {
  console.warn('Upstash Redis not configured. Queue operations will fail.');
}

export const redis = new Redis({
  url: redisUrl ?? 'http://localhost:6379',
  token: redisToken ?? 'dummy',
});

export const QUEUE_NAMES = {
  SCRAPE: 'scrape',
  INGEST: 'ingest',
  PROCESS: 'process',
  PUBLISH: 'publish',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export interface QueueJob<T = unknown> {
  id: string;
  data: T;
  attempts?: number;
  timestamp?: number;
}

export async function addJob<T>(
  queueName: QueueName,
  job: T,
  options?: {
    jobId?: string;
    delay?: number;
  }
): Promise<string> {
  const jobId = options?.jobId ?? crypto.randomUUID();
  const payload = {
    id: jobId,
    data: job,
    attempts: 0,
    timestamp: Date.now(),
  };

  if (options?.delay) {
    await redis.zadd(queueName, { score: Date.now() + options.delay, member: JSON.stringify(payload) });
  } else {
    await redis.lpush(queueName, JSON.stringify(payload));
  }

  return jobId;
}

export async function getJob<T>(queueName: QueueName): Promise<QueueJob<T> | null> {
  const payload = await redis.rpop(queueName);
  if (!payload) return null;
  return typeof payload === 'string' ? JSON.parse(payload) : payload as QueueJob<T>;
}

export async function getJobCount(queueName: QueueName): Promise<number> {
  return redis.llen(queueName);
}

export async function peekJobs<T>(queueName: QueueName, count: number = 10): Promise<QueueJob<T>[]> {
  const items = await redis.lrange(queueName, -count, -1);
  return (items ?? []).map((item) =>
    typeof item === 'string' ? JSON.parse(item) : item
  ) as QueueJob<T>[];
}

export async function requeueJob<T>(queueName: QueueName, job: QueueJob<T>): Promise<void> {
  const updatedJob = {
    ...job,
    attempts: (job.attempts ?? 0) + 1,
    timestamp: Date.now(),
  };
  await redis.lpush(queueName, JSON.stringify(updatedJob));
}
