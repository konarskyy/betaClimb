import { describe, expect, it } from "vitest";
import type { Hold, RouteGeometry } from "@betaclimb/shared";
import { computeAllBetas, computeBeta } from "./engine.js";

/**
 * Geometria testowa: 1000x1000 px, trasa 10 m wysokości → 1 cm na piksel.
 * Dzięki temu pozycja w cm = (x*1000, (1-y)*1000), co ułatwia rozumowanie.
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
  // Chwyty co 100 cm w pionie (0.1 znormalizowane), w jednej kolumnie.
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

  it("każdy ruch prowadzi w górę (malejące y obrazu)", () => {
    const beta = computeBeta(holds, GEO, { heightCm: 180 }, "flash");
    const yById = new Map(holds.map((h) => [h.id, h.y]));
    for (const m of beta.moves) {
      expect(yById.get(m.toHoldId)!).toBeLessThan(yById.get(m.fromHoldId)!);
    }
  });
});

describe("wpływ wzrostu na betę", () => {
  // start (yUp 150), mid (yUp 250), top (yUp 350). Luki: 100 / 100 / 200 cm.
  const holds: Hold[] = [
    hold(0.5, 0.85, { id: "start", isStart: true }),
    hold(0.5, 0.75, { id: "mid" }),
    hold(0.5, 0.65, { id: "top", isFinish: true }),
  ];

  it("wyższy wspinacz robi mniej ruchów (pomija chwyt pośredni)", () => {
    const low = computeBeta(holds, GEO, { heightCm: 160 }, "dynamic");
    const tall = computeBeta(holds, GEO, { heightCm: 220 }, "dynamic");

    expect(low.feasible).toBe(true);
    expect(tall.feasible).toBe(true);
    // niski musi użyć chwytu pośredniego (2 ruchy), wysoki przeskakuje (1 ruch)
    expect(low.moveCount).toBe(2);
    expect(tall.moveCount).toBe(1);
    expect(tall.holdSequence).toEqual(["start", "top"]);
  });
});

describe("ruch dynamiczny vs statyczny", () => {
  // pojedyncza luka 140 cm
  const holds: Hold[] = [
    hold(0.5, 0.8, { id: "start", isStart: true }),
    hold(0.5, 0.66, { id: "top", isFinish: true }),
  ];

  it("statyczny jest niewykonalny, a dynamiczny/flash wykonalny dla 180 cm", () => {
    const betas = computeAllBetas(holds, GEO, { heightCm: 180 });
    expect(betas.static.feasible).toBe(false);
    expect(betas.static.note).toMatch(/zasięg/i);
    expect(betas.dynamic.feasible).toBe(true);
    expect(betas.flash.feasible).toBe(true);
    // ruch przekracza zasięg statyczny → oznaczony jako dynamiczny
    expect(betas.dynamic.moves[0]!.isDynamic).toBe(true);
  });
});

describe("brak przejścia", () => {
  // luka 200 cm, niski wspinacz (zasięg dynamiczny 142.5 cm)
  const holds: Hold[] = [
    hold(0.5, 0.8, { id: "start", isStart: true }),
    hold(0.5, 0.6, { id: "top", isFinish: true }),
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
  // brak oznaczeń isStart/isFinish — silnik wybiera najniższy i najwyższy chwyt
  const holds: Hold[] = [
    hold(0.5, 0.9, { id: "a" }),
    hold(0.5, 0.8, { id: "b" }),
    hold(0.5, 0.7, { id: "c" }),
  ];

  it("wybiera najniższy jako start i najwyższy jako top", () => {
    const beta = computeBeta(holds, GEO, { heightCm: 180 }, "static");
    expect(beta.feasible).toBe(true);
    expect(beta.holdSequence[0]).toBe("a"); // najniżej (y=0.9)
    expect(beta.holdSequence.at(-1)).toBe("c"); // najwyżej (y=0.7)
  });
});
