export interface VideoDiscoveredEvent {
  type: 'VIDEO_DISCOVERED';
  contentId: string;
  source: string;
  sourceVideoId: string;
  authorUsername: string | null;
  timestamp: string;
}

export interface VideoIngestedEvent {
  type: 'VIDEO_INGESTED';
  contentId: string;
  originalVideoKey: string;
  thumbnailKey: string;
  timestamp: string;
}

export interface VideoProcessedEvent {
  type: 'VIDEO_PROCESSED';
  contentId: string;
  processedVideoKey: string;
  profile: string;
  timestamp: string;
}

export interface VideoPublishedEvent {
  type: 'VIDEO_PUBLISHED';
  contentId: string;
  platform: 'instagram' | 'facebook';
  publishedAt: string;
  slot: 'morning' | 'night';
}

export interface VideoFailedEvent {
  type: 'VIDEO_FAILED';
  contentId: string;
  step: string;
  error: string;
  timestamp: string;
}

export type DomainEvent =
  | VideoDiscoveredEvent
  | VideoIngestedEvent
  | VideoProcessedEvent
  | VideoPublishedEvent
  | VideoFailedEvent;
