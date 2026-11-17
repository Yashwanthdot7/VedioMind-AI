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

// ------------------------------------------------------------------ study tools

export type StudyType = 'notes' | 'quiz' | 'flashcards' | 'mindmap';
export type StudyLevel = 'kids' | 'student' | 'teacher';

export interface StudyNotes {
  title: string;
  overview: string;
  sections: { heading: string; timestamp: string; points: string[] }[];
  keyTerms: { term: string; definition: string }[];
}

export interface StudyQuiz {
  questions: {
    question: string;
    options: string[];
    answerIndex: number;
    explanation: string;
    timestamp: string;
  }[];
}

export interface StudyFlashcards {
  cards: { front: string; back: string; timestamp: string }[];
}

export interface StudyMindMap {
  root: string;
  branches: {
    label: string;
    timestamp: string;
    children: { label: string; details: string[] }[];
  }[];
}

export interface StudyDataMap {
  notes: StudyNotes;
  quiz: StudyQuiz;
  flashcards: StudyFlashcards;
  mindmap: StudyMindMap;
}

// ------------------------------------------------------------------ video lessons

export type LessonLayout = 'title' | 'bullets' | 'fact' | 'steps' | 'compare' | 'summary';
export type LessonStatus = 'queued' | 'scripting' | 'voice' | 'done' | 'failed';
export type LessonAudience = 'kids' | 'student' | 'teacher';

export interface LessonScene {
  layout: LessonLayout;
  icon: string;
  heading: string;
  narration: string;
  bullets: string[];
  highlight: string;
  leftTitle: string;
  left: string[];
  rightTitle: string;
  right: string[];
  audio: string | null;
  duration: number | null;
  imagePrompt?: string;
  image?: string | null;
  imageStatus?: 'pending' | 'done' | 'failed' | 'skipped';
}

export interface Lesson {
  id: string;
  title: string;
  status: LessonStatus;
  progress: number;
  language: string;
  audience: LessonAudience;
  length?: 'short' | 'standard';
  voice: string;
  voiceMode: 'gemini' | 'browser';
  voiceNotice?: string | null;
  visuals?: 'pictures' | 'slides';
  imageNotice?: string | null;
  imageProvider?: string | null;
  source: 'text' | 'video';
  sourceVideo: { videoId: string; analysisId: string | null; title: string } | null;
  inputPreview?: string | null;
  scenes: LessonScene[];
  quiz: StudyQuiz['questions'];
  durationSec: number | null;
  error: string | null;
  createdAt: string;
}

export interface LessonSummary {
  id: string;
  title: string;
  icon: string;
  status: LessonStatus;
  progress: number;
  language: string;
  audience: LessonAudience;
  durationSec: number | null;
  createdAt: string;
}
