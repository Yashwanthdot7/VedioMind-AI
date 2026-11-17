/**
 * Verifies the Supabase connection and schema.
 * Usage: npm run check:supabase
 */
require('dotenv').config();
const { supabase } = require('../src/config/supabase');

const TABLES = ['profiles', 'video_analyses', 'user_library', 'chat_sessions', 'chat_messages', 'study_materials', 'generated_videos'];
const BUCKETS = ['uploads', 'generated-videos'];

(async () => {
    if (!supabase) {
        console.error('✗ Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY in backend/.env');
        process.exit(1);
    }
    console.log(`Checking ${process.env.SUPABASE_URL}\n`);
    let ok = true;

    for (const table of TABLES) {
        const { error, count } = await supabase.from(table).select('*', { count: 'exact', head: true });
        if (error) {
            ok = false;
            const hint = error.code === '42P01' || /does not exist|schema cache/i.test(error.message)
                ? ' → run supabase/schema.sql in the SQL Editor'
                : /invalid|jwt|api key/i.test(error.message) ? ' → check SUPABASE_SECRET_KEY' : '';
            console.log(`✗ table ${table}: ${error.message}${hint}`);
        } else {
            console.log(`✓ table ${table} (${count ?? 0} rows)`);
        }
    }

    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    if (bucketError) {
        ok = false;
        console.log(`✗ storage: ${bucketError.message}`);
    } else {
        for (const name of BUCKETS) {
            const found = buckets.some((b) => b.id === name);
            if (!found) ok = false;
            console.log(`${found ? '✓' : '✗'} bucket ${name}${found ? '' : ' → run supabase/schema.sql'}`);
        }
    }

    console.log(ok ? '\nAll good — Supabase is ready.' : '\nSome checks failed (see above).');
    process.exit(ok ? 0 : 1);
})().catch((err) => {
    console.error('✗ Could not connect:', err.message);
    process.exit(1);
});
