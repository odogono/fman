# Multiplayer (exploration)

An exploration of what a server-based, multiplayer version of the game could look like. Nothing here is decided or scheduled.

## What stands in the way

The simulation ([`web/src/sim`](../web/src/sim)) is already headless, deterministic and replayable from a journal of inputs, which is most of what an authoritative server needs. The obstacles are in the game model, which assumes a single human manager.

1. **Only the managed club exists.** `Game` ([`management.ts`](../web/src/sim/management.ts)) mixes one manager's state (`cash`, `debt`, `players`, `morale`, `homeGate`, `level`) with world state (`clubs`, `league`, `cupRound`, `scheduleCounter`, `seed`). Opponents have no squads: their strength is `rng.int(1, 14)`, plus a difficulty bonus, plus points per match (`prepareLeagueMatch` in [`league.ts`](../web/src/sim/league.ts)). Multiplayer needs one `World` and a `ManagerState` for each human.
2. **Matches are decided from one side.** Highlights and settlement treat every match as "the managed club against an opponent". A match between two humans needs a symmetric resolution: both team strengths go in, and one result comes out that both managers see.
3. **There is one 24-player pool.** A player's `status` (0 unowned, 1 owned, 2 picked) is relative to the one managed club. Several humans need ownership for each club, and probably a larger pool.
4. **Randomness depends on input timing.** The RNG reseeds from the frame clock at each management menu ([ADR 0003](adr/0003-preserve-spectrum-randomness-and-arithmetic.md)), so how quickly someone presses keys changes outcomes. Online this can be exploited, so the server must own the seeds. This fits a new `multiplayer` ruleset ([ADR 0007](adr/0007-experimental-rules-as-rulesets.md)) and leaves the Original rules' parity alone.
5. **There is no server.** Accounts, lobbies and persistence don't exist yet. Bun serves WebSockets itself, so no new tooling is needed.

## Proposed format: simultaneous weekly turns in a shared league

Every matchday becomes a turn that all managers play at the same time:

1. **Manage (private).** Each manager picks a team, takes loans and bids, on the classic screens. Their client runs the simulation locally for their own club, so the screens respond instantly. Their answers become orders.
2. **Lock in.** When every manager is ready, or the deadline passes, the server resolves the week. All fixtures are played: human against human with the symmetric resolution, human against CPU with the existing rolls.
3. **Watch.** Every manager gets their highlights at the same moment, and other results arrive as a ticker. Both managers in a match between two humans see the same highlights.

**The transfer market is where managers compete.** Instead of one random player offered to one manager, the league offers one player a week to every manager in a **sealed-bid auction**, and the highest bid wins. Players are scarce and cash is tight, so outbidding a rival for a player you can barely afford is the strongest multiplayer decision the game offers. It needs few new rules.

The same engine supports two speeds. Only the deadline changes:

| Mode         | Deadline                            | One season (about 15 league weeks and the cup)                     |
| ------------ | ----------------------------------- | ------------------------------------------------------------------ |
| Async league | 24 hours, or when everyone is ready | About three weeks: a check-in-each-evening game, like play-by-mail |
| Live party   | About 90 seconds a week             | About 45 minutes with 4–8 friends                                  |

Further rules:

- Human managers start in Division 4, and promotion is a race.
- Dismissal costs a manager their club. They can return as manager of a worse one.
- A manager who misses a deadline keeps last week's team and bids nothing.
- The gameplay bots in `tools/bots/` fill empty seats and measure balance, as they already do for rulesets ([gameplay-baseline.md](gameplay-baseline.md)).

## How it would work technically

- **The server is authoritative** and runs the same TypeScript simulation under Bun. Clients submit only orders, so they can't cheat.
- **Each week is a journal entry** (see [`journal.ts`](../web/src/sim/journal.ts)), made of a world snapshot, each manager's answers and a server seed, and stored as one row (for example in Postgres). Any week can be replayed to settle a dispute or find a bug, and this gives rollback for free.
- **Hidden information:** the league table, results and the auctioned player are public. Squads, cash and bids stay private.

## Suggested order of work

1. **Split the model and add symmetric matches**, proven with hotseat multiplayer on one device. This carries most of the risk and needs no server. First check how the highlights decide goals, since that sets how hard the symmetric resolution will be.
2. **A shared market with sealed bids**, followed by a balance pass with the bots.
3. **The server and async leagues:** accounts, lobbies, deadlines, and storing the weekly journal.
4. **Live party mode:** a short deadline and highlights played in sync.

## Prior art

### Sky Sports Football Manager (2001)

- **Made by:** Network Interactive Sports (NI Sports), published by THQ. Some sources credit HotGen Studios as developer, or describe NI Sports as a THQ division working with HotGen. It appears to be NI Sports' only game.
- **Platform and release:** Windows, UK, November 2001 (sources give the 9th or the 11th).
- **What it was:** an online management game, designed around network play, with a persistent world. It had real clubs and players from the Premiership to the Conference (114 clubs in five leagues), the League, FA Cup, League Cup and European competitions, and covered transfers, loans, tactics, training, injuries and finances. Its main feature was **live fixtures against other human managers over the internet**.
- **How it paid:** a monthly subscription of about £6.99 (one source says $6.99), on top of the boxed game.
- **Reception:** MobyGames lists one critic score, 52%.
- **Not known:** when the servers closed and how many people played. Reviews from 2001–02, such as PC Gamer UK, are the place to look.

### Football Manager Live (2008–2011)

Sports Interactive and Sega's later massively multiplayer attempt, recalled from memory and not yet checked against sources. It had persistent shared worlds with many human clubs, seasons spanning weeks of real time, and matches played on a schedule whether managers were online or not. Its economy was driven by players trading with each other. It was a subscription game and closed after a couple of years for lack of subscribers.

### Lessons

Both games sold a large persistent world and depended on enough people paying and playing to keep it alive. Small private leagues with deadline-based turns don't need anyone online at the same time, and bots in empty seats let a league work with only a few friends.

Sources:

- [MobyGames: Sky Sports Football Manager (2001)](https://www.mobygames.com/game/34736/sky-sports-football-manager/)
- [Gamepressure: Sky Sports Football Manager](https://www.gamepressure.com/games/sky-sports-football-manager/z81599)
- [Giant Bomb: Sky Sports Football Manager](https://www.giantbomb.com/sky-sports-football-manager/3030-23500/)
- [GRYOnline: Sky Sports Football Manager](https://www.gry-online.pl/gry/sky-sports-football-manager/z81599)
- [GRYOnline: Network Interactive Sports](https://www.gry-online.pl/firmy/network-interactive-sports/z430a)
- [Azygram: Sky Sports Football Manager](https://azygram.com/games/d/sky-sports-football-manager-833439)
- [musicMagpie listing](https://www.musicmagpie.co.uk/store/products/nisportsskysportsf/)
