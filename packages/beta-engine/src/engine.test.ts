import { describe, expect, it } from "vitest";
import type { Hold, RouteGeometry } from "@betaclimb/shared";
import { computeAllBetas, computeBeta } from "./engine.js";

/**
 * Geometria testowa: 1000x1000 px, trasa 10 m wysokości → 1 cm na piksel.
 * Pozycja w cm = (x*1000, (1-y)*1000).
 *
 * Model nóg: zasięg liczony od chwytu pod stopą.
 * Dla wzrostu 180: statyczny 180 cm, dynamiczny 252 cm.
 */
const GEO: RouteGeometry = { imgW: 1000, imgH: 1000, routeHeightM: 10 };

let counter = 0;
function hold(x: number, y: number, opts: Partial<Hold> = {}): Hold {
  return {
    id: opts.id ?? `h${counter++}`,
    x,
    y,
    isStart: opts.isStart ?? false,
    isFinish: opts.isFinish ?? false,
  };
}

describe("computeBeta — prosta drabinka", () => {
  // Chwyty co 100 cm w pionie, w jednej kolumnie.
  const holds: Hold[] = [
    hold(0.5, 0.9, { id: "start", isStart: true }),
    hold(0.5, 0.8),
    hold(0.5, 0.7),
    hold(0.5, 0.6),
    hold(0.5, 0.5, { id: "top", isFinish: true }),
  ];

  it("znajduje przejście od startu do topu na każdym poziomie", () => {
    const betas = computeAllBetas(holds, GEO, { heightCm: 180 });
    for (const level of ["static", "dynamic", "flash"] as const) {
      expect(betas[level].feasible).toBe(true);
      expect(betas[level].holdSequence[0]).toBe("start");
      expect(betas[level].holdSequence.at(-1)).toBe("top");
    }
  });

  it("każdy ruch ma chwyt pod stopę i prowadzi w górę", () => {
    const beta = computeBeta(holds, GEO, { heightCm: 180 }, "flash");
    const yById = new Map(holds.map((h) => [h.id, h.y]));
    for (const m of beta.moves) {
      expect(m.footHoldId).toBeTruthy();
      expect(yById.get(m.toHoldId)!).toBeLessThan(yById.get(m.fromHoldId)!);
    }
  });
});

describe("model nóg — dobór chwytu pod stopę", () => {
  // A (ręce) w lewo-dół, B (cel) w prawo-góra, C dokładnie pod B na wysokości A.
  // Stopa na C jest bliżej celu niż stopa na A → algorytm wybiera C i skraca zasięg.
  const holds: Hold[] = [
    hold(0.4, 0.7, { id: "A", isStart: true }),
    hold(0.55, 0.5, { id: "B", isFinish: true }),
    hold(0.5, 0.7, { id: "C" }), // pomocniczy chwyt pod stopę
  ];

  it("wybiera lepsze oparcie dla nogi i zmniejsza wymagany zasięg", () => {
    const beta = computeBeta(holds, GEO, { heightCm: 180 }, "dynamic");
    expect(beta.feasible).toBe(true);
    expect(beta.moveCount).toBe(1);
    const move = beta.moves[0]!;
    expect(move.footHoldId).toBe("C");
    // zasięg od stopy (C→B) jest mniejszy niż sam ruch ręki (A→B)
    expect(move.footReachCm).toBeLessThan(move.distanceCm);
  });
});

describe("statyczny vs dynamiczny zależy od oparcia nogi", () => {
  // pojedyncza luka 220 cm — stopa zostaje na starcie, za nisko na ruch statyczny
  const holds: Hold[] = [
    hold(0.5, 0.8, { id: "start", isStart: true }),
    hold(0.5, 0.58, { id: "top", isFinish: true }),
  ];

  it("statyczny niewykonalny, dynamiczny/flash wykonalny i ruch oznaczony jako wyskok", () => {
    const betas = computeAllBetas(holds, GEO, { heightCm: 180 });
    expect(betas.static.feasible).toBe(false);
    expect(betas.static.note).toMatch(/zasięg/i);
    expect(betas.dynamic.feasible).toBe(true);
    expect(betas.flash.feasible).toBe(true);
    expect(betas.dynamic.moves[0]!.isDynamic).toBe(true);
  });
});

describe("wpływ wzrostu na betę", () => {
  // start (yUp 100), mid (yUp 220), top (yUp 340). Luki: 120 / 120 / 240 cm.
  const holds: Hold[] = [
    hold(0.5, 0.9, { id: "start", isStart: true }),
    hold(0.5, 0.78, { id: "mid" }),
    hold(0.5, 0.66, { id: "top", isFinish: true }),
  ];

  it("wyższy wspinacz przeskakuje chwyt pośredni (mniej ruchów)", () => {
    const low = computeBeta(holds, GEO, { heightCm: 160 }, "dynamic");
    const tall = computeBeta(holds, GEO, { heightCm: 210 }, "dynamic");
    expect(low.feasible).toBe(true);
    expect(tall.feasible).toBe(true);
    expect(low.moveCount).toBe(2); // niski: zasięg dynamiczny 224 cm < 240 → przez mid
    expect(tall.moveCount).toBe(1); // wysoki: zasięg 294 cm ≥ 240 → bezpośrednio
    expect(tall.holdSequence).toEqual(["start", "top"]);
  });
});

describe("brak przejścia", () => {
  // luka 300 cm, niski wspinacz (zasięg dynamiczny 210 cm)
  const holds: Hold[] = [
    hold(0.5, 0.8, { id: "start", isStart: true }),
    hold(0.5, 0.5, { id: "top", isFinish: true }),
  ];

  it("wszystkie poziomy są niewykonalne i zwracają opis", () => {
    const betas = computeAllBetas(holds, GEO, { heightCm: 150 });
    for (const level of ["static", "dynamic", "flash"] as const) {
      expect(betas[level].feasible).toBe(false);
      expect(betas[level].note).toBeTruthy();
      expect(betas[level].holdSequence).toHaveLength(0);
    }
  });
});

describe("fallback start/top", () => {
  const holds: Hold[] = [
    hold(0.5, 0.9, { id: "a" }),
    hold(0.5, 0.8, { id: "b" }),
    hold(0.5, 0.7, { id: "c" }),
  ];

  it("wybiera najniższy jako start i najwyższy jako top", () => {
    const beta = computeBeta(holds, GEO, { heightCm: 180 }, "static");
    expect(beta.feasible).toBe(true);
    expect(beta.holdSequence[0]).toBe("a");
    expect(beta.holdSequence.at(-1)).toBe("c");
  });
});
