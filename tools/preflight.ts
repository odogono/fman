#!/usr/bin/env bun
// Fail `bun run check` with a clear message, rather than `tsc: command not
// found`, in a checkout that has not run `bun install`.
import { existsSync } from 'node:fs';

for (const dir of ['node_modules', 'web/node_modules']) {
  if (!existsSync(dir)) {
    console.error(`${dir} is missing: run \`bun install\` in this checkout`);
    process.exit(1);
  }
}
