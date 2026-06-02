// 3D bin packing using Maximal Empty Spaces.
// Coordinate system:
//   x = along container length (door -> nose)
//   y = up (height)
//   z = across container width
// All dimensions are in mm.

class FreeSpace {
  constructor(x, y, z, dx, dy, dz) {
    this.x = x; this.y = y; this.z = z;
    this.dx = dx; this.dy = dy; this.dz = dz;
  }
  get volume() { return this.dx * this.dy * this.dz; }
  fits(w, h, d) { return w <= this.dx + 1e-6 && h <= this.dy + 1e-6 && d <= this.dz + 1e-6; }
}

function rotations(L, W, H) {
  // 6 axis-aligned orientations returning [dx, dy, dz] = (length, height, width).
  return [
    [L, H, W], [L, W, H],
    [W, H, L], [W, L, H],
    [H, W, L], [H, L, W],
  ];
}

function dedupeRotations(rots) {
  const seen = new Set();
  const out = [];
  for (const r of rots) {
    const key = r.join('x');
    if (!seen.has(key)) { seen.add(key); out.push(r); }
  }
  return out;
}

// Zone is a soft preference, not a hard constraint.
//   'any'  — normal front-to-back packing.
//   'nose' — pack against the back wall first. For nose boxes, x-layer priority
//            dominates y so the back layer fills before the next layer starts.
const ZONE_PRIORITY = { nose: 0, any: 1 };

function zoneOf(box) {
  return box && box.zone === 'nose' ? 'nose' : 'any';
}

function loadOrderOf(box) {
  const n = parseInt(box && box.loadOrder, 10);
  return Number.isFinite(n) && n > 0 ? n : Number.MAX_SAFE_INTEGER;
}

// Try to place a single box into the best available free space.
//
// Returns a placement {box, x, y, z, dx, dy, dz} or null if it cannot fit.
function placeOne(box, spaces, container) {
  const rots = dedupeRotations(rotations(box.L, box.W, box.H));
  const minBoxDim = Math.min(box.L, box.W, box.H);
  const L = container.L;
  const anchorMax = zoneOf(box) === 'nose';

  let best = null;
  for (let i = 0; i < spaces.length; i++) {
    const s = spaces[i];
    if (s.dx < minBoxDim || s.dy < minBoxDim || s.dz < minBoxDim) continue;
    for (const [dx, dy, dz] of rots) {
      if (!s.fits(dx, dy, dz)) continue;
      const placeX = anchorMax ? (s.x + s.dx - dx) : s.x;
      const placeZ = s.z;
      const xTerm = anchorMax ? (L - (placeX + dx)) : placeX;
      const yTerm = s.y;
      const zTerm = placeZ;

      // Normal boxes stay low first. Nose boxes fill the current back x-layer
      // first, then move one layer toward the door.
      const score = anchorMax
        ? xTerm * 1e12 + yTerm * 1e7 + zTerm * 100 - dx
        : yTerm * 1e12 + xTerm * 1e7 + zTerm * 100 - dx;
      if (!best || score < best.score) {
        best = { score, dx, dy, dz, x: placeX, y: s.y, z: placeZ };
      }
    }
  }
  if (!best) return null;
  return { box, x: best.x, y: best.y, z: best.z, dx: best.dx, dy: best.dy, dz: best.dz };
}

// Apply a placement to the free-space list, returning the updated list.
function applyPlacement(spaces, placement) {
  const newSpaces = [];
  for (const s of spaces) {
    const subs = splitMaximal(s, placement);
    for (const sub of subs) if (sub.volume > 0) newSpaces.push(sub);
  }
  return pruneContained(newSpaces);
}

// Pack one container using a specific box-sort comparator.
// volumeCap (mm³) limits the total placed volume — used to honor the
// loading-efficiency setting. Pass Infinity for no cap.
// Returns { placed, unplaced, spaces, usedVol } so a follow-up pass can reuse
// the gaps and continue tracking the cap.
function packOneStrategy(container, boxes, cmp, volumeCap) {
  const sorted = [...boxes].sort(cmp);
  let spaces = [new FreeSpace(0, 0, 0, container.L, container.H, container.W)];
  const placed = [];
  const unplaced = [];
  let usedVol = 0;
  const eps = 1e-3;
  for (const box of sorted) {
    const boxVol = box.L * box.W * box.H;
    // Volume cap: stop placing once cumulative placed volume reaches the
    // efficiency-derived cap. Remaining boxes flow to the next container.
    if (usedVol + boxVol > volumeCap + eps) {
      unplaced.push(box);
      continue;
    }
    const placement = placeOne(box, spaces, container);
    if (!placement) { unplaced.push(box); continue; }
    placed.push(placement);
    spaces = applyPlacement(spaces, placement);
    usedVol += boxVol;
  }
  return { placed, unplaced, spaces, usedVol };
}

// Wrap a comparator so user-defined loading order comes first, then zone.
function withPackingPriority(cmp) {
  return (a, b) => {
    const oa = loadOrderOf(a);
    const ob = loadOrderOf(b);
    if (oa !== ob) return oa - ob;
    const za = ZONE_PRIORITY[zoneOf(a)] ?? 1;
    const zb = ZONE_PRIORITY[zoneOf(b)] ?? 1;
    if (za !== zb) return za - zb;
    return cmp(a, b);
  };
}

// Sort strategies — multi-pass packing tries each and keeps the best result.
// Different strategies produce different fill patterns; we just take whichever
// strategy fits the most boxes (with placed volume as the tiebreaker).
const SORT_STRATEGIES = [
  // 1. Longest dim first, then volume (original) — good for elongated items.
  withPackingPriority((a, b) => {
    const ma = Math.max(a.L, a.W, a.H);
    const mb = Math.max(b.L, b.W, b.H);
    if (mb !== ma) return mb - ma;
    return (b.L * b.W * b.H) - (a.L * a.W * a.H);
  }),
  // 2. Pure volume — large chunks first.
  withPackingPriority((a, b) => (b.L * b.W * b.H) - (a.L * a.W * a.H)),
  // 3. Largest face footprint — flat/wide items grab the floor first.
  withPackingPriority((a, b) => {
    const aMax = Math.max(a.L * a.W, a.L * a.H, a.W * a.H);
    const bMax = Math.max(b.L * b.W, b.L * b.H, b.W * b.H);
    if (bMax !== aMax) return bMax - aMax;
    return (b.L * b.W * b.H) - (a.L * a.W * a.H);
  }),
  // 4. Largest minimum-dim first — cuboids first; very different fill pattern.
  withPackingPriority((a, b) => {
    const ma = Math.min(a.L, a.W, a.H);
    const mb = Math.min(b.L, b.W, b.H);
    if (mb !== ma) return mb - ma;
    return (b.L * b.W * b.H) - (a.L * a.W * a.H);
  }),
];

function placedVolume(result) {
  let v = 0;
  for (const p of result.placed) v += p.dx * p.dy * p.dz;
  return v;
}

// Pack one container's worth of boxes.
//
// options.efficiency — fraction 0..1. Caps total placed volume at
//                      containerVolume * efficiency. Defaults to 1 (no cap).
// Phase 1 — Multi-strategy: try several sort orders, pick the result that
// fits the most boxes (tie-broken by placed volume).
// Phase 2 — Squeeze: if anything is unplaced, sort the leftovers smallest-
// first and try to slot them into the gaps left by the winning strategy.
function packBoxes(container, boxes, options) {
  if (boxes.length === 0) return { placed: [], unplaced: [] };
  const eff = (options && typeof options.efficiency === 'number') ? options.efficiency : 1;
  const containerVol = container.L * container.W * container.H;
  const volumeCap = containerVol * eff;
  const eps = 1e-3;

  let best = null;
  for (const cmp of SORT_STRATEGIES) {
    const r = packOneStrategy(container, boxes, cmp, volumeCap);
    if (!best
        || r.placed.length > best.placed.length
        || (r.placed.length === best.placed.length && placedVolume(r) > placedVolume(best))) {
      best = r;
    }
    // Short-circuit: if a strategy placed everything, no need to try more.
    if (best.unplaced.length === 0) break;
  }

  // Squeeze phase — try to fit any remaining boxes into gaps, smallest first.
  // Honors the same volume cap so we don't over-pack past the efficiency limit.
  if (best.unplaced.length > 0) {
    const leftoversAsc = [...best.unplaced].sort(
      withPackingPriority((a, b) => (a.L * a.W * a.H) - (b.L * b.W * b.H))
    );
    let spaces = best.spaces;
    let usedVol = best.usedVol || 0;
    const placed = best.placed.slice();
    const stillUnplaced = [];
    for (const box of leftoversAsc) {
      const boxVol = box.L * box.W * box.H;
      if (usedVol + boxVol > volumeCap + eps) {
        stillUnplaced.push(box);
        continue;
      }
      const placement = placeOne(box, spaces, container);
      if (!placement) { stillUnplaced.push(box); continue; }
      placed.push(placement);
      spaces = applyPlacement(spaces, placement);
      usedVol += boxVol;
    }
    best = { placed, unplaced: stillUnplaced, spaces, usedVol };
  }

  return { placed: best.placed, unplaced: best.unplaced };
}

function splitMaximal(space, box) {
  // If box does not intersect space, leave it intact.
  if (box.x >= space.x + space.dx || box.x + box.dx <= space.x ||
      box.y >= space.y + space.dy || box.y + box.dy <= space.y ||
      box.z >= space.z + space.dz || box.z + box.dz <= space.z) {
    return [space];
  }

  const out = [];
  // Slice on the -x side
  if (box.x > space.x)
    out.push(new FreeSpace(space.x, space.y, space.z,
                           box.x - space.x, space.dy, space.dz));
  // Slice on the +x side
  if (box.x + box.dx < space.x + space.dx)
    out.push(new FreeSpace(box.x + box.dx, space.y, space.z,
                           space.x + space.dx - (box.x + box.dx), space.dy, space.dz));
  // Slice on the -y side (below)
  if (box.y > space.y)
    out.push(new FreeSpace(space.x, space.y, space.z,
                           space.dx, box.y - space.y, space.dz));
  // Slice on the +y side (above)
  if (box.y + box.dy < space.y + space.dy)
    out.push(new FreeSpace(space.x, box.y + box.dy, space.z,
                           space.dx, space.y + space.dy - (box.y + box.dy), space.dz));
  // Slice on the -z side
  if (box.z > space.z)
    out.push(new FreeSpace(space.x, space.y, space.z,
                           space.dx, space.dy, box.z - space.z));
  // Slice on the +z side
  if (box.z + box.dz < space.z + space.dz)
    out.push(new FreeSpace(space.x, space.y, box.z + box.dz,
                           space.dx, space.dy, space.z + space.dz - (box.z + box.dz)));
  return out;
}

function pruneContained(spaces) {
  // Drop free spaces fully contained inside another free space.
  // Also dedupe identical spaces.
  const sig = new Set();
  const u = [];
  for (const s of spaces) {
    const k = `${s.x}|${s.y}|${s.z}|${s.dx}|${s.dy}|${s.dz}`;
    if (sig.has(k)) continue;
    sig.add(k);
    u.push(s);
  }

  const keep = [];
  for (let i = 0; i < u.length; i++) {
    let contained = false;
    for (let j = 0; j < u.length; j++) {
      if (i === j) continue;
      if (contains(u[j], u[i])) { contained = true; break; }
    }
    if (!contained) keep.push(u[i]);
  }
  return keep;
}

function contains(a, b) {
  return a.x <= b.x + 1e-6 && a.y <= b.y + 1e-6 && a.z <= b.z + 1e-6
      && a.x + a.dx + 1e-6 >= b.x + b.dx
      && a.y + a.dy + 1e-6 >= b.y + b.dy
      && a.z + a.dz + 1e-6 >= b.z + b.dz;
}
