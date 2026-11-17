const test = require('node:test');
const assert = require('node:assert/strict');

process.env.POLLINATIONS_MIN_GAP_MS = '0';
const imageService = require('../src/services/imageService');

const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(5000)]);
const cfOk = () => ({ ok: true, status: 200, json: async () => ({ success: true, result: { image: jpeg.toString('base64') } }) });
const cfLimit = () => ({ ok: false, status: 429, json: async () => ({ success: false, errors: [{ message: 'daily free allocation of neurons exceeded' }] }) });
const pollOk = () => ({ ok: true, status: 200, headers: { get: () => 'image/jpeg' }, arrayBuffer: async () => jpeg });
const pollBad = () => ({ ok: false, status: 502, headers: { get: () => 'text/html' }, arrayBuffer: async () => Buffer.alloc(0) });

function setup(handler) {
    const calls = [];
    imageService.fetch = async (url, opts) => { calls.push({ url, opts }); return handler(url, calls.length); };
    imageService.cloudflareExhaustedUntil = 0;
    return calls;
}

test('uses Cloudflare FLUX when configured', async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acc123';
    process.env.CLOUDFLARE_API_TOKEN = 'tok';
    const calls = setup(() => cfOk());
    const out = await imageService.generate('a volcano', { audience: 'kids', seed: 1 });
    assert.equal(out.provider, 'cloudflare');
    assert.equal(out.buffer.length, jpeg.length);
    assert.match(calls[0].url, /accounts\/acc123\/ai\/run\/@cf\/black-forest-labs\/flux-1-schnell/);
    const body = JSON.parse(calls[0].opts.body);
    assert.match(body.prompt, /a volcano/);
    assert.match(body.prompt, /3D render/, '3D style added');
    assert.match(body.prompt, /Pixar-like/, 'kids get the friendly 3D style');
    assert.match(body.prompt, /no text/);
    assert.equal(calls[0].opts.headers.Authorization, 'Bearer tok');
});

test('falls back to Pollinations when the Cloudflare daily limit is hit, and skips Cloudflare until reset', async () => {
    const calls = setup((url) => (url.includes('cloudflare') ? cfLimit() : pollOk()));
    const out = await imageService.generate('a volcano', { seed: 2 });
    assert.equal(out.provider, 'pollinations');
    assert.ok(imageService.cloudflareExhaustedUntil > Date.now());
    assert.match(calls[1].url, /image\.pollinations\.ai\/prompt\/.*width=1280&height=720/);

    const before = calls.length;
    await imageService.generate('another', { seed: 3 });
    assert.equal(calls.length - before, 1, 'Cloudflare skipped after quota');
    assert.ok(!calls[calls.length - 1].url.includes('cloudflare'));
});

test('works with no Cloudflare account at all (Pollinations only)', async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = '';
    process.env.CLOUDFLARE_API_TOKEN = '';
    const calls = setup(() => pollOk());
    const out = await imageService.generate('rainbow');
    assert.equal(out.provider, 'pollinations');
    assert.equal(calls.length, 1);
    assert.ok(imageService.enabled());
});

test('reports IMAGE_FAILED when every free provider fails', async () => {
    setup(() => pollBad());
    await assert.rejects(() => imageService.generate('rainbow'), { code: 'IMAGE_FAILED' });
});

test('can be fully disabled', () => {
    process.env.POLLINATIONS_DISABLED = 'true';
    assert.equal(imageService.enabled(), false);
    delete process.env.POLLINATIONS_DISABLED;
});
