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
import {
  DYNAMIC_REACH_FACTOR,
  DYNO_DIFFICULTY_PENALTY,
  FLASH_DIFFICULTY_MARGIN,
  LEG_SPAN_FACTOR,
  LEVEL_CONFIGS,
  LEVEL_DIFFICULTY_WEIGHT,
  MIN_FOOT_DROP_FACTOR,
  SMEAR_REACH_FACTOR,
  STATIC_REACH_FACTOR,
  type FootType,
  type LevelConfig,
  type MoveAnalysis,
} from "./levels.js";

/** Minimalna różnica wysokości (cm), by uznać ruch za prowadzący „w górę". */
const UPWARD_EPSILON_CM = 0.5;

interface Edge {
  to: string;
  cost: number;
}

/** Wysokość (yUp) dolnej krawędzi ściany — poniżej zaczyna się ziemia. */
const GROUND_YUP_CM = 0;

/**
 * Analiza ruchu ręki `a → b` z modelem nóg. Oparcie stopy wybierane jest w kolejności:
 *  1. **chwyt** — inny niż trzymany ręką i wyraźnie poniżej rąk (technika „stopa idzie
 *     za ręką"); najlepsze oparcie, pełny zasięg,
 *  2. **smear** — tarcie o gołą ścianę tuż pod rękami (gdy brak chwytu); słabszy zasięg,
 *     dozwolone tylko powyżej ziemi,
 *  3. **flaga** — noga w powietrzu (gdy nie ma już miejsca nad ziemią); brak nacisku,
 *     więc ruch tylko dynamiczny.
 *
 * Stopa nigdy nie dotyka ziemi (smear wymaga `yUp > GROUND_YUP_CM`).
 */
export function analyzeMove(
  a: HoldCm,
  b: HoldCm,
  holds: HoldCm[],
  heightCm: number,
): MoveAnalysis {
  const holdReachCm = heightCm * STATIC_REACH_FACTOR;
  const smearReachCm = heightCm * SMEAR_REACH_FACTOR;
  const dynamicReachCm = heightCm * DYNAMIC_REACH_FACTOR;
  const legSpanCm = heightCm * LEG_SPAN_FACTOR;
  const minDropCm = heightCm * MIN_FOOT_DROP_FACTOR;

  // 1) najlepszy chwyt pod stopę: inny niż chwyt rąk, wyraźnie poniżej rąk, w zasięgu nogi
  let bestHoldId: string | null = null;
  let bestHoldDist = Infinity;
  for (const f of holds) {
    if (f.id === a.id) continue;
    if (f.yUpCm > a.yUpCm - minDropCm) continue;
    if (distanceCm(a, f) > legSpanCm) continue;
    const d = distanceCm(f, b);
    if (d < bestHoldDist) {
      bestHoldDist = d;
      bestHoldId = f.id;
    }
  }

  // 2) smear: stopa o ścianę tuż pod rękami, ale powyżej ziemi
  const smearYUp = a.yUpCm - minDropCm;
  const smearAvailable = smearYUp > GROUND_YUP_CM;
  const smearDist = smearAvailable ? Math.hypot(b.xCm - a.xCm, b.yUpCm - smearYUp) : Infinity;

  let footType: FootType;
  let footHoldId: string | null;
  let footDistCm: number;
  let footReachCm = 0;
  let staticFeasible: boolean;

  if (bestHoldId !== null && bestHoldDist <= holdReachCm) {
    footType = "hold";
    footHoldId = bestHoldId;
    footDistCm = bestHoldDist;
    footReachCm = holdReachCm;
    staticFeasible = true;
  } else if (smearAvailable && smearDist <= smearReachCm) {
    footType = "smear";
    footHoldId = null;
    footDistCm = smearDist;
    footReachCm = smearReachCm;
    staticFeasible = true;
  } else {
    // brak ruchu statycznego — wybierz najlepszą nogę do wyskoku, inaczej flaga
    staticFeasible = false;
    if (bestHoldId !== null && (!smearAvailable || bestHoldDist <= smearDist)) {
      footType = "hold";
      footHoldId = bestHoldId;
      footDistCm = bestHoldDist;
    } else if (smearAvailable) {
      footType = "smear";
      footHoldId = null;
      footDistCm = smearDist;
    } else {
      footType = "flag";
      footHoldId = null;
      footDistCm = distanceCm(a, b);
    }
  }

  const staticUsage = staticFeasible ? footDistCm / footReachCm : Number.POSITIVE_INFINITY;
  return {
    footType,
    footHoldId,
    handDistCm: distanceCm(a, b),
    footDistCm,
    staticReachCm: holdReachCm,
    dynamicReachCm,
    staticUsage,
    dynamicUsage: footDistCm / dynamicReachCm,
    staticFeasible,
    dynamicFeasible: footDistCm <= dynamicReachCm,
    isDynamic: !staticFeasible,
  };
}

/** Wyznacza zbiór chwytów startowych i końcowych z sensownym fallbackiem. */
function resolveEndpoints(holds: HoldCm[]): { starts: Set<string>; finishes: Set<string> } {
  const startsList = holds.filter((h) => h.isStart);
  const finishesList = holds.filter((h) => h.isFinish);
  const lowest = holds.reduce((a, b) => (b.yUpCm < a.yUpCm ? b : a));
  const highest = holds.reduce((a, b) => (b.yUpCm > a.yUpCm ? b : a));
  return {
    starts: new Set((startsList.length ? startsList : [lowest]).map((h) => h.id)),
    finishes: new Set((finishesList.length ? finishesList : [highest]).map((h) => h.id)),
  };
}

/**
 * Sekwencja statyczna: WSZYSTKIE chwyty trasy od najniższego do najwyższego.
 * Statyka to najpewniejszy styl — wspinacz nie pomija żadnego chwytu, robiąc
 * najmniejsze możliwe ruchy. (Dlatego nie używamy tu Dijkstry, która skracałaby
 * drogę przez pomijanie chwytów pośrednich.)
 */
function staticChain(holds: HoldCm[]): string[] {
  return [...holds].sort((a, b) => a.yUpCm - b.yUpCm).map((h) => h.id);
}

/** Czy cały statyczny łańcuch da się przejść kontrolowanymi ruchami. */
function staticChainFeasible(chain: string[], byId: Map<string, HoldCm>, holds: HoldCm[], heightCm: number): boolean {
  for (let i = 1; i < chain.length; i++) {
    const a = byId.get(chain[i - 1]!)!;
    const b = byId.get(chain[i]!)!;
    if (!analyzeMove(a, b, holds, heightCm).staticFeasible) return false;
  }
  return true;
}

/**
 * Buduje graf skierowany: krawędź a→b istnieje, gdy b leży WYŻEJ niż a i dany
 * poziom dopuszcza ruch (z uwzględnieniem oparcia dla nogi). Ścisły warunek
 * „wyżej" czyni graf acyklicznym, więc Dijkstra zawsze się zakończy.
 */
function buildGraph(
  holds: HoldCm[],
  heightCm: number,
  config: LevelConfig,
): Map<string, Edge[]> {
  const adj = new Map<string, Edge[]>();
  for (const h of holds) adj.set(h.id, []);

  for (const a of holds) {
    for (const b of holds) {
      if (a.id === b.id) continue;
      if (b.yUpCm <= a.yUpCm + UPWARD_EPSILON_CM) continue; // tylko w górę
      const analysis = analyzeMove(a, b, holds, heightCm);
      const { allowed, cost } = config.evaluate(analysis);
      if (!allowed) continue;
      adj.get(a.id)!.push({ to: b.id, cost });
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

  const srcEdges: Edge[] = [...starts].map((id) => ({ to: id, cost: 0 }));
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
  const maxReachCm = config.maxReachCm(climber.heightCm);

  const cmHolds = holds.map((h) => toCm(h, geometry));
  const byId = new Map(cmHolds.map((h) => [h.id, h]));
  const { starts, finishes } = resolveEndpoints(cmHolds);

  let path: string[] | null;
  if (level === "static") {
    // statyka: użyj WSZYSTKICH chwytów (najmniejsze, najpewniejsze ruchy)
    const chain = staticChain(cmHolds);
    path =
      chain.length >= 2 && staticChainFeasible(chain, byId, cmHolds, climber.heightCm)
        ? chain
        : null;
  } else {
    const adj = buildGraph(cmHolds, climber.heightCm, config);
    path = shortestPath(cmHolds, adj, starts, finishes);
  }

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
      maxReachCm: Math.round(maxReachCm),
      note:
        level === "static"
          ? `Brak płynnego przejścia statycznego — między sąsiednimi chwytami jest zbyt duża luka (do ${Math.round(gap)} cm) na kontrolowany ruch. Spróbuj poziomu dynamicznego.`
          : gap > maxReachCm
            ? `Brak przejścia: luka ${Math.round(gap)} cm przekracza zasięg ${Math.round(maxReachCm)} cm dla tego poziomu.`
            : "Brak przejścia od startu do topu dla tego poziomu.",
    };
  }

  // wspólna miara wysiłku dla wszystkich poziomów — dzięki temu oceny są porównywalne
  const referenceReachCm = climber.heightCm * DYNAMIC_REACH_FACTOR;
  const weight = LEVEL_DIFFICULTY_WEIGHT[level];

  const moves: BetaMove[] = [];
  for (let i = 1; i < path.length; i++) {
    const from = byId.get(path[i - 1]!)!;
    const to = byId.get(path[i]!)!;
    const an = analyzeMove(from, to, cmHolds, climber.heightCm);
    const reachUsage = an.footDistCm / maxReachCm; // względem zasięgu poziomu (informacyjnie)
    const strain = an.footDistCm / referenceReachCm; // wspólna miara
    let raw = strain * 10 * weight;
    if (an.isDynamic) raw *= DYNO_DIFFICULTY_PENALTY;
    moves.push({
      index: i,
      fromHoldId: from.id,
      toHoldId: to.id,
      footType: an.footType,
      footHoldId: an.footHoldId,
      distanceCm: Math.round(an.handDistCm * 10) / 10,
      footReachCm: Math.round(an.footDistCm * 10) / 10,
      reachUsage: Math.round(reachUsage * 100) / 100,
      difficulty: Math.round(raw * 10) / 10, // skala ~0..10+
      isDynamic: an.isDynamic,
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

/**
 * Gwarantuje, że ŁĄCZNA ocena trudności flash jest ŚCIŚLE wyższa niż statyczna
 * i dynamiczna. Flash = przejście „pierwszej próby" bez rozpoznania, więc z definicji
 * jest najbardziej zobowiązujący. Jeśli geometria trasy daje inaczej, skalujemy trudności
 * wszystkich ruchów flash wspólnym współczynnikiem (spójnie: suma = suma ruchów, a krux
 * skaluje się proporcjonalnie i pozostaje fizycznie sensowny).
 */
function enforceFlashIsHardest(betas: Partial<Record<BetaLevel, BetaResult>>): void {
  const flash = betas.flash;
  if (!flash?.feasible || flash.moves.length === 0 || flash.totalDifficulty <= 0) return;
  const others = [betas.static, betas.dynamic].filter(
    (b): b is BetaResult => !!b?.feasible,
  );
  if (others.length === 0) return;

  const totalFloor = Math.max(...others.map((b) => b.totalDifficulty));
  const s = (totalFloor * FLASH_DIFFICULTY_MARGIN) / flash.totalDifficulty;
  if (s <= 1) return;

  flash.moves = flash.moves.map((m) => ({
    ...m,
    difficulty: Math.round(m.difficulty * s * 10) / 10,
  }));
  flash.totalDifficulty = Math.round(flash.moves.reduce((sum, m) => sum + m.difficulty, 0) * 10) / 10;
  flash.hardestMove = flash.moves.reduce((mx, m) => Math.max(mx, m.difficulty), 0);
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
  enforceFlashIsHardest(out);
  return out;
}
