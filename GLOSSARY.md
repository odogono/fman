# Football Manager

The language of the original ZX Spectrum Football Manager recreation.

## Language

**Club**:
A football club that occupies a place in one of the four divisions and may be managed by the player.

**Manager**:
The person managing one club through successive league and F.A. Cup campaigns.

**Squad**:
The players currently owned by the managed club, including picked players, reserves and injured players.
_Avoid_: Team when referring to all owned players

**Picked team**:
The players selected from the squad to take part in the next match.
_Avoid_: Squad when referring only to selected players

**Skill**:
A player's football ability, contributing to the strength of their playing category.

**Energy**:
A player's readiness to play, reduced by playing and restored by resting.
_Avoid_: Skill when referring to readiness

**Morale**:
The managed club's confidence, affected by match and cup results.

**Team strength**:
The five attributes used to compare clubs for a match: Energy, Morale, Defence, Midfield and Attack.

**Difficulty level**:
The manager's chosen level, from Beginner (1) to Genius (7), which strengthens every opponent the managed club meets.
_Avoid_: Skill when referring to the level; skill belongs to players

**League match**:
A fixture contributing goals and points to the current division's league table.

**Cup round**:
A stage of the F.A. Cup in which the managed club progresses or is eliminated, with drawn matches replayed.

**Matchday**:
One League match or Cup round, from picking the fixture through highlights and any cup replays to settling it.

**Highlights**:
The displayed attacking sequences that determine a match's goals.
_Avoid_: Replay when referring to highlights; a cup replay is another match

**Gate receipts**:
The income credited to the managed club for a match, including a cup replay.

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
_Avoid_: Pause when referring to the game menu; a pause is the original's timed wait

**Prompt**:
A point where the original waits for the manager to type a line and press Enter.

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

**Rules parity**:
The original ruleset giving the same game state, numbers and random draws as the Spectrum game for the same answers, including the original's rule bugs.

**Presentation parity**:
Screens, input editing, sound and timing matching the original. Unlike rules parity, it is kept where already achieved but not required.

**Ruleset**:
A named set of game rules. A game is played under one ruleset for its whole life.
_Avoid_: Mode or difficulty when referring to a ruleset

**Original rules**:
The ruleset that holds rules parity. Players choose it when starting a new game; games from before rule choice existed keep it.
_Avoid_: Classic, which names a presentation mode

**Enhanced rules**:
The ruleset players get by default: the original rules plus every accepted rule change. It is released in versions, and a game keeps the version it started with.
_Avoid_: Modern, which names a presentation mode

**Experimental ruleset**:
A ruleset that carries a single rule change, measured against the original rules before the change joins the Enhanced rules. Players never choose one.

**Run**:
One automated game played from a new game until dismissal or a fixed number of seasons, under one ruleset, difficulty level and strategy.
_Avoid_: Campaign or game when referring to an automated run

**Strategy**:
A fixed way of managing a club in a run: how it picks the team, buys, sells, borrows and repays. A strategy gives only offered answers and keeps the difficulty level unchanged.
_Avoid_: Tactics or level when referring to a strategy
