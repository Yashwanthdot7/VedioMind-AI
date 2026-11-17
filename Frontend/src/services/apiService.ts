import { supabase } from '../lib/supabase';
import { LibraryItem, Message, StudyDataMap, StudyLevel, StudyType, VideoData } from '../types';

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
