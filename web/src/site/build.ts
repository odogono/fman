import { createHash } from 'node:crypto';
import { readdir, rm } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

import { icons, paintIcon } from './icons';

const web = resolve(import.meta.dir, '../..');
const themeColor = '#151515';

/** The web app manifest, with paths relative to it. */
export const manifest = () => ({
  background_color: themeColor,
  description: 'A recreation of the 1982 ZX Spectrum football management game.',
  display: 'standalone',
  icons: icons
    .filter(icon => icon.file !== 'apple-touch-icon.png')
    .map(({ file, purpose, size }) => ({
      purpose,
      sizes: `${size}x${size}`,
      src: file,
      type: 'image/png'
    })),
  id: './',
  name: 'Football Manager',
  scope: './',
  short_name: 'Football',
  start_url: './',
  theme_color: themeColor
});

const files = async (dir: string): Promise<string[]> =>
  (await readdir(dir, { recursive: true, withFileTypes: true }))
    .filter(entry => entry.isFile())
    .map(entry => relative(dir, join(entry.parentPath, entry.name)))
    .sort();

/** The commit being built, shown beside the version; empty outside git. */
const commit = () => {
  const git = Bun.spawnSync(['git', 'rev-parse', '--short', 'HEAD'], {
    cwd: web
  });
  return git.success ? git.stdout.toString().trim() : '';
};

const check = (output: Bun.BuildOutput) => {
  if (!output.success) {
    throw new AggregateError(output.logs, 'Build failed');
  }
};

/**
 * Builds the installable, offline web app into `outdir`, served from
 * `base`: the page and its assets, the manifest and icons, and a service
 * worker that caches every file the build wrote; and, uncached, the clip
 * debugger at `clips.html`.
 */
export const buildSite = async ({
  base,
  outdir
}: {
  base: string;
  outdir: string;
}) => {
  await rm(outdir, { force: true, recursive: true });
  check(
    await Bun.build({
      define: { FMAN_COMMIT: JSON.stringify(commit()) },
      entrypoints: [join(web, 'index.html')],
      minify: true,
      outdir,
      publicPath: base
    })
  );
  for (const icon of icons) {
    await Bun.write(join(outdir, icon.file), paintIcon(icon));
  }
  await Bun.write(
    join(outdir, 'manifest.webmanifest'),
    JSON.stringify(manifest(), null, 2)
  );

  const page = join(outdir, 'index.html');
  const html = await Bun.file(page).text();
  const head = [
    `<link rel="manifest" href="${base}manifest.webmanifest" />`,
    `<link rel="apple-touch-icon" href="${base}apple-touch-icon.png" />`,
    `<meta name="theme-color" content="${themeColor}" />`,
    '<meta name="mobile-web-app-capable" content="yes" />',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black" />'
  ].join('');
  if (!html.includes('</head>')) {
    throw new Error('The built page has no </head>');
  }
  await Bun.write(page, html.replace('</head>', `${head}</head>`));

  // The page itself is cached as the worker's start URL.
  const built = await files(outdir);
  const hash = createHash('sha256');
  for (const file of built) {
    hash.update(file).update(await Bun.file(join(outdir, file)).bytes());
  }
  const precache = built.map(file => (file === 'index.html' ? './' : file));

  // The clip debugger (#144) is published beside the game, built after the
  // precache is listed so the offline cache leaves it out.
  const clips = await Bun.build({
    entrypoints: [join(web, 'clips.html')],
    minify: true,
    outdir,
    publicPath: base
  });
  check(clips);
  const debug = clips.outputs.map(output => relative(outdir, output.path));

  check(
    await Bun.build({
      define: {
        CACHE: JSON.stringify(`fman-${hash.digest('hex').slice(0, 16)}`),
        PRECACHE: JSON.stringify(precache)
      },
      entrypoints: [join(web, 'src/offline/service-worker.ts')],
      minify: true,
      naming: 'sw.js',
      outdir
    })
  );
  return { debug, precache };
};

if (import.meta.main) {
  await buildSite({
    base: process.env.FMAN_BASE || '/',
    outdir: join(web, 'dist')
  });
}
