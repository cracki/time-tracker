/**
 * Hand-crafted Lottie (bodymovin) animation: two dashed rings rotating in
 * opposite directions around the brand logo, a soft breathing halo, and
 * two glowing orbiting dots. 4s seamless loop @ 60fps.
 */

interface LottieLayer {
  ddd: 0;
  ind: number;
  ty: 4;
  nm: string;
  sr: number;
  ks: Record<string, unknown>;
  ao: 0;
  shapes: unknown[];
  ip: number;
  op: number;
  st: number;
}

const TAU_END = 240;

function rotateLayer(nm: string, ind: number, from: number, to: number, opacity: number): LottieLayer {
  return {
    ddd: 0,
    ind,
    ty: 4,
    nm,
    sr: 1,
    ks: {
      o: { a: 0, k: opacity },
      r: {
        a: 1,
        k: [
          { i: { x: [0.5], y: [1] }, o: { x: [0.5], y: [0] }, t: 0, s: [from] },
          { t: TAU_END, s: [to] },
        ],
      },
      p: { a: 0, k: [120, 120, 0] },
      a: { a: 0, k: [0, 0, 0] },
      s: { a: 0, k: [100, 100, 100] },
    },
    ao: 0,
    shapes: [],
    ip: 0,
    op: TAU_END,
    st: 0,
  };
}

/** Ellipse group helper (circle + stroke or fill + static transform). */
function circleGroup(radius: number, paint: Record<string, unknown>): unknown[] {
  return [
    {
      ty: "gr",
      nm: "circle",
      it: [
        { ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [radius * 2, radius * 2] }, nm: "el" },
        paint,
        {
          ty: "tr",
          p: { a: 0, k: [0, 0] },
          a: { a: 0, k: [0, 0] },
          s: { a: 0, k: [100, 100] },
          r: { a: 0, k: 0 },
          o: { a: 0, k: 100 },
        },
      ],
    },
  ];
}

const teal = [0.255, 0.631, 0.612, 1];
const emerald = [0.204, 0.78, 0.482, 1];
const amber = [0.961, 0.62, 0.043, 1];

const dashedRing = rotateLayer("ring-dash", 1, 0, 360, 75);
dashedRing.shapes = circleGroup(86, {
  ty: "st",
  c: { a: 0, k: teal },
  o: { a: 0, k: 90 },
  w: { a: 0, k: 3 },
  lc: 2,
  lj: 2,
  d: [
    { n: "d", nm: "dash", v: { a: 0, k: 8 } },
    { n: "g", nm: "gap", v: { a: 0, k: 16 } },
  ],
  nm: "stroke",
});

const thinRing = rotateLayer("ring-thin", 2, 360, 0, 30);
thinRing.shapes = circleGroup(70, {
  ty: "st",
  c: { a: 0, k: emerald },
  o: { a: 0, k: 55 },
  w: { a: 0, k: 1.6 },
  lc: 2,
  lj: 2,
  nm: "stroke",
});

/** Glowing dot riding a rotating layer (circle offset above the anchor). */
function orbitDot(nm: string, ind: number, orbitRadius: number, dotRadius: number, color: number[], phaseDeg: number, opacity: number): LottieLayer {
  const layer = rotateLayer(nm, ind, phaseDeg, phaseDeg + 360, opacity);
  layer.shapes = [
    {
      ty: "gr",
      nm: "dot",
      it: [
        { ty: "el", p: { a: 0, k: [0, -orbitRadius] }, s: { a: 0, k: [dotRadius * 2, dotRadius * 2] }, nm: "el" },
        { ty: "fl", c: { a: 0, k: color }, o: { a: 0, k: 100 }, nm: "fill" },
        {
          ty: "tr",
          p: { a: 0, k: [0, 0] },
          a: { a: 0, k: [0, 0] },
          s: { a: 0, k: [100, 100] },
          r: { a: 0, k: 0 },
          o: { a: 0, k: 100 },
        },
      ],
    },
  ];
  return layer;
}

/** Soft breathing halo behind the logo. */
const halo: LottieLayer = {
  ddd: 0,
  ind: 5,
  ty: 4,
  nm: "halo",
  sr: 1,
  ks: {
    o: {
      a: 1,
      k: [
        { t: 0, s: [22] },
        { t: 120, s: [8] },
        { t: TAU_END, s: [22] },
      ],
    },
    r: { a: 0, k: 0 },
    p: { a: 0, k: [120, 120, 0] },
    a: { a: 0, k: [0, 0, 0] },
    s: {
      a: 1,
      k: [
        { i: { x: [0.4, 0.4, 0.4], y: [1, 1, 1] }, o: { x: [0.6, 0.6, 0.6], y: [0, 0, 0] }, t: 0, s: [92, 92, 100] },
        { i: { x: [0.4, 0.4, 0.4], y: [1, 1, 1] }, o: { x: [0.6, 0.6, 0.6], y: [0, 0, 0] }, t: 120, s: [106, 106, 100] },
        { t: TAU_END, s: [92, 92, 100] },
      ],
    },
  },
  ao: 0,
  shapes: circleGroup(78, { ty: "fl", c: { a: 0, k: teal }, o: { a: 0, k: 100 }, nm: "fill" }),
  ip: 0,
  op: TAU_END,
  st: 0,
};

export const orbitLottie = {
  v: "5.7.4",
  fr: 60,
  ip: 0,
  op: TAU_END,
  w: 240,
  h: 240,
  nm: "orbit-logo",
  ddd: 0,
  assets: [],
  layers: [
    orbitDot("dot-a", 3, 86, 5, emerald, 180, 95),
    orbitDot("dot-b", 4, 70, 3.5, amber, 40, 80),
    dashedRing,
    thinRing,
    halo,
  ],
} as const;
