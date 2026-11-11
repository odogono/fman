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
