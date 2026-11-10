import { existsSync, lstatSync, symlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Worktrees start without the gitignored `roms/`. Link it to the main
// checkout's copy so originals and `roms/zx/analysis/` are shared.
const root = resolve(import.meta.dir, '../..');
const target = resolve(root, 'roms');
const commonDir = Bun.spawnSync(
  ['git', 'rev-parse', '--path-format=absolute', '--git-common-dir'],
  { cwd: root }
)
  .stdout.toString()
  .trim();
const source = resolve(dirname(commonDir), 'roms');

if (existsSync(target) || lstatSync(target, { throwIfNoEntry: false })) {
  console.log(`roms/ already present at ${target}`);
} else if (source === target || !existsSync(source)) {
  console.error(`No roms/ found in the main checkout (${source}).`);
  process.exit(1);
} else {
  symlinkSync(source, target, 'dir');
  console.log(`Linked roms/ -> ${source}`);
}
