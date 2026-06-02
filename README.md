# BetaClimb 🧗

Aplikacja mobilna do wspinaczki sportowej. Użytkownik robi/wgrywa zdjęcie trasy,
ręcznie zaznacza chwyty, a aplikacja wyznacza **optymalną betę (sekwencję ruchów)**
spersonalizowaną pod jego **wzrost**, w trzech wariantach: **statycznym**, **dynamicznym**
i **flash**. Aplikacja ma rejestrację i logowanie.

## Architektura (monorepo)

```
betaclimb/
├── packages/
│   ├── shared/        # wspólne typy + schematy Zod (DTO API)
│   └── beta-engine/   # algorytm wyznaczania bety (czysty TS + testy) — rdzeń projektu
└── apps/
    ├── api/           # backend: Fastify + Prisma + PostgreSQL, auth (argon2 + JWT)
    └── mobile/        # aplikacja React Native (Expo)
```

## Wymagania
- Node.js ≥ 20
- Docker (PostgreSQL dla backendu)
- Telefon z aplikacją **Expo Go** lub emulator (do uruchomienia mobile)

## Szybki start

```bash
# 1. instalacja zależności (workspaces: shared, beta-engine, api)
npm install

# 2. build pakietów wspólnych
npm run build

# 3. testy rdzenia algorytmu
npm run test --workspace packages/beta-engine

# 4. baza danych (Docker) + schemat
npm run db:up
cp apps/api/.env.example apps/api/.env
npm run db:push --workspace apps/api

# 5. backend (osobny terminal) — http://localhost:4000
npm run dev:api

# 6. aplikacja mobilna (osobny terminal) — Expo Go / emulator
cd apps/mobile && npm install && npm run start
```

Szczegóły każdej części w jej własnym README.

## Jak działa wyznaczanie bety
Zob. [`packages/beta-engine/README.md`](packages/beta-engine/README.md). W skrócie:
chwyty są węzłami grafu, krawędzie łączą chwyty osiągalne w jednym ruchu (zasięg = funkcja
wzrostu wspinacza), a beta to najlepsza ścieżka znaleziona algorytmem A* — z różnymi
kryteriami kosztu dla wariantu statycznego, dynamicznego i flash.
