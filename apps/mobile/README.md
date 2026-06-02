# BetaClimb — aplikacja mobilna (Expo)

React Native (Expo SDK 56) + expo-router. Logowanie/rejestracja, dodawanie tras ze
zdjęcia z ręcznym zaznaczaniem chwytów i podgląd bety na 3 poziomach.

## Uruchomienie

```bash
cd apps/mobile
npm install
npm run start          # otwórz w Expo Go (zeskanuj kod QR) lub naciśnij i / a
```

Backend musi działać (zob. [`../api/README.md`](../api/README.md)).

### Adres backendu
Domyślnie `http://localhost:4000`. Na **fizycznym telefonie** localhost nie zadziała —
ustaw adres LAN komputera:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.10:4000 npm run start
```

## Ekrany
- **Logowanie / Rejestracja** — rejestracja pyta o wzrost (personalizacja bety).
- **Moje trasy** — lista zapisanych tras.
- **Nowa trasa** — zdjęcie (aparat/galeria) → nazwa + wysokość trasy (skala) →
  dotykasz zdjęcia, by dodać chwyty, oznaczasz start/top → zapis.
- **Trasa** — zdjęcie z nakładką chwytów i ścieżką bety; przełącznik
  Statyczne / Dynamiczne / Flash; podsumowanie i lista kroków.
- **Profil** — zmiana wzrostu (zmienia wyznaczaną betę).

## Struktura
```
app/                       # trasy expo-router
├── _layout.tsx            # providery (React Query, Auth, SafeArea)
├── index.tsx              # przekierowanie wg stanu logowania
├── (auth)/                # login, register
└── (app)/                 # ekrany po zalogowaniu (guard) + route/[id]
src/
├── api.ts                 # klient HTTP (JWT + odświeżanie tokenu)
├── auth.tsx               # kontekst uwierzytelnienia
├── session.ts             # tokeny w SecureStore
├── components/
│   ├── RouteCanvas.tsx    # zdjęcie + SVG: tapowanie chwytów / rysowanie bety
│   └── ui.tsx             # przyciski, pola, karty
├── theme.ts, types.ts
```

## Weryfikacja kodu
```bash
npm run typecheck                              # kontrola typów
npx expo export --platform android -d /tmp/x   # próbne zbundlowanie (sprawdza Metro)
```
