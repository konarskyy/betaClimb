# @betaclimb/beta-engine

Rdzeń projektu: wyznaczanie **optymalnej bety** (sekwencji ruchów) na podstawie
chwytów zaznaczonych na zdjęciu trasy, spersonalizowane pod **wzrost** wspinacza.

## Model

1. **Chwyty → centymetry.** Chwyty mają współrzędne znormalizowane `[0,1]`. Skalę
   px→cm wyznaczamy ze znanej wysokości trasy w metrach (`routeHeightM`) i wysokości
   zdjęcia w pikselach (zakładamy kwadratowe piksele). Oś `yUp` rośnie ku górze.
2. **Graf.** Węzły = chwyty. Krawędź `a→b` istnieje, gdy `b` jest **wyżej** niż `a`
   (progres) i odległość `≤ zasięg`. Ścisły warunek „wyżej" czyni graf acyklicznym.
3. **Zasięg.** `maxReach = wzrost × współczynnik`. Wyższy wspinacz ma większy zasięg,
   więc może pomijać chwyty pośrednie → krótsza/inna beta.
4. **Najlepsza ścieżka.** Dijkstra z wirtualnym źródłem (wszystkie starty) do
   wirtualnego ujścia (wszystkie topy). Koszt krawędzi zależy od poziomu bety.

## Poziomy bety

| Poziom | Współczynnik zasięgu | Koszt ruchu `u = dystans/zasięg` | Charakter |
|--------|----------------------|----------------------------------|-----------|
| `static`  | 0.65 | `0.2 + u²` | wiele krótkich, pewnych ruchów (lock-off) |
| `dynamic` | 0.95 | `1 + 0.25u` | minimalizacja liczby ruchów (mniej, większych / dyno) |
| `flash`   | 0.85 | `0.6 + 1.5u²` | kompromis „najlepszego pierwszego przejścia" |

Ruch o dystansie większym niż zasięg statyczny (`0.65 × wzrost`) jest oznaczany
jako **dynamiczny** (`isDynamic`).

## API

```ts
import { computeBeta, computeAllBetas } from "@betaclimb/beta-engine";

const beta = computeBeta(holds, geometry, { heightCm: 180 }, "flash");
const all  = computeAllBetas(holds, geometry, { heightCm: 180 }); // static + dynamic + flash
```

Wynik (`BetaResult`) zawiera: `feasible`, `holdSequence`, `moves` (z dystansem,
trudnością i flagą `isDynamic`), `moveCount`, `totalDifficulty`, `hardestMove`
oraz `note` przy braku przejścia.

## Testy

```bash
npm run test --workspace packages/beta-engine
```

## Uproszczenia (jawne)
- Model **pojedynczego punktu progresji** — nie pełna biomechanika 4 kończyn.
- Skala px→cm z wysokości trasy podanej przez użytkownika.
- Zasięg ≈ funkcja liniowa wzrostu (proxy dla wymachu ramion / lock-offu).
