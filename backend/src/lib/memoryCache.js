/**
 * Tiny in-memory LRU cache with TTL.
 * Used so chat requests don't have to send the full transcript every time,
 * and so re-processing the same video is instant even without Supabase.
 */
class MemoryCache {
    constructor({ maxEntries = 50, ttlMs = 6 * 60 * 60 * 1000 } = {}) {
        this.maxEntries = maxEntries;
        this.ttlMs = ttlMs;
        this.store = new Map();
    }

    get(key) {
        const entry = this.store.get(key);
        if (!entry) return undefined;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return undefined;
        }
        // refresh LRU position
        this.store.delete(key);
        this.store.set(key, entry);
        return entry.value;
    }

    set(key, value) {
        if (this.store.has(key)) this.store.delete(key);
        this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
        while (this.store.size > this.maxEntries) {
            const oldestKey = this.store.keys().next().value;
            this.store.delete(oldestKey);
        }
    }
}

const analysisCache = new MemoryCache();

const analysisKey = (videoId, language) => `${videoId}:${language}`;

module.exports = { MemoryCache, analysisCache, analysisKey };
