import type { Hold, RouteGeometry } from "@betaclimb/shared";

/**
 * Chwyt przeniesiony do rzeczywistych współrzędnych w centymetrach.
 * `yUpCm` rośnie KU GÓRZE (odwrotnie niż współrzędna obrazu) — wygodne do
 * stwierdzania, czy ruch prowadzi w górę trasy.
 */
export interface HoldCm {
  id: string;
  xCm: number;
  yUpCm: number;
  isStart: boolean;
  isFinish: boolean;
}

/**
 * Zakładamy kwadratowe piksele: skala wyznaczona z wysokości trasy
 * (znana wysokość w metrach ↔ wysokość zdjęcia w pikselach) obowiązuje też dla osi X.
 */
export function cmPerPixel(geometry: RouteGeometry): number {
  return (geometry.routeHeightM * 100) / geometry.imgH;
}

/** Przelicza chwyt o znormalizowanych współrzędnych na pozycję w centymetrach. */
export function toCm(hold: Hold, geometry: RouteGeometry): HoldCm {
  const scale = cmPerPixel(geometry);
  return {
    id: hold.id,
    xCm: hold.x * geometry.imgW * scale,
    // y obrazu rośnie w dół — odwracamy, by yUp rosło w górę
    yUpCm: (1 - hold.y) * geometry.imgH * scale,
    isStart: hold.isStart,
    isFinish: hold.isFinish,
  };
}

/** Odległość euklidesowa między chwytami w centymetrach. */
export function distanceCm(a: HoldCm, b: HoldCm): number {
  return Math.hypot(b.xCm - a.xCm, b.yUpCm - a.yUpCm);
}
