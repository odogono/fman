# Browser checks

For a change to see in the real app (layout, touch controls, the game menu, the PWA). Behaviour belongs in tests first: `web/src/view/app.test.ts` drives the whole app headlessly.

## Running

- `bun run dev` serves `web/index.html` with hot reload; pass a fixed port, as in `cd web && bun --port 3147 ./index.html`, so the preview URL is known. Stop it when done.
- The service worker and install prompt exist only in the built site: `bun run build`, then serve `web/dist`.
- Use the T3 preview tools (`preview_open`, `preview_evaluate`, `preview_snapshot`). Playwright is not a dependency.

## Driving the page

| Element                         | Use                                                                                                                     |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `#entry` form, `#command` input | Answer a prompt: set `#command`'s value, then `form.requestSubmit()`. Hidden while no prompt is waiting.                |
| `#screen-title`                 | The screen's name ("Main menu", "Transfer market"): wait on it to know where play is.                                   |
| `#transcript`                   | The screen's text, as a screen reader hears it.                                                                         |
| `#menu-button`, `#game-menu`    | The game menu dialog; its controls are `#game-menu button`, matched by text.                                            |
| `#context-bar`                  | Classic mode's touch answers.                                                                                           |
| `#home`                         | Modern mode's Home screen; its choices are `#home button[data-id]`.                                                     |
| `#pick-team`                    | Modern mode's pick team screen; its live rows and actions are `#pick-team button[data-id]`.                             |
| `#highlights`                   | Modern mode's highlights screen: scoreboard, then the pitch or the ticker and its Skip button.                          |
| `#status`                       | Modern mode's status screen; on the status prompt its Done button is `#status button[data-id]`.                         |
| `#loan`                         | Modern mode's loan and repayment screen, and the balance after; amount buttons carry `data-action`, the rest `data-id`. |

Storage keys (`web/src/view/storage.ts`): `fman:options` holds `{ presentation, rules, scale, sound, touch }`, `fman:autosave` the session the page resumes on load, `fman:slot:<n>` the save slots. Set options, then `location.reload()`; `sound: false` keeps prompts quiet, and `touch: 'on'` forces the context bar, and `presentation: 'classic'` turns off Modern mode, the default.

## Pitfalls

- **`preview_evaluate` times out after 15 s.** A new game takes several seconds of prompts and beeps to reach the main menu. Run one short step per call, each returning as soon as `#screen-title` changes, rather than one long loop.
- **Reaching a later screen**: build the session headlessly instead of clicking there. In a `bun` script, `createJournal()` (`web/src/sim/journal.ts`) plus `submitInput` (`web/src/test/input.ts`) plays to the screen; write `journal.snapshot()` into `fman:autosave` and reload, and the page resumes exactly there.
- **A background preview tab is hidden**, and the app stops advancing while the page is hidden, so play freezes after the first answer. Open the tab with `open: true` where the preview panel can show it.
- Blur `document.activeElement` before a screenshot, or the focus ring shows.
