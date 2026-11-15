import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

// A headless Chromium driven over the DevTools protocol. Playwright isn't a
// dependency (docs/agents/browser-checks.md), so this finds a browser that's
// already installed: $CHROME, one Playwright downloaded, or Chrome itself.

const playwrightCaches = [
  join(homedir(), 'Library/Caches/ms-playwright'),
  join(homedir(), '.cache/ms-playwright')
];

/** The executable inside each kind of Playwright browser folder. */
const playwrightBinaries: Record<string, readonly string[]> = {
  chromium: [
    'chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium',
    'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
    'chrome-linux/chrome'
  ],
  chromium_headless_shell: [
    'chrome-headless-shell-mac-arm64/chrome-headless-shell',
    'chrome-headless-shell-mac-x64/chrome-headless-shell',
    'chrome-headless-shell-linux64/chrome-headless-shell',
    'chrome-linux/headless_shell'
  ]
};

const installed = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
];

/**
 * The browsers to try, best first: the newest Playwright headless shell,
 * then Playwright's Chromium, then an installed Chrome.
 */
export const browserCandidates = (
  folders: readonly string[],
  cache: string
): string[] => {
  const newestFirst = (kind: string) =>
    folders
      .filter(f => new RegExp(String.raw`^${kind}-\d+$`).test(f))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
      .flatMap(f => playwrightBinaries[kind]!.map(bin => join(cache, f, bin)));
  return [
    ...newestFirst('chromium_headless_shell'),
    ...newestFirst('chromium')
  ];
};

export const findBrowser = (): string => {
  const fromEnv = process.env.CHROME;
  if (fromEnv) {
    if (!existsSync(fromEnv)) {
      throw new Error(`$CHROME is ${fromEnv}, which doesn't exist`);
    }
    return fromEnv;
  }
  const candidates = [
    ...playwrightCaches.flatMap(cache =>
      existsSync(cache) ? browserCandidates(readdirSync(cache), cache) : []
    ),
    ...installed
  ];
  const found = candidates.find(path => existsSync(path));
  if (!found) {
    throw new Error(
      'No Chromium found. Set $CHROME to one, or run `bunx playwright install chromium-headless-shell`.'
    );
  }
  return found;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Waits for `ready` to return a value, polling every 200 ms. */
export const waitFor = async <T>(
  what: string,
  ready: () => Promise<T | undefined>,
  seconds = 15
): Promise<T> => {
  for (let tries = 0; tries < seconds * 5; tries++) {
    try {
      const value = await ready();
      if (value !== undefined) {
        return value;
      }
    } catch {
      // Not up yet.
    }
    await sleep(200);
  }
  throw new Error(`gave up waiting for ${what}`);
};

export type Page = {
  close: () => void;
  /** Runs an expression in the page and returns its value, awaiting a promise. */
  evaluate: <T>(expression: string) => Promise<T>;
};

/** Opens `url` in a fresh headless browser with a 1100 × 1300 window. */
export const openPage = async (url: string, port = 9333): Promise<Page> => {
  const profile = mkdtempSync(join(tmpdir(), 'clips-record-'));
  const browser = spawn(
    findBrowser(),
    [
      '--headless',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--window-size=1100,1300',
      'about:blank'
    ],
    { stdio: 'ignore' }
  );
  const close = () => {
    browser.kill();
    rmSync(profile, { force: true, recursive: true });
  };
  try {
    const target = await waitFor('the browser', async () => {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = (await response.json()) as {
        type: string;
        webSocketDebuggerUrl: string;
      }[];
      return targets.find(t => t.type === 'page');
    });
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(resolve =>
      socket.addEventListener('open', resolve, { once: true })
    );
    let id = 0;
    const waiting = new Map<number, (message: Reply) => void>();
    type Reply = {
      error?: { message: string };
      id?: number;
      result?: {
        exceptionDetails?: { exception?: { description?: string } };
        result?: { value?: unknown };
      };
    };
    socket.addEventListener('message', event => {
      const message = JSON.parse(String(event.data)) as Reply;
      if (message.id !== undefined) {
        waiting.get(message.id)?.(message);
        waiting.delete(message.id);
      }
    });
    const send = (method: string, params: object = {}) =>
      new Promise<Reply>(resolve => {
        const n = ++id;
        waiting.set(n, resolve);
        socket.send(JSON.stringify({ id: n, method, params }));
      });
    const evaluate = async <T>(expression: string): Promise<T> => {
      const reply = await send('Runtime.evaluate', {
        awaitPromise: true,
        expression,
        returnByValue: true
      });
      const failure =
        reply.error?.message ??
        reply.result?.exceptionDetails?.exception?.description;
      if (failure) {
        throw new Error(failure);
      }
      return reply.result?.result?.value as T;
    };
    await send('Emulation.setDeviceMetricsOverride', {
      deviceScaleFactor: 2,
      height: 1300,
      mobile: false,
      width: 1100
    });
    await send('Page.navigate', { url });
    return {
      close: () => {
        socket.close();
        close();
      },
      evaluate
    };
  } catch (error) {
    close();
    throw error;
  }
};
