# Sprite highlights

[#111](https://github.com/odogono/fman/issues/111). In Modern mode, matches decided as [moments](moment-highlights.md) are shown on a top-down pitch with tiny sprites, in place of the paper-and-ink ticker. The direction and mockups are in [highlights-engine.md](highlights-engine.md). The clips play with placeholder shapes ([#144](https://github.com/odogono/fman/issues/144)); the events drawer and panel and the sprite artwork are not built yet.

## Scope

- **A view only.** It adds no rule and no Enhanced version. It shows in Modern mode for every game decided as moments: `enhanced-7` onwards. Original-rules games keep the original pitch ([#45](https://github.com/odogono/fman/issues/45)).
- **Classic mode keeps the ticker.** A Spectrum-styled sprite view isn't planned.
- **Kits stay as they are.** Since `enhanced-7` no match is drawn on the attribute pitch, so yellow and green kits would be possible, but `enhanced-3` to `enhanced-6` still use that pitch with the same kit list. Lifting the ban would need a new kit list and Enhanced version, and is left until someone wants it. Each goalkeeper wears the first colour from a fixed list (orange, lime, grey, purple) that looks unlike both kits and the other goalkeeper, as keepers do in real football.
- **Injury clips** belong to [#110](https://github.com/odogono/fman/issues/110), once injuries happen during the match.

## Clips

Each moment plays as a **clip** ([glossary](../GLOSSARY.md)): the build-up, the moment, then the reaction, all at real-world pace. The camera works like the 16-bit football games': it shows only a section of the pitch, follows the ball, and zooms in slightly for the moment.

- **Camera.** The pitch runs up and down the screen on every screen. The camera shows the same patch, about 40 m across, scaled to fit, so every screen sees the same picture; for the moment it tightens to about 30 m. It looks a little ahead of the ball in the direction of play, so the goal comes into view before the shot.
- **Mini-map.** A small overview of the whole pitch in a corner shows both sides and the ball, hidden during the zoom.

| Moment    | Build-up                                | Moment                                                 | Reaction                                       |
| --------- | --------------------------------------- | ------------------------------------------------------ | ---------------------------------------------- |
| Goal      | Two to five seeded passes, with carries | The shot, and the ball in the net                      | The scorer celebrates                          |
| Save      | The same                                | The shot; the keeper dives, holds or parries           | The keeper plays the ball out                  |
| Clearance | The same                                | A defender cuts out the final pass, or blocks the shot | The defender clears long upfield or into touch |
| Near miss | The same                                | The shot hits the post, goes wide or over              | The shooter holds their head                   |

Only the build-up varies: the number of passes, their distances and the carries between them. It starts at a seeded spot in the attacking side's own half and works up the pitch, the last pass reaching the named player in shooting range. Defenders drift towards the ball but never tackle or intercept. Attackers keep onside: until a pass is played to them they wait no further up than the second-last defender, the ball or halfway, and one caught beyond drops straight back. Of the build-ups, 40% start in open play, 20% each from a free kick and a throw-in, and 10% each from a goal kick and a corner, named in the minute caption. A free kick is set between the attacking side's own half and about 35 m out, with the defenders 9.15 m back. A throw-in is held over the thrower's head beyond the touchline, then thrown to a team-mate 6 to 20 m away. A goal kick is taken by the keeper from the six-yard box and goes long to someone in midfield; a side whose only keeper is the shooter takes none. A corner is crossed from the flag to the shooter, who meets it in the box with up to four team-mates attacking it. The seed also picks, evenly, a save's dive, hold or parry and a [clearance](clearances.md)'s interception or block. A near miss goes wide 60% of the time (split by side), over 25% and off the post 15%, since the original's misses rarely hit the post.

Everything moves at real speeds: passes at about 15 m/s, runs at 5 to 7 m/s, half a second to a second to control each pass, and seeded carries of 1 to 4 seconds. A build-up takes about 6 to 20 seconds, the zoom about 1, the moment about 2 and the reaction 3 to 4, so clips run about 12 to 28 seconds and a match of 6 to 10 moments about 2 to 4 minutes, near the original's pace. A clip **reaches its moment** on the frame the ball crosses the line, reaches the keeper, or passes the post or byline.

- **Seed.** Everything made up in a clip comes from a seed of its own, a hash of the match and the moment: the clubs, the moment's place in the list, its minute, its kind and the named player. It never draws the game's random numbers or reads the clock, so a resumed match, or the same match shown again, plays the same clip.
- **Length.** The view sets each clip's length and the sim holds it ([ADR 0013](adr/0013-clips-set-their-own-length.md)). At kick-off, before the first frame plays, the view reads every moment from the ticker and hands the sim one length per moment, in frames (`holdClips`). Each length replaces the 75-frame pause that shows its moment; the 0-0 header and the final hold keep 75 frames. The journal saves them (save version 12). Classic mode hands over nothing.
- **Decided at kick-off.** A match plays as clips only if the view handed over clip lengths at its kick-off, and then for the whole match, resumes included. A match without them, such as one saved before clips existed or kicked off under reduced motion, shows the ticker to the end.
- **Resuming mid-clip.** The sim's ticker says how many frames into the current pause the match is, so a resumed clip picks up at that frame.
- **Between clips** the view cuts straight to the next one. Each clip opens with both sides already in shape, under a caption of its minute that is part of the clip's own length; there is no filler play.
- **Kick-off and full time.** During the 0-0 header both sides stand in shape with the ball on the centre spot, captioned "Kick-off". The final hold shows the same still pitch captioned "Full time", or the full ticker list after Skip.
- **Ends.** The sides change ends at half-time: the home side attacks up the screen before 46′ and down after.
- **Players.** The managed club shows one sprite per picked player, set out by position: defence at the back, midfield in the middle, attack up front. A picked goalkeeper keeps goal; with none, the first-picked defender does, so even a side picked short has a keeper. A player with no position plays in midfield. A goalkeeper the moment names as its shooter plays up front, and the same rule picks who keeps goal instead. A team picked short of 11 plays short. Each line spreads evenly across the pitch at a fixed depth, whatever its count. The opponent fields a 4-4-2 in squad order: its first goalkeeper, then its first four defenders, four midfielders and two attackers, filling any gap from other positions. The named player always plays, in place of the last-listed player in their position. Only the player the moment names is labelled, in the zoomed view.
- **Tiredness.** In the zoomed view, tired players show it (sweat, hands on knees), more often later in the match. It reads each side's real energy and the minute, and draws only from the clip's seed.

## The screen

- **Scoreboard** as on today's Modern highlights. The score, and the list of moments, change when a clip reaches its moment, never when it starts, so nothing gives the moment away.
- **Events.** On a phone, the latest moment's ticker line sits under the pitch, with an "All events" drawer. On a wide window, a panel beside the pitch uses the space the hidden left pane leaves. Both show the ticker's lines, newest first.
- **Keys.** A tap or keypress during a clip ends it and moves to the next moment, as a keypress ends a ticker pause. Cut short before its moment, the clip still shows the moment's score, ticker line and screen-reader line before the cut. Skip ends every remaining clip and shows the full ticker list over the pitch for the final hold; the result screen follows as now.
- **Reduced motion.** When the browser asks for less motion, the view hands the sim no clip lengths and shows the paper-and-ink ticker instead.
- **Screen readers** hear each moment's ticker line when its clip reaches the moment.

## Artwork

New sprites drawn for this view on a canvas of its own at the screen's resolution, so the camera can zoom smoothly, a little taller than the original's 8×8 characters, with poses for running, shooting, diving, celebrating and tired, tinted by kit when drawn. The original's characters stay with the original pitch, and the generated mockups are for direction only. The clip engine ships first with placeholder shapes: a kit-coloured circle per player, a white dot for the ball and lines for the markings, with the named player's label spelled as on the ticker line.

## Debug page

A page of its own, `web/clips.html`, served by `bun run dev` at `/clips` and left out of the build, plays any clip the engine can make. It sets the kind, outcome and restart (or leaves them to the seed), the scoring side, the minute, both kits, the managed side's line counts with or without a goalkeeper, and the moment's place in the list, with a random-seed button. It plays, pauses, steps and scrubs frames at ¼×, 1× and 4×, shows the clip's length, moment frame and passes, and can overlay player ids and the ball's path. It can also load the autosave or a web save file and replay a moment from that match's ticker.

## Order of work

1. **Clip lengths from the view** (sim, done in [#143](https://github.com/odogono/fman/issues/143)): the ticker's timeline takes a length for each moment, saves it, and defaults to 75 frames.
2. **The sprite view with placeholder shapes** (Modern, done in [#144](https://github.com/odogono/fman/issues/144)): the clip scripts, seeding, camera and zoom, mini-map, ends, team shapes, the goalkeeper colour, cuts, Skip, resuming mid-clip, reduced motion and screen readers. Only the latest moment's ticker line shows under the pitch. The debug page ships with it.
3. **The events drawer and panel.**
4. **The sprite artwork**, including tiredness.
