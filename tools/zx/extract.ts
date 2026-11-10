import { mkdir } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

// Token order is the 48K Spectrum character set, 0xA5 through 0xFF.
const tokens = [
  'RND',
  'INKEY$',
  'PI',
  'FN',
  'POINT',
  'SCREEN$',
  'ATTR',
  'AT',
  'TAB',
  'VAL$',
  'CODE',
  'VAL',
  'LEN',
  'SIN',
  'COS',
  'TAN',
  'ASN',
  'ACS',
  'ATN',
  'LN',
  'EXP',
  'INT',
  'SQR',
  'SGN',
  'ABS',
  'PEEK',
  'IN',
  'USR',
  'STR$',
  'CHR$',
  'NOT',
  'BIN',
  'OR',
  'AND',
  '<=',
  '>=',
  '<>',
  'LINE',
  'THEN',
  'TO',
  'STEP',
  'DEF FN',
  'CAT',
  'FORMAT',
  'MOVE',
  'ERASE',
  'OPEN #',
  'CLOSE #',
  'MERGE',
  'VERIFY',
  'BEEP',
  'CIRCLE',
  'INK',
  'PAPER',
  'FLASH',
  'BRIGHT',
  'INVERSE',
  'OVER',
  'OUT',
  'LPRINT',
  'LLIST',
  'STOP',
  'READ',
  'DATA',
  'RESTORE',
  'NEW',
  'BORDER',
  'CONTINUE',
  'DIM',
  'REM',
  'FOR',
  'GO TO',
  'GO SUB',
  'INPUT',
  'LOAD',
  'LIST',
  'LET',
  'PAUSE',
  'NEXT',
  'POKE',
  'PRINT',
  'PLOT',
  'RUN',
  'SAVE',
  'RANDOMIZE',
  'IF',
  'CLS',
  'DRAW',
  'CLEAR',
  'RETURN',
  'COPY'
];

const word = (bytes: Uint8Array, address: number) =>
  bytes[address]! + 256 * bytes[address + 1]!;

export const readSnapshot = (bytes: Uint8Array) => {
  if (bytes.length < 30 || word(bytes, 6) === 0) {
    throw new Error('Expected a v1 (48K) Z80 snapshot with a nonzero PC');
  }
  const flags = bytes[12] === 255 ? 1 : bytes[12]!;
  const compressed = Boolean(flags & 32);
  const ram = new Uint8Array(49_152);
  let output = 0;
  let input = 30;
  let terminated = !compressed;
  if (!compressed) {
    if (bytes.length !== 49_182) {
      throw new Error('Expected exactly 48K RAM');
    }
    ram.set(bytes.subarray(30));
  } else {
    while (input < bytes.length) {
      if (
        bytes[input] === 0 &&
        bytes[input + 1] === 237 &&
        bytes[input + 2] === 237 &&
        bytes[input + 3] === 0
      ) {
        input += 4;
        terminated = true;
        break;
      }
      if (bytes[input] === 237 && bytes[input + 1] === 237) {
        if (input + 3 >= bytes.length || bytes[input + 2] === 0) {
          throw new Error('Invalid or truncated RLE run');
        }
        const count = bytes[input + 2]!;
        if (output + count > ram.length) {
          throw new Error('RAM overflow');
        }
        ram.fill(bytes[input + 3]!, output, output + count);
        output += count;
        input += 4;
      } else {
        if (output >= ram.length) {
          throw new Error('RAM overflow');
        }
        ram[output++] = bytes[input++]!;
      }
    }
    if (!terminated || output !== ram.length || input !== bytes.length) {
      throw new Error('Expected 48K RAM followed by the v1 end marker');
    }
  }
  return { compressed, pc: word(bytes, 6), ram };
};

export const decodeNumber = (bytes: readonly number[]) => {
  if (bytes.length !== 5) {
    throw new Error('Expected five numeric bytes');
  }
  if (bytes[0] === 0) {
    return bytes[2]! + 256 * bytes[3]! - (bytes[1] ? 65_536 : 0);
  }
  const mantissa =
    (bytes[1]! | 128) * 16_777_216 +
    bytes[2]! * 65_536 +
    bytes[3]! * 256 +
    bytes[4]!;
  return (bytes[1]! & 128 ? -1 : 1) * mantissa * 2 ** (bytes[0]! - 160);
};

const character = (byte: number) => {
  if (byte === 94) {
    return '↑';
  }
  if (byte === 96) {
    return '£';
  }
  if (byte === 127) {
    return '©';
  }
  if (byte >= 32 && byte <= 126) {
    return String.fromCharCode(byte);
  }
  if (byte >= 144 && byte <= 164) {
    return `{UDG-${String.fromCharCode(byte - 79)}}`;
  }
  return `{0x${byte.toString(16).padStart(2, '0').toUpperCase()}}`;
};

type BasicLine = {
  address: number;
  number: number;
  numbers: { address: number; bytes: number[]; value: number }[];
  raw: number[];
  text: string;
};

export const extractBasic = (memory: Uint8Array): BasicLine[] => {
  if (memory.length !== 65_536) {
    throw new Error('Expected 64K address space');
  }
  let address = word(memory, 23_635);
  const end = word(memory, 23_627);
  if (address < 23_755 || end < address) {
    throw new Error('Invalid PROG/VARS bounds');
  }
  const lines: BasicLine[] = [];
  let previous = -1;
  while (address < end) {
    if (address + 4 > end) {
      throw new Error('Truncated line header');
    }
    const number = memory[address]! * 256 + memory[address + 1]!;
    const length = word(memory, address + 2);
    const next = address + 4 + length;
    if (
      number > 9999 ||
      number <= previous ||
      length < 1 ||
      next > end ||
      memory[next - 1] !== 13
    ) {
      throw new Error(`Invalid BASIC line at ${address}`);
    }
    const raw = [...memory.subarray(address + 4, next)];
    const numbers: BasicLine['numbers'] = [];
    let text = '';
    let quoted = false;
    let comment = false;
    for (let cursor = address + 4; cursor < next - 1; cursor++) {
      const byte = memory[cursor]!;
      if (byte === 14 && !quoted && !comment) {
        if (cursor + 5 >= next - 1) {
          throw new Error('Truncated numeric payload');
        }
        const bytes = [...memory.subarray(cursor + 1, cursor + 6)];
        numbers.push({ address: cursor, bytes, value: decodeNumber(bytes) });
        cursor += 5;
      } else if (byte >= 16 && byte <= 23) {
        const size = byte >= 22 ? 2 : 1;
        if (cursor + size >= next - 1) {
          throw new Error('Truncated display control');
        }
        const name = [
          'INK',
          'PAPER',
          'FLASH',
          'BRIGHT',
          'INVERSE',
          'OVER',
          'AT',
          'TAB'
        ][byte - 16];
        text += `{${name} ${[...memory.subarray(cursor + 1, cursor + size + 1)].join(',')}}`;
        cursor += size;
      } else if (byte >= 165 && !quoted && !comment) {
        text += ` ${tokens[byte - 165]} `;
        if (byte === 234) {
          comment = true;
        }
      } else {
        text += character(byte);
        if (byte === 34 && !comment) {
          quoted = !quoted;
        }
      }
    }
    lines.push({ address, number, numbers, raw, text: text.trim() });
    previous = number;
    address = next;
  }
  return lines;
};

if (import.meta.main) {
  const [input, destination = 'roms/zx/analysis'] = Bun.argv.slice(2);
  if (!input) {
    throw new Error(
      'Usage: bun tools/zx/extract.ts <snapshot.z80> [roms/output-dir]'
    );
  }
  const output = resolve(destination);
  if (!output.startsWith(resolve('roms') + sep)) {
    throw new Error(
      'Extracted original material must remain under gitignored roms/'
    );
  }
  const bytes = new Uint8Array(await Bun.file(input).arrayBuffer());
  const { ram, ...header } = readSnapshot(bytes);
  const memory = new Uint8Array(65_536);
  memory.set(ram, 16_384);
  const lines = extractBasic(memory);
  const metadata = {
    ...header,
    basicBytes: word(memory, 23_627) - word(memory, 23_635),
    lineCount: lines.length,
    prog: word(memory, 23_635),
    ramtop: word(memory, 23_730),
    seed: word(memory, 23_670),
    sha256: new Bun.CryptoHasher('sha256').update(bytes).digest('hex'),
    storedNumbers: lines.reduce((sum, line) => sum + line.numbers.length, 0),
    vars: word(memory, 23_627)
  };
  await mkdir(output, { recursive: true });
  await Bun.write(resolve(output, 'ram.bin'), ram);
  await Bun.write(
    resolve(output, 'basic.json'),
    JSON.stringify(lines, null, 2) + '\n'
  );
  await Bun.write(
    resolve(output, 'metadata.json'),
    JSON.stringify(metadata, null, 2) + '\n'
  );
  await Bun.write(
    resolve(output, 'listing.bas'),
    lines.map(line => `${line.number} ${line.text}`).join('\n') + '\n'
  );
  console.log(JSON.stringify(metadata, null, 2));
}
