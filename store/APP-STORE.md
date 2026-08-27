# App Store Connect — checklist Cicla Qui

Serve un account **Apple Developer Program** (99 $/anno) e un Mac con Xcode.
Il workflow `Build iOS` su GitHub verifica solo che il progetto compili:
la firma e l'upload vanno fatti da Xcode con il tuo account.

## 1. Preparazione su Mac
```bash
git clone <repo> && cd <repo>
bun install
bunx cap sync ios
open ios/App/App.xcworkspace
```

In Xcode:
1. Target **App** → *Signing & Capabilities* → seleziona il tuo Team, bundle id `app.ciclaqui`.
2. Verifica le capability: **Background Modes** (Location updates + Remote notifications), **Push Notifications**.
3. *General* → Version `1.0.0`, Build `1` (incrementa a ogni upload).
4. Prodotto → *Archive* → *Distribute App* → **App Store Connect**.

## 2. Scheda App Store

**Nome:** Cicla Qui
**Sottotitolo:** Mobilità sostenibile che premia

**Promo (max 170):**
Vai in bici o a piedi, accumula punti con il tuo ente e riscattali in premi.

**Descrizione:**
Cicla Qui premia la mobilità sostenibile di aziende e comuni.

Registrati con il codice del tuo ente e inizia a muoverti: l'app riconosce
automaticamente se stai andando in bici, a piedi o in auto e ti assegna i punti
per ogni tragitto green.

• Tracciamento automatico dei viaggi, anche con schermo spento
• Punti per chilometro in bici e ogni 100 metri a piedi
• Premi e rimborsi messi a disposizione dal tuo ente
• Sfide e coppe con classifiche e podi
• Passaporto bici con QR e procedura guidata in caso di furto
• Mappa con fontanelle, rastrelliere e ciclofficine
• CO₂ risparmiata e statistiche personali

Cicla Qui non è utilizzabile senza il codice di un ente aderente.

**Parole chiave:** bici,mobilità,sostenibile,ciclabile,punti,premi,azienda,comune,CO2,tracker

**URL supporto:** https://ciclaqui.it
**URL privacy:** https://ciclaqui.it/legal/privacy

## 3. Materiali grafici
- Icona 1024×1024 PNG (senza trasparenza né angoli arrotondati)
- Screenshot 6.7" (1290×2796) e 6.5" — mappa in tracking, punti/premi, passaporto bici, sfide

## 4. Punti critici della review Apple
- **Posizione in background:** la stringa in Info.plist è già presente. Nelle note
  per la review spiega che il tracking parte solo dopo che l'utente avvia un viaggio
  e mostra una notifica persistente.
- **Account demo obbligatorio:** l'app richiede un codice ente, quindi devi fornire
  in "App Review Information" email, password e codice ente di un account di prova
  già approvato, altrimenti la review viene respinta (Guideline 2.1).
- **Privacy nutrition labels:** posizione (collegata all'utente), contatti, dati di
  utilizzo. Nessun tracking pubblicitario.
- **Account deletion:** obbligatoria in-app — già presente nella sezione Privacy.

## 5. Rilascio
TestFlight interno → TestFlight esterno con un ente pilota → invio alla review.
