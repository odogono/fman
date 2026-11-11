// Optional reference capture: full native observations, no original assets.
const [menu, bills, output = 'build/zx/name-print.json'] = Bun.argv.slice(2);
if (!menu || !bills) {
  throw new Error(
    'Usage: bun tools/zx/capture-name-print.ts <24-fresh-menu.z80> <10-bills.z80> [output.json]'
  );
}
const child = Bun.spawn(
  [
    'uv',
    'run',
    '--with',
    'skoolkit==10.2',
    'python',
    `${import.meta.dir}/capture-name-print.py`,
    menu,
    bills,
    output
  ],
  { stderr: 'inherit', stdout: 'inherit' }
);
if ((await child.exited) !== 0) {
  throw new Error('Original name PRINT capture failed');
}
