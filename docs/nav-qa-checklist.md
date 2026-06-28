# Checklist QA — Navigazione mappa Cicla Qui

Da eseguire manualmente in preview (web) e su build native (iOS/Android)
prima di ogni release. Le soglie e i nomi simbolici (`OFFROUTE_M`, `ARRIVED_M`…)
provengono da `src/lib/nav-helpers.ts` — i test unitari `*.test.ts` coprono
la stessa logica e devono passare (`bunx vitest run`).

## 1. Avvio tracking automatico

- [ ] Apertura app con permessi GPS già concessi → fix valido (accuracy ≤ 100 m) →
      il tracking parte da solo entro 2 s, senza bottoni manuali.
- [ ] Permessi GPS negati → compare `GpsPermissionSheet` con istruzioni
      specifiche per piattaforma e deep-link a impostazioni.
- [ ] Permessi appena concessi dopo il rifiuto → tracking parte automaticamente
      al primo fix valido.
- [ ] Servizi di localizzazione disattivati a livello OS → sheet "unavailable",
      nessun crash.
- [ ] Fuori finestra oraria ente → il tracking NON parte (badge "Fuori orario").

## 2. Navigazione verso POI

- [ ] Tap su POI sulla mappa → apre `PoiSheet` con dettagli.
- [ ] Tap "Naviga" → percorso disegnato + tracking avviato (toast
      "Percorso pronto · tracking avviato").
- [ ] Banner di navigazione mostra: modalità, distanza residua, ETA, barra di
      progresso, indicatore "REC" pulsante.
- [ ] La polyline si "consuma" muovendosi (richiede avanzamento ≥ 2 nodi: non
      deve sfarfallare ad ogni jitter GPS).
- [ ] Distanza residua e ETA si aggiornano in tempo reale e non superano mai
      i valori originali.

## 3. Fuori percorso & ricalcolo

- [ ] Deviare > 20 m dal percorso con GPS buono (≤ 50 m accuracy) →
      toast "⤴︎ Fuori percorso · ricalcolo…" entro pochi secondi.
- [ ] Durante il ricalcolo NON parte un secondo ricalcolo
      (lock per `RECALC_COOLDOWN` = 10 s).
- [ ] Con GPS pessimo (accuracy > 50 m) NON parte alcun ricalcolo anche se
      la distanza dal percorso è alta (evita falsi positivi).
- [ ] Dopo il ricalcolo la nuova polyline parte dalla posizione corrente.

## 4. Arrivo a destinazione

- [ ] Entro 25 m dal POI con GPS buono → conferma per 2 fix consecutivi →
      toast "🎯 Arrivato" + tracking si ferma + appare `TripSummarySheet`.
- [ ] GPS ballerino: l'arrivo NON viene confermato finché accuracy > 50 m.
- [ ] Fallback dwell: fermi (< 2 km/h) entro 60 m per 8 s → arrivo confermato
      anche senza mai scendere sotto i 25 m.
- [ ] Se il trip dura < 30 s o ha < 2 punti → non viene salvato sul backend
      (trip.reset()), ma il summary può comunque comparire.

## 5. Annulla tragitto

- [ ] Bottone rosso "Annulla" nel banner → dialog di conferma.
- [ ] Conferma → tracking fermato, punti GPS scartati (NIENTE salvataggio),
      banner chiuso, toast "Tragitto annullato".
- [ ] X grigia (chiudi) → chiude solo l'UI di navigazione, il tracking di
      background continua se era attivo.
- [ ] Dopo "Annulla" un nuovo tap su POI → "Naviga" funziona come la prima volta.

## 6. Riconnessione / perdita GPS

- [ ] Disattivare GPS durante il tragitto → `SourceErrorChip` "GPS" visibile,
      il banner mostra stato degradato, niente crash.
- [ ] Riattivare GPS → al primo fix valido il tracking riprende
      automaticamente senza richiedere interazione.
- [ ] Andare in tunnel/zone senza segnale per > 30 s e tornare → la polyline
      residua non "salta" assurdamente (filtro accuracy > 50 m nel recorder).
- [ ] Refresh manuale (FAB) durante navigazione → POI/qualità aria si
      aggiornano, il percorso NON viene resettato.

## 7. Performance & UI

- [ ] Tap sui bottoni reattivo (no ritardo 300 ms): `active:scale(0.97)`
      visibile.
- [ ] Marker freccia ruota fluido col heading (quantizzato a 5°), niente
      flicker o ridisegno continuo.
- [ ] `BottomTrio` (SOS / Kcal / Qa) 10 mm sopra la navbar, non sovrapposto.
- [ ] Attribuzione Google Maps nascosta.
- [ ] Niente warning ricorrenti in console durante una navigazione di 5 min
      (`console.error`/`console.warn` puliti).

## 8. Test automatici

Eseguire prima del merge:

```bash
bunx vitest run
```

Devono passare le suite:

- `src/lib/nav-helpers.test.ts` — soglie, off-route, arrivo, dwell, ETA.
- `src/lib/polyline.test.ts` — decoder Google encoded polyline.
- `src/lib/mode-classifier.test.ts` — classificazione mezzo anti-frode.

Se aggiungi o modifichi soglie in `nav-helpers.ts`, aggiorna anche
`app.index.tsx` (devono restare allineate) e questa checklist.
