import { createRng } from '../sim/rng';

const app = document.querySelector('#app');
if (app) {
  app.textContent = `fman: seed check ${createRng(1).int(1, 100)}`;
}
