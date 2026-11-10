import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const output = Bun.argv[2] ?? 'build/zx/pacing.json';
const child = Bun.spawn(
  [
    'uv',
    'run',
    '--with',
    'skoolkit==10.2',
    'python',
    '-B',
    resolve(import.meta.dir, 'capture-pacing.py')
  ],
  { stderr: 'inherit', stdout: 'pipe' }
);
const result = await new Response(child.stdout).text();
if ((await child.exited) !== 0) {
  throw new Error('Original pacing capture failed');
}
JSON.parse(result);
await mkdir(dirname(output), { recursive: true });
await Bun.write(output, result);
console.log(`Wrote pacing observations to ${output}`);
