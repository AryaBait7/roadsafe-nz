"use client";

import { useEffect, useRef } from "react";
import type { IntroPhase } from "./useIntroSequence";

/**
 * A real 3D road, not a scrolling texture.
 *
 * Every element sits at a real depth in a `preserve-3d` world and a single
 * camera moves through it. Perspective projection then does all the work for
 * free: distant markings are genuinely small and tightly spaced, near ones are
 * large and far apart, and objects accelerate past the viewer because that is
 * what projection does — not because anything is being scaled.
 *
 * **One number drives the whole scene.** `drive` is the distance the camera
 * has covered, and the looping world and the sign both read it. Nothing has
 * its own timeline, so nothing can drift out of step with anything else: the
 * markings, the guardrails, their posts, the board and its columns are all
 * the same journey seen from one eye.
 *
 * Two things used to break that illusion, and both are gone:
 *
 *  1. The sign's distance was capped (`Math.min(travelled, LIMIT)`) so it
 *     would not grow without bound, while the road kept rushing past
 *     underneath. Against a moving road a stationary board reads as
 *     *receding* — the board appeared to drive backwards. The camera itself
 *     now decelerates onto the sign, so the board reaches its close position
 *     because the journey ends there, not because it was clamped.
 *  2. A replay reset the sign's transform from 1,970 straight back to 0 while
 *     it was still on screen, which was a literal jump backwards. The board is
 *     now blanked for the frame in which it is repositioned.
 *
 *  3. **The fade flattened the scene.** `opacity` is a grouping property: an
 *     element with `opacity < 1` is forced to `transform-style: flat`, whatever
 *     its computed value says. The sign's wrapper carried both the 3D context
 *     and the fade, so for the 900ms of every fade the perspective switched off
 *     and the board snapped from its projected size to its raw layout size.
 *     Measured on the running page: same element, same transform, opacity 1 →
 *     94px wide, opacity 0.5 → 530px. That is the large billboard that appeared
 *     on the first frame of a fresh visit. The fade now lives on the leaf
 *     elements — the board and the two columns — which have no 3D children to
 *     lose, and the wrapper passes it down as `--sign-opacity` so it never
 *     touches an element in the 3D chain.
 *
 * Cost is two transform writes per frame regardless of how many objects are
 * in the scene.
 *
 * Decorative: hidden from assistive technology.
 */

/** Focal length. Smaller = wider field of view = more dramatic depth. */
const PERSPECTIVE = 420;

/** Distance from eye level down to the road surface. */
const GROUND_Y = 300;

/** Half the sealed carriageway width. */
const ROAD_HALF = 135;

/**
 * The world repeats every LOOP units. Markings sit one LOOP apart and posts
 * at half that, so both patterns are continuous across the wrap.
 *
 * NEAR_Z is how far *past* the camera plane the nearest object travels before
 * the loop resets. At NEAR_Z the ground projects to about 741px below the
 * horizon, which clears the bottom of any realistic viewport, so the wrap is
 * never visible as a flash.
 */
const LOOP = 140;
const NEAR_Z = 250;
const MARKING_COUNT = 30;
const POST_SPACING = LOOP / 2;
const POST_COUNT = MARKING_COUNT * 2;

/** Total length of road built, in world units. */
const ROAD_LENGTH = MARKING_COUNT * LOOP;

/** How far ahead the sign starts, and where on the road it stands. */
const SIGN_Z = -2100;
const SIGN_X = 0;

/**
 * The gap left between the camera and the board when the drive ends. At this
 * distance the board projects to roughly 300px across — dominant and easily
 * readable, the size of a real gantry sign a few car lengths ahead.
 */
const FINAL_GAP = 130;

/** The whole journey, in world units. The camera stops exactly here. */
const DRIVE_DISTANCE = -SIGN_Z - FINAL_GAP;

/**
 * How long the drive takes. It lands at 3.0s of the 4.0s sequence, so the
 * board holds its full size for the 800ms before the hero copy takes over —
 * long enough to read, short enough that nobody is waiting on it.
 */
const DRIVE_MS = 3000;

/** How quickly Skip closes whatever distance is left. */
const SKIP_MS = 380;

/**
 * A slow drift once the camera has arrived, so the road behind the hero copy
 * is not a frozen photograph. It moves the world only — the board holds its
 * position, and by then it has faded out.
 */
const IDLE_SPEED = 18;

/** Peak speed of the drive, used to scale the motion blur. */
const PEAK_SPEED = (1.5 * DRIVE_DISTANCE) / (DRIVE_MS / 1000);

/** The board. Wide enough to span the carriageway and carry the wordmark. */
const SIGN_WIDTH = 400;
const SIGN_HEIGHT_Y = 205;

/**
 * Where the two columns stand: under the outer thirds of the board, at the
 * road edge, level with the guardrail line. That single placement is what
 * grounds them — the column lands in the barrier rather than in a traffic
 * lane, so it needs no brackets, plates or feet to look founded, and the
 * driving lane between them stays completely clear.
 */
const SIGN_POST_SPREAD = ROAD_HALF + 21;
const SIGN_POST_WIDTH = 24;
const SIGN_POST_DEPTH = 18;
const SIGN_POST_HEIGHT = 150;

/**
 * Smoothstep: away from rest, up to speed through the middle, and easing to a
 * stop at the board. Monotonic by construction, so the distance it returns
 * can only ever increase — the board cannot shrink or travel backwards at any
 * point of the approach.
 */
function easeDrive(p: number): number {
  return p * p * (3 - 2 * p);
}

function GuardRail({ side }: { side: -1 | 1 }) {
  const x = side * (ROAD_HALF + 26);

  return (
    <>
      {/* The rail itself: one long plane turned to face across the road, so
          its width maps onto the Z axis and it recedes with the road. */}
      <div
        className="absolute top-1/2 left-1/2 bg-gradient-to-b from-surface-300/70 to-surface-500/40"
        style={{
          width: ROAD_LENGTH,
          height: 13,
          transform: `translate(-50%, -50%) translate3d(${x}px, ${GROUND_Y - 46}px, ${NEAR_Z - ROAD_LENGTH / 2}px) rotateY(90deg)`,
        }}
      />
      {/* A bright top edge catching the light, and the shadowed underside. */}
      <div
        className="absolute top-1/2 left-1/2 bg-surface-200/70"
        style={{
          width: ROAD_LENGTH,
          height: 2,
          transform: `translate(-50%, -50%) translate3d(${x}px, ${GROUND_Y - 52}px, ${NEAR_Z - ROAD_LENGTH / 2}px) rotateY(90deg)`,
        }}
      />
      <div
        className="absolute top-1/2 left-1/2 bg-navy-950/60"
        style={{
          width: ROAD_LENGTH,
          height: 5,
          transform: `translate(-50%, -50%) translate3d(${x}px, ${GROUND_Y - 33}px, ${NEAR_Z - ROAD_LENGTH / 2}px) rotateY(90deg)`,
        }}
      />

      {/* Posts. These are what actually sell the speed: they are discrete, so
          they visibly rush past and vanish beneath the viewer. */}
      {Array.from({ length: POST_COUNT }, (_, i) => (
        <div
          key={i}
          className="absolute top-1/2 left-1/2 bg-surface-400/55"
          style={{
            width: 7,
            height: 52,
            transform: `translate(-50%, -50%) translate3d(${x}px, ${GROUND_Y - 20}px, ${NEAR_Z - (i + 1) * POST_SPACING}px)`,
          }}
        />
      ))}
    </>
  );
}

/**
 * One support column.
 *
 * Two faces at right angles and nothing else. An earlier version added a
 * collar, a base plate, a plinth and a bracket out to the barrier, and the
 * result read as scaffolding: the eye went to the ironmongery instead of the
 * board it was holding up. The hierarchy has to be board, then road, then
 * guardrails, then supports — so the supports lost every part that was not
 * load-bearing in the picture.
 *
 * What is left does three quiet things. It tapers, slightly wider at the base
 * than the head, the way a real motorway column does. It is lit from the
 * centre of the road, so the two columns are mirror images rather than
 * copies. And its foot is masked out instead of finished with a plate, so it
 * fades into the guardrail line — no join to draw, nothing to notice.
 *
 * Both faces live inside the sign's transform group, so they approach the
 * viewer on exactly the distance the board does. Nothing is scaled
 * independently, which is the only way the structure stays rigid as it grows.
 */
function SignPost({ offset }: { offset: number }) {
  const side = Math.sign(offset);
  const x = SIGN_X + offset;
  const centreY = GROUND_Y - SIGN_POST_HEIGHT / 2 + 8;

  // The visible side face is the one turned toward the centre line, because
  // that is where the camera is.
  const sideX = x - side * (SIGN_POST_WIDTH / 2);

  // Fades the last fifth of the column into the barrier line.
  const fade = "linear-gradient(to top, transparent 0%, #000 20%)";

  // Lit from the middle of the road: the left column catches it on its right
  // flank, the right column on its left, so the pair are mirror images
  // rather than copies.
  const shaft =
    `linear-gradient(to ${side < 0 ? "right" : "left"}, ` +
    "#151b24 0%, #3d4552 20%, #828c9a 40%, #b3bdca 52%, " +
    "#6f7987 68%, #2f3744 86%, #11161e 100%)";

  return (
    <>
      <div
        className="absolute top-1/2 left-1/2"
        style={{
          width: SIGN_POST_DEPTH,
          height: SIGN_POST_HEIGHT,
          background: "linear-gradient(to right, #0f151d, #29303e)",
          opacity: "var(--sign-opacity, 1)",
          transition: "opacity var(--sign-fade, 520ms) ease-out",
          maskImage: fade,
          WebkitMaskImage: fade,
          transform: `translate(-50%, -50%) translate3d(${sideX}px, ${centreY}px, ${-SIGN_POST_DEPTH / 2}px) rotateY(90deg)`,
        }}
      />

      <div
        className="absolute top-1/2 left-1/2 overflow-hidden"
        style={{
          width: SIGN_POST_WIDTH,
          height: SIGN_POST_HEIGHT,
          background: shaft,
          opacity: "var(--sign-opacity, 1)",
          transition: "opacity var(--sign-fade, 520ms) ease-out",
          clipPath: "polygon(12% 0%, 88% 0%, 100% 100%, 0% 100%)",
          maskImage: fade,
          WebkitMaskImage: fade,
          transform: `translate(-50%, -50%) translate3d(${x}px, ${centreY}px, 0px)`,
        }}
      >
        {/* The board's own light spilling down the head of the column. */}
        <span
          className="absolute inset-x-0 top-0 block h-2/5"
          style={{
            background:
              "linear-gradient(to bottom, rgba(255,199,44,0.24), rgba(255,199,44,0.06) 55%, transparent)",
          }}
        />
      </div>
    </>
  );
}

/**
 * The RoadSafe NZ sign — a physical board over the highway, not an overlay.
 *
 * It is a normal DOM element placed at a real depth, so it is approached
 * rather than scaled: its size, position and the rate it grows all fall out of
 * the same projection as the road. Keeping it in the DOM also keeps the
 * wordmark crisp at every distance and themeable from the same tokens.
 *
 * Built as a frame around a panel rather than a bordered box, which is what
 * separates a road sign from a web card: the outer plate carries the metal
 * and the shadow, the inner panel carries the message.
 *
 * It spans the carriageway dead centre, so the centre line and both barriers
 * converge on the middle of the board at every screen width.
 */
function RoadSign() {
  return (
    <>
      {[-SIGN_POST_SPREAD, SIGN_POST_SPREAD].map((offset) => (
        <SignPost key={offset} offset={offset} />
      ))}

      <div
        className="absolute top-1/2 left-1/2 rounded-xl p-[7px]"
        style={{
          width: SIGN_WIDTH,
          // Brushed steel frame: bright top edge, body, dark underside, and a
          // faint lift again at the bottom lip.
          background:
            "linear-gradient(to bottom, #9aa4b2 0%, #4d5765 34%, #262d38 74%, #5c6573 100%)",
          boxShadow:
            "0 20px 44px rgba(2,6,14,0.78), 0 0 54px rgba(255,199,44,0.20), 0 0 140px rgba(255,199,44,0.09)",
          opacity: "var(--sign-opacity, 1)",
          transition: "opacity var(--sign-fade, 520ms) ease-out",
          transform: `translate(-50%, -50%) translate3d(${SIGN_X}px, ${GROUND_Y - SIGN_HEIGHT_Y}px, 0px)`,
        }}
      >
        <div
          className="rounded-lg border border-safety-400/75 bg-navy-900 px-8 py-7 text-center"
          style={{
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.10), inset 0 0 46px rgba(4,9,18,0.85)",
          }}
        >
          {/* The padding-left compensates for the trailing letter-space, so
              wide-tracked lines are optically centred rather than sitting a
              fraction to the left. */}
          <span className="block pl-[0.4em] text-[13px] font-semibold tracking-[0.4em] text-safety-400">
            ROAD SAFETY
          </span>
          {/* nowrap: the wordmark is one object, and it broke onto a second
              line inside the board at larger sizes. */}
          <span className="mt-3 block text-5xl font-semibold tracking-tight whitespace-nowrap text-white">
            RoadSafe<span className="text-safety-400"> NZ</span>
          </span>
          <span
            aria-hidden
            className="mx-auto mt-4 block h-px w-12 bg-safety-400/35"
          />
          <span className="mt-3 block pl-[0.3em] text-[12px] tracking-[0.3em] text-surface-300">
            NEW ZEALAND
          </span>
        </div>
      </div>
    </>
  );
}

export function RoadScene({
  phase,
  runId,
}: {
  phase: IntroPhase;
  /** Changes on every replay; restarts the drive from zero distance. */
  runId: number;
}) {
  const worldRef = useRef<HTMLDivElement>(null);
  const signRef = useRef<HTMLDivElement>(null);
  const blurRef = useRef<HTMLDivElement>(null);

  // Read by the animation loop without re-subscribing it on every change.
  // Written in an effect, not during render: a ref is not render state, and
  // mutating one while rendering is a correctness hazard React flags.
  const skipping = useRef(false);

  useEffect(() => {
    skipping.current = phase === "done";
  }, [phase]);

  useEffect(() => {
    // Keyed on runId: the journey lives inside this effect, so a replay has to
    // re-run it. Without that the camera kept the distance from the previous
    // run and the sign was already behind the viewer — the replay showed a
    // road with no billboard on it.
    skipping.current = false;

    const world = worldRef.current;
    const sign = signRef.current;
    const blur = blurRef.current;

    // Respect reduced motion by never starting the loop. The scene still has
    // to look finished, so the camera is placed at the end of the drive
    // rather than left at the start of it.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (sign) sign.style.transform = `translateZ(${DRIVE_DISTANCE}px)`;
      return;
    }

    /**
     * Put the board back to the horizon *while it is invisible*. Moving it
     * 1,970 units away in one frame is the one genuinely backwards movement
     * in the sequence, so it happens behind a blank frame and the fade is
     * handed back to the phase on the next one.
     */
    if (sign) {
      sign.style.setProperty("--sign-fade", "0ms");
      sign.style.setProperty("--sign-opacity", "0");
      sign.style.transform = "translateZ(0px)";
    }
    if (world) world.style.transform = "translateZ(0px)";
    if (blur) blur.style.opacity = "0";

    let frame = 0;
    let start = performance.now();
    let paused = false;
    let previousDistance = 0;
    let previousTime = 0;
    let restored = false;

    // Where Skip caught the drive, so the remainder can be closed smoothly
    // instead of cutting. Both values only ever move forward.
    let skipFrom: number | null = null;
    let skipAt = 0;

    const step = (now: number) => {
      const elapsed = now - start;

      let p = Math.min(elapsed / DRIVE_MS, 1);

      if (skipping.current && p < 1) {
        if (skipFrom === null) {
          skipFrom = p;
          skipAt = elapsed;
        }
        const closing = Math.min((elapsed - skipAt) / SKIP_MS, 1);
        p = Math.max(p, skipFrom + (1 - skipFrom) * closing);
      }

      // The drive itself: monotonic, and finishing exactly at the board.
      const drive = DRIVE_DISTANCE * easeDrive(p);

      // The idle drift applies to the world alone, so the board never moves
      // relative to the camera once it has arrived.
      const idle = p < 1 ? 0 : ((elapsed - DRIVE_MS) / 1000) * IDLE_SPEED;
      const travelled = drive + idle;

      // Only transforms are written — no layout is read, so nothing forces a
      // synchronous reflow inside the frame.
      if (world) world.style.transform = `translateZ(${travelled % LOOP}px)`;
      if (sign) sign.style.transform = `translateZ(${drive}px)`;

      if (blur) {
        // Motion blur lives on a plain 2D layer, never on the 3D world: a CSS
        // filter creates a containing block and would flatten preserve-3d,
        // collapsing the scene.
        const speed = previousTime
          ? ((travelled - previousDistance) / (now - previousTime)) * 1000
          : 0;
        blur.style.opacity = String(Math.min(speed / PEAK_SPEED, 1) * 0.5);
      }
      previousDistance = travelled;
      previousTime = now;

      // The board is back at the horizon and 67px wide, so it is safe to
      // show. It appears instantly at that size — a cross-fade at the
      // vanishing point would be invisible anyway — and the normal fade
      // duration is handed back for the reveal at the end of the drive.
      if (!restored && sign) {
        restored = true;
        sign.style.setProperty("--sign-opacity", "1");
        sign.style.setProperty("--sign-fade", "520ms");
      }

      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);

    // Stop burning frames while the tab is hidden, and resume without having
    // banked the time it was away — otherwise the drive would be over before
    // anyone saw it.
    const onVisibility = () => {
      if (document.hidden && !paused) {
        paused = true;
        cancelAnimationFrame(frame);
      } else if (!document.hidden && paused) {
        paused = false;
        const held = performance.now() - start;
        start = performance.now() - Math.min(held, DRIVE_MS);
        previousTime = 0;
        frame = requestAnimationFrame(step);
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [runId]);

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-navy-950">
      {/* Sky and horizon sit behind the 3D world as flat layers — they are
          effectively at infinity, so they gain nothing from being in it.

          One continuous gradient rather than stacked bands: overlapping
          layers with their own start and end points produced visible
          horizontal seams across the middle of the frame, which read as flat
          strips and undid the depth the road works to create. The stops are
          placed around the vanishing point at 46%. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, #050b16 0%, #071120 26%, #0d1e33 40%, #24304a 45%, #4a4433 47.5%, #1a2133 50%, #0a101c 60%, #070d17 100%)",
        }}
      />

      {/* Dusk glow concentrated at the vanishing point, so the light appears
          to come from where the road goes rather than from a flat band. */}
      <div
        className="absolute inset-x-0 top-[34%] h-[26%]"
        style={{
          background:
            "radial-gradient(ellipse 46% 100% at 50% 100%, rgba(255,199,44,0.16), rgba(255,199,44,0.05) 45%, transparent 72%)",
        }}
      />

      {/* Three ranges rather than two. Depth outdoors is carried by how much
          atmosphere sits between you and a thing, so each range further back
          is fainter and lower in contrast than the one in front of it. */}
      <svg
        className="absolute inset-x-0 top-[28%] h-[20%] w-full"
        viewBox="0 0 1200 180"
        preserveAspectRatio="none"
      >
        <path
          d="M0 180 L0 118 L86 58 L168 104 L268 40 L356 96 L448 52 L560 110 L642 62 L742 112 L836 66 L940 114 L1044 60 L1132 106 L1200 78 L1200 180 Z"
          className="fill-navy-900/45"
        />
        <path
          d="M0 180 L0 116 L110 62 L196 108 L286 46 L398 112 L470 82 L560 124 L654 68 L742 116 L840 78 L944 120 L1046 72 L1130 112 L1200 88 L1200 180 Z"
          className="fill-navy-950/80"
        />
        <path
          d="M0 180 L0 146 L96 120 L214 150 L322 116 L448 152 L566 128 L690 154 L806 124 L928 152 L1052 126 L1200 150 L1200 180 Z"
          className="fill-navy-950"
        />
      </svg>

      {/* The 3D scene. perspective-origin sets where the vanishing point sits;
          just above centre puts the horizon high enough for the road to fill
          the lower frame.

          World units are pixels, so on a phone the sign would sit past the
          screen edge. The whole stage is scaled down about the vanishing
          point instead; the scale lives on this plain parent, never on a
          preserve-3d element, so the scene is not flattened. */}
      <div
        className="absolute inset-0 origin-[50%_46%] [scale:0.64] sm:[scale:0.82] md:[scale:1]"
        style={{
          perspective: `${PERSPECTIVE}px`,
          perspectiveOrigin: "50% 46%",
        }}
      >
        {/* Looping world: markings, guardrails, road surface. */}
        <div
          ref={worldRef}
          className="absolute inset-0"
          style={{ transformStyle: "preserve-3d", willChange: "transform" }}
        >
          {/* Shoulders, then the sealed surface on top. */}
          <div
            className="absolute top-1/2 left-1/2 bg-[linear-gradient(to_top,#0a0e15,#131a26)]"
            style={{
              width: (ROAD_HALF + 90) * 2,
              height: ROAD_LENGTH,
              transform: `translate(-50%, -50%) translate3d(0px, ${GROUND_Y + 1}px, ${NEAR_Z - ROAD_LENGTH / 2}px) rotateX(90deg)`,
            }}
          />
          {/* The seal lightens toward the horizon, where the surface catches
              the sky: a flat fill reads as a painted ramp, not tarmac. */}
          <div
            className="absolute top-1/2 left-1/2 bg-[linear-gradient(to_top,#0b1119,#1b2433_45%,#26303f)]"
            style={{
              width: ROAD_HALF * 2,
              height: ROAD_LENGTH,
              transform: `translate(-50%, -50%) translate3d(0px, ${GROUND_Y}px, ${NEAR_Z - ROAD_LENGTH / 2}px) rotateX(90deg)`,
            }}
          />

          {/* Continuous edge lines. */}
          {[-1, 1].map((side) => (
            <div
              key={side}
              className="absolute top-1/2 left-1/2 bg-white/35"
              style={{
                width: 5,
                height: ROAD_LENGTH,
                transform: `translate(-50%, -50%) translate3d(${side * (ROAD_HALF - 12)}px, ${GROUND_Y - 1}px, ${NEAR_Z - ROAD_LENGTH / 2}px) rotateX(90deg)`,
              }}
            />
          ))}

          {/* Centre markings as discrete slabs. Being real objects is the
              whole point: each one approaches, grows, and sweeps under the
              camera at its own rate. */}
          {Array.from({ length: MARKING_COUNT }, (_, i) => (
            <div
              key={i}
              className="absolute top-1/2 left-1/2 rounded-[1px] bg-safety-400"
              style={{
                width: 9,
                height: 62,
                transform: `translate(-50%, -50%) translate3d(0px, ${GROUND_Y - 1}px, ${NEAR_Z - (i + 1) * LOOP}px) rotateX(90deg)`,
              }}
            />
          ))}

          <GuardRail side={-1} />
          <GuardRail side={1} />
        </div>

        {/* The sign rides the drive, not the loop, so it is approached exactly
            once.

            It fades once the hero wordmark has arrived: both carry the same
            words, and two "RoadSafe NZ" of different sizes on top of each
            other is clutter. The board is at its largest and most readable
            through travel, slowing and title — the approach it exists for —
            and then yields the frame. */}
        <div
          ref={signRef}
          className="absolute inset-0"
          style={
            {
              transformStyle: "preserve-3d",
              willChange: "transform",
              // NOT `opacity`. See the note on the component above: opacity on
              // this element would flatten the scene it carries.
              "--sign-opacity": phase === "reveal" || phase === "done" ? 0 : 1,
            } as React.CSSProperties
          }
        >
          <div
            className="absolute inset-0"
            style={{
              transformStyle: "preserve-3d",
              transform: `translateZ(${SIGN_Z}px)`,
            }}
          >
            <RoadSign />
          </div>
        </div>
      </div>

      {/* Atmospheric haze at the horizon. The road plane is finite, so without
          this its far end stops abruptly against the sky; fading it out makes
          the surface appear to continue past the vanishing point. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-[40%] h-[16%]"
        style={{
          background:
            "linear-gradient(to bottom, rgba(10,16,28,0.95) 0%, rgba(10,16,28,0.6) 42%, rgba(10,16,28,0.2) 74%, transparent 100%)",
        }}
      />

      {/* Speed streaks: a flat layer outside the 3D context, faded in with
          velocity. Kept out of the world so its blur cannot flatten it. */}
      <div
        ref={blurRef}
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%] opacity-0"
        style={{
          background:
            "repeating-linear-gradient(to right, transparent 0 46px, rgba(255,255,255,0.05) 46px 52px, transparent 52px 104px)",
          filter: "blur(7px)",
          transition: "opacity 400ms linear",
        }}
      />

      {/* Vignette, then the grade that deepens as the camera slows so the hero
          copy has something to sit against. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_46%,transparent_34%,rgba(7,17,32,0.78)_100%)]" />
      <div
        className="absolute inset-0 bg-navy-950 transition-opacity duration-1000 ease-out"
        style={{ opacity: phase === "travel" ? 0 : 0.5 }}
      />
    </div>
  );
}
