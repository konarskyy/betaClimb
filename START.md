# 🚀 Jak uruchomić (dwa terminale)

## Terminal 1 — Backend (API + baza)
```bash
cd /Users/kacperkonarski/studia/projekt-wspinaczka
npm run db:up        # PostgreSQL w Dockerze (Docker Desktop musi być włączony)
npm run dev:api      # serwer na http://localhost:4000  — zostaw uruchomiony
```
> Pierwszy raz po `db:up` na nowej bazie wykonaj jeszcze raz schemat:
> `npm run db:push --workspace apps/api`

## Terminal 2 — Aplikacja mobilna (Expo Go)
```bash
cd /Users/kacperkonarski/studia/projekt-wspinaczka/apps/mobile
EXPO_PUBLIC_API_URL=http://192.168.31.129:4000 npx expo start -c
```
> Zeskanuj kod QR w **Expo Go**. Telefon i komputer muszą być w tej samej Wi-Fi.
> `192.168.31.129` to adres LAN komputera — sprawdź go w razie zmiany:
> `ipconfig getifaddr en0`.  Flaga `-c` czyści cache Metro.

## Zatrzymanie
- Terminal 1/2: `Ctrl + C`
- Baza: `npm run db:down` (z katalogu głównego)

## Szybka kontrola
- Backend działa? Otwórz na komputerze: http://localhost:4000/health → `{"status":"ok"}`
- Z telefonu nie łączy? Sprawdź http://192.168.31.129:4000/health w przeglądarce telefonu.
