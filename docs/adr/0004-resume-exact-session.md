# Resume the exact session from browser storage

Reloading the browser resumes play exactly where it stopped: same screen, Matchday progress, highlight playback frame, input state, frame counter and RNG. The web build keeps an autosave of the full session in browser storage. A game menu outside the reproduced screen also offers deliberate saved games in five save slots, plus file export/import.

This replaces the first save contract, which stored only the Game and always resumed at the original's line-100 reseed boundary, without local storage. That contract was simpler and closer to `KEEP`. But mobile browsers kill tabs, and an accidental reload would lose a Matchday, so we accepted the cost of a serialisable session snapshot. The original `keep` command still behaves as before. The autosave and the menu are web host features (ADR 0001). Play is frozen while the menu is open, and time outside the game is not simulated (ADR 0003).

Snapshots are versioned save format 2. Version-1 files remain importable and resume at the reseed boundary. An unsupported autosave falls back to the title screen without being deleted. When storage is unavailable, the game stays playable and offers export. If two tabs are open, the last write wins.
