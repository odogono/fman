import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';

import { clipFps } from '../../web/src/view/clips';
import { openPage, waitFor, type Page } from './browser';
import {
  inMatchOrder,
  parseOptions,
  usage,
  withDefaults,
  type Options
} from './scenarios';

// `bun run clips:record`: records Modern-mode highlight clips from the clip
// debugger (web/clips.html) in headless Chromium, one MP4 per scenario, for
// checking a change to the clips by eye or showing it in a PR. See README.md.

const root = resolve(import.meta.dir, '../..');

const freePort = () =>
  new Promise<number>((done, fail) => {
    const server = createServer();
    server.once('error', fail);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() =>
        typeof address === 'object' && address
          ? done(address.port)
          : fail(new Error('no port'))
      );
    });
  });

/** Serves the clip debugger as `bun run dev` does, without hot reload. */
const serveDebugger = async () => {
  const port = await freePort();
  const server = spawn(
    'bun',
    ['--port', String(port), './index.html', './clips.html'],
    { cwd: join(root, 'web'), stdio: 'ignore' }
  );
  const url = `http://localhost:${port}/clips`;
  await waitFor('the clip debugger', async () =>
    (await fetch(url)).ok ? true : undefined
  );
  return { stop: () => server.kill(), url };
};

type ClipInfo = {
  attackingUp: boolean;
  finish: string;
  length: number;
  moment: number;
  outcome: string;
  rebound: boolean;
  restart: string;
};

/** Joins the JPEG frames in `frames` into `video` at the clips' speed. */
const encode = (frames: string, video: string, options: Options) => {
  const ffmpeg = spawnSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-framerate',
    String(clipFps / options.step),
    '-i',
    join(frames, '%05d.jpg'),
    '-vf',
    'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-pix_fmt',
    'yuv420p',
    '-c:v',
    'libx264',
    '-crf',
    '20',
    video
  ]);
  if (ffmpeg.error || ffmpeg.status !== 0) {
    throw new Error(
      ffmpeg.error
        ? `ffmpeg didn't run (${ffmpeg.error.message}); the frames are in ${frames}`
        : String(ffmpeg.stderr)
    );
  }
};

/** Writes each JPEG data URL in `shots` to `frames`, numbered from `n`. */
const writeShots = (frames: string, shots: readonly string[], n: number) =>
  shots.reduce((k, shot) => {
    writeFileSync(
      join(frames, `${String(k).padStart(5, '0')}.jpg`),
      Buffer.from(shot.slice(shot.indexOf(',') + 1), 'base64')
    );
    return k + 1;
  }, n);

/**
 * Records the scenarios as one video, as a match's highlights play them:
 * the kick-off still, each clip in minute order, then the full-time still,
 * wiped between.
 */
const recordSequence = async (page: Page, options: Options, out: string) => {
  const scenarios = inMatchOrder(options.scenarios);
  const lengths = await page.evaluate<number[]>(
    `clipDebug.sequence(${JSON.stringify(scenarios.map(s => withDefaults(s.settings)))})`
  );
  const frames = join(out, 'sequence-frames');
  rmSync(frames, { force: true, recursive: true });
  mkdirSync(frames, { recursive: true });
  let n = 0;
  const batch = 12;
  for (const [index, length] of lengths.entries()) {
    for (let at = 0; at < length; at += options.step * batch) {
      const shots = await page.evaluate<string[]>(`(() => {
        const canvas = document.querySelector('.clip-pitch');
        const shots = [];
        for (let k = 0; k < ${batch}; k++) {
          const frame = ${at} + k * ${options.step};
          if (frame >= ${length}) break;
          clipDebug.paintSequence(${index}, frame);
          shots.push(canvas.toDataURL('image/jpeg', 0.9));
        }
        return shots;
      })()`);
      n = writeShots(frames, shots, n);
    }
  }
  const video = join(out, 'sequence.mp4');
  encode(frames, video, options);
  if (!options.frames) {
    rmSync(frames, { force: true, recursive: true });
  }
  const line = [
    'sequence:',
    scenarios.map(s => `${s.name} (${s.settings.minute}′)`).join(', '),
    `-> ${video}`
  ].join(' ');
  console.log(line);
  writeFileSync(join(out, 'summary.txt'), `${line}\n`);
};

const record = async (options: Options) => {
  const served = options.url ? undefined : await serveDebugger();
  const url = options.url ?? served!.url;
  const page = await openPage(url);
  const summary: string[] = [];
  try {
    await waitFor('the clip debugger to load', () =>
      page.evaluate<boolean | undefined>(
        "typeof globalThis.clipDebug?.set === 'function' || undefined"
      )
    );
    const out = resolve(options.out);
    mkdirSync(out, { recursive: true });
    if (options.sequence) {
      await recordSequence(page, options, out);
      return;
    }
    const batch = 12;
    for (const scenario of options.scenarios) {
      const info = await page.evaluate<ClipInfo>(`(() => {
        clipDebug.set(${JSON.stringify(withDefaults(scenario.settings))});
        const s = clipDebug.script;
        return { attackingUp: s.input.attackingUp, finish: s.finish, length: s.length, moment: s.momentFrame, outcome: s.outcome, rebound: s.rebound, restart: s.restart };
      })()`);
      const frames = join(out, `${scenario.name}-frames`);
      rmSync(frames, { force: true, recursive: true });
      mkdirSync(frames, { recursive: true });
      let n = 0;
      // A batch of frames per round trip: each comes back as a JPEG data URL.
      for (let at = 0; at < info.length; at += options.step * batch) {
        const shots = await page.evaluate<string[]>(`(() => {
          const canvas = document.querySelector('.clip-pitch');
          const shots = [];
          for (let k = 0; k < ${batch}; k++) {
            const frame = ${at} + k * ${options.step};
            if (frame >= clipDebug.script.length) break;
            clipDebug.paint(frame);
            shots.push(canvas.toDataURL('image/jpeg', 0.9));
          }
          return shots;
        })()`);
        n = writeShots(frames, shots, n);
      }
      const video = join(out, `${scenario.name}.mp4`);
      encode(frames, video, options);
      if (!options.frames) {
        rmSync(frames, { force: true, recursive: true });
      }
      const line = [
        `${scenario.name}:`,
        `seed ${scenario.settings.seedBase ?? 1},`,
        `${info.restart}, ${info.finish}${info.rebound ? ' after a rebound' : ''}, ${info.outcome},`,
        `attacking ${info.attackingUp ? 'up' : 'down'},`,
        `${(info.length / clipFps).toFixed(1)} s, moment at ${(info.moment / clipFps).toFixed(1)} s`,
        `-> ${video}`
      ].join(' ');
      summary.push(line);
      console.log(line);
    }
    writeFileSync(join(out, 'summary.txt'), `${summary.join('\n')}\n`);
  } finally {
    page.close();
    served?.stop();
  }
};

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(usage);
  process.exit(0);
}
let options: Options;
try {
  options = parseOptions(args);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
await record(options);
