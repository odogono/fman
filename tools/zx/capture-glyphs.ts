// Optional reference capture. Only pixel hashes/metadata leave the emulator.
const [snapshot, output = 'build/zx/glyphs.json'] = Bun.argv.slice(2);
if (!snapshot) {
  throw new Error(
    'Usage: bun tools/zx/capture-glyphs.ts <snapshot.z80> [output.json]'
  );
}
const child = Bun.spawn(
  [
    'uv',
    'run',
    '--with',
    'skoolkit==10.2',
    'python',
    `${import.meta.dir}/capture-glyphs.py`,
    snapshot,
    output
  ],
  { stderr: 'inherit', stdout: 'inherit' }
);
if ((await child.exited) !== 0) {
  throw new Error('Original glyph capture failed');
}
