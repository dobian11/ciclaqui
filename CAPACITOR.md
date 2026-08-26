# Cicla Qui — Build nativa iOS + Android

I progetti nativi sono **già generati e configurati** nel repo (`ios/` e `android/`), con permessi GPS in background, notifiche push e icone pronte.

> iOS richiede un Mac con Xcode. Android funziona su qualsiasi OS con Android Studio.

## 1. Clona e installa

Pulsante **GitHub** in alto a destra → "Connect to GitHub", poi:

```bash
git clone <url-del-tuo-repo>
cd <repo>
bun install
```

## 2. Build web + sync nativo

Ogni volta che cambia il codice:

```bash
bun run build     # genera dist/
bunx cap sync     # copia dist/ + plugin in ios/ e android/
```

Se le cartelle native non ci fossero (repo pulito):

```bash
bunx cap add ios
bunx cap add android
```

## 3. Genera icone e splash

```bash
bun add -D @capacitor/assets
bunx capacitor-assets generate --iconBackgroundColor "#0a0f0d" --splashBackgroundColor "#0a0f0d"
```

Sorgenti già presenti: `resources/icon.png` (1024×1024) e `resources/splash.png` (2732×2732).

## 4. Android — APK / AAB

```bash
bunx cap open android
```

In Android Studio: `Build → Generate Signed Bundle / APK → Android App Bundle`, crea il keystore (conservalo!), poi carica l'`.aab` su Play Console.

Permessi già dichiarati in `android/app/src/main/AndroidManifest.xml`:

- `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`
- `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION` (+ service del plugin di tracking)
- `POST_NOTIFICATIONS`, `WAKE_LOCK`, `HIGH_SAMPLING_RATE_SENSORS`

**Play Console — dichiarazione obbligatoria**: la posizione in background va giustificata con un video di 30–60 s che mostra il flusso (schermata educativa → prompt permessi → tracking con notifica persistente). Motivazione: "registrazione automatica degli spostamenti sostenibili per assegnare punti aziendali".

Per il test su un telefono: `Build → Build APK(s)`, poi trasferisci l'APK e abilita "Installa da fonti sconosciute".

## 5. iOS — TestFlight / App Store

```bash
bunx cap open ios
```

In Xcode:

1. Target **App** → Signing & Capabilities → seleziona il tuo Team; Bundle ID `app.ciclaqui`.
2. Aggiungi le capability **Background Modes** (Location updates + Remote notifications) e **Push Notifications** — le chiavi Info.plist sono già presenti.
3. `Product → Archive → Distribute App → App Store Connect`.

Chiavi già in `ios/App/App/Info.plist`: `NSLocationWhenInUse…`, `NSLocationAlwaysAndWhenInUse…`, `NSMotionUsageDescription`, `NSCameraUsageDescription`, `UIBackgroundModes` (location, remote-notification), `ITSAppUsesNonExemptEncryption=false`.

**App Review**: l'app mostra già la schermata educativa (`PermissionsOnboarding`) prima del prompt di sistema — requisito Apple per il permesso "Sempre". Nelle note per il reviewer indica un codice ente di test e un account demo.

## 6. Push notifications (FCM)

- Android: scarica `google-services.json` da Firebase e mettilo in `android/app/`.
- iOS: carica la chiave APNs su Firebase e aggiungi `GoogleService-Info.plist` in `ios/App/App/`.

Il codice client (`src/hooks/use-push.ts`) registra il token automaticamente sul build nativo.

## 7. Tracking in background

Sul build nativo `use-trip-recorder` usa `@capacitor-community/background-geolocation`: il viaggio continua a telefono bloccato, con notifica persistente "Cicla Qui sta registrando il tuo viaggio". Su web/PWA questo **non** è possibile (limite di iOS e Android) e l'app avvisa l'utente.

## 8. Chiavi

Nel bundle vanno solo chiavi pubbliche (Supabase anon, Google Maps con restrizioni per bundle ID / package name). Mai `service_role` o segreti Stripe.

## 9. Aggiornamenti

Ogni release richiede una nuova build inviata agli store. Per hotfix rapidi si può valutare Capgo o Appflow.
