# Capacitor — Wrap Cicla Qui per App Store e Play Store

Questa guida ti permette di prendere la versione web e generarne **app native iOS e Android** da pubblicare sugli store, usando Capacitor.

> Esegui questi comandi sul **tuo Mac** (per iOS serve macOS + Xcode). Per Android basta Android Studio (qualsiasi OS).

## 1. Esporta il progetto da Lovable

Usa il pulsante **GitHub** in alto a destra → "Connect to GitHub" → poi clona il repo sul tuo computer:

```bash
git clone <url-del-tuo-repo>
cd <repo>
bun install
```

## 2. Aggiungi le piattaforme native

I file `capacitor.config.ts` e le dipendenze sono già nel repo. Aggiungi le piattaforme:

```bash
bunx cap add ios
bunx cap add android
```

## 3. Build + sync

Ogni volta che cambi il codice web:

```bash
bun run build          # genera dist/
bunx cap sync          # copia dist/ in ios/ e android/
```

## 4. Apri nei IDE nativi

```bash
bunx cap open ios       # Xcode
bunx cap open android   # Android Studio
```

Da qui:

- **iOS**: imposta Bundle Identifier (`app.ciclaqui`), Team Apple Developer, firma, e poi `Product → Archive → Distribute to App Store Connect`.
- **Android**: in Android Studio fai `Build → Generate Signed Bundle / APK → Android App Bundle`, e carica su Play Console.

## 5. Permessi nativi

L'app usa **geolocalizzazione continua**. Devi dichiararla nei manifest nativi:

### iOS — `ios/App/App/Info.plist`

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Cicla Qui usa la tua posizione per tracciare i viaggi in bici e assegnarti i punti.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Per registrare i viaggi anche in background.</string>
<key>UIBackgroundModes</key>
<array><string>location</string></array>
```

### Android — `android/app/src/main/AndroidManifest.xml`

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.INTERNET" />
```

## 6. Icone e splash screen

Hai già `public/icons/icon-512.png`. Per generare tutte le size native usa:

```bash
bunx capacitor-assets generate --iconBackgroundColor "#0a0f0d" --splashBackgroundColor "#0a0f0d"
```

(richiede `bun add -D @capacitor/assets` e una `resources/icon.png` 1024×1024).

## 7. Variabili d'ambiente

Le chiavi pubbliche (Supabase, Google Maps) sono già nel bundle. **Non** mettere mai chiavi `service_role` o `stripe_secret_*` nell'app.

## 8. Aggiornamenti OTA

Capacitor non aggiorna automaticamente: ogni release richiede una nuova build inviata agli store. Per piccoli fix puoi usare [Capgo](https://capgo.app) o Appflow.
