# Football Manager

The language of the original ZX Spectrum Football Manager recreation.

## Language

**Club**:
A football club that occupies a place in one of the four divisions and may be managed by the player.

**Manager**:
The person managing one club through successive league and F.A. Cup campaigns.

**Squad**:
The players a club currently owns. The managed club's squad includes its picked players, reserves and injured players; under the Original rules only the managed club has one.
_Avoid_: Team when referring to all owned players, roster

**Picked team**:
The players selected from the squad to take part in the next match.
_Avoid_: Squad when referring only to selected players

**Reserve**:
A squad player who is neither picked nor injured, and so can be added to the picked team.
_Avoid_: Substitute, since the original has no substitutions

**Position**:
Where a player plays: goalkeeper, defence, midfield or attack. A goalkeeper counts as a defender. The Original rules have no goalkeeper position.

**Free agent**:
A player who belongs to no club's squad. Transfer offers are drawn from the free agents, and clubs release their surplus players to them at the season end.
_Avoid_: Unemployed, pool

**Transfer list**:
The free agents who can be offered to the manager, numbered alongside the managed club's squad in the places that squad doesn't fill.
_Avoid_: Market when referring to these players; the market is the weekly offer

**Skill**:
A player's football ability, contributing to the strength of their playing category.

**Energy**:
A player's readiness to play, reduced by playing and restored by resting.
_Avoid_: Skill when referring to readiness

**Injury**:
A player's spell out of the picked team, drawn before each match. In the original it lasts one week; under lasting injuries it is likelier for a tired player and lasts up to three. Under match injuries it is drawn in the match instead, for a picked player, as a moment.

**Weeks out**:
How many more matches an injured player misses under lasting injuries, shown on the squad screen in place of `i`.

**Skill drift**:
The small change in the skill of a player in a squad at the season end, in place of the original's reroll. Free agents still reroll.
_Avoid_: Training or growth, which suggest a change the manager causes

**Morale**:
The managed club's confidence, affected by match and cup results.

**Form**:
Under club form, how a club other than the managed club has done in its last three league matches: one up for each win and one down for each loss. It strengthens or weakens the club as an opponent, and starts again from nothing at the season end.
_Avoid_: Morale when referring to other clubs; streak

**Team strength**:
The five attributes used to compare clubs for a match: Energy, Morale, Defence, Midfield and Attack.

**Squad strength**:
A club's defence, midfield and attack as the sums of its whole squad's skill in each playing category. Under squad strength it decides most of an opponent's team strength and moves other clubs' results.
_Avoid_: Rating, which names the manager's score; team strength, which is all five attributes in one match

**Managerial rating**:
The manager's score out of 100, earned at each season end from the league finish and how far the club went in the F.A. Cup.

**Difficulty level**:
The manager's chosen level, from Beginner (1) to Genius (7), which strengthens every opponent the managed club meets.
_Avoid_: Skill when referring to the level; skill belongs to players

**League match**:
A fixture contributing goals and points to the current division's league table.

**League table**:
The clubs of a division ordered by points, then goal difference, then goals scored. The top three are promoted and the bottom three relegated at the season end, except where there is no division to move to; the top club of Division 1 are champions.
_Avoid_: Standings, ladder

**Week's results**:
Every league match in the managed club's division in one week: the managed club's own, then the other seven.
_Avoid_: Other matches, which names only the original's list of the other seven

**Cup round**:
A stage of the F.A. Cup in which the managed club progresses or is eliminated, with drawn matches replayed.

**Matchday**:
One League match or Cup round, from picking the fixture through highlights and any cup replays to settling it.

**Season end**:
The step after the last league match and cup round where clubs are promoted and relegated, the bonus is paid and players' skill and energy are set for the new season.
_Avoid_: Reset, which suggests everything starts fresh

**Highlights**:
What decides a match's goals. In the original, these are displayed attacking sequences; other rulesets may decide a match as a list of moments instead.
_Avoid_: Replay when referring to highlights; a cup replay is another match

**Chance**:
One opportunity for a side to score in a match, won through a team-strength test.
_Avoid_: Attack when not referring to the original's displayed sequence

**Attack**:
One attacking sequence of the original's highlights, played out on the pitch. Original-rules matches are decided by attacks; other rulesets decide them by moments.
_Avoid_: Chance, which is the strength test behind either

**Moment**:
One decisive event in a match: a goal, a save, a clearance or a near miss, at a minute, for the side that made the chance. It names the player who shot: for the managed club one of its picked players, and, when clubs own squads, for an opponent one of its squad. Under match injuries a moment can also be an injury to one of the managed club's picked players, naming the opponent who made the tackle when one did. Under penalties a goal, save or near miss can be a penalty.
_Avoid_: Event, highlight

**Clearance**:
A moment in which a defender stops a chance before it reaches goal, by intercepting the final pass or blocking the shot, and clears the ball. It names the attacker the chance fell to.
_Avoid_: Tackle or interception as the name of the moment

**Penalty**:
Under penalties, a chance either side can win for a foul in the box: a goal, save or near miss marked as a penalty, scored as often as any other chance. For the managed club it can follow an injury to one of its players, the tackle that caused it being the **foul**, and someone else takes it.
_Avoid_: Spot kick; penalty shoot-out, which the game has none of

**Ticker**:
The list of a match's moments, shown one at a time in minute order as the match is played. In Modern mode the moments play as clips and the ticker lists them alongside. Original-rules matches have no ticker; their highlights are shown on the pitch.
_Avoid_: Feed, commentary

**Clip**:
The short animation of one moment in Modern mode's highlights: the build-up, the moment itself and the reaction. The clip decides how long its moment is shown. Everything in it except the moment is made up for show and changes nothing in the game.
_Avoid_: Replay, which names a cup match; highlight

**Playhead**:
The point in a match's clips that Modern mode's highlights have on show. The scoreboard, the moments listed and the line-ups show the match as it stood there; while the playhead is paused or behind, the match waits for it.
_Avoid_: Cursor, position

**Watching again**:
Playing a clip whose moment has already been shown, after rewinding to it. It changes nothing in the game; the match waits until the playhead catches up.
_Avoid_: Replay, which names a cup match; rewind, which names the control

**Build-up**:
The part of a clip before its moment: the play from the restart, or open play, to the final ball that reaches the player the moment names. A penalty has none.
_Avoid_: Move, attack, which names the original's sequence

**Finish**:
How the player a moment names meets the chance in a clip: a shot, a header, a shot from range or a one-on-one. It shapes how the chance looks, never whether it goes in.
_Avoid_: Shot type; outcome, which is what the moment decides

**Challenge**:
In a clip's build-up, a defender sliding in on the ball, which the player carrying it always skips past. It changes nothing about the moment.
_Avoid_: Tackle, which wins the ball

**Tackle**:
In a clip, a defender sliding in and winning the ball from the player on it: one way a clearance plays, and how a tackled injury plays.
_Avoid_: Tackle as the name of the moment, which is a clearance; challenge, which never wins the ball

**Cup celebration**:
Modern mode's scene after the managed club wins the F.A. Cup final: the winners gather and lift the cup on the pitch while the losers sink to the turf. Like a clip, it is made up for show and changes nothing in the game.
_Avoid_: Cup winners screen, trophy animation

**Ground**:
A club's home: the pitch, goals, boards and stands where its home matches' clips are played. A clip is played at the home side's ground, except the F.A. Cup final's clips and the cup celebration, which are played at the final ground. Each club's ground is its own, and stays the same all game: grounds differ in their grass's mowing, their stands and the colours of their seats, never in the pitch, goals or boards. It is made up for show and changes nothing in the game.
_Avoid_: Stadium, venue, arena

**Final ground**:
The neutral ground, owned by no club and grander than any club's, where the F.A. Cup final's clips and the cup celebration are played.
_Avoid_: Wembley, cup ground

**Scoreboard**:
The strip above Modern mode's highlights: both clubs, the score and, where the highlights have minutes, the minute of the moment on show.
_Avoid_: Header, title bar

**Line-up**:
The players a side fields in a match's clips, by position, shown beside the pitch on a wide window: the managed club's picked team, and the opponent's eleven from its squad, or only their positions where the opponent owns no squad.
_Avoid_: Picked team, which is only the managed club's; team sheet, formation

**Gate receipts**:
The income credited to the managed club for a match, including a cup replay.

**Weekly bills**:
The wages, ground rent and loan interest the managed club pays after each league match and decided cup round, borrowing any shortfall.
_Avoid_: Expenses, costs

**Weekly balance**:
How much the managed club's cash less its loan changed since the last weekly bills.
_Avoid_: Profit, which ignores the loan; the bills' total

**Next bills**:
The weekly bills the managed club will pay after its next fixture, at its current squad and loan.
_Avoid_: Forecast, projection

**Credit limit**:
The most the managed club may owe, set by its division. Borrowing beyond it is refused.

**Dismissal**:
The end of the manager's game when the club owes more than its credit limit: at once under the Original rules, or once a grace period runs out under the Enhanced rules.
_Avoid_: Sacking, game over

**Grace period**:
The weeks a club over its credit limit has to get back under it before the manager is dismissed.
_Avoid_: Crisis, warning

**Home gate**:
The current gate-receipt value used for the managed club's home fixtures.
_Avoid_: Attendance when referring to this monetary value

**Web save**:
A file kept by the manager to restore a game in the web recreation.

**Tape save**:
A game recorded by the original Spectrum version for later loading from cassette.

**Autosave**:
The single stored copy of the current play, kept continuously up to date so reopening the game resumes exactly where play left off.
_Avoid_: Save when referring to the autosave

**Saved game**:
A web save the player deliberately keeps from the game menu, in a save slot or an exported file, independent of the autosave.

**Save slot**:
A named place in the browser holding one saved game.

**Game menu**:
The web overlay, outside the reproduced Spectrum screen, from which the player resumes, saves, loads, starts a new game or changes options. Play is frozen while it is open.
_Avoid_: Pause when referring to the game menu, since a pause is the original's timed wait; Settings when referring to its options

**Prompt**:
A point where the original waits for the manager to type a line and press Enter.

**Prompt beep**:
The short beep the original sounds as a prompt appears, holding input until it ends. Only Classic mode sounds it; in Modern mode a prompt takes an answer as soon as it appears.
_Avoid_: Prompt sound when referring to clicks or match beeps, which both modes keep

**Answer**:
The text submitted to a prompt. An answer the original rejects with one of its own error messages is still an answer.
_Avoid_: Command, action

**Offered answer**:
An answer a presentation mode puts within reach of a tap: the choices the original screen invites, free number entry where it asks for an amount, or free text entry where it asks for a name. Every offered answer is one the original accepts.

**Keypress**:
A key held down while the original waits or runs a timed pause, which can cut a pause short. It is not an answer. Only one key is down at a time; a new keypress replaces the last.
_Avoid_: Answer or tap when referring to skipping a pause

**Brief keypress**:
A keypress that comes up by itself once the original has scanned it: Enter pressed by an answer from a soft keyboard or the game menu, or a held keypress whose key-up can no longer arrive.

**Held keypress**:
A keypress that stays down until its key or finger lifts: a physical key, a finger on the screen during a timed pause, or a finger on a context bar button. Resuming a session, or hiding the page, turns it into a brief keypress.

**Presentation mode**:
How the game is shown and controlled; every mode drives the same game with the same rules and outcomes.

**Classic mode**:
The presentation mode that reproduces the original Spectrum screens, scaled to fit, with touch controls standing in for typed answers.

**Modern mode**:
The presentation mode with screens redesigned for phones, where choices are made by tapping rather than typing.
_Avoid_: Mobile mode, since both modes are meant to work on mobile

**Wide window**:
A window wider than it is tall with room for two of Modern mode's panes side by side, as on a desktop. Any other window, a phone's held either way, takes Modern mode's phone layouts.
_Avoid_: Desktop, which names the device rather than the room the window gives

**Modern screen**:
A screen Modern mode draws in place of an original screen, such as the Home screen, pick team or highlights. Screens Modern mode has no design for show the original's, with the context bar.
_Avoid_: Own screen or pane

**Context bar**:
The row of answer buttons under an original screen: under every screen in Classic mode, and in Modern mode under the screens it has no design for.
_Avoid_: Answer bar, button bar

**Home screen**:
Modern mode's form of the original's management menu: the club summary, the next fixture and the menu's choices. On a wide window it stays beside the other screens while a game is in play, except the highlights.
_Avoid_: Home or dashboard, since home already names the home club, gate and kit

**Full-time screen**:
Modern mode's form of the original's final score: the scoreboard at full time, the goals and the managed club's injuries from the match's moments, and the gate receipts.
_Avoid_: Result screen, since result already names a match's outcome and the cup result; match report

**Next fixture**:
The league match or cup round the managed club plays next, as shown before it is started.

**Print fault**:
The original stopping partway through printing a name renamed with Spectrum control codes, which ends the game and can leave it half-updated. Kept under the Original rules; from version 10 the Enhanced rules refuse a name with control codes beyond a club's colour, so none can happen.
_Avoid_: Crash, error

**Rules parity**:
The original ruleset giving the same game state, numbers and random draws as the Spectrum game for the same answers, including the original's rule bugs.

**Presentation parity**:
Screens, input editing, sound and timing matching the original. Unlike rules parity, it is kept where already achieved but not required.

**Ruleset**:
A named set of game rules, together with the starting clubs and players a new game begins with. A game is played under one ruleset for its whole life.
_Avoid_: Mode or difficulty when referring to a ruleset

**Starting clubs and players**:
The 64 clubs and 24 players a new game begins with, before any renaming. The original clubs and players are the 1982 set; the present-day clubs and players are a fixed later season.
_Avoid_: Teams, roster

**Name colour**:
The colours a club's name is printed in on the management screens.
_Avoid_: Kit when referring to how a name is printed

**Kit**:
The colour a club's players wear in the highlights. Two sides in a match never wear the same kit.
_Avoid_: Name colour when referring to the pitch

**Home kit**:
The kit a club wears unless it clashes with its opponent's home kit while playing away.

**Change kit**:
The kit an away club wears when its home kit would clash with the home side's.

**Original rules**:
The ruleset that holds rules parity, starting from the original clubs and players. Players choose it when starting a new game; games from before rule choice existed keep it.
_Avoid_: Classic, which names a presentation mode

**Enhanced rules**:
The ruleset players get by default: the original rules plus every accepted rule change, and the present-day clubs and players since its third version. It is released in versions, and a game keeps the version it started with.
_Avoid_: Modern, which names a presentation mode

**Experimental ruleset**:
A ruleset that carries a single rule change, measured against the original rules before the change joins the Enhanced rules. Players never choose one.

**Run**:
One automated game played from a new game until dismissal or a fixed number of seasons, under one ruleset, difficulty level and strategy.
_Avoid_: Campaign or game when referring to an automated run

**Strategy**:
A fixed way of managing a club in a run: how it picks the team, buys, sells, borrows and repays. A strategy gives only offered answers and keeps the difficulty level unchanged.
_Avoid_: Tactics or level when referring to a strategy
