const path = require('path');
const crypto = require('crypto');

/**
 * In-memory stand-in for the parts of supabase-js the backend uses:
 * from().select/insert/upsert/update/delete/eq/order/limit/single/maybeSingle,
 * auth.getUser(token) and storage (disabled, so lesson files stay on disk).
 *
 * Call install() BEFORE requiring anything from src/.
 */
function createFake(users) {
    const tables = {};
    const rowsOf = (t) => (tables[t] ||= []);

    function query(table) {
        const s = { op: 'select', payload: null, filters: [], order: null, limit: null, one: null, onConflict: 'id' };
        const api = {
            select() { return api; },
            insert(obj) { s.op = 'insert'; s.payload = obj; return api; },
            upsert(obj, opts = {}) { s.op = 'upsert'; s.payload = obj; s.onConflict = opts.onConflict || 'id'; return api; },
            update(obj) { s.op = 'update'; s.payload = obj; return api; },
            delete() { s.op = 'delete'; return api; },
            eq(col, val) { s.filters.push([col, val]); return api; },
            order(col, { ascending = true } = {}) { s.order = [col, ascending]; return api; },
            limit(n) { s.limit = n; return api; },
            single() { s.one = 'single'; return api; },
            maybeSingle() { s.one = 'maybe'; return api; },
            then(resolve, reject) {
                try {
                    const rows = rowsOf(table);
                    const match = (r) => s.filters.every(([c, v]) => r[c] === v);
                    const now = new Date().toISOString();
                    let data;
                    if (s.op === 'insert') {
                        data = { id: crypto.randomUUID(), created_at: now, ...s.payload };
                        rows.push(data);
                    } else if (s.op === 'upsert') {
                        const key = s.onConflict;
                        const existing = rows.find((r) => r[key] === s.payload[key]);
                        if (existing) Object.assign(existing, s.payload, { updated_at: now });
                        else rows.push({ created_at: now, updated_at: now, ...s.payload });
                        data = existing || rows[rows.length - 1];
                    } else if (s.op === 'update') {
                        data = rows.filter(match);
                        data.forEach((r) => Object.assign(r, s.payload, { updated_at: now }));
                    } else if (s.op === 'delete') {
                        tables[table] = rows.filter((r) => !match(r));
                        data = null;
                    } else {
                        data = rows.filter(match).map((r) => ({ ...r }));
                        if (s.order) {
                            const [c, asc] = s.order;
                            data.sort((a, b) => (a[c] < b[c] ? -1 : a[c] > b[c] ? 1 : 0) * (asc ? 1 : -1));
                        }
                        if (s.limit) data = data.slice(0, s.limit);
                        if (s.one) data = data[0] ?? null;
                    }
                    return Promise.resolve({ data, error: null }).then(resolve, reject);
                } catch (error) {
                    return Promise.resolve({ data: null, error }).then(resolve, reject);
                }
            },
        };
        return api;
    }

    return {
        tables,
        from: query,
        auth: {
            getUser: async (token) => (users[token]
                ? { data: { user: { email: 'x@example.com', ...users[token] } }, error: null }
                : { data: null, error: new Error('bad token') }),
        },
        storage: {
            createBucket: async () => ({ error: new Error('storage disabled in tests') }),
            from: () => ({}),
        },
    };
}

function install(users) {
    const fake = createFake(users);
    const configPath = path.join(__dirname, '../../src/config/supabase.js');
    require.cache[configPath] = {
        id: configPath, filename: configPath, loaded: true, exports: { supabase: fake, isSupabaseEnabled: true },
    };
    return fake;
}

module.exports = { install, createFake };
