import type { BetaLevel, BetaResult, GradeColor, RouteGrade } from "@betaclimb/shared";
import { DYNAMIC_REACH_FACTOR } from "./levels.js";

/**
 * Skala kolorowa sali — domyślna, łatwa do dostosowania pod konkretną ściankę.
 * Każdy próg `maxV` to najwyższy stopień V objęty danym kolorem (włącznie).
 * Kolory uporządkowane od najłatwiejszego do najtrudniejszego.
 */
const COLOR_BANDS: ReadonlyArray<{ maxV: number; label: string; hex: string }> = [
  { maxV: 1, label: "Zielony", hex: "#46d39a" },
  { maxV: 3, label: "Żółty", hex: "#ffd54a" },
  { maxV: 5, label: "Pomarańczowy", hex: "#ff9f43" },
  { maxV: 7, label: "Czerwony", hex: "#ff6b6b" },
  { maxV: 9, label: "Niebieski", hex: "#4ea1ff" },
  { maxV: Number.POSITIVE_INFINITY, label: "Czarny", hex: "#6b7682" },
];

function colorForV(vIndex: number): GradeColor {
  const band = COLOR_BANDS.find((b) => vIndex <= b.maxV) ?? COLOR_BANDS[COLOR_BANDS.length - 1]!;
  return { label: band.label, hex: band.hex };
}

/**
 * Ocena trudności trasy na podstawie policzonych bet, spersonalizowana wzrostem.
 *
 * Trasę ocenia się wg NAJŁATWIEJSZEGO wykonalnego stylu (tak, jak realnie da się
 * ją przejść): statyczny → dynamiczny → flash. O trudności decyduje głównie krux
 * (najtrudniejszy ruch względem zasięgu), z dodatkiem naciągu sumarycznego i długości.
 *
 * Mapowanie na skalę V jest heurystyczne — kalibrowalne stałymi poniżej.
 */
export function gradeFromBetas(
  betas: Partial<Record<BetaLevel, BetaResult>>,
  heightCm: number,
): RouteGrade | null {
  const beta = [betas.static, betas.dynamic, betas.flash].find(
    (b): b is BetaResult => !!b?.feasible && b.moves.length > 0,
  );
  if (!beta) return null;

  const referenceReachCm = heightCm * DYNAMIC_REACH_FACTOR;
  const strains = beta.moves.map((m) => m.footReachCm / referenceReachCm);
  const crux = Math.max(...strains);
  const sustained = strains.reduce((a, b) => a + b, 0) / strains.length;

  // krux dominuje; naciąg sumaryczny i długość lekko podbijają stopień.
  // Stałe skalibrowane tak, by: łatwa drabinka ≈ V1, średnie luki ≈ V3,
  // wyskok na granicy zasięgu ≈ V8. Łatwo dostroić pod realne dane z sali.
  const vFloat =
    (crux - 0.3) * 12 + (sustained - 0.3) * 2 + Math.min(beta.moveCount, 20) * 0.03;
  const vIndex = Math.max(0, Math.min(16, Math.round(vFloat)));

  return {
    score: Math.round(vFloat * 10) / 10,
    vScale: `V${vIndex}`,
    color: colorForV(vIndex),
  };
}
