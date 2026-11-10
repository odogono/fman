import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const [script = '--verify-clock', output = 'build/zx/timing.json'] =
  Bun.argv.slice(2);
const child = Bun.spawn(
  [
    'uv',
    'run',
    '--with',
    'skoolkit==10.2',
    'python',
    '-B',
    resolve(import.meta.dir, 'capture_timing.py'),
    script
  ],
  { stderr: 'inherit', stdout: 'pipe' }
);
const result = await new Response(child.stdout).text();
if ((await child.exited) !== 0) {
  throw new Error('Timing reference capture failed');
}
JSON.parse(result);
await mkdir(dirname(output), { recursive: true });
await Bun.write(output, result);
console.log(`Wrote timing observations to ${output}`);
