import { describe, expect, it } from "vitest";
import type { Hold, RouteGeometry } from "@betaclimb/shared";
import { computeAllBetas, computeBeta } from "./engine.js";

/**
 * Geometria testowa: 1000x1000 px, trasa 10 m → 1 cm na piksel.
 * Pozycja w cm = (x*1000, (1-y)*1000).
 *
 * Model nóg (wzrost 180): statyczny zasięg 180 cm, dynamiczny 252 cm,
 * zasięg nogi 153 cm, minimalny spadek stopy 27 cm.
 * Stopa musi być na INNYM chwycie i wyraźnie poniżej rąk.
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

describe("computeBeta — drabinka co 80 cm", () => {
  // kolumna chwytów co 80 cm: yUp 100, 180, 260, 340
  const holds: Hold[] = [
    hold(0.5, 0.9, { id: "start", isStart: true }),
    hold(0.5, 0.82, { id: "h180" }),
    hold(0.5, 0.74, { id: "h260" }),
    hold(0.5, 0.66, { id: "top", isFinish: true }),
  ];

  it("znajduje przejście na każdym poziomie", () => {
    const betas = computeAllBetas(holds, GEO, { heightCm: 180 });
    for (const level of ["static", "dynamic", "flash"] as const) {
      expect(betas[level].feasible).toBe(true);
      expect(betas[level].holdSequence[0]).toBe("start");
      expect(betas[level].holdSequence.at(-1)).toBe("top");
    }
  });

  it("każdy ruch prowadzi w górę", () => {
    const beta = computeBeta(holds, GEO, { heightCm: 180 }, "static");
    const yById = new Map(holds.map((h) => [h.id, h.y]));
    for (const m of beta.moves) {
      expect(yById.get(m.toHoldId)!).toBeLessThan(yById.get(m.fromHoldId)!);
    }
  });
});

describe("model nóg — stopa poniżej rąk, na innym chwycie", () => {
  const holds: Hold[] = [
    hold(0.5, 0.9, { id: "start", isStart: true }),
    hold(0.5, 0.82, { id: "h180" }),
    hold(0.5, 0.74, { id: "h260" }),
    hold(0.5, 0.66, { id: "top", isFinish: true }),
  ];

  it("stopa stoi na niżej położonym chwycie, nie na chwycie rąk", () => {
    const beta = computeBeta(holds, GEO, { heightCm: 180 }, "static");
    const yById = new Map(holds.map((h) => [h.id, h.y]));
    // ostatni ruch (h260 -> top): stopa na h180 — inny chwyt i wyraźnie niżej
    const last = beta.moves.at(-1)!;
    expect(last.fromHoldId).toBe("h260");
    expect(last.footHoldId).not.toBe(last.fromHoldId);
    // niżej = większe y obrazu
    expect(yById.get(last.footHoldId)!).toBeGreaterThan(yById.get(last.fromHoldId)!);
  });
});

describe("statyczny vs dynamiczny", () => {
  // pojedyncza luka 220 cm (baza na starcie, ale za daleko na ruch statyczny)
  const holds: Hold[] = [
    hold(0.5, 0.8, { id: "start", isStart: true }),
    hold(0.5, 0.58, { id: "top", isFinish: true }),
  ];

  it("statyczny niewykonalny, dynamiczny/flash wykonalny (wyskok)", () => {
    const betas = computeAllBetas(holds, GEO, { heightCm: 180 });
    expect(betas.static.feasible).toBe(false);
    expect(betas.static.note).toMatch(/zasięg/i);
    expect(betas.dynamic.feasible).toBe(true);
    expect(betas.flash.feasible).toBe(true);
    expect(betas.dynamic.moves[0]!.isDynamic).toBe(true);
  });
});

describe("wpływ wzrostu — ten sam ruch: wyskok vs kontrola", () => {
  // luka 190 cm
  const holds: Hold[] = [
    hold(0.5, 0.8, { id: "start", isStart: true }),
    hold(0.5, 0.61, { id: "top", isFinish: true }),
  ];

  it("niski musi wyskoczyć, wysoki robi statycznie", () => {
    const low = computeBeta(holds, GEO, { heightCm: 160 }, "dynamic");
    const tall = computeBeta(holds, GEO, { heightCm: 210 }, "dynamic");
    expect(low.feasible).toBe(true);
    expect(tall.feasible).toBe(true);
    expect(low.moves[0]!.isDynamic).toBe(true); // 190 > zasięg statyczny 160
    expect(tall.moves[0]!.isDynamic).toBe(false); // 190 ≤ zasięg statyczny 210
  });
});

describe("brak przejścia", () => {
  // luka 300 cm, niski wspinacz (zasięg dynamiczny 210 cm)
  const holds: Hold[] = [
    hold(0.5, 0.8, { id: "start", isStart: true }),
    hold(0.5, 0.5, { id: "top", isFinish: true }),
  ];

  it("wszystkie poziomy niewykonalne", () => {
    const betas = computeAllBetas(holds, GEO, { heightCm: 150 });
    for (const level of ["static", "dynamic", "flash"] as const) {
      expect(betas[level].feasible).toBe(false);
      expect(betas[level].holdSequence).toHaveLength(0);
    }
  });
});

describe("fallback start/top", () => {
  // bez oznaczeń — najniższy chwyt staje się startem (z bazą), najwyższy topem
  const holds: Hold[] = [
    hold(0.5, 0.9, { id: "a" }),
    hold(0.5, 0.82, { id: "b" }),
    hold(0.5, 0.74, { id: "c" }),
  ];

  it("wybiera najniższy jako start i najwyższy jako top", () => {
    const beta = computeBeta(holds, GEO, { heightCm: 180 }, "static");
    expect(beta.feasible).toBe(true);
    expect(beta.holdSequence[0]).toBe("a");
    expect(beta.holdSequence.at(-1)).toBe("c");
  });
});
