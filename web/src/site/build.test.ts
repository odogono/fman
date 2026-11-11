import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, test } from 'bun:test';

import { buildSite } from './build';
import { icons } from './icons';

const outdir = await mkdtemp(join(tmpdir(), 'fman-site-'));
afterAll(() => rm(outdir, { force: true, recursive: true }));
const { precache } = await buildSite({ base: '/fman/', outdir });
const read = (file: string) => Bun.file(join(outdir, file));

/** The cache a built service worker names. */
const cacheName = (worker: string) => /"(fman-[\da-f]{16})"/.exec(worker)![1];

/** A PNG's width and height, from its header. */
const pngSize = (bytes: Uint8Array) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  return [view.getUint32(16), view.getUint32(20)];
};

test('the page links the manifest, icon and theme colour under the base', async () => {
  const html = await read('index.html').text();
  expect(html).toContain(
    '<link rel="manifest" href="/fman/manifest.webmanifest" />'
  );
  expect(html).toContain(
    '<link rel="apple-touch-icon" href="/fman/apple-touch-icon.png" />'
  );
  expect(html).toContain('<meta name="theme-color" content="#151515" />');
  expect(html).toMatch(/src="\/fman\/[^"]+\.js"/);
});

test('the manifest makes the game installable, standalone from its folder', async () => {
  const manifest = await read('manifest.webmanifest').json();
  expect(manifest).toMatchObject({
    display: 'standalone',
    name: 'Football Manager',
    scope: './',
    start_url: './'
  });
  const sizes = manifest.icons.map(
    (icon: { purpose: string; sizes: string }) =>
      `${icon.sizes} ${icon.purpose}`
  );
  expect(sizes).toEqual(['192x192 any', '512x512 any', '512x512 maskable']);
});

test('each icon is a PNG of its size', async () => {
  for (const icon of icons) {
    const bytes = await read(icon.file).bytes();
    expect([...bytes.subarray(1, 4)]).toEqual([0x50, 0x4e, 0x47]);
    expect(pngSize(bytes)).toEqual([icon.size, icon.size]);
  }
});

test('the service worker caches every file the build wrote', async () => {
  const written = (await readdir(outdir)).filter(file => file !== 'sw.js');
  expect(precache.toSorted()).toEqual(
    written.map(file => (file === 'index.html' ? './' : file)).toSorted()
  );
  const worker = await read('sw.js').text();
  for (const file of precache) {
    expect(worker).toContain(JSON.stringify(file));
  }
  expect(worker).toMatch(/"fman-[\da-f]{16}"/);
  expect(worker).not.toMatch(/\bexport\b/);
});

test('a changed build names a new cache, so players get the update', async () => {
  const again = await mkdtemp(join(tmpdir(), 'fman-site-'));
  try {
    await buildSite({ base: '/', outdir: again });
    const first = cacheName(await read('sw.js').text());
    const second = cacheName(await Bun.file(join(again, 'sw.js')).text());
    // The base is written into the page, so the page and the cache differ.
    expect(second).not.toBe(first);
  } finally {
    await rm(again, { force: true, recursive: true });
  }
});
