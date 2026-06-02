import type {
  BetaLevel,
  BetaMove,
  BetaResult,
  ClimberProfile,
  Hold,
  RouteGeometry,
} from "@betaclimb/shared";
import { BETA_LEVELS } from "@betaclimb/shared";
import { distanceCm, toCm, type HoldCm } from "./geometry.js";
import { LEVEL_CONFIGS, STATIC_REACH_FACTOR, type LevelConfig } from "./levels.js";

/** Minimalna różnica wysokości (cm), by uznać ruch za prowadzący „w górę". */
const UPWARD_EPSILON_CM = 0.5;

interface Edge {
  to: string;
  cost: number;
  distanceCm: number;
}

/** Wyznacza zbiór chwytów startowych i końcowych z sensownym fallbackiem. */
function resolveEndpoints(holds: HoldCm[]): { starts: Set<string>; finishes: Set<string> } {
  const startsList = holds.filter((h) => h.isStart);
  const finishesList = holds.filter((h) => h.isFinish);

  // Brak oznaczonego startu → najniższy chwyt; brak topu → najwyższy chwyt.
  const lowest = holds.reduce((a, b) => (b.yUpCm < a.yUpCm ? b : a));
  const highest = holds.reduce((a, b) => (b.yUpCm > a.yUpCm ? b : a));

  return {
    starts: new Set((startsList.length ? startsList : [lowest]).map((h) => h.id)),
    finishes: new Set((finishesList.length ? finishesList : [highest]).map((h) => h.id)),
  };
}

/**
 * Buduje graf skierowany: krawędź a→b istnieje, gdy b leży WYŻEJ niż a
 * (progres ku górze) i mieści się w zasięgu ruchu. Dzięki ścisłemu warunkowi
 * „wyżej" graf jest acykliczny, więc Dijkstra zawsze się zakończy.
 */
function buildGraph(holds: HoldCm[], maxReachCm: number, config: LevelConfig): Map<string, Edge[]> {
  const adj = new Map<string, Edge[]>();
  for (const h of holds) adj.set(h.id, []);

  for (const a of holds) {
    for (const b of holds) {
      if (a.id === b.id) continue;
      if (b.yUpCm <= a.yUpCm + UPWARD_EPSILON_CM) continue; // tylko w górę
      const dist = distanceCm(a, b);
      if (dist > maxReachCm) continue; // poza zasięgiem
      const reachUsage = dist / maxReachCm;
      adj.get(a.id)!.push({ to: b.id, cost: config.moveCost(reachUsage), distanceCm: dist });
    }
  }
  return adj;
}

/** Dijkstra z wirtualnym źródłem (wszystkie starty) do wirtualnego ujścia (wszystkie topy). */
function shortestPath(
  holds: HoldCm[],
  adj: Map<string, Edge[]>,
  starts: Set<string>,
  finishes: Set<string>,
): string[] | null {
  const SRC = "__src__";
  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const visited = new Set<string>();

  for (const h of holds) dist.set(h.id, Infinity);
  dist.set(SRC, 0);

  // Krawędzie ze źródła do każdego startu (koszt 0).
  const srcEdges: Edge[] = [...starts].map((id) => ({ to: id, cost: 0, distanceCm: 0 }));

  // Prosty wybór minimum (n małe — maks. 200 chwytów).
  const nodes = [SRC, ...holds.map((h) => h.id)];
  while (true) {
    let u: string | null = null;
    let best = Infinity;
    for (const n of nodes) {
      if (visited.has(n)) continue;
      const d = dist.get(n) ?? Infinity;
      if (d < best) {
        best = d;
        u = n;
      }
    }
    if (u === null || best === Infinity) break;
    visited.add(u);

    const edges = u === SRC ? srcEdges : adj.get(u) ?? [];
    for (const e of edges) {
      const nd = best + e.cost;
      if (nd < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, nd);
        prev.set(e.to, u);
      }
    }
  }

  // Wybierz osiągalny top o najmniejszym koszcie.
  let bestFinish: string | null = null;
  let bestCost = Infinity;
  for (const f of finishes) {
    const d = dist.get(f) ?? Infinity;
    if (d < bestCost) {
      bestCost = d;
      bestFinish = f;
    }
  }
  if (bestFinish === null || bestCost === Infinity) return null;

  // Odtwórz ścieżkę (bez wirtualnego źródła).
  const path: string[] = [];
  let cur: string | undefined = bestFinish;
  while (cur && cur !== SRC) {
    path.push(cur);
    cur = prev.get(cur);
  }
  path.reverse();
  return path;
}

/** Największa minimalna luka „w górę" — pomaga wytłumaczyć brak przejścia. */
function largestUnavoidableGapCm(holds: HoldCm[], finishes: Set<string>): number {
  let worst = 0;
  for (const a of holds) {
    if (finishes.has(a.id)) continue;
    let nearestUp = Infinity;
    for (const b of holds) {
      if (b.yUpCm <= a.yUpCm + UPWARD_EPSILON_CM) continue;
      nearestUp = Math.min(nearestUp, distanceCm(a, b));
    }
    if (nearestUp !== Infinity) worst = Math.max(worst, nearestUp);
  }
  return worst;
}

/** Wyznacza betę dla jednego poziomu. */
export function computeBeta(
  holds: Hold[],
  geometry: RouteGeometry,
  climber: ClimberProfile,
  level: BetaLevel,
): BetaResult {
  const config = LEVEL_CONFIGS[level];
  const maxReachCm = climber.heightCm * config.reachFactor;
  const staticReachCm = climber.heightCm * STATIC_REACH_FACTOR;

  const cmHolds = holds.map((h) => toCm(h, geometry));
  const byId = new Map(cmHolds.map((h) => [h.id, h]));
  const { starts, finishes } = resolveEndpoints(cmHolds);

  const adj = buildGraph(cmHolds, maxReachCm, config);
  const path = shortestPath(cmHolds, adj, starts, finishes);

  if (!path) {
    const gap = largestUnavoidableGapCm(cmHolds, finishes);
    return {
      level,
      feasible: false,
      holdSequence: [],
      moves: [],
      moveCount: 0,
      totalDifficulty: 0,
      hardestMove: 0,
      maxReachCm,
      note:
        gap > maxReachCm
          ? `Brak przejścia: luka ${Math.round(gap)} cm przekracza zasięg ${Math.round(maxReachCm)} cm dla tego poziomu.`
          : "Brak przejścia od startu do topu dla tego poziomu.",
    };
  }

  const moves: BetaMove[] = [];
  for (let i = 1; i < path.length; i++) {
    const from = byId.get(path[i - 1]!)!;
    const to = byId.get(path[i]!)!;
    const dist = distanceCm(from, to);
    const reachUsage = dist / maxReachCm;
    moves.push({
      index: i,
      fromHoldId: from.id,
      toHoldId: to.id,
      distanceCm: Math.round(dist * 10) / 10,
      reachUsage: Math.round(reachUsage * 100) / 100,
      difficulty: Math.round(reachUsage * 100) / 10, // skala 0..10
      isDynamic: dist > staticReachCm,
    });
  }

  const totalDifficulty = Math.round(moves.reduce((s, m) => s + m.difficulty, 0) * 10) / 10;
  const hardestMove = moves.reduce((m, mv) => Math.max(m, mv.difficulty), 0);

  return {
    level,
    feasible: true,
    holdSequence: path,
    moves,
    moveCount: moves.length,
    totalDifficulty,
    hardestMove,
    maxReachCm: Math.round(maxReachCm),
  };
}

/** Wyznacza betę dla wybranych (domyślnie wszystkich) poziomów. */
export function computeAllBetas(
  holds: Hold[],
  geometry: RouteGeometry,
  climber: ClimberProfile,
  levels: readonly BetaLevel[] = BETA_LEVELS,
): Record<BetaLevel, BetaResult> {
  const out = {} as Record<BetaLevel, BetaResult>;
  for (const level of levels) {
    out[level] = computeBeta(holds, geometry, climber, level);
  }
  return out;
}
