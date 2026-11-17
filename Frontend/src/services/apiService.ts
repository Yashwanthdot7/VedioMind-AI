import { supabase } from '../lib/supabase';
import { Lesson, LessonAudience, LessonSummary, LibraryItem, Message, StudyDataMap, StudyLevel, StudyType, VideoData } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: {
        ...(options.body !== undefined && { 'Content-Type': 'application/json' }),
        ...(await authHeaders()),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach the VideoMind server. Is the backend running?', 0, 'NETWORK');
  }

  let payload: { error?: string; message?: string; code?: string } | null = null;
  try {
    payload = await response.json();
  } catch {
    /* non-JSON response */
  }

  if (!response.ok) {
    throw new ApiError(
      payload?.error || payload?.message || `Request failed (${response.status})`,
      response.status,
      payload?.code || 'UNKNOWN',
    );
  }
  return payload as unknown as T;
}

// ------------------------------------------------------------------ video

export interface ProcessResult {
  data: VideoData;
  cached: boolean;
  saved: boolean;
}

export async function processVideo(url: string, language: string): Promise<ProcessResult> {
  const res = await request<{ data: VideoData; cached: boolean; saved: boolean }>('/video/process', {
    method: 'POST',
    body: { url, language },
  });
  return { data: res.data, cached: res.cached, saved: res.saved };
}

// ------------------------------------------------------------------ chat

/**
 * Multi-turn chat. The server looks the video up by id, so the transcript
 * is only re-sent if the server has lost it (e.g. restarted in guest mode).
 */
export async function sendChat(video: VideoData, history: Message[]): Promise<string> {
  const base = {
    analysisId: video.analysisId,
    videoId: video.videoId,
    language: video.language,
    messages: history.map((m) => ({ role: m.role, content: m.content })),
  };

  try {
    const res = await request<{ answer: string }>('/chat/conversation', { method: 'POST', body: base });
    return res.answer;
  } catch (err) {
    if (err instanceof ApiError && err.code === 'CONTEXT_EXPIRED') {
      const res = await request<{ answer: string }>('/chat/conversation', {
        method: 'POST',
        body: {
          ...base,
          videoContext: { title: video.title, summary: video.summary, transcript: video.transcript },
        },
      });
      return res.answer;
    }
    throw err;
  }
}

// ------------------------------------------------------------------ study tools

export interface StudyResult<T extends StudyType> {
  data: StudyDataMap[T];
  cached: boolean;
  createdAt: string;
}

export async function getStudyMaterial<T extends StudyType>(
  video: VideoData,
  type: T,
  level: StudyLevel,
  refresh = false,
): Promise<StudyResult<T>> {
  const base = {
    analysisId: video.analysisId,
    videoId: video.videoId,
    language: video.language,
    level,
    refresh,
  };
  try {
    return await request<StudyResult<T>>(`/study/${type}`, { method: 'POST', body: base });
  } catch (err) {
    if (err instanceof ApiError && err.code === 'CONTEXT_EXPIRED') {
      return request<StudyResult<T>>(`/study/${type}`, {
        method: 'POST',
        body: { ...base, videoContext: { title: video.title, summary: video.summary, transcript: video.transcript } },
      });
    }
    throw err;
  }
}

// ------------------------------------------------------------------ video lessons

export interface LessonOptions {
  voices: Record<string, string>;
  pictures: boolean;
  pictureProvider: 'cloudflare' | 'pollinations' | null;
  audiences: LessonAudience[];
  lengths: Record<string, string>;
}

export async function getLessonOptions(): Promise<LessonOptions> {
  return (await request<{ data: LessonOptions }>('/lessons/options')).data;
}

export interface CreateLessonInput {
  text?: string;
  video?: VideoData;
  audience: LessonAudience;
  language: string;
  length: 'short' | 'standard';
  voice?: string;
  visuals?: 'pictures' | 'slides';
}

export async function createLesson(input: CreateLessonInput): Promise<Lesson> {
  const body: Record<string, unknown> = {
    audience: input.audience,
    language: input.language,
    length: input.length,
    voice: input.voice,
    visuals: input.visuals,
  };
  if (input.video) {
    Object.assign(body, {
      videoId: input.video.videoId,
      analysisId: input.video.analysisId,
      videoLanguage: input.video.language,
    });
  } else {
    body.text = input.text;
  }
  try {
    return (await request<{ data: Lesson }>('/lessons', { method: 'POST', body })).data;
  } catch (err) {
    if (err instanceof ApiError && err.code === 'CONTEXT_EXPIRED' && input.video) {
      const v = input.video;
      body.videoContext = { title: v.title, summary: v.summary, transcript: v.transcript };
      return (await request<{ data: Lesson }>('/lessons', { method: 'POST', body })).data;
    }
    throw err;
  }
}

export async function getLesson(id: string): Promise<Lesson> {
  return (await request<{ data: Lesson }>(`/lessons/${id}`)).data;
}

export async function listLessons(): Promise<LessonSummary[]> {
  return (await request<{ data: LessonSummary[] }>('/lessons')).data;
}

export async function deleteLesson(id: string): Promise<void> {
  await request(`/lessons/${id}`, { method: 'DELETE' });
}

/** Narration audio as a Blob (fetched with auth so private lessons work) */
export async function fetchLessonAudio(id: string, index: number): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}/lessons/${id}/audio/${index}`, { headers: await authHeaders() });
  if (!res.ok) throw new ApiError('Could not load the narration audio', res.status, 'AUDIO_FAILED');
  return res.blob();
}

/** A scene's AI picture, decoded and ready to draw (same-origin, so the canvas can still be recorded) */
export async function fetchLessonImage(id: string, index: number): Promise<ImageBitmap> {
  const res = await fetch(`${API_BASE_URL}/lessons/${id}/image/${index}`, { headers: await authHeaders() });
  if (!res.ok) throw new ApiError('Could not load a picture', res.status, 'IMAGE_FAILED');
  return createImageBitmap(await res.blob());
}

// ------------------------------------------------------------------ library

export async function getLibrary(): Promise<LibraryItem[]> {
  const res = await request<{ data: LibraryItem[] }>('/library');
  return res.data;
}

export interface LibraryEntry {
  analysis: VideoData;
  chat: {
    sessionId: string | null;
    messages: { id: string; role: 'user' | 'assistant'; content: string; timestamp: string }[];
  };
}

export async function getLibraryEntry(analysisId: string): Promise<LibraryEntry> {
  const res = await request<{ data: LibraryEntry }>(`/library/${analysisId}`);
  return res.data;
}

export async function setFavorite(analysisId: string, isFavorite: boolean): Promise<void> {
  await request(`/library/${analysisId}`, { method: 'PATCH', body: { isFavorite } });
}

export async function removeFromLibrary(analysisId: string): Promise<void> {
  await request(`/library/${analysisId}`, { method: 'DELETE' });
}

export async function clearChat(analysisId: string): Promise<void> {
  await request(`/library/${analysisId}/chat`, { method: 'DELETE' });
}
