import type { BetaLevel } from "@betaclimb/shared";

/**
 * Współczynniki modelu nóg (mnożone przez wzrost w cm).
 *
 * Cała wykonalność ruchu liczona jest OD CHWYTU POD STOPĄ, nie od ręki —
 * to nogi dają zasięg i siłę.
 */
/** Statyczny zasięg ciała: stojąc na chwycie, ręka sięga ~1.0× wzrostu nad stopę. */
export const STATIC_REACH_FACTOR = 1.0;
/** Zasięg przy tarciu o gołą ścianę (smear) — słabszy niż na chwycie. */
export const SMEAR_REACH_FACTOR = 0.8;
/** Dynamiczny zasięg: wyskok napędzany nogami sięga znacznie dalej. */
export const DYNAMIC_REACH_FACTOR = 1.4;
/** Jak daleko od rąk można postawić stopę (zasięg nogi). */
export const LEG_SPAN_FACTOR = 0.85;
/**
 * Minimalny pionowy „spadek" stopy względem rąk. Stopa musi być wyraźnie
 * PONIŻEJ rąk — nie da się stanąć na chwycie trzymanym ręką ani na tej samej
 * wysokości co dłonie.
 */
export const MIN_FOOT_DROP_FACTOR = 0.15;

/**
 * Waga trudności wg stylu przejścia. Trudność liczymy względem WSPÓLNEJ miary
 * (zasięgu dynamicznego), a potem skalujemy wagą stylu, żeby oceny różnych
 * poziomów były porównywalne:
 *  - `static` — kontrolowane, pewne ruchy → najniższa ocena,
 *  - `dynamic` — wyskoki → wyższa,
 *  - `flash` — przejście „pierwszej próby" bez rozpoznania → najwyższa.
 */
export const LEVEL_DIFFICULTY_WEIGHT: Record<BetaLevel, number> = {
  static: 1.0,
  dynamic: 1.25,
  flash: 1.6,
};

/** Dodatkowa kara do trudności za ruch dynamiczny (wyskok jest pewniejszym ryzykiem). */
export const DYNO_DIFFICULTY_PENALTY = 1.4;

/**
 * Margines, o jaki ocena trudności flash musi przewyższać statyczną i dynamiczną.
 * Flash (onsight, bez rozpoznania) jest z definicji najbardziej zobowiązujący,
 * więc jego punktacja nigdy nie może być równa ani niższa od pozostałych poziomów.
 */
export const FLASH_DIFFICULTY_MARGIN = 1.1;

/**
 * Rodzaj oparcia stopy:
 *  - `hold`  — na innym, niżej położonym chwycie,
 *  - `smear` — tarcie o gołą ścianę (gdy brak chwytu),
 *  - `flag`  — noga w powietrzu (brak oparcia; tylko ruch dynamiczny).
 */
export type FootType = "hold" | "smear" | "flag";

/**
 * Analiza pojedynczego ruchu ręki z chwytu na chwyt, z uwzględnieniem
 * najlepszego dostępnego oparcia dla stopy.
 */
export interface MoveAnalysis {
  /** rodzaj oparcia stopy */
  footType: FootType;
  /** chwyt pod stopę (tylko gdy footType === "hold") */
  footHoldId: string | null;
  /** dystans samego ruchu ręki */
  handDistCm: number;
  /** dystans od stopy do celu — decyduje o wykonalności */
  footDistCm: number;
  staticReachCm: number;
  dynamicReachCm: number;
  staticUsage: number;
  dynamicUsage: number;
  /** da się wykonać statycznie (stopa wystarczająco blisko celu) */
  staticFeasible: boolean;
  /** da się wykonać dynamicznie (w zasięgu wyskoku) */
  dynamicFeasible: boolean;
  /** ruch wymaga wyskoku (poza zasięgiem statycznym) */
  isDynamic: boolean;
}

/**
 * Konfiguracja poziomu bety. `evaluate` decyduje, czy dany ruch jest dozwolony
 * na tym poziomie i ile kosztuje (kształt kosztu wyznacza „najlepszą" betę):
 *  - statyczne: tylko ruchy z oparciem dla nogi; kara za naciąg → pewne, krótkie ruchy,
 *  - dynamiczne: dozwolone wyskoki; minimalizacja LICZBY ruchów,
 *  - flash: preferuje ruchy statyczne, dopuszcza wyskok z karą — kompromis „pierwszego przejścia".
 */
export interface LevelConfig {
  level: BetaLevel;
  evaluate: (a: MoveAnalysis) => { allowed: boolean; cost: number };
  /** zasięg pokazywany jako „maksymalny" dla tego poziomu */
  maxReachCm: (heightCm: number) => number;
}

export const LEVEL_CONFIGS: Record<BetaLevel, LevelConfig> = {
  static: {
    level: "static",
    evaluate: (a) =>
      a.staticFeasible
        ? { allowed: true, cost: 0.2 + a.staticUsage * a.staticUsage }
        : { allowed: false, cost: Infinity },
    maxReachCm: (h) => h * STATIC_REACH_FACTOR,
  },
  dynamic: {
    level: "dynamic",
    evaluate: (a) =>
      a.dynamicFeasible
        ? { allowed: true, cost: 1 + 0.25 * a.dynamicUsage }
        : { allowed: false, cost: Infinity },
    maxReachCm: (h) => h * DYNAMIC_REACH_FACTOR,
  },
  flash: {
    level: "flash",
    evaluate: (a) => {
      if (!a.dynamicFeasible) return { allowed: false, cost: Infinity };
      // preferuj ruchy statyczne; wyskok dozwolony, ale z karą
      const cost = a.isDynamic
        ? 1.2 + 1.5 * a.dynamicUsage * a.dynamicUsage
        : 0.6 + a.staticUsage * a.staticUsage;
      return { allowed: true, cost };
    },
    maxReachCm: (h) => h * DYNAMIC_REACH_FACTOR,
  },
};
