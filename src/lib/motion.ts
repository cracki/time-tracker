/**
 * Shared motion presets (framer-motion) — one place for the app's motion
 * language so screens stay consistent. Global reduced-motion is already
 * handled by the CSS kill-switch in globals.css (spec §22/§81), so presets
 * stay simple and declarative.
 *
 * Motion language:
 *  - entrances: 6–14px rise + fade, 180–280ms, easeOut (never bouncy)
 *  - lists: 30ms stagger between items, capped feel via a shared container
 *  - presses: scale 0.96–0.98 (CSS active:scale-* on buttons/FAB)
 *  - sheets/dialogs: keep the library defaults (vaul/radix already tuned)
 */

import type { Variants, Transition } from "framer-motion";

export const easeOut: Transition["ease"] = [0.16, 1, 0.3, 1];

/** Single element entrance. */
export const fadeUp: { initial: Record<string, number>; animate: Record<string, number>; transition: Transition } = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.22, ease: easeOut },
};

/** Stagger container + item for small grids/lists (≤ ~12 items). */
export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.03, delayChildren: 0.02 } },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.24, ease: easeOut } },
};

/** Spring for press/hold interactions (FAB, chips). */
export const pressSpring: Transition = { type: "spring", stiffness: 500, damping: 30 };
