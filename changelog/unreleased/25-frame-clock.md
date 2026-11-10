---
type: fix
scope: view
section: fixed
---

**Use the Spectrum's exact frame cadence when reseeding the game.** Commands
now account for elapsed time at input dispatch even when animation callbacks
are delayed, and opening the game menu freezes the clock without losing its
fractional frame. Existing save files remain compatible (#25).
