const { supabase } = require('../config/supabase');
const { analysisCache, analysisKey } = require('../lib/memoryCache');
const AppError = require('../lib/AppError');

/**
 * Persistence layer: in-memory cache first, then Supabase (if configured).
 * All functions are safe to call when Supabase is disabled.
 */

const ANALYSIS_COLUMNS = 'id, youtube_id, language, title, author, duration_sec, thumbnail_url, transcript, summary, key_takeaways, created_at';

function rowToAnalysis(row) {
    return {
        analysisId: row.id,
        videoId: row.youtube_id,
        language: row.language,
        title: row.title,
        transcript: row.transcript || [],
        summary: row.summary || '',
        keyTakeaways: row.key_takeaways || [],
        metadata: {
            duration: row.duration_sec,
            author: row.author,
            thumbnail: row.thumbnail_url,
        },
        createdAt: row.created_at,
    };
}

function dbError(error, action) {
    console.error(`Supabase error while ${action}:`, error.message || error);
    return new AppError(`Database error while ${action}`, 500, 'DB_ERROR');
}

// ---------------------------------------------------------------- analyses

async function findAnalysis(videoId, language) {
    const cached = analysisCache.get(analysisKey(videoId, language));
    if (cached) return cached;
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('video_analyses')
        .select(ANALYSIS_COLUMNS)
        .eq('youtube_id', videoId)
        .eq('language', language)
        .maybeSingle();

    if (error) {
        // A cache miss must never break processing
        console.warn('Cache lookup failed:', error.message);
        return null;
    }
    if (!data) return null;

    const analysis = rowToAnalysis(data);
    analysisCache.set(analysisKey(videoId, language), analysis);
    return analysis;
}

async function getAnalysisById(analysisId) {
    if (!supabase) return null;
    const { data, error } = await supabase
        .from('video_analyses')
        .select(ANALYSIS_COLUMNS)
        .eq('id', analysisId)
        .maybeSingle();
    if (error) throw dbError(error, 'loading the video');
    return data ? rowToAnalysis(data) : null;
}

/**
 * Save a freshly generated analysis. Returns it with analysisId set
 * (null when Supabase is disabled or the save failed).
 */
async function saveAnalysis(analysis, userId = null) {
    let saved = { ...analysis, analysisId: null };

    if (supabase) {
        const { data, error } = await supabase
            .from('video_analyses')
            .upsert({
                source: 'youtube',
                youtube_id: analysis.videoId,
                language: analysis.language,
                title: analysis.title,
                author: analysis.metadata?.author ?? null,
                duration_sec: analysis.metadata?.duration ?? null,
                thumbnail_url: analysis.metadata?.thumbnail ?? null,
                transcript: analysis.transcript,
                summary: analysis.summary,
                key_takeaways: analysis.keyTakeaways,
                created_by: userId,
            }, { onConflict: 'youtube_id,language' })
            .select(ANALYSIS_COLUMNS)
            .single();

        if (error) {
            console.warn('Saving analysis failed (continuing without DB):', error.message);
        } else {
            saved = rowToAnalysis(data);
        }
    }

    analysisCache.set(analysisKey(saved.videoId, saved.language), saved);
    return saved;
}

// ---------------------------------------------------------------- library

async function addToLibrary(userId, analysisId) {
    if (!supabase || !userId || !analysisId) return;
    const { error } = await supabase
        .from('user_library')
        .upsert({ user_id: userId, analysis_id: analysisId }, { onConflict: 'user_id,analysis_id', ignoreDuplicates: true });
    if (error) console.warn('Adding to library failed:', error.message);
}

async function listLibrary(userId) {
    const { data, error } = await supabase
        .from('user_library')
        .select('added_at, is_favorite, video_analyses ( id, youtube_id, language, title, author, duration_sec, thumbnail_url )')
        .eq('user_id', userId)
        .order('added_at', { ascending: false })
        .limit(200);

    if (error) throw dbError(error, 'loading your library');

    return (data || [])
        .filter((row) => row.video_analyses)
        .map((row) => ({
            analysisId: row.video_analyses.id,
            videoId: row.video_analyses.youtube_id,
            language: row.video_analyses.language,
            title: row.video_analyses.title,
            author: row.video_analyses.author,
            duration: row.video_analyses.duration_sec,
            thumbnail: row.video_analyses.thumbnail_url,
            isFavorite: row.is_favorite,
            addedAt: row.added_at,
        }));
}

async function isInLibrary(userId, analysisId) {
    const { data, error } = await supabase
        .from('user_library')
        .select('analysis_id')
        .eq('user_id', userId)
        .eq('analysis_id', analysisId)
        .maybeSingle();
    if (error) throw dbError(error, 'checking your library');
    return Boolean(data);
}

async function removeFromLibrary(userId, analysisId) {
    const { error } = await supabase
        .from('user_library')
        .delete()
        .eq('user_id', userId)
        .eq('analysis_id', analysisId);
    if (error) throw dbError(error, 'removing the video');
}

async function setFavorite(userId, analysisId, isFavorite) {
    const { error } = await supabase
        .from('user_library')
        .update({ is_favorite: Boolean(isFavorite) })
        .eq('user_id', userId)
        .eq('analysis_id', analysisId);
    if (error) throw dbError(error, 'updating the video');
}

// ---------------------------------------------------------------- chat

/** One chat session per user per video keeps the UI simple */
async function getOrCreateSession(userId, analysisId, title) {
    const { data: existing, error: findError } = await supabase
        .from('chat_sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('analysis_id', analysisId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (findError) throw dbError(findError, 'loading the chat');
    if (existing) return existing.id;

    const { data, error } = await supabase
        .from('chat_sessions')
        .insert({ user_id: userId, analysis_id: analysisId, title: title?.slice(0, 200) || null })
        .select('id')
        .single();
    if (error) throw dbError(error, 'starting the chat');
    return data.id;
}

async function appendMessages(sessionId, messages) {
    const { error } = await supabase
        .from('chat_messages')
        .insert(messages.map((m) => ({ session_id: sessionId, role: m.role, content: m.content })));
    if (error) console.warn('Saving chat messages failed:', error.message);
}

async function getChatHistory(userId, analysisId) {
    const { data: session, error } = await supabase
        .from('chat_sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('analysis_id', analysisId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) throw dbError(error, 'loading the chat');
    if (!session) return { sessionId: null, messages: [] };

    const { data: messages, error: msgError } = await supabase
        .from('chat_messages')
        .select('id, role, content, created_at')
        .eq('session_id', session.id)
        .order('created_at', { ascending: true })
        .limit(500);
    if (msgError) throw dbError(msgError, 'loading the chat');

    return {
        sessionId: session.id,
        messages: (messages || []).map((m) => ({
            id: String(m.id),
            role: m.role,
            content: m.content,
            timestamp: m.created_at,
        })),
    };
}

async function clearChatHistory(userId, analysisId) {
    const { error } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('user_id', userId)
        .eq('analysis_id', analysisId);
    if (error) throw dbError(error, 'clearing the chat');
}

module.exports = {
    findAnalysis,
    getAnalysisById,
    saveAnalysis,
    addToLibrary,
    listLibrary,
    isInLibrary,
    removeFromLibrary,
    setFavorite,
    getOrCreateSession,
    appendMessages,
    getChatHistory,
    clearChatHistory,
};
