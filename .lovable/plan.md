## Visione

**Cicla Qui** è una piattaforma multi-ruolo (Utente / Azienda / Admin) per mobilità sostenibile aziendale. Gli utenti si iscrivono col codice matricola della loro azienda, l'app traccia automaticamente il mezzo (bici/piedi/auto) via GPS, accumula punti convertibili in denaro (10pt = 0,10€) prelevabili via Stripe Connect. Le aziende pagano un abbonamento mensile per gestire i loro dipendenti.

## Ruoli & accesso

- **Utente** (`/auth`) — signup con email + password + **codice azienda** (obbligatorio: lega l'utente a un'azienda esistente). Home = mappa fullscreen.
- **Azienda** (`/azienda/auth`) — area separata per HR/manager. Vede solo i propri dipendenti, genera codice azienda, paga l'abbonamento, scarica report.
- **Admin** (`/admin`) — gestisce tutte le aziende, approva prelievi, vede metriche globali, modera segnalazioni furto. Accesso via ruolo in DB (no signup pubblico).

## Home utente — mappa + 3 tag + navbar

```text
┌──────────────────────────────────────────┐
│  [Aria 78 AQI] [SOS 🆘] [Calorie 142]   │ ← 3 tag flottanti sopra navbar
├──────────────────────────────────────────┤
│                                          │
│         🟢 (icona bici, posizione)       │
│              MAPPA LEAFLET               │
│                                          │
├──────────────────────────────────────────┤
│  🏠 Mappa  🚲 Bici  ⚡ Punti  👤 Profilo │ ← navbar
└──────────────────────────────────────────┘
```

- **Icona posizione dinamica**: 🟢 bici (verde) / 🟡 piedi (giallo) / 🔴 auto (rosso) — disegno del mezzo dentro il marker
- **Tag SOS** rosso → al tap apre `https://www.db360app.it` (window.open / external link)
- **Tag Calorie** → calcolate live in base a mezzo+km+peso utente (formule MET standard)
- **Tag Qualità aria** → API gratuita Open-Meteo Air Quality (AQI, PM2.5, ossigeno, polline) sulla posizione corrente

## Tracking automatico mezzo + punti

Watcher GPS in background, calcola velocità media negli ultimi 30s:
- `< 8 km/h` → **piedi** (giallo) → **3 pt/km**
- `8–35 km/h` → **bici** (verde) → **10 pt/km**
- `> 35 km/h` → **auto** (rosso) → **0 pt**

**Anti-frode (necessario perché punti = soldi reali)**:
- Massimo 50 km/giorno conteggiati per punti
- Distanza calcolata via Haversine punto-a-punto, scartando "salti GPS" >200m/sec
- Sessione minima 0,2 km per essere salvata
- Punti registrati lato server (server function), non lato client
- Tabella `trips` immutabile, anomalie flaggate per review admin
- Tetto giornaliero punti per utente, configurabile da admin

> Ti avverto: rilevamento automatico via velocità GPS ha falsi positivi (bici in discesa = auto = 0 punti; piedi su autobus = punti immeritati). Quando l'MVP è in mano agli utenti reali probabilmente vorrai aggiungere "conferma mezzo a fine viaggio". Lo lasciamo pronto da attivare.

## Passaporto bici + antifurto community

- **Crea passaporto**: marca, modello, colore, **numero telaio** (unico, indicizzato), foto, ricevuta acquisto (PDF/img)
- Stato bici: `libera` / `custodita` / `rubata` / `recuperata`
- **Segnala furto**: cambia stato → push notification (in-app) a tutti gli utenti nel raggio + visibile in feed pubblico `/bici-rubate`
- **Pagina pubblica** `/telaio/{numero}` — chiunque (anche non registrato) può cercare un numero telaio e vedere se è segnalato come rubato (utile prima di comprare usato). Se rubata: form "ho visto questa bici" con geo + nota → notifica al proprietario.
- QR fisico stampabile col link al passaporto

## Sistema punti → denaro

- Saldo utente in tabella `wallets` (`points_balance`, `eur_balance`, `lifetime_points`)
- Conversione: 10 punti = 0,10€ (rate configurabile da admin)
- **Prelievo via Stripe Connect Express**:
  - Utente onboarding KYC su Stripe (una tantum, gestito da Stripe)
  - Soglia minima prelievo: 5€ (configurabile)
  - Richiesta prelievo → admin review (anti-frode) → payout automatico Stripe
- Storico transazioni completo per utente
- Tabella `point_transactions` immutabile (audit trail)

## Sezione Azienda

- Signup: ragione sociale, P.IVA, email manager, IBAN
- Dashboard: lista dipendenti iscritti, km totali, CO₂ risparmiata, classifica top performer
- **Genera codice azienda** (UUID corto tipo `ACME-7F2K`) da distribuire ai dipendenti
- Report CSV mensile
- **Abbonamento Stripe**: 
  - Starter €49/mese (fino a 20 dipendenti)
  - Pro €149/mese (fino a 100 dipendenti)
  - Enterprise: prezzo custom (contatto)
- Se abbonamento scade → dipendenti non guadagnano più punti finché non rinnovato (saldo conservato)

## Sezione Admin

- Dashboard globale: utenti totali, aziende, km tracciati, payout pendenti
- Coda **approvazione prelievi** con segnalazioni anti-frode automatiche
- Lista aziende con stato abbonamento, sospensione manuale
- Moderazione segnalazioni furto e avvistamenti
- Configurazione: punti/km per mezzo, tetto giornaliero, soglia prelievo, rate conversione
- Audit log azioni admin

## Architettura tecnica

**Stack**: TanStack Start + React + Tailwind v4 + shadcn/ui + Leaflet + Lovable Cloud (Postgres+Auth+Storage) + Stripe (subscription B2B + Connect payout)

**Struttura route**:
```text
/                              → redirect a /auth o /app
/auth                          → login/signup utente (richiede codice azienda)
/azienda/auth                  → login/signup azienda
/telaio/$numero                → pubblica, lookup antifurto

/_authenticated/
  app/                         → mappa fullscreen (home utente)
  app/bici/                    → passaporti bici utente
  app/bici/nuova
  app/bici/$id
  app/punti/                   → saldo, storico, richiedi prelievo
  app/punti/stripe-onboarding  → Stripe Connect KYC
  app/profilo/

/_azienda/                     → layout protetto ruolo "company_manager"
  dashboard/
  dipendenti/
  abbonamento/
  report/

/_admin/                       → layout protetto ruolo "admin"
  dashboard/
  prelievi/
  aziende/
  segnalazioni/
  config/
```

**Schema DB** (tabelle chiave con RLS):
- `profiles` (id→auth.users, company_id, full_name, weight_kg, avatar)
- `user_roles` (user_id, role enum: `user|company_manager|admin`)
- `companies` (id, name, vat, code [unique], iban, stripe_customer_id, subscription_status, plan, employee_cap, created_by)
- `bikes` (id, owner_id, marca, modello, colore, frame_number [unique idx], status, photo_url, qr_token)
- `bike_reports` (bike_id, reporter_id, type [sighting|recovery], lat, lng, note, photo_url)
- `trips` (id, user_id, started_at, ended_at, mode [foot|bike|car], distance_km, avg_speed, calories, path geojson, points_earned, anomaly_flag)
- `wallets` (user_id, points_balance, eur_balance, lifetime_points)
- `point_transactions` (id, user_id, delta_points, delta_eur, reason, trip_id, payout_id, created_at)
- `payout_requests` (id, user_id, amount_eur, status [pending|approved|paid|rejected], stripe_payout_id, admin_notes)
- `company_subscriptions` (company_id, stripe_subscription_id, status, current_period_end, plan)
- `app_config` (key/value singleton tabellato: points_per_km_bike, points_per_km_foot, daily_cap_km, payout_threshold_eur, eur_per_point)
- `admin_audit_log`

**RLS**: utente vede solo i suoi dati; `company_manager` vede solo dipendenti con `profiles.company_id = sua`; `admin` vede tutto via `has_role(auth.uid(),'admin')`.

**API esterne usate** (tutte gratis senza chiave):
- OpenStreetMap tiles (mappa)
- Open-Meteo Air Quality API (qualità aria/AQI)
- Calorie: formula MET locale (no API)

## Roadmap di build

Costruire tutto in un colpo solo è troppo. Procediamo a sprint, dopo ogni sprint l'app è testabile.

| Sprint | Cosa esce | Quando |
|---|---|---|
| **1. Fondamenta** | Lovable Cloud, schema DB completo, signup utente con codice azienda, signup azienda + generazione codice, role guard admin/azienda/utente, home mappa con marker posizione, navbar | Adesso |
| **2. Tracking & punti** | Tracker GPS auto-detect mezzo, salvataggio trip server-side, calcolo punti con anti-frode base, wallet, storico, 3 tag (SOS+Calorie+Aria) | Dopo Sprint 1 |
| **3. Bici & antifurto** | Passaporto bici, upload foto, QR, segnala furto, feed pubblico bici rubate, pagina lookup telaio | Dopo Sprint 2 |
| **4. Monetizzazione** | Stripe abbonamento B2B (3 piani), Stripe Connect onboarding utente, flusso prelievo con approvazione admin | Dopo Sprint 3 |
| **5. Dashboard** | Pannello azienda completo (dipendenti, report CSV, classifica), pannello admin completo (prelievi, config, audit) | Dopo Sprint 4 |
| **6. PWA + store** | manifest, icone, service worker per installabilità. Guida wrap Capacitor per Play Store / App Store | Dopo Sprint 5 |

## Cosa ti chiedo di confermare prima di partire con Sprint 1

1. **Stripe**: per l'abbonamento B2B uso `enable_stripe_payments` (zero setup tuo). Per i payout agli utenti uso Stripe Connect Express → mi servirà il tuo account Stripe Business (lo creiamo poi insieme allo Sprint 4). Ok?
2. **Codice azienda obbligatorio al signup utente**: se uno non ha un codice, può comunque registrarsi come utente "libero" senza azienda, o lo blocchiamo? *(consiglio: permetti signup libero — utente senza azienda accumula punti ma con payout a suo carico; più semantico per il consumer market)*
3. **Admin iniziale**: la prima volta che attivi Cloud, come ti rendo admin? Posso seedare il tuo account come admin via migrazione una volta che ti registri la prima volta, oppure ti aggiungo io manualmente. Ok?
4. **Sprint 1 ora**: parto subito con fondamenta + signup multi-ruolo + home mappa, oppure vuoi modificare qualcosa nel piano?

Una volta confermato, abilito Lovable Cloud e lancio lo Sprint 1.
