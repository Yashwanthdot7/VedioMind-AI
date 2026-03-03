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

export interface VideoData {
  videoId: string;
  title: string;
  transcript: TranscriptSegment[];
  summary: string;
  keyTakeaways: string[];
}

export interface ProcessingStep {
  label: string;
  completed: boolean;
}