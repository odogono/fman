# Sprite highlights

[#111](https://github.com/odogono/fman/issues/111). In Modern mode, matches decided as [moments](moment-highlights.md) are shown on a top-down pitch with tiny sprites, in place of the paper-and-ink ticker. The direction and mockups are in [highlights-engine.md](highlights-engine.md). Nothing here is built yet.

## Scope

- **A view only.** It adds no rule and no Enhanced version. It shows in Modern mode for every game decided as moments: `enhanced-7` onwards. Original-rules games keep the original pitch ([#45](https://github.com/odogono/fman/issues/45)).
- **Classic mode keeps the ticker.** A Spectrum-styled sprite view isn't planned.
- **Kits stay as they are.** Since `enhanced-7` no match is drawn on the attribute pitch, so yellow and green kits would be possible, but `enhanced-3` to `enhanced-6` still use that pitch with the same kit list. Lifting the ban would need a new kit list and Enhanced version, and is left until someone wants it. Goalkeepers wear one fixed colour that no kit uses.
- **Injury clips** belong to [#110](https://github.com/odogono/fman/issues/110), once injuries happen during the match.

## Clips

Each moment plays as a **clip** ([glossary](../GLOSSARY.md)): the build-up in the wide view, the camera zooming in for the moment, then the reaction.

| Moment    | Build-up                  | Moment                                       | Reaction                      |
| --------- | ------------------------- | -------------------------------------------- | ----------------------------- |
| Goal      | Two to five seeded passes | The shot, and the ball in the net            | The scorer celebrates         |
| Save      | The same                  | The shot; the keeper dives, holds or parries | The keeper plays the ball out |
| Near miss | The same                  | The shot hits the post or goes wide          | The shooter holds their head  |

Only the build-up varies: the number of passes and their distances. The moment and the reaction take a fixed time for each kind, so clips run about 3 to 7 seconds.

- **Seed.** Everything made up in a clip comes from a seed of its own, a hash of the match and the moment: the clubs, the moment's place in the list, its minute, its kind and the named player. It never draws the game's random numbers or reads the clock, so a resumed match, or the same match shown again, plays the same clip.
- **Length.** The view sets each clip's length and the sim holds it ([ADR 0013](adr/0013-clips-set-their-own-length.md)). At kick-off, before the first frame plays, the view reads every moment from the ticker and hands the sim one length per moment, in frames (`holdClips`). Each length replaces the 75-frame pause that shows its moment; the 0-0 header and the final hold keep 75 frames. The journal saves them (save version 12). Classic mode hands over nothing.
- **Decided at kick-off.** A match plays as clips only if the view handed over clip lengths at its kick-off, and then for the whole match, resumes included. A match without them, such as one saved before clips existed or kicked off under reduced motion, shows the ticker to the end.
- **Resuming mid-clip.** The sim's ticker says how many frames into the current pause the match is, so a resumed clip picks up at that frame.
- **Between clips** the view cuts straight to the next one. Each clip opens with both sides already in shape, under a caption of its minute that is part of the clip's own length; there is no filler play.
- **Kick-off and full time.** During the 0-0 header both sides stand in shape with the ball on the centre spot, captioned "Kick-off". The final hold shows the same still pitch captioned "Full time", or the full ticker list after Skip.
- **Ends.** The sides change ends at half-time: the home side attacks up the screen before 46′ and down after.
- **Players.** The managed club shows one sprite per picked player, set out by position: defence at the back, midfield in the middle, attack up front. A picked goalkeeper keeps goal; with none, the first-picked defender does, so even a side picked short has a keeper. A player with no position plays in midfield. A team picked short of 11 plays short. The opponent shows 11 from its squad in a fixed shape. Only the player the moment names is labelled, in the zoomed view.
- **Tiredness.** In the zoomed view, tired players show it (sweat, hands on knees), more often later in the match. It reads each side's real energy and the minute, and draws only from the clip's seed.

## The screen

- **Scoreboard** as on today's Modern highlights. The score, and the list of moments, change when a clip reaches its moment, never when it starts, so nothing gives the moment away.
- **Events.** On a phone, the latest moment's ticker line sits under the pitch, with an "All events" drawer. On a wide window, a panel beside the pitch uses the space the hidden left pane leaves. Both show the ticker's lines, newest first.
- **Keys.** A tap or keypress during a clip ends it and moves to the next moment, as a keypress ends a ticker pause. Cut short before its moment, the clip still shows the moment's score, ticker line and screen-reader line before the cut. Skip ends every remaining clip and shows the full ticker list over the pitch for the final hold; the result screen follows as now.
- **Reduced motion.** When the browser asks for less motion, the view hands the sim no clip lengths and shows the paper-and-ink ticker instead.
- **Screen readers** hear each moment's ticker line when its clip reaches the moment.

## Artwork

New sprites drawn for this view on a canvas of its own at the screen's resolution, so the camera can zoom smoothly, a little taller than the original's 8×8 characters, with poses for running, shooting, diving, celebrating and tired, tinted by kit when drawn. The original's characters stay with the original pitch, and the generated mockups are for direction only. The clip engine ships first with placeholder shapes: a kit-coloured circle per player, a white dot for the ball and lines for the markings, with the named player's label spelled as on the ticker line.

## Order of work

1. **Clip lengths from the view** (sim): the ticker's timeline takes a length for each moment, saves it, and defaults to 75 frames.
2. **The sprite view with placeholder shapes** (Modern): the clip scripts, seeding, camera and zoom, ends, team shapes, the goalkeeper colour, cuts, Skip, resuming mid-clip, reduced motion and screen readers. Only the latest moment's ticker line shows under the pitch.
3. **The events drawer and panel.**
4. **The sprite artwork**, including tiredness.
