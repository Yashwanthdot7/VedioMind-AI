export enum ProcessingStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export interface TranscriptSegment {
  timestamp: string;
  text: string;
  seconds: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface VideoMetadata {
  duration: number | null;
  author: string | null;
  thumbnail: string | null;
}

export interface VideoData {
  analysisId: string | null;
  videoId: string;
  language: string;
  title: string;
  transcript: TranscriptSegment[];
  summary: string;
  keyTakeaways: string[];
  metadata?: VideoMetadata;
}

export interface LibraryItem {
  analysisId: string;
  videoId: string;
  language: string;
  title: string;
  author: string | null;
  duration: number | null;
  thumbnail: string | null;
  isFavorite: boolean;
  addedAt: string;
}

export interface ProcessingStep {
  label: string;
  completed: boolean;
}

/** Minimal subset of the YouTube IFrame player we use (methods return promises via youtube-player) */
export interface PlayerHandle {
  seekTo(seconds: number, allowSeekAhead: boolean): unknown;
  playVideo(): unknown;
  getCurrentTime(): number | Promise<number>;
}
