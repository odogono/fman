import { createApp } from './app';
import { createBeeper } from './beeper';
import { createBrowserDom, downloadFile } from './browser';
import { createStorage } from './storage';

const root = document.querySelector<HTMLElement>('#app');
if (!root) {
  throw new Error('Missing application root');
}
const { connect, dom } = createBrowserDom(root);
const app = createApp({
  beeper: createBeeper(),
  clock: {
    now: () => performance.now(),
    today: () => new Date().toISOString()
  },
  dom,
  download: downloadFile,
  print: () => window.print(),
  storage: createStorage(() => localStorage)
});
connect(app);
const tick = (now: number) => {
  app.tick(now);
  requestAnimationFrame(tick);
};
requestAnimationFrame(tick);

// The installable build links a manifest, with the offline service worker
// beside it; `bun run dev` has neither.
const manifest = document.querySelector<HTMLLinkElement>(
  'link[rel="manifest"]'
);
if (manifest && 'serviceWorker' in navigator) {
  addEventListener('load', () => {
    navigator.serviceWorker
      .register(new URL('sw.js', manifest.href))
      .catch(() => {});
  });
}
