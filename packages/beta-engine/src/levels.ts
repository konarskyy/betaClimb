import type { BetaLevel } from "@betaclimb/shared";

/**
 * Konfiguracja poziomu bety.
 *
 * `reachFactor` — jaką część wzrostu wspinacz może pokonać w jednym ruchu
 * (zasięg = wzrost * reachFactor). Większy zasięg pozwala pomijać chwyty.
 *
 * `moveCost(reachUsage)` — koszt jednego ruchu w funkcji wykorzystania zasięgu
 * (0 = ruch zerowy, 1 = ruch na granicy zasięgu). Kształt funkcji decyduje,
 * co algorytm uznaje za „najlepszą" betę:
 *  - statyczne: mały koszt bazowy + silna kara za naciąg (u²) → wiele krótkich, pewnych ruchów,
 *  - dynamiczne: duży koszt bazowy → minimalizacja LICZBY ruchów (mniej, większych),
 *  - flash: średni koszt bazowy + umiarkowana kara za naciąg → kompromis dla „pierwszego przejścia".
 */
export interface LevelConfig {
  level: BetaLevel;
  reachFactor: number;
  moveCost: (reachUsage: number) => number;
}

/** Zasięg „statyczny" — granica ruchu kontrolowanego (lock-off). Powyżej = ruch dynamiczny. */
export const STATIC_REACH_FACTOR = 0.65;

export const LEVEL_CONFIGS: Record<BetaLevel, LevelConfig> = {
  static: {
    level: "static",
    reachFactor: STATIC_REACH_FACTOR,
    moveCost: (u) => 0.2 + u * u,
  },
  dynamic: {
    level: "dynamic",
    reachFactor: 0.95,
    moveCost: (u) => 1 + 0.25 * u,
  },
  flash: {
    level: "flash",
    reachFactor: 0.85,
    moveCost: (u) => 0.6 + 1.5 * u * u,
  },
};
