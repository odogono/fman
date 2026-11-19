import { boardMetres, clipFps, pitchLength } from './model';

/** The goal mouth's half width, in metres. */
export const goalHalf = 3.66;
/** A kick shows for this many frames from the touch. */
export const kickFrames = 10;
/** Passes longer than this, in metres, go in the air. */
export const longestGroundPass = 30;
/** The final pass is played from no further than about this from the shooter's spot. */
export const finalPassRange = 30;
/** A pass takes at least this long, in seconds. */
export const passMinimum = 0.6;
/** How fast a receiver runs onto a pass, in metres a second. */
export const receiverSpeed = 7;
/** A defender this close to a pass's path, in metres, blocks it. */
export const laneWidth = 2;
/** Defenders keep at least this far from a pass along the ground. */
export const laneClearance = 1;
/** The longest pass back, in metres, from the receiver's spot. */
export const longestBackPass = 11;
/** A header's crouch and leap take this many frames before the ball arrives. */
export const jumpFrames = 16;
/** A clearance runs on this far, in metres, after it bounces. */
export const clearRunOn = 4;
/**
 * How far beyond the lines the ball's middle can go before it meets the
 * boards. A board along a touchline is drawn edge on, about 0.9 m across,
 * and the ball is about 0.6 m across.
 */
export const boardStops = {
  d: boardMetres - 0.3,
  x: boardMetres - 0.8
} as const;
/** How far beyond the lines a player can go, about 1 m across, likewise. */
export const playerStops = {
  d: boardMetres - 0.4,
  x: boardMetres - 1
} as const;
/** A ball meeting the boards comes back off them at this share of its pace. */
export const boardBounce = 0.3;
/**
 * A first touch takes the pace off the ball this fast, in metres a frame
 * each frame, and the receiver closes on it at this share of their pace.
 */
export const touchDrag = 0.02;
export const gatherShare = 0.7;
/** The fastest a first touch sends the ball on from the receiver, in metres a second. */
export const touchSpring = 6;
/** A carrier turns the ball round at most this far a frame, in radians. */
export const ballTurn = 0.1;
/** The ball's turn round a carrier quickens or eases by this, in radians a frame each frame. */
export const ballSpinUp = 0.02;
/** A carrier this near, in metres, where they are going holds their way. */
export const holdingGap = 0.5;
/**
 * A carrier speeds up and slows down by at most these, in metres a frame
 * each frame: about 6 and 10 metres a second each second.
 */
export const carrierPickUp = 6 / clipFps / clipFps;
export const carrierBrake = 10 / clipFps / clipFps;
/** A receiver takes their first touch at no less, nor more, than this pace, in metres a second. */
export const firstTouchPace = [1.5, 3.5] as const;
/** How far off their line, in metres, a keeper stands: ball near, and far. */
export const keeperOffLine = [1.5, 8] as const;
/** A keeper coming for a cross meets it at least this far, in metres, short of the header. */
export const claimGap = 2;
/** The share of saves from a cross where the keeper comes to catch it. */
export const claimShare = 0.35;
/** The share of shots and headers parried back out for the shooter to strike again. */
export const reboundShare = 0.2;
/** A parry runs out into the box at this pace, in metres a second. */
export const spillPace = 9;
/** A shooter follows in for the rebound at this pace, in metres a second. */
export const followPace = 7;
/** A rebound needs the first effort from within this far of goal, in metres. */
export const reboundRange = 20;
/** Frames the ball sits loose before the rebound is struck. */
export const reboundSettle = 3;
/**
 * How much a keeper's quality (#235), from -1 to 1, moves their share of
 * parries, a third for an average keeper: by this share of it either way.
 */
export const parryLean = 0.6;
/**
 * How much a player's quality (#236), from -1 to 1, moves how fast they
 * run, either way.
 */
export const skillPaceLean = 0.08;
/** How much slower a player with no energy left runs than a fresh one. */
export const energyPaceLean = 0.06;
/** How much a shooter's quality moves the pace of their shot, either way. */
export const shotPaceLean = 0.1;
/** Frames a keeper lies down after the parry before scrambling up. */
export const scrambleFrames = 15;
/** The defender chasing a rebound gets no nearer the ball than this, in metres. */
export const lateBy = 2.5;
/** The furthest from goal, in metres, an ordinary shot and one from range are struck. */
export const longestShot = 22;
export const longestLongRange = 30;
/**
 * An injured player (#110) goes down no nearer goal than this, in metres:
 * outside the penalty area, 16.5 m deep, with room for the stumble, so the
 * tackle never looks like a foul that should have been a penalty.
 */
export const injuredFrom = 16.5 + 3;
/** A player fouled in the box (#211) goes down no nearer goal than this. */
export const sixYards = 8;
/** The penalty spot's distance from goal, and the D's radius round it. */
export const penaltySpot = 11;
export const penaltyArc = 9.15;
/** A penalty taker runs up at this pace, in metres a second. */
export const penaltyRunUp = 4.5;
/** The penalty area's depth from the goal line, and half its width. */
export const boxDepth = 16.5;
export const boxHalf = 20.16;
/** A shooter found out of range carries it into range at this pace, in metres a second, done by this frame. */
export const intoRangePace = 7;
export const shooterReadyBy = 13.5 * clipFps;
/** The final pass stops waiting for the shooter by this frame, so the moment starts in time. */
export const lastWaitBy = 11 * clipFps;
/** A shooter found late takes the ball in this many frames at most. */
export const quickTouch = 25;
/** The nearest to goal, in metres, a shot from range is set up. */
export const longRange = 24;
/** The deepest a high back line holds, in metres up the pitch. */
export const highLine = 86;
/** How far off their line, in metres, a keeper comes to meet a one-on-one. */
export const keeperRushes = 6;
/** About how far, in metres, the holder carries it on before the final pass. */
export const carryReach = 6;
/** The furthest, in metres, a shooter carries it after the final pass, into range to shoot. */
export const longestCarry = 7;
/** The furthest out, in metres, a shot found beyond carrying range is struck from. */
export const stretchedShot = 25;
/** How long past the build-up's time, in frames, the final pass still waits for the shooter. */
export const lateWait = 2 * clipFps;
/** The furthest, in metres, the pass before the final one goes forward. */
export const longestForward = 35;
/** The back line holds this many metres goal side of the ball, in metres. */
export const backLineAhead = 14;
/**
 * How far beyond the back line, in metres, a shooter waiting onside can run
 * onto the final pass.
 */
export const finalRunOn = 8;
/** The furthest, in metres, a player carries the ball out wide to cross it. */
export const widestCarry = 25;
/** The ball is this far ahead of a carrier's feet, in metres. */
export const stride = 0.8;
/**
 * Players keep at least this far apart, in metres, about a sprite's width,
 * so no one is drawn standing inside anyone else.
 */
export const personalSpace = 1.3;
/**
 * How far, in metres, beyond an opponent an attacker's spot on the far side
 * of them comes round to their own side (#229).
 */
export const farSideReach = 4;
/**
 * How far, in metres, an attacker can be nudged beyond where they may wait
 * before dropping straight back.
 */
export const offsideNudge = 0.3;
/** A defender further than this from their place, in metres, sprints back. */
export const recoveryGap = 3;
/** How far apart, in metres, a back line lets its players get as it moves. */
export const backLineGive = 2;
/** How far a back line's players may sway out of line, in metres. */
export const backLineSway = 0.4;
/** Slower than this, in metres a second, a player is standing. */
export const standingSpeed = 0.5;
/** A player's facing follows their movement over this many frames. */
export const facingWindow = 10;
/**
 * A player faces the way they run once faster than `start`, in metres a
 * second, and faces the ball again once slower than `stop`.
 */
export const facingSpeed = { start: 2.5, stop: 1.5 };
/** Another defender must be this much nearer the ball to take over pressing it. */
export const pressingGive = 1.5;
/** A defender runs to cut out a pass or block a shot at no more than this, in metres a second. */
export const clearerPace = 8;
/** A keeper shuffles across their goal, keeping on the angle, at this pace, in metres a second. */
export const keeperShuffle = 6;
/** No one on their feet goes faster than this, in metres a second, however they are moved. */
export const fastestRun = 8.5;
/** Getting out of a pass's way, a player goes flat out, at this pace, in metres a second. */
export const flatOut = 9.5;
/**
 * A defender goal side of the ball and within this many metres of it
 * jockeys, going no more than this much faster than the ball, in metres a
 * second.
 */
export const jockeyRange = 4;
export const jockeyGive = 1;
/** After the moment, players walk or jog back at these paces, in metres a second. */
export const walkPace = 1.5;
export const jogPace = 3.5;
/** Hands on heads for this many of the reaction's frames. */
export const despairFrames = 60;
/** The reaction's frame the keeper sets off for the ball in the net. */
export const fetchFrom = 30;
/** The reaction's frame the attackers start back. */
export const turnBackFrom = 15;
/** A scorer's arms go up this many frames before they wheel away. */
export const leapFrames = 15;
/** A scorer wheels away at this pace, in metres a second. */
export const celebrationPace = 8;
/** A scorer celebrates where they wheel to for at least this many frames. */
export const celebrateFor = 30;
/** The furthest a scorer wheels away, in metres, so team-mates catch them. */
export const longestWheel = 12;
/** A jump for joy: frames crouched, in the air, then landed with arms up. */
export const jumpCrouch = 8;
export const jumpAir = 14;
export const jumpCycle = 32;
/** A knee slide carries a scorer this many metres. */
export const slideMetres = 3;
/** Team-mates crowd a celebrating scorer this close, in metres. */
export const huddleGap = 1.1;
/** A keeper down after a save is up again after this many frames. */
export const getUpFrames = 25;
/**
 * Getting up shows for at most this many frames, half on hands and knees,
 * half on one knee; up from sitting, only the half on one knee.
 */
export const gettingUp = 12;
/** Of the blocks of a shooter on the ball, this share are tackles instead. */
export const tackleShare = 0.5;
/** Of the other blocks, this share are made sliding in. */
export const slidingBlockShare = 0.5;
/** A tackler sprints in at this pace, in metres a second, and slides in from this near. */
export const tacklePace = 8;
export const slideReach = 3;
/** A slide starts at this pace, in metres a second, and stops in this many frames. */
export const slidePace = 8;
export const slideFrames = 20;
/**
 * A tackled shooter stumbles this many frames, from this pace in metres a
 * second (about 1.2 m in all), then lies down this many.
 */
export const stumbleFrames = 10;
export const stumblePace = 11;
export const lieFrames = 45;
/** An injured player pulls up before a defender closing them down is this near, in metres. */
export const pullUpGap = 3.5;
/** Of the clips, this share see a defender slide in on the ball in the build-up. */
export const challengeShare = 0.8;
/**
 * A challenge comes from a defender this near the ball, in metres, and in
 * front of it. Their slide takes this many frames, and the carrier skips
 * aside from it over these frames, at up to this pace in metres a second.
 */
export const challengeRange = [2, 5] as const;
export const challengeSlide = 24;
export const challengeSkip = [2, 22] as const;
export const skipPace = 2.5;
/** A tackler sits up this many frames before getting up; a blocker, fewer. */
export const sitFrames = 20;
export const blockSitFrames = 10;
/** A keeper with the ball walks out at this pace, in metres a second. */
export const keeperStride = 2;
/** How far short of where they meet a low ball in the shooter waits, in metres, to run onto it. */
export const runOntoIt = 4;
/** The furthest, in metres, a winger carries the ball down the line to the byline for a cut-back. */
export const bylineRun = 35;
/** A cross comes from at least this far out to the side, in metres from the middle of the pitch. */
export const crossWidth = 12;
/** Beaten to a cross headed clear, the shooter is this far, in metres, from where the defender meets it. */
export const beatenBy = 1.6;
/** About this share of each kind of chance comes from a ball in from wide that isn't headed at goal (#224). */
export const crossShare = 1 / 3;
/** A punch flies this many metres out from goal, over this many frames, with the fists up for the first few. */
export const punchRange = 18;
export const punchFlight = 45;
export const punchFrames = 8;
/** A cross half-cleared loops out to the edge of the box at this pace, in metres a second. */
export const halfClearPace = 12;
/** A low cross, or a cut-back, is driven in at this pace, in metres a second. */
export const lowCrossPace = 20;
/** A cross floated for a header to get to goes no slower than this, in metres a second. */
export const floatedCross = 11;
/** A header is met no further out than this, in metres up the pitch. */
export const furthestHeader = pitchLength - 12;
/** A run onto the ball gets up to, or down to, a steady pace over this share of it. */
export const runRamp = 0.3;
/** A header shows its contact, then its landing, this many frames each. */
export const landingFrames = 8;
/** The longest a passer holds the final pass for the shooter to get in reach. */
export const shooterWait = clipFps;
/** Waiting on the ball for a team-mate, the holder carries it on at this pace, in metres a second. */
export const waitingPace = 2.5;
/** A player turns at most once in this many frames, but to kick or aim. */
export const turnFrames = 20;
/**
 * The moment goes on this long after the ball arrives, so it settles in
 * the net, the keeper's hands or behind, before the reaction.
 */
export const afterArrival = Math.round(0.8 * clipFps);
