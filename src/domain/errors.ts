export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class DuplicateContentError extends DomainError {
  constructor(sourceVideoId: string, source: string) {
    super(
      `Content already exists: ${sourceVideoId} from ${source}`,
      'DUPLICATE_CONTENT',
      { sourceVideoId, source }
    );
    this.name = 'DuplicateContentError';
  }
}

export class BlockedAuthorError extends DomainError {
  constructor(username: string, source: string) {
    super(
      `Author blocked: ${username} from ${source}`,
      'BLOCKED_AUTHOR',
      { username, source }
    );
    this.name = 'BlockedAuthorError';
  }
}

export class ContentNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Content not found: ${id}`, 'CONTENT_NOT_FOUND', { id });
    this.name = 'ContentNotFoundError';
  }
}

export class ProcessingError extends DomainError {
  constructor(contentId: string, reason: string) {
    super(
      `Processing failed for ${contentId}: ${reason}`,
      'PROCESSING_ERROR',
      { contentId, reason }
    );
    this.name = 'ProcessingError';
  }
}

export class UploadError extends DomainError {
  constructor(key: string, reason: string) {
    super(
      `Upload failed for ${key}: ${reason}`,
      'UPLOAD_ERROR',
      { key, reason }
    );
    this.name = 'UploadError';
  }
}

export class InvalidStatusTransitionError extends DomainError {
  constructor(
    contentId: string,
    currentStatus: string,
    targetStatus: string
  ) {
    super(
      `Invalid status transition for ${contentId}: ${currentStatus} -> ${targetStatus}`,
      'INVALID_STATUS_TRANSITION',
      { contentId, currentStatus, targetStatus }
    );
    this.name = 'InvalidStatusTransitionError';
  }
}
