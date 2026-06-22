/**
 * Typy domenowe współdzielone przez backend, aplikację mobilną i silnik bety.
 */

/** Poziomy bety (warianty sekwencji ruchów). */
export const BETA_LEVELS = ["static", "dynamic", "flash"] as const;
export type BetaLevel = (typeof BETA_LEVELS)[number];

/**
 * Pojedynczy chwyt na trasie.
 * Współrzędne są ZNORMALIZOWANE do przedziału [0,1] względem rozmiaru zdjęcia,
 * gdzie x rośnie w prawo, a y rośnie w DÓŁ (konwencja obrazu).
 */
export interface Hold {
  id: string;
  x: number; // 0..1 (lewo -> prawo)
  y: number; // 0..1 (góra -> dół)
  isStart: boolean;
  isFinish: boolean;
}

/** Geometria/skala trasy potrzebna do przeliczenia pikseli na centymetry. */
export interface RouteGeometry {
  /** szerokość zdjęcia w pikselach */
  imgW: number;
  /** wysokość zdjęcia w pikselach */
  imgH: number;
  /** rzeczywista wysokość trasy w metrach (z topo / oszacowana przez użytkownika) */
  routeHeightM: number;
}

/**
 * Rodzaj oparcia stopy podczas ruchu:
 *  - `hold`  — na innym, niżej położonym chwycie,
 *  - `smear` — tarcie o gołą ścianę (gdy brak chwytu),
 *  - `flag`  — noga w powietrzu (brak oparcia; ruch dynamiczny).
 */
export type FootType = "hold" | "smear" | "flag";

/** Pojedynczy ruch w wyznaczonej becie. */
export interface BetaMove {
  /** numer ruchu, liczony od 1 */
  index: number;
  fromHoldId: string;
  toHoldId: string;
  /** rodzaj oparcia stopy (model nóg) */
  footType: FootType;
  /** chwyt pod stopę — tylko gdy footType === "hold", inaczej null */
  footHoldId: string | null;
  /** dystans samego ruchu ręki (z chwytu na chwyt) w centymetrach */
  distanceCm: number;
  /** dystans od chwytu pod stopą do celu — to on decyduje o wykonalności */
  footReachCm: number;
  /** stopień wykorzystania zasięgu: footReachCm / maxReachCm (0..1+) */
  reachUsage: number;
  /** względna trudność ruchu (im wyżej, tym trudniej) */
  difficulty: number;
  /** czy ruch jest dynamiczny (wyskok) — stopa za nisko, by sięgnąć statycznie */
  isDynamic: boolean;
}

/** Wynik wyznaczenia bety dla jednego poziomu. */
export interface BetaResult {
  level: BetaLevel;
  /** czy udało się znaleźć przejście od startu do topu */
  feasible: boolean;
  /** uporządkowane id chwytów tworzących sekwencję (start -> ... -> finish) */
  holdSequence: string[];
  moves: BetaMove[];
  /** liczba ruchów */
  moveCount: number;
  /** sumaryczna trudność (kryterium jakości bety) */
  totalDifficulty: number;
  /** najtrudniejszy pojedynczy ruch (krux) */
  hardestMove: number;
  /** zastosowany maksymalny zasięg w cm dla tego wspinacza i poziomu */
  maxReachCm: number;
  /** czytelny opis, gdy brak przejścia */
  note?: string;
}

/** Parametry wspinacza wpływające na betę. */
export interface ClimberProfile {
  /** wzrost w centymetrach */
  heightCm: number;
}

/** Kolor wg skali sali (np. lokalnej ścianki). */
export interface GradeColor {
  /** nazwa koloru, np. "Zielony" */
  label: string;
  /** kolor w HEX do wyświetlenia */
  hex: string;
}

/**
 * Ocena trudności trasy — spersonalizowana wzrostem wspinacza. Liczona z
 * najłatwiejszego wykonalnego stylu (tak, jak realnie da się trasę przejść).
 */
export interface RouteGrade {
  /** ciągły wynik trudności (≈0..16), pomocniczy do sortowania */
  score: number;
  /** skala boulderowa V (Hueco): "V0".."V16" */
  vScale: string;
  /** odpowiednik na skali kolorowej sali */
  color: GradeColor;
}
