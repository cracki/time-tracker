"use client";

/**
 * OrbitLogo — brand logo wrapped in a Lottie orbital animation
 * (rotating dashed rings + orbiting dots + breathing halo).
 * Falls back to the plain logo if the animation layer fails.
 */

import { useEffect, useRef } from "react";
import { Lottie } from "lottie-react";
import type { LottieHandle } from "lottie-react";
import { orbitLottie } from "@/lib/lottie/orbit";
import { cn } from "@/lib/utils";

export function OrbitLogo({ size = 96, className }: { size?: number; className?: string }) {
  // Lottie box is 1.9x the logo so the rings orbit visibly outside it.
  const pad = size * 0.45;
  const box = size + pad * 2;
  const lottieRef = useRef<LottieHandle>(null);

  // Decorative motion — freeze it for reduced-motion users (WCAG 2.2.2).
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      lottieRef.current?.pause();
    }
  }, []);

  return (
    <span
      className={cn("relative inline-grid place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <span
        className="pointer-events-none absolute"
        style={{ left: -pad, top: -pad, width: box, height: box }}
      >
        <Lottie src={orbitLottie} loop autoplay lottieRef={lottieRef} aria-hidden className="size-full" />
      </span>
      <img src="/logo.png" alt="" aria-hidden className="size-full app-shadow" />
    </span>
  );
}
