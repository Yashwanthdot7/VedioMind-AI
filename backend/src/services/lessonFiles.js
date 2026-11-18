const fs = require('fs/promises');
const path = require('path');
const { supabase } = require('../config/supabase');

/**
 * Where lesson files live (lesson.json, scene-N.wav, scene-N.jpg).
 *
 * Always on the local disk, which acts as a cache. When Supabase is configured the
 * files are also kept in a private Supabase Storage bucket, because free hosts
 * (Render, Koyeb) wipe the disk on every restart or deploy. Reading checks the
 * disk first and downloads from the bucket (and re-caches) if the file is gone.
 */

const STORAGE = path.resolve(process.env.LESSON_STORAGE_DIR || path.join(__dirname, '../../storage/lessons'));
const BUCKET = process.env.LESSON_BUCKET || 'lessons';
const cloudEnabled = Boolean(supabase) && process.env.LESSON_CLOUD_STORAGE !== 'off';

const CONTENT_TYPES = {
    '.json': 'application/json', '.wav': 'audio/wav', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
};
const contentType = (name) => CONTENT_TYPES[path.extname(name).toLowerCase()] || 'application/octet-stream';

const dirOf = (id) => path.join(STORAGE, id);
const localPath = (id, name) => path.join(dirOf(id), path.basename(name));
const cloudKey = (id, name) => `${id}/${path.basename(name)}`;

let bucketReady = null;
/** Create the private bucket the first time it's needed (ignored if it already exists) */
function ensureBucket() {
    if (!cloudEnabled) return Promise.resolve(false);
    if (!bucketReady) {
        bucketReady = (async () => {
            const { error } = await supabase.storage.createBucket(BUCKET, { public: false });
            if (error && !/already exists|duplicate/i.test(error.message)) {
                console.warn(`Supabase Storage bucket "${BUCKET}" unavailable: ${error.message}. Lesson files stay on this server's disk only.`);
                return false;
            }
            return true;
        })();
    }
    return bucketReady;
}

async function put(id, name, data) {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    await fs.mkdir(dirOf(id), { recursive: true });
    await fs.writeFile(localPath(id, name), buffer);
    if (await ensureBucket()) {
        const { error } = await supabase.storage.from(BUCKET)
            .upload(cloudKey(id, name), buffer, { contentType: contentType(name), upsert: true });
        if (error) console.warn(`Uploading ${cloudKey(id, name)} failed: ${error.message}`);
    }
}

/** Only write to disk (used for frequent progress saves that don't need to survive a restart) */
async function putLocal(id, name, data) {
    await fs.mkdir(dirOf(id), { recursive: true });
    await fs.writeFile(localPath(id, name), data);
}

/** @returns {Promise<Buffer|null>} */
async function read(id, name) {
    try {
        return await fs.readFile(localPath(id, name));
    } catch {
        /* not on this disk */
    }
    if (!(await ensureBucket())) return null;
    const { data, error } = await supabase.storage.from(BUCKET).download(cloudKey(id, name));
    if (error || !data) return null;
    const buffer = Buffer.from(await data.arrayBuffer());
    await putLocal(id, name, buffer).catch(() => {});
    return buffer;
}

async function removeAll(id) {
    await fs.rm(dirOf(id), { recursive: true, force: true });
    if (!(await ensureBucket())) return;
    const { data } = await supabase.storage.from(BUCKET).list(id, { limit: 100 });
    if (data?.length) {
        await supabase.storage.from(BUCKET).remove(data.map((f) => `${id}/${f.name}`));
    }
}

module.exports = {
    STORAGE, BUCKET, cloudEnabled, contentType, dirOf, put, putLocal, read, removeAll, ensureBucket,
};
