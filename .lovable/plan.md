
# Roadmap completa: mappe reali + tutti gli sprint

## Mappe — strategia ibrida

**Subito (web + Android via Capacitor):**
- Collego il connector **Google Maps Platform** già disponibile in Lovable.
- Sostituisco Leaflet con **Google Maps JS** (tile reali, traffico, routing, geocoding, ricerca luoghi).
- Aria reale via **Google Air Quality API** (più preciso di Open-Meteo).
- Routing/tracciato viaggio reale via **Routes API** + snap-to-road con **Roads API**.

**Più avanti (iOS nativo via Capacitor):**
- Quando avrai Apple Developer Program attivo, aggiungo **MapKit JS** (web su Safari iOS) e/o plugin **MapKit nativo** su iOS.
- Mi servirà: Team ID, Key ID, file `.p8`. Genererò il JWT lato server.
- Su Android e web resterà Google Maps.

## Sprint 2 — Tracking viaggi reale
- Hook `useTripRecorder`: registra punti GPS in tempo reale, calcola distanza (Haversine), durata, velocità media, mode dominante.
- Tabella `trips` già creata → scrivo `start_trip` / `append_point` / `end_trip` come `createServerFn`.
- Polyline live disegnata sulla mappa Google.
- Anti-frode base: velocità max plausibile per mode, salti GPS scartati, accuracy < 50m.
- Punti assegnati a fine viaggio: bici 10/km, piedi 3/km, auto 0. Scritti in `point_transactions` + aggiornamento `wallets` in transazione DB.
- Pulsante Start/Stop nel FAB area o sopra navbar.

## Sprint 3 — Passaporto bici + furto
- `/app/bici`: lista bici dell'utente, CTA "Registra bici".
- `/app/bici/nuova`: form (codice telaio, marca, modello, colore, foto), genera QR con link pubblico.
- `/app/bici/$id`: dettaglio + tasto "Segnala rubata" / "Recuperata".
- `/bici/$frame`: pagina pubblica (senza auth) per chiunque trovi la bici — mostra stato + form contatto al proprietario.
- Tabella `bike_reports` per segnalazioni avvistamenti.

## Sprint 4 — Monetizzazione Stripe
- **Stripe Connect Express** per utenti: onboarding link, payout 1 punto = 0.01 €, soglia minima 100 punti.
- **Stripe Billing** per aziende: piani mensili, webhook → `company_subscriptions`.
- Server routes pubblici `/api/public/stripe/webhook/*` con verifica firma.
- Sezione `/app/punti` mostra saldo, storico, pulsante "Preleva" (apre Stripe).
- `/azienda` mostra stato abbonamento + portale fatturazione.

## Sprint 5 — Dashboard azienda + admin
- `/azienda`: elenco dipendenti, km/punti per dipendente, totali, esporta CSV.
- `/azienda/dipendenti/$id`: dettaglio viaggi.
- `/admin`: panoramica aziende, utenti totali, payout pending, log audit, toggle config app (`app_config`).
- Role guard: `admin` via `has_role(uid,'admin')`.

## Sprint 6 — PWA + Capacitor
- Manifest, icone, service worker, install prompt.
- Capacitor: `@capacitor/core`, `@capacitor/ios`, `@capacitor/android`, `@capacitor/geolocation` (GPS in background).
- Guida build `.ipa` / `.aab` per App Store / Play Store.

## Note tecniche
- Google Maps caricato con `loading=async` + browser key referrer-restricted (auto da connector).
- Air Quality, Routes, Geocoding chiamati lato server via gateway (`createServerFn`).
- Tutti i write su trip/wallet protetti da `requireSupabaseAuth`.
- Capacitor Geolocation con `enableHighAccuracy: true` per tracking preciso anche a schermo spento.

## Ordine di esecuzione (parto subito)
1. Connetto Google Maps → swap della mappa attuale.
2. Sprint 2 tracker reale.
3. Sprint 3 bici.
4. Sprint 4 Stripe (ti chiederò le chiavi al momento).
5. Sprint 5 dashboard.
6. Sprint 6 PWA + Capacitor.

Confermi e parto dal punto 1?
