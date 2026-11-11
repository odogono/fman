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

const showUpdateReady = () => {
  const bar = document.createElement('p');
  bar.className = 'update-ready';
  bar.setAttribute('role', 'status');
  bar.textContent = 'A new version is ready. ';
  const reload = document.createElement('button');
  reload.type = 'button';
  reload.textContent = 'Reload';
  reload.addEventListener('click', () => location.reload());
  bar.append(reload);
  root?.append(bar);
};

// The installable build links a manifest, with the offline service worker
// beside it; `bun run dev` has neither.
const manifest = document.querySelector<HTMLLinkElement>(
  'link[rel="manifest"]'
);
if (manifest && 'serviceWorker' in navigator) {
  // A page already run by a worker gets a new one only when a new build
  // has installed; the first install also takes control, but changes
  // nothing on screen, so it shows no prompt.
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      showUpdateReady,
      { once: true }
    );
  }
  addEventListener('load', () => {
    navigator.serviceWorker
      .register(new URL('sw.js', manifest.href))
      .catch(() => {});
  });
}
