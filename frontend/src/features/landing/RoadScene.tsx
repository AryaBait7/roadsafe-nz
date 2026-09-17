"use client";

import { useEffect, useRef } from "react";
import type { IntroPhase } from "./useIntroSequence";

/**
 * A real 3D road, not a scrolling texture.
 *
 * The previous version painted a repeating gradient onto a tilted plane and
 * scrolled its background. That can suggest motion, but it cannot do what a
 * driving shot actually needs: there are no *objects* in a texture, so posts
 * cannot pass the camera and a sign cannot be approached — they would only
 * ever be more pattern.
 *
 * Here every element sits at a real depth in a `preserve-3d` world and a
 * single camera container moves through it. Perspective projection then does
 * all the work for free: distant markings are genuinely small and tightly
 * spaced, near ones are large and far apart, and objects accelerate past the
 * viewer because that is what projection does — not because anything is
 * being scaled.
 *
 * Cost is one transform write per frame for the looping world and one for the
 * sign, regardless of how many objects are in the scene.
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
 * the loop resets. It matters: at the reset the nearest object must already
 * be below the bottom of the viewport, otherwise the wrap is visible as a
 * flash. At NEAR_Z the ground projects to GROUND_Y * PERSPECTIVE /
 * (PERSPECTIVE - NEAR_Z) ≈ 741px below the horizon, which clears the bottom
 * of any realistic viewport.
 */
const LOOP = 140;
const NEAR_Z = 250;
const MARKING_COUNT = 30;
const POST_SPACING = LOOP / 2;
const POST_COUNT = MARKING_COUNT * 2;

/** Total length of road built, in world units. */
const ROAD_LENGTH = MARKING_COUNT * LOOP;

/**
 * The sign starts this far ahead and is approached exactly once, so it lives
 * outside the looping world and rides cumulative distance instead.
 */
const SIGN_Z = -2100;

/** Camera speed per phase, in world units per second. */
const SPEED: Record<IntroPhase, number> = {
  travel: 560,
  slowing: 300,
  title: 130,
  reveal: 45,
  done: 10,
};

/** How quickly actual speed converges on the phase's target. */
const ACCELERATION = 1.9;

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
 * The RoadSafe NZ sign — a physical board beside the highway, not an overlay.
 *
 * It is a normal DOM element placed at a real depth, so it is approached
 * rather than scaled: its size, position and the rate it grows all fall out
 * of the same projection as the road. Keeping it in the DOM also keeps the
 * wordmark crisp at every distance and themeable from the same tokens.
 *
 * Below 1280px it becomes an overhead gantry centred over the carriageway.
 * Projected, a roadside board 255 units out leaves a 375px screen by the
 * title phase; shrinking the stage enough to keep it would shrink the road
 * with it. The offsets are CSS variables (see `.road-sign-layout` in
 * globals.css) so the switch needs no JavaScript and no re-render.
 */
function RoadSign() {
  return (
    <>
      {/* Two support posts: planted on the shoulder beside the board, or at
          the road edges when it spans the carriageway. */}
      {["var(--sign-post-left)", "var(--sign-post-right)"].map((x) => (
        <div
          key={x}
          className="absolute top-1/2 left-1/2 bg-surface-500/70"
          style={{
            width: 9,
            height: 132,
            transform: `translate(-50%, -50%) translate3d(${x}, ${GROUND_Y - 62}px, 0px)`,
          }}
        />
      ))}

      {/* Gantry crossbar, only in the overhead layout. */}
      <div
        className="absolute top-1/2 left-1/2 bg-surface-500/70 xl:hidden"
        style={{
          width: (ROAD_HALF + 26) * 2,
          height: 7,
          transform: `translate(-50%, -50%) translate3d(0px, ${GROUND_Y - 128}px, 0px)`,
        }}
      />

      {/* The board. Angled slightly toward the carriageway, the way a real
          roadside sign is, and lit as if catching headlights at dusk. */}
      <div
        className="absolute top-1/2 left-1/2 rounded-md border-2 border-safety-400 bg-navy-900 px-5 py-4 text-center"
        style={{
          width: 300,
          transform: `translate(-50%, -50%) translate3d(var(--sign-x), ${GROUND_Y - 190}px, 0px) rotateY(var(--sign-turn))`,
          boxShadow:
            "0 0 34px rgba(255,199,44,0.30), 0 0 90px rgba(255,199,44,0.12), inset 0 1px 0 rgba(255,255,255,0.14)",
        }}
      >
        <span className="block text-[11px] font-semibold tracking-[0.3em] text-safety-400">
          ROAD SAFETY
        </span>
        <span className="mt-1 block text-4xl font-semibold tracking-tight text-white">
          RoadSafe<span className="text-safety-400"> NZ</span>
        </span>
        <span className="mt-1.5 block text-[10px] tracking-[0.18em] text-surface-300">
          NEW ZEALAND
        </span>
      </div>
    </>
  );
}

export function RoadScene({
  phase,
  isMoving,
}: {
  phase: IntroPhase;
  isMoving: boolean;
}) {
  const worldRef = useRef<HTMLDivElement>(null);
  const signRef = useRef<HTMLDivElement>(null);
  const blurRef = useRef<HTMLDivElement>(null);

  // Read by the animation loop without re-subscribing it on every change.
  // Written in an effect, not during render: a ref is not render state, and
  // mutating one while rendering is a correctness hazard React flags.
  const targetSpeed = useRef(SPEED.travel);

  useEffect(() => {
    targetSpeed.current = isMoving ? SPEED[phase] : SPEED.done;
  }, [phase, isMoving]);

  useEffect(() => {
    // Respect reduced motion by never starting the loop; the static frame
    // below is already a complete scene.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let previous = performance.now();
    let travelled = 0;
    let speed = 0;
    let paused = false;

    const step = (now: number) => {
      const delta = Math.min((now - previous) / 1000, 0.05);
      previous = now;

      // Ease toward the phase's target rather than snapping, so changing
      // phase reads as the vehicle slowing rather than a cut.
      speed += (targetSpeed.current - speed) * Math.min(1, delta * ACCELERATION);
      travelled += speed * delta;

      // Only transforms are written — no layout is read, so nothing forces a
      // synchronous reflow inside the frame.
      if (worldRef.current) {
        worldRef.current.style.transform = `translateZ(${travelled % LOOP}px)`;
      }
      if (signRef.current) {
        signRef.current.style.transform = `translateZ(${travelled}px)`;
      }
      if (blurRef.current) {
        // Motion blur lives on a plain 2D layer, never on the 3D world: a
        // CSS filter creates a containing block and would flatten
        // preserve-3d, collapsing the scene.
        blurRef.current.style.opacity = String(
          Math.min(speed / SPEED.travel, 1) * 0.5,
        );
      }

      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);

    // Stop burning frames while the tab is hidden.
    const onVisibility = () => {
      if (document.hidden && !paused) {
        paused = true;
        cancelAnimationFrame(frame);
      } else if (!document.hidden && paused) {
        paused = false;
        previous = performance.now();
        frame = requestAnimationFrame(step);
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

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

      <svg
        className="absolute inset-x-0 top-[30%] h-[18%] w-full"
        viewBox="0 0 1200 160"
        preserveAspectRatio="none"
      >
        <path
          d="M0 160 L0 96 L110 42 L196 88 L286 26 L398 92 L470 62 L560 104 L654 48 L742 96 L840 58 L944 100 L1046 52 L1130 92 L1200 68 L1200 160 Z"
          className="fill-navy-950/80"
        />
        <path
          d="M0 160 L0 126 L96 100 L214 130 L322 96 L448 132 L566 108 L690 134 L806 104 L928 132 L1052 106 L1200 130 L1200 160 Z"
          className="fill-navy-950"
        />
      </svg>

      {/* The 3D scene. perspective-origin sets where the vanishing point sits;
          just above centre puts the horizon high enough for the road to fill
          the lower frame.

          World units are pixels, so on a phone the roadside sign would sit
          past the screen edge. The whole stage is scaled down about the
          vanishing point instead; the scale lives on this plain parent, never
          on a preserve-3d element, so the scene is not flattened. */}
      <div
        className="road-sign-layout absolute inset-0 origin-[50%_46%] [scale:0.64] sm:[scale:0.82] md:[scale:1]"
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
          <div
            className="absolute top-1/2 left-1/2 bg-[linear-gradient(to_top,#0b1119,#222b3b)]"
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

        {/* The sign rides total distance, not the loop, so it is approached
            exactly once. */}
        <div
          ref={signRef}
          className="absolute inset-0"
          style={{ transformStyle: "preserve-3d", willChange: "transform" }}
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

      {/* Atmospheric haze at the horizon. The road plane is finite, so
          without this its far end stops abruptly against the sky; fading it
          out makes the surface appear to continue past the vanishing point. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-[41%] h-[14%]"
        style={{
          background:
            "linear-gradient(to bottom, rgba(10,16,28,0.95) 0%, rgba(10,16,28,0.55) 45%, transparent 100%)",
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

      {/* Vignette, then the grade that deepens as the camera slows so the
          hero copy has something to sit against. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_46%,transparent_34%,rgba(7,17,32,0.78)_100%)]" />
      <div
        className="absolute inset-0 bg-navy-950 transition-opacity duration-1000 ease-out"
        style={{ opacity: phase === "travel" ? 0 : 0.5 }}
      />
    </div>
  );
}
