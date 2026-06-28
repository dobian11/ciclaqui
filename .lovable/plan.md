## Cosa costruiamo

**Cicla Qui** — assistente per ciclisti italiani: mappa GPS ottimizzata, registro bici antifurto con QR, computer di bordo (km / CO₂), community radar per segnalazioni e SOS. Distribuito come PWA installabile e impacchettato con Capacitor per Google Play e Apple App Store.

## Design

- **Palette**: bianco `#FFFFFF`, neutro `#F4F7F5`, ink `#0E1A14`, verde Cicla `#00B86B` come accento unico
- **Typography**: Space Grotesk (titoli) + DM Sans (body) via `<link>` Google Fonts nella root route
- **Home**: solo mappa fullscreen + navbar (come richiesto). Tutto il resto (bici, viaggi, alert, profilo) vive in tab/route separate accessibili dalla navbar
- **Mobile-first**: bottom-nav su mobile, sidebar su desktop, area sicura per notch iOS

## Architettura

```text
/                    → Mappa fullscreen + navbar (home)
/auth                → Login / registrazione (email+password, Google)
/_authenticated/
  bici/              → Lista bici dell'utente
  bici/nuova         → Aggiungi bici (marca, modello, colore, telaio) → genera QR
  bici/$id           → Dettaglio bici + QR + stato (Libera/Custodita/Rubata)
  viaggi/            → Storico percorsi + statistiche CO₂
  viaggi/attivo      → Trip tracker live (GPS, km, velocità, durata)
  community/         → Feed segnalazioni geolocalizzate
  profilo/           → Account, impostazioni, punti sostenibilità
/bici/qr/$token      → Pagina pubblica scansione QR (verifica proprietà / "ho trovato questa bici")
```

## Funzionalità MVP

**1. Auth (Lovable Cloud)**
- Email/password + Google OAuth
- Tabella `profiles` (display_name, avatar, punti_sostenibilita, citta)
- Trigger auto-creazione profilo al signup

**2. Registro bici + QR**
- Tabella `bikes`: owner_id, marca, modello, colore, numero_telaio, foto, stato (enum: libera/custodita/rubata), qr_token (uuid pubblico)
- Generazione QR con libreria `qrcode` puntante a `/bici/qr/$token`
- Pagina pubblica QR: mostra stato bici; se "rubata", form per segnalare avvistamento (geo + nota)

**3. Mappa + Trip Tracker**
- Leaflet + OpenStreetMap (gratis, no API key)
- Smart polling GPS: alta frequenza in movimento, bassa quando fermi (risparmio batteria)
- Tabella `trips`: user_id, started_at, ended_at, distance_km, avg_speed, path (geojson), co2_saved_kg
- Calcolo CO₂: `km × 0.192 kg/km` (media auto benzina)

**4. Community Safe-Radar + SOS**
- Tabella `alerts`: user_id, type (furto/pericolo/ostacolo), lat, lng, descrizione, foto, upvotes, created_at, expires_at
- Marker sulla mappa per alert nel raggio utente
- Bottone SOS: apre dialer `tel:112` + invia alert "emergenza" geolocalizzato

**5. Calcolatore impronta verde**
- Widget nel profilo: slider km/settimana → CO₂ annua + equivalente alberi

## Stack tecnico

- **Frontend**: TanStack Start + React, Tailwind v4, shadcn/ui
- **Mappe**: `leaflet` + `react-leaflet` (OSM tiles)
- **QR**: `qrcode` (generazione) + `html5-qrcode` (scansione opzionale)
- **Backend**: Lovable Cloud (Postgres + Auth + Storage per foto bici)
- **PWA**: manifest + icone + service worker (vite-plugin-pwa, generateSW) — installabile su iOS/Android
- **Capacitor** (fase 2): `@capacitor/core`, `@capacitor/ios`, `@capacitor/android` → wrap della PWA in app native per gli store

## Roadmap di rilascio

1. **Sprint 1 (questa build)**: Auth + Cloud + Mappa home + registro bici con QR + trip tracker base
2. **Sprint 2**: Community radar + SOS + scansione QR pubblica + calcolatore CO₂
3. **Sprint 3**: PWA installabile (manifest, icone, offline mappa cache)
4. **Sprint 4 (off-Lovable)**: setup progetto Capacitor in locale, generazione bundle Android (.aab) e iOS (.ipa via Mac/Xcode), pubblicazione store

> **Nota store**: la build Android richiede account Google Play Developer ($25 una tantum). La build iOS richiede Mac + Xcode + Apple Developer Program ($99/anno). Lovable produce la web app/PWA che funziona da subito; il wrap Capacitor finale si fa fuori da Lovable seguendo una guida che ti fornirò allo Sprint 4.

## Cosa abilito al primo build

- Lovable Cloud (Postgres, Auth email+Google, Storage foto bici)
- Tabelle: `profiles`, `bikes`, `trips`, `alerts` con RLS scoped a `auth.uid()`
- Tabella pubblica `bikes` con policy `TO anon` solo per lookup tramite `qr_token`
- Policy `user_roles` per future feature admin (moderazione alert)

## Sprint 1 — cosa vedrai subito

- Login/signup funzionante
- Home con mappa Leaflet fullscreen + navbar (bottom su mobile)
- "Aggiungi bici" → form → QR generato e scaricabile
- "Inizia viaggio" → tracker GPS live → salva percorso e CO₂
- Profilo con punti sostenibilità

Confermi e procedo con lo Sprint 1?
