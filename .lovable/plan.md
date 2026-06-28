## Sprint 10 — Conformità Store + Background GPS + Push

Obiettivo: rendere l'app **pubblicabile su App Store e Play Store** e abilitare tracking continuo a schermo bloccato + notifiche push. È il blocco a maggior rischio di rifiuto, quindi va per primo.

---

### A. Conformità legale (GDPR + Store)

1. **Pagine legali reali** (route pubbliche, no segnaposto):
   - `/legal/privacy` — Informativa Privacy GDPR (titolare, finalità, base giuridica, conservazione, diritti, DPO, trasferimenti extra-UE).
   - `/legal/terms` — Termini di Servizio (account ente/utente, punti≠valuta, premi, prelievi, sospensione, foro).
   - `/legal/cookie` — Policy cookie + banner con consenso granulare (necessari / analytics / marketing) salvato in `cookie_consents`.
   - `/legal/permissions` — Spiegazione permessi GPS/Motion/Notifiche **prima** della richiesta sistema (richiesto da Apple, altrimenti reject).
2. **Diritti GDPR self-service** nella dashboard utente:
   - Export dati account (JSON+ZIP via server fn → email firmata).
   - Cancellazione account (soft delete 30gg → hard delete via cron pg_cron).
   - Revoca consensi.
3. **Footer legale** persistente + link in onboarding.

### B. Background GPS nativo (Capacitor)

- Plugin: `@capacitor-community/background-geolocation` (iOS + Android).
- Wrapper `useBackgroundTrip` che:
  - chiede permessi *Always Allow* con schermata educativa custom prima del prompt sistema;
  - registra punti GPS anche con app chiusa, batch upload ogni 30s o 200m;
  - mostra notifica persistente Android ("Cicla Qui sta registrando il tuo viaggio").
- Sostituisce l'attuale `use-trip-recorder` quando `Capacitor.isNativePlatform()`.
- Fallback PWA: Geolocation API + `Page Visibility` warning.

### C. Anti-frode livello 4

- Accelerometro + bussola via `@capacitor/motion`.
- `mode-classifier.ts`: combina **GPS speed + accel variance + heading stability** → score di confidenza.
  - Bici: speed 8-35 km/h, accel variance media, heading variabile.
  - Auto: speed >30 km/h costante, accel variance bassa, heading stabile.
  - Piedi: speed <7 km/h, accel variance alta.
- Trip flagged se score < soglia → review manuale ente prima di accreditare punti.
- Tabella `trip_flags` + sezione "Da verificare" nella dashboard ente.

### D. Push notifications

- Firebase Cloud Messaging (Android + iOS via APNs).
- Tabella `device_tokens` (user_id, token, platform).
- Server fn `sendPush` che usa FCM HTTP v1 con service account.
- Trigger automatici:
  - Sfida completata, streak a rischio (h 20 se manca attività),
  - Bici tua segnalata avvistata,
  - Trip flagged dall'azienda.
- Schermata preferenze notifiche.

### E. Marketplace premi (foundation)

Solo le fondamenta per non bloccare lo sprint successivo:
- Tabelle `rewards_catalog` (centrale Cicla Qui), `rewards_partner_local` (per ente), `reward_redemptions`.
- Pagina "Premi" utente con tab *Nazionali* / *Locali* / *Cash*.
- Riscatto = scala punti, genera voucher con codice univoco + QR.

---

### Dettagli tecnici

**Nuove tabelle (migration):**
```text
cookie_consents(user_id, necessary, analytics, marketing, consented_at, ip_hash)
data_export_requests(user_id, status, file_path, expires_at)
account_deletion_requests(user_id, scheduled_for, reason)
device_tokens(user_id, token, platform, last_seen)
notification_preferences(user_id, push_streak, push_challenges, push_bike, push_trip_flag)
trip_flags(trip_id, score, reason, status, reviewed_by, reviewed_at)
rewards_catalog(id, title, description, points_cost, partner, image_url, stock, region, active)
rewards_partner_local(id, company_id, ...)
reward_redemptions(id, user_id, reward_id, code, qr_url, status, redeemed_at)
```

**Nuovi secret necessari (chiederò dopo aver approvato il piano):**
- `FCM_SERVICE_ACCOUNT_JSON` (Firebase) — push notifications.
- `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_AUTH_KEY` (iOS push, opzionale se via Firebase).

**Capacitor (lo aggiungo io):**
- `@capacitor/core`, `@capacitor/ios`, `@capacitor/android`, `@capacitor-community/background-geolocation`, `@capacitor/motion`, `@capacitor/push-notifications`, `@capacitor/local-notifications`.

**File principali toccati:**
- nuovi: `src/routes/legal.*.tsx`, `src/components/cicla/CookieBanner.tsx`, `src/components/cicla/PermissionsOnboarding.tsx`, `src/hooks/use-background-trip.ts`, `src/lib/mode-classifier.ts`, `src/lib/push.functions.ts`, `src/lib/gdpr.functions.ts`, `src/routes/_authenticated/app.premi.tsx`, `src/routes/_authenticated/app.account.privacy.tsx`.
- modificati: `src/routes/__root.tsx` (banner + footer), onboarding, dashboard utente, navbar.

---

### Ordine di esecuzione (1 messaggio = 1 batch)

1. Migration DB + secret push.
2. Pagine legali + cookie banner + footer.
3. GDPR self-service (export + cancellazione).
4. Capacitor setup + background GPS + permissions onboarding.
5. Mode classifier evoluto + trip_flags + review ente.
6. Push notifications + preferenze.
7. Marketplace premi (foundation + UI riscatto).
8. QA: build native, test su preview, verifica linter Supabase.

Sprint successivi (memo, non ora): Catalogo premi reale + sponsor, Report PDF aziende + CO₂, Heatmap, Widget iOS/Android, Apple Health/Google Fit.
