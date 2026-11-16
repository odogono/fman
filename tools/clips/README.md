# Recording clips

`bun run clips:record` records Modern-mode highlight clips as MP4s. Use it to check a change to the clips by eye, or to show one in a PR. It serves the clip debugger (`web/clips.html`) on a free port and opens it in headless Chromium. For each clip, it sets the debugger's controls through `clipDebug.set`, paints every second frame with `clipDebug.paint`, and joins the frames with ffmpeg. The videos play at 25 fps, at the clip's real speed.

```sh
bun run clips:record                           # one clip of each kind of chance
bun run clips:record --only rebound,one-on-one # some of those
bun run clips:record --kind save --outcome parry --finish header --seeds 1-5
bun run clips:record --kind injury --tackled no # a player pulling up injured
bun run clips:record --kind save --penalty yes  # a penalty saved
bun run clips:record --help                    # every option
```

`--sequence` records the chosen clips as one video, `sequence.mp4`, played as a match's highlights: the kick-off card, each clip in minute order and the full-time card, with the wipes between. Clips that set no `--minute` are spread evenly through the match, so later ones attack the other way after half-time.

```sh
bun run clips:record --sequence --only shot,corner-header,near-miss
```

The videos and a `summary.txt` go to `build/clips/` unless `--out` names another folder. Each line of the summary gives a clip's restart, finish, outcome, the direction it attacks, its length and when its moment comes. `--frames` keeps the JPEG frames, for stepping through a clip one frame at a time.

A recorded clip is the one the debugger shows for the same settings and seed. The seeds here are the debugger's **Seed** field. To find a clip worth recording, try seeds in the debugger first (`bun run dev`, then `/clips`). To record from a debugger you already have running, pass `--url http://localhost:3147/clips`.

## Needs

- **ffmpeg** on the `PATH`. Without it, the frames are left in place and the command says where.
- **Chromium.** The tool tries, in order:
  - `$CHROME`
  - the newest Playwright headless shell or Chromium in `~/Library/Caches/ms-playwright` or `~/.cache/ms-playwright`
  - an installed Chrome or Chromium

  Playwright isn't a dependency. If none of these are present, `bunx playwright install chromium-headless-shell` downloads one.

The frames are drawn at twice the debugger's canvas size, so a sprite's pixels stay sharp.
