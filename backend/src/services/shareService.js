const crypto = require('crypto');
const { supabase } = require('../config/supabase');
const lessonJobs = require('./lessonJobs');
const courseJobs = require('./courseJobs');

/**
 * Class links: a teacher makes one of their lessons or courses public and gets a
 * short link (?s=<slug>). Anyone with it can watch, no account needed.
 * Only account-owned items can be shared; guests' lessons already work by link.
 */

const SLUG_RE = /^[A-Za-z0-9_-]{8,16}$/;
const index = new Map(); // slug -> { kind, id }, for items shared since this server started

const newSlug = () => crypto.randomBytes(7).toString('base64url'); // 10 characters, URL-safe
const isSlug = (s) => SLUG_RE.test(String(s || ''));

async function setShared(kind, item, isPublic) {
    const shareSlug = item.shareSlug || newSlug();
    index.set(shareSlug, { kind, id: item.id });
    const updated = kind === 'course'
        ? await courseJobs.setSharing(item, { isPublic, shareSlug })
        : await lessonJobs.setSharing(item, { isPublic, shareSlug });
    return { isPublic: Boolean(isPublic), shareSlug, item: updated };
}

/** @returns {Promise<{ kind: 'lesson'|'course', id: string } | null>} only if it is public right now */
async function resolve(slug) {
    if (!isSlug(slug)) return null;
    let hit = index.get(slug) || null;
    if (!hit && supabase) {
        const [lessonRow, courseRow] = await Promise.all([
            supabase.from('generated_videos').select('id').eq('share_slug', slug).maybeSingle(),
            supabase.from('courses').select('id').eq('share_slug', slug).maybeSingle(),
        ]);
        if (courseRow.data) hit = { kind: 'course', id: courseRow.data.id };
        else if (lessonRow.data) hit = { kind: 'lesson', id: lessonRow.data.id };
        if (hit) index.set(slug, hit);
    }
    if (!hit) return null;
    const item = hit.kind === 'course' ? await courseJobs.get(hit.id) : await lessonJobs.get(hit.id);
    if (!item || !item.isPublic || item.shareSlug !== slug) return null;
    return { kind: hit.kind, id: hit.id, title: item.title };
}

module.exports = { setShared, resolve, isSlug, newSlug };
