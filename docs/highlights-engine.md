# Highlights engine (exploration)

An exploration of new match highlights for the Enhanced rules. Nothing here is decided or scheduled.

## How the original decides a match

Highlights don't decorate a result; they make it ([original-game-analysis.md](original-game-analysis.md)). Each of the five team strengths gives each side a chance of two attacks. Each attack places three attackers, three defenders, a goalkeeper and a ball, and a goal happens when the ball reaches the net through collision checks on the screen's colour attributes ([`highlights.ts`](../web/src/sim/highlights.ts)). This is why kits can never be yellow or green ([present-day-clubs.md](present-day-clubs.md)).

The original never names a player during a match, has no match clock, and decides injuries before team selection, not during play.

## What the new engine would be

- **Enhanced rules only.** A new Enhanced version ([ADR 0007](adr/0007-experimental-rules-as-rulesets.md)). Original-rules games keep the original highlights exactly.
- **It decides goals.** This is a rules change, not a new look for the same draws, so results change and the [gameplay baseline](gameplay-baseline.md) has to be measured again.
- **Event-based.** The engine produces a short list of moments from the team strengths and the picked players. Each view animates the moments its own way. The engine never simulates continuous positions for all 22 players.
- **Watch only.** The manager can skip, or play at 2× or 4×, but can't change anything during the match.

A **moment** is one event in a match, at a minute, involving named players:

| Moment    | Example                            | Draws on                       |
| --------- | ---------------------------------- | ------------------------------ |
| Goal      | 34′ Okafor, 1–0                    | Attack against defence, skill  |
| Save      | 12′ keeper saves Holt's long shot  | Attack against defence         |
| Near miss | 67′ off the post                   | Attack against defence         |
| Injury    | 51′ Pryce goes off                 | New: injuries during the match |
| Fatigue   | late goals against tired defenders | Energy                         |
| Morale    | a lifted or deflated side          | Morale                         |

Red cards and penalties would be further new rules and are left out.

**Only moments that change the game come from the engine.** Goals, saves, near misses and injuries change the score, the squad or the baseline, so the engine decides them with the game's seeded random numbers. Tackles, passes and build-up play change nothing, so the engine never produces them. Each view invents them from its own random numbers, seeded from the moment it is showing. A view can then change how a match looks without moving a single result or random draw. A tackle that causes something, such as the challenge that injures a player, is part of that moment: the injury moment names who made the tackle.

## Chosen direction: top-down pitch with tiny sprites

Twelve mockups covered seven directions: a pixel pitch with more detail, a tactical radar, a teletext-style ticker, illustrated key-moment cards, an isometric diorama, a top-down pitch with tiny sprites, and full 3D broadcast. The **tiny-sprite top-down pitch** was chosen:

- It reads well on a phone held upright and on a desktop.
- It suits moments: a wide view shows the build-up, then the camera zooms in for the moment itself, where tiredness can show (sweat, hands on knees).
- Small sprites on a canvas are cheap to draw, compared with 3D or illustrated cards.

Other directions can still contribute:

- The **pixel pitch with more detail** is the same look seen closer up, so it becomes the zoomed view.
- The **teletext ticker** is the text summary shown when the manager skips.
- The **radar** could be a fast, data-only option.

The mockups are generated reference images for direction only, not artwork to ship. Every one shows the same made-up match, Ashford Rovers against Kingsmere United.

Desktop: the wide pitch at the 51′ injury, the wide pitch with an events panel, and the camera zoomed in on the 88′ winner against tired defenders.

| Wide                                                                                                                       | Wide, with events                                                                                                            | Zoomed                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| ![Wide pitch](https://gist.githubusercontent.com/odogono/c6ddfb89f623edb9875ab9fedcc0891c/raw/07-tiny-sprites-desktop.jpg) | ![Events panel](https://gist.githubusercontent.com/odogono/c6ddfb89f623edb9875ab9fedcc0891c/raw/09-sprites-wide-desktop.jpg) | ![Zoomed goal](https://gist.githubusercontent.com/odogono/c6ddfb89f623edb9875ab9fedcc0891c/raw/10-sprites-zoom-desktop.jpg) |

Phone: the whole pitch upright with an "all events" drawer, and the camera zoomed in on the 67′ shot off the post. In the zoomed view the Ashford goalkeeper is drawn by mistake in outfield kit, out of his goal.

| Wide                                                                                                                      | Zoomed                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| ![Phone, wide](https://gist.githubusercontent.com/odogono/c6ddfb89f623edb9875ab9fedcc0891c/raw/11-sprites-wide-phone.jpg) | ![Phone, zoomed](https://gist.githubusercontent.com/odogono/c6ddfb89f623edb9875ab9fedcc0891c/raw/12-sprites-zoom-phone.jpg) |

## Suggested order of work

1. **The engine.** Produces moments from the team strengths and the picked players, headless in [`web/src/sim`](../web/src/sim) and tested, with no view yet. Measured as the experimental ruleset [`moment-highlights`](moment-highlights.md).
2. **Balance.** The bots in `tools/bots/` play whole seasons on the new engine ([gameplay-baseline.md](gameplay-baseline.md)). Tune how often each moment happens until scores, tables and cup runs sit close to [the original's baseline](baseline/original.md), then give it its Enhanced version.
3. **The ticker.** A teletext-style list of moments, shipped in both presentation modes ([built for Classic mode](moment-highlights.md#the-ticker)). Text fits the reproduced Spectrum screen with little change ([ADR 0010](adr/0010-enhanced-rules-speak-on-the-original-screens.md)), so this is the point where players get the new engine.
4. **The sprite view.** Modern mode only. Each moment plays as a scripted clip of a few seconds: build-up, the moment itself, the reaction. Nothing simulates the whole match underneath. The ticker stays as the summary shown when the manager skips.

## Open questions

- **How moments are drawn.** The probability of each kind of moment, and how team strengths and individual players' skill and energy set it. The aim is final scores in a range close to the original's, so that the league and cup stay balanced.
- **Injuries during the match.** The original draws injuries before selection. Either the existing draw moves into the match, or a new one is added; each changes the baseline differently.
- **Who scores.** Weighting by skill, and which playing category (defence, midfield or attack) a scorer comes from.
- **Kits.** A tiny-sprite view no longer forbids yellow or green kits, but the Original rules' highlights still do, and the present-day clubs share one kit list between both.
- **Classic mode after the ticker.** Classic mode gets the ticker. Whether it ever gets a Spectrum-styled version of the sprite view is open.
