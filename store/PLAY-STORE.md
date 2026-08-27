# Google Play Console — checklist Cicla Qui

## 1. Build
1. GitHub → Actions → **Build Android (APK + AAB)** → Run workflow.
2. Scarica l'artefatto `ciclaqui-android`:
   - `app-debug.apk` → installazione diretta sul telefono per test;
   - `app-release.aab` → caricamento su Play Console.
3. Il `versionCode` è automatico (numero della run), quindi ogni build è caricabile senza conflitti.

## 2. Firma (una volta sola)
Genera il keystore in locale:

```bash
keytool -genkey -v -keystore ciclaqui.keystore -alias ciclaqui \
  -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 ciclaqui.keystore > keystore.b64
```

Su GitHub → Settings → Secrets and variables → Actions, aggiungi:
- `ANDROID_KEYSTORE_BASE64` (contenuto di `keystore.b64`)
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS` (es. `ciclaqui`)
- `ANDROID_KEY_PASSWORD`

Conserva il file `.keystore`: senza di esso non puoi più aggiornare l'app.

## 3. Scheda dello store

**Nome app:** Cicla Qui

**Descrizione breve (max 80):**
Muoviti in bici o a piedi, accumula punti e riscatta premi con il tuo ente.

**Descrizione completa:**
Cicla Qui premia la mobilità sostenibile di aziende e comuni.

Registrati con il codice del tuo ente e inizia a muoverti: l'app riconosce
automaticamente se stai andando in bici, a piedi o in auto e ti assegna i
punti per ogni tragitto green.

• Tracciamento automatico dei viaggi, anche con schermo spento
• Punti per chilometro in bici e ogni 100 metri a piedi
• Premi, buoni e rimborsi messi a disposizione dal tuo ente
• Sfide e coppe aziendali con classifiche e podi
• Passaporto bici con QR: registra la tua bici e segnala un furto
• Mappa con fontanelle, rastrelliere, ciclofficine e navigazione integrata
• CO₂ risparmiata e statistiche personali

Cicla Qui non è utilizzabile senza il codice di un ente aderente.

**Categoria:** Salute e fitness (alternativa: Stile di vita)

**Email di contatto:** (inserisci l'indirizzo dell'assistenza)

**Privacy policy:** https://ciclaqui.it/legal/privacy

## 4. Grafica richiesta
- Icona 512×512 PNG
- Immagine in evidenza 1024×500 PNG
- Almeno 2 screenshot telefono (min 1080 px sul lato lungo): mappa in tracking, punti/premi, passaporto bici, sfide

## 5. Dichiarazioni obbligatorie
- **Posizione in background:** sì. Motivazione: "L'app registra il percorso in
  bici o a piedi anche con lo schermo spento per calcolare correttamente
  distanza e punti del viaggio avviato dall'utente." Serve un video dimostrativo
  del flusso (avvio viaggio → schermo bloccato → riepilogo).
- **Sicurezza dei dati:** raccolta di posizione, nome, email, dati di utilizzo;
  dati cifrati in transito; l'utente può richiedere cancellazione ed export
  dall'app (sezione Privacy).
- **Annunci:** no. **Acquisti in-app:** no (gli abbonamenti sono contrattati con l'ente).
- **Fascia d'età:** compila il questionario IARC (contenuto per tutti).
- **App di accesso ristretto:** indica che serve un codice ente e fornisci
  credenziali di prova a Google nella sezione "Accesso all'app".

## 6. Rilascio
Test interno → Test chiuso (alcuni dipendenti di un ente pilota) → Produzione.
