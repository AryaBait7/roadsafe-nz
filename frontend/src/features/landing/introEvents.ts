/**
 * Window event dispatched when the visitor replays the landing intro.
 *
 * The hero owns the intro's state and the sections below are server-rendered,
 * so there is no shared React state between them — and lifting the intro into
 * a provider that wraps both would restructure the page to carry one signal.
 * A named window event keeps the two ends decoupled: the hero announces the
 * replay, anything that wants to reset listens for it.
 */
export const INTRO_REPLAY_EVENT = "roadsafe:intro-replay";
