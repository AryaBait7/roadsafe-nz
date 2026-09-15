"use client";

import { cn } from "@/lib/cn";
import type { IntroPhase } from "./useIntroSequence";

/**
 * The moving road, drawn entirely in CSS — no video or photograph.
 *
 * The road is a plane rotated back in 3D under a shallow perspective origin,
 * which produces a true vanishing point: the plane narrows to a point on the
 * horizon and its edges spread to the bottom corners on their own. Scrolling
 * the lane markings down that plane makes them approach and accelerate,
 * because perspective foreshortens the far end. Scaling a flat image cannot
 * reproduce that — everything would grow at the same rate.
 *
 * Depth cues, nearest to furthest:
 *   roadside posts -> hills -> mountains -> sky
 * Each layer moves more slowly than the one in front of it.
 *
 * Decorative: hidden from assistive technology. The real content sits above it.
 */

/**
 * One pitch = one full repeat of the marking gradient. The travel animation
 * shifts the background by exactly this distance, so every loop lands where
 * the last one started and the markings never jump. Every marking layer must
 * therefore use this same period, whatever its dash length.
 */
const MARKING_PITCH = 160;

const SPEEDS: Record<IntroPhase, { markings: string; near: string; mid: string }> = {
  travel: { markings: "0.42s", near: "3.5s", mid: "9s" },
  slowing: { markings: "1.5s", near: "11s", mid: "26s" },
  title: { markings: "4s", near: "26s", mid: "60s" },
  reveal: { markings: "7s", near: "40s", mid: "90s" },
  done: { markings: "9s", near: "50s", mid: "110s" },
};

/**
 * Longhand only. Setting the `animation` shorthand alongside
 * `animationPlayState` makes React warn and the result unreliable, because
 * re-rendering the shorthand resets the longhand it also controls — which
 * would break pausing precisely when a phase changes.
 */
function animation(
  name: string,
  duration: string,
  running: boolean,
): React.CSSProperties {
  return {
    animationName: name,
    animationDuration: duration,
    animationTimingFunction: "linear",
    animationIterationCount: "infinite",
    animationPlayState: running ? "running" : "paused",
  };
}

export function RoadScene({
  phase,
  isMoving,
}: {
  phase: IntroPhase;
  isMoving: boolean;
}) {
  const speed = SPEEDS[phase];
  const pitch = { "--marking-pitch": `${MARKING_PITCH}px` } as React.CSSProperties;

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-navy-950">
      {/* Sky: deep navy overhead warming toward a dusk horizon. */}
      <div className="absolute inset-x-0 top-0 h-[58%] bg-gradient-to-b from-navy-950 via-navy-900 to-navy-700" />
      <div className="absolute inset-x-0 top-[38%] h-[22%] bg-gradient-to-b from-transparent via-safety-500/12 to-safety-400/20" />

      {/* Mountains at the horizon. Static: distant objects show no parallax
          over the short distance the camera travels. */}
      <svg
        className="absolute inset-x-0 top-[40%] h-[20%] w-full"
        viewBox="0 0 1200 160"
        preserveAspectRatio="none"
      >
        <path
          d="M0 160 L0 96 L110 42 L196 88 L286 26 L398 92 L470 62 L560 104 L654 48 L742 96 L840 58 L944 100 L1046 52 L1130 92 L1200 68 L1200 160 Z"
          className="fill-navy-950/85"
        />
        <path
          d="M0 160 L0 126 L96 100 L214 130 L322 96 L448 132 L566 108 L690 134 L806 104 L928 132 L1052 106 L1200 130 L1200 160 Z"
          className="fill-navy-950"
        />
      </svg>

      {/* Middle-distance hills: slow lateral drift. */}
      <div className="absolute inset-x-0 top-[52%] h-[10%] overflow-hidden">
        <div
          className="h-full w-[200%] bg-[radial-gradient(ellipse_60px_18px_at_center,var(--color-navy-800)_60%,transparent_62%)] bg-[length:180px_100%] bg-repeat-x opacity-70"
          style={animation("scenery-drift", speed.mid, isMoving)}
        />
      </div>

      {/* The road plane.

          Rotation is anchored to the plane's BOTTOM edge, not its top. With
          `origin-top` the plane tips away and projects above its own
          container — measured at y 318-496 inside a wrapper occupying
          496-918, i.e. the road recedes up out of frame and only a squashed
          strip remains visible. Pivoting on the bottom edge instead lays the
          surface down in front of the camera: the near edge stays pinned to
          the bottom of the screen and the far edge recedes to the horizon.

          The plane is far taller than its wrapper so that, once foreshortened,
          it still reaches the horizon line rather than stopping short. */}
      <div
        className="absolute inset-x-0 bottom-0 h-[52%] overflow-hidden"
        style={{ perspective: "300px", perspectiveOrigin: "50% 0%" }}
      >
        <div
          className="absolute inset-x-0 bottom-0 h-[260%]"
          style={{ transformOrigin: "50% 100%", transform: "rotateX(75deg)" }}
        >
          {/* Asphalt. Lighter at the far end so atmospheric haze separates the
              road surface from the sky; without that contrast the plane is
              indistinguishable from the background and reads as no road. */}
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#2b3446,#141a25_45%,#0a0e15)]" />

          {/* Centre line, in safety yellow. */}
          <div
            className="absolute inset-y-0 left-1/2 w-[7px] -translate-x-1/2 bg-[repeating-linear-gradient(to_bottom,var(--color-safety-400)_0_70px,transparent_70px_160px)]"
            style={{
              ...pitch,
              ...animation("road-travel", speed.markings, isMoving),
            }}
          />

          {/* Solid edge lines */}
          <div className="absolute inset-y-0 left-[20%] w-[5px] bg-white/45" />
          <div className="absolute inset-y-0 right-[20%] w-[5px] bg-white/45" />

          {/* Lane dashes: shorter dash, but the gradient must still repeat on
              the same 160px period as the centre line. The travel animation
              shifts every marking layer by exactly one pitch, so a layer whose
              period does not divide into that distance jumps on each loop —
              160 / 44 is not an integer. Stating the transparent stop as
              80px keeps the period at 160 (80px dash gap x 2) while the dash
              itself stays 44px. */}
          {(["left-[35%]", "right-[35%]"] as const).map((side) => (
            <div
              key={side}
              className={cn(
                "absolute inset-y-0 w-[4px] bg-[repeating-linear-gradient(to_bottom,rgba(255,255,255,0.32)_0px,rgba(255,255,255,0.32)_44px,transparent_44px,transparent_160px)]",
                side,
              )}
              style={{
                ...pitch,
                ...animation("road-travel", speed.markings, isMoving),
              }}
            />
          ))}
        </div>
      </div>

      {/* Roadside posts: the nearest layer, so the fastest. Motion blur here
          only — blurring the whole frame would look like a focus fault. */}
      <div className="absolute inset-x-0 bottom-[14%] h-[16%] overflow-hidden">
        <div
          className="h-full w-[200%] bg-[repeating-linear-gradient(to_right,transparent_0_150px,rgba(255,255,255,0.22)_150px_154px,transparent_154px_300px)]"
          style={{
            ...animation("scenery-drift", speed.near, isMoving),
            filter: phase === "travel" ? "blur(2.5px)" : "blur(0px)",
            transition: "filter 900ms ease-out",
          }}
        />
      </div>

      {/* Vignette, then the navy grade that deepens as the camera slows so
          the wordmark has contrast to emerge against. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_46%,transparent_38%,rgba(7,17,32,0.72)_100%)]" />
      <div
        className={cn(
          "absolute inset-0 bg-navy-950 transition-opacity duration-1000 ease-out",
          phase === "travel" ? "opacity-0" : "opacity-55",
        )}
      />
    </div>
  );
}
