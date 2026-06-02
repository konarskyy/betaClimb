# @betaclimb/api

Backend BetaClimb: **Fastify + Prisma + PostgreSQL**. Obsługuje rejestrację/logowanie
(argon2 + JWT), zapis tras z chwytami, upload zdjęć i wyznaczanie bety (`@betaclimb/beta-engine`).

## Uruchomienie

```bash
# z katalogu głównego repo:
npm run db:up                       # PostgreSQL w Dockerze
cp apps/api/.env.example apps/api/.env
npm run db:push --workspace apps/api # utworzenie schematu w bazie
npm run dev:api                     # serwer dev (http://localhost:4000)
```

Test integracyjny (wymaga działającej bazy):

```bash
npm run test --workspace apps/api
```

## Endpointy

| Metoda | Ścieżka | Opis | Auth |
|--------|---------|------|------|
| POST | `/auth/register` | rejestracja (`username`, `password`, `heightCm`) | — |
| POST | `/auth/login` | logowanie → para tokenów | — |
| POST | `/auth/refresh` | odświeżenie tokenów (`refreshToken`) | — |
| GET | `/me` | profil zalogowanego użytkownika | JWT |
| PATCH | `/me` | zmiana wzrostu (`heightCm`) | JWT |
| POST | `/routes` | utworzenie trasy z chwytami | JWT |
| GET | `/routes` | lista tras użytkownika | JWT |
| GET | `/routes/:id` | szczegóły trasy z chwytami | JWT |
| POST | `/routes/:id/image` | upload zdjęcia (multipart `file`) | JWT |
| POST | `/routes/:id/beta` | beta 3 poziomów (opcj. `heightCm`, `levels`) | JWT |

## Bezpieczeństwo
- Hasła hashowane **argon2id** (sól osadzona w hashu).
- **JWT** access (krótki) + refresh (długi), osobne sekrety.
- Ten sam komunikat błędu dla złego loginu i hasła.
- Walidacja wejścia **Zod** (wspólne schematy z `@betaclimb/shared`).
- Prisma → zapytania parametryzowane (ochrona przed SQL Injection).

> Hardening produkcyjny (do rozważenia): rotacja i czarna lista refresh tokenów,
> rate limiting, sekrety w menedżerze sekretów, storage zdjęć w S3/MinIO.
