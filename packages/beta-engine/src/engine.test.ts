import { describe, expect, it } from "vitest";
import type { Hold, RouteGeometry } from "@betaclimb/shared";
import { computeAllBetas, computeBeta } from "./engine.js";
import { gradeFromBetas } from "./grade.js";

/**
 * Geometria testowa: 1000x1000 px, trasa 10 m → 1 cm na piksel.
 * Pozycja w cm = (x*1000, (1-y)*1000).
 *
 * Model nóg (wzrost 180): zasięg na chwycie 180 cm, na tarciu (smear) 144 cm,
 * dynamiczny 252 cm, zasięg nogi 153 cm, minimalny spadek stopy 27 cm.
 * Stopa: chwyt → tarcie o ścianę → noga w powietrzu (nigdy ziemia).
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

  it("na starcie noga jest na ścianie (smear), wyżej na niższym chwycie", () => {
    const beta = computeBeta(holds, GEO, { heightCm: 180 }, "static");
    const yById = new Map(holds.map((h) => [h.id, h.y]));
    // pierwszy ruch ze startu — brak chwytu pod nogę → tarcie o ścianę
    expect(beta.moves[0]!.footType).toBe("smear");
    expect(beta.moves[0]!.footHoldId).toBeNull();
    // ostatni ruch — stopa na realnym, niżej położonym chwycie
    const last = beta.moves.at(-1)!;
    expect(last.footType).toBe("hold");
    expect(last.footHoldId).toBe("h180");
    expect(yById.get(last.footHoldId!)!).toBeGreaterThan(yById.get(last.fromHoldId)!);
  });
});

describe("smear vs flaga — noga nigdy nie dotyka ziemi", () => {
  it("tuż nad ziemią, bez chwytu pod nogę → noga w powietrzu (flaga)", () => {
    const holds: Hold[] = [
      hold(0.5, 0.98, { id: "start", isStart: true }), // yUp 20 — tuż nad ziemią
      hold(0.5, 0.8, { id: "top", isFinish: true }), // yUp 200
    ];
    const beta = computeBeta(holds, GEO, { heightCm: 180 }, "dynamic");
    expect(beta.feasible).toBe(true);
    expect(beta.moves[0]!.footType).toBe("flag");
    expect(beta.moves[0]!.isDynamic).toBe(true);
  });
});

describe("statyczny vs dynamiczny", () => {
  const holds: Hold[] = [
    hold(0.5, 0.8, { id: "start", isStart: true }),
    hold(0.5, 0.58, { id: "top", isFinish: true }), // luka 220 cm
  ];

  it("statyczny niewykonalny, dynamiczny/flash wykonalny (wyskok)", () => {
    const betas = computeAllBetas(holds, GEO, { heightCm: 180 });
    expect(betas.static.feasible).toBe(false);
    expect(betas.dynamic.feasible).toBe(true);
    expect(betas.flash.feasible).toBe(true);
    expect(betas.dynamic.moves[0]!.isDynamic).toBe(true);
  });
});

describe("wpływ wzrostu — ten sam ruch: wyskok vs kontrola", () => {
  const holds: Hold[] = [
    hold(0.5, 0.8, { id: "start", isStart: true }),
    hold(0.5, 0.68, { id: "top", isFinish: true }), // luka 120 cm (przez smear)
  ];

  it("niski musi wyskoczyć, wysoki robi statycznie", () => {
    const low = computeBeta(holds, GEO, { heightCm: 160 }, "dynamic");
    const tall = computeBeta(holds, GEO, { heightCm: 210 }, "dynamic");
    expect(low.feasible).toBe(true);
    expect(tall.feasible).toBe(true);
    expect(low.moves[0]!.isDynamic).toBe(true);
    expect(tall.moves[0]!.isDynamic).toBe(false);
  });
});

describe("brak przejścia", () => {
  const holds: Hold[] = [
    hold(0.5, 0.8, { id: "start", isStart: true }),
    hold(0.5, 0.5, { id: "top", isFinish: true }), // luka 300 cm
  ];

  it("wszystkie poziomy niewykonalne", () => {
    const betas = computeAllBetas(holds, GEO, { heightCm: 150 });
    for (const level of ["static", "dynamic", "flash"] as const) {
      expect(betas[level].feasible).toBe(false);
      expect(betas[level].holdSequence).toHaveLength(0);
    }
  });
});

describe("statyka korzysta ze WSZYSTKICH chwytów", () => {
  // chwyty co 60 cm — wysoki wspinacz mógłby pomijać pośrednie, ale statyka nie pomija
  const holds: Hold[] = [
    hold(0.5, 0.9, { id: "s", isStart: true }), // yUp 100
    hold(0.5, 0.84, { id: "m1" }), // yUp 160
    hold(0.5, 0.78, { id: "m2" }), // yUp 220
    hold(0.5, 0.72, { id: "t", isFinish: true }), // yUp 280
  ];

  it("statyczna sekwencja zawiera każdy chwyt, od najniższego do najwyższego", () => {
    const beta = computeBeta(holds, GEO, { heightCm: 200 }, "static");
    expect(beta.feasible).toBe(true);
    expect(beta.holdSequence).toEqual(["s", "m1", "m2", "t"]);
  });

  it("dynamiczna może pomijać chwyty (mniej, większych ruchów)", () => {
    const dyn = computeBeta(holds, GEO, { heightCm: 200 }, "dynamic");
    expect(dyn.feasible).toBe(true);
    expect(dyn.holdSequence.length).toBeLessThan(holds.length);
  });
});

describe("flash ma zawsze najwyższą ocenę trudności", () => {
  const holds: Hold[] = [
    hold(0.5, 0.9, { id: "start", isStart: true }),
    hold(0.5, 0.82, { id: "h180" }),
    hold(0.5, 0.74, { id: "h260" }),
    hold(0.5, 0.66, { id: "top", isFinish: true }),
  ];

  it("trudność flash > statyczna i > dynamiczna", () => {
    const betas = computeAllBetas(holds, GEO, { heightCm: 180 });
    expect(betas.flash.feasible).toBe(true);
    expect(betas.flash.totalDifficulty).toBeGreaterThan(betas.static.totalDifficulty);
    expect(betas.flash.totalDifficulty).toBeGreaterThan(betas.dynamic.totalDifficulty);
  });
});

describe("ocena trudności (skala V + kolor)", () => {
  it("łatwa drabinka dostaje niski stopień; null gdy brak przejścia", () => {
    const easy: Hold[] = [
      hold(0.5, 0.9, { id: "s", isStart: true }),
      hold(0.5, 0.82, { id: "m" }),
      hold(0.5, 0.74, { id: "t", isFinish: true }),
    ];
    const grade = gradeFromBetas(computeAllBetas(easy, GEO, { heightCm: 180 }), 180);
    expect(grade).not.toBeNull();
    expect(grade!.vScale).toMatch(/^V\d+$/);
    expect(grade!.color.hex).toMatch(/^#/);

    const impossible: Hold[] = [
      hold(0.5, 0.8, { id: "s", isStart: true }),
      hold(0.5, 0.5, { id: "t", isFinish: true }), // luka 300 cm
    ];
    expect(gradeFromBetas(computeAllBetas(impossible, GEO, { heightCm: 150 }), 150)).toBeNull();
  });

  it("trudniejsza trasa (większe luki) ma wyższy stopień niż łatwa", () => {
    const easy: Hold[] = [
      hold(0.5, 0.9, { id: "s", isStart: true }),
      hold(0.5, 0.84, { id: "m1" }),
      hold(0.5, 0.78, { id: "m2" }),
      hold(0.5, 0.72, { id: "t", isFinish: true }),
    ];
    const hard: Hold[] = [
      hold(0.5, 0.9, { id: "s", isStart: true }),
      hold(0.5, 0.7, { id: "t", isFinish: true }), // luka 200 cm — wyskok, ale wykonalny
    ];
    const gEasy = gradeFromBetas(computeAllBetas(easy, GEO, { heightCm: 180 }), 180)!;
    const gHard = gradeFromBetas(computeAllBetas(hard, GEO, { heightCm: 180 }), 180)!;
    expect(gHard.score).toBeGreaterThan(gEasy.score);
  });
});

describe("fallback start/top", () => {
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
