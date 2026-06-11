# @betaclimb/beta-engine

Rdzeń projektu: wyznaczanie **optymalnej bety** (sekwencji ruchów) na podstawie
chwytów zaznaczonych na zdjęciu trasy, spersonalizowane pod **wzrost** wspinacza.

## Model (z nogami)

Wspinanie nie odbywa się „na rękach" — **nogi dają zasięg i siłę**. Dlatego każdy
ruch ręki liczony jest **od chwytu pod stopą**, nie od dłoni.

1. **Chwyty → centymetry.** Współrzędne znormalizowane `[0,1]` przeliczamy na cm ze
   znanej wysokości trasy (`routeHeightM`) i wysokości zdjęcia (kwadratowe piksele).
   Oś `yUp` rośnie ku górze.
2. **Oparcie stopy (model nóg).** Dla ruchu ręki `a→b` algorytm dobiera oparcie stopy
   w kolejności (`footType`):
   - **`hold`** — inny chwyt niż trzymany ręką, **wyraźnie poniżej rąk** (min.
     `0.15 × wzrost`), w zasięgu nogi (`≤ 0.85 × wzrost`); pełny zasięg `1.0 × wzrost`.
     Oddaje technikę „stopa idzie za ręką".
   - **`smear`** — gdy brak chwytu: **tarcie o gołą ścianę** tuż pod rękami; słabszy
     zasięg `0.8 × wzrost`. Działa tylko **powyżej ziemi**.
   - **`flag`** — gdy i na to nie ma miejsca (tuż nad ziemią): **noga w powietrzu**,
     bez nacisku → ruch możliwy tylko dynamicznie.

   Wykonalność i trudność liczone są od oparcia stopy do celu (`footDist`). Stopa
   **nigdy nie dotyka ziemi**. Start nie jest wyjątkiem — używa tarcia lub flagi.
3. **Statycznie czy dynamicznie?**
   - `footDist ≤ 1.0 × wzrost` → ruch **statyczny** (da się wykonać stojąc na chwycie),
   - `1.0 × wzrost < footDist ≤ 1.4 × wzrost` → ruch **dynamiczny** (wyskok napędzany
     nogami — stopa za nisko, by sięgnąć w kontroli),
   - powyżej `1.4 × wzrost` → ruch niewykonalny.
4. **Graf.** Węzły = chwyty; krawędź `a→b` gdy `b` jest wyżej i poziom dopuszcza ruch.
   Ścisły warunek „wyżej" czyni graf acyklicznym.
5. **Najlepsza ścieżka.** Dijkstra od wirtualnego źródła (starty) do ujścia (topy).

## Poziomy bety

| Poziom | Dozwolone ruchy | Koszt (`uₛ, u_d` = footDist / zasięg) | Charakter |
|--------|-----------------|---------------------------------------|-----------|
| `static`  | tylko statyczne (z oparciem nogi) | `0.2 + uₛ²` | pewne, krótkie ruchy |
| `dynamic` | statyczne + wyskoki | `1 + 0.25·u_d` | minimalizacja liczby ruchów |
| `flash`   | statyczne + wyskoki | statyczny: `0.6 + uₛ²`, wyskok: `1.2 + 1.5·u_d²` | preferuje statykę, wyskok z karą |

Każdy ruch w wyniku ma `footType` (`hold`/`smear`/`flag`), `footHoldId` (chwyt pod stopę,
gdy dotyczy), `footReachCm` (zasięg od stopy) oraz `isDynamic`. Współczynniki:
`STATIC_REACH_FACTOR=1.0`, `SMEAR_REACH_FACTOR=0.8`, `DYNAMIC_REACH_FACTOR=1.4`,
`LEG_SPAN_FACTOR=0.85`, `MIN_FOOT_DROP_FACTOR=0.15` (w `levels.ts`).

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
- Model **stance (ręce + stopa)** — uwzględnia oparcie dla nogi, ale nie pełną
  biomechanikę 4 kończyn ani balansu środka ciężkości. Oparcie dla stopy wybierane
  jest niezależnie dla każdego ruchu (zakładamy optymalne ustawienie nóg).
- Każdy chwyt może służyć za stopnik (brak osobnych stopni/wcięć — to naturalne
  rozszerzenie na przyszłość).
- Skala px→cm z wysokości trasy podanej przez użytkownika.
- Zasięg ≈ funkcja liniowa wzrostu (proxy dla wyprostu ciała i siły nóg).
