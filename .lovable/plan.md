# Correzione mappa senza schermata bianca

## Obiettivo
La schermata Mappa deve restare utilizzabile anche quando Google rifiuta la chiave o il suo servizio non è disponibile.

## Intervento
- Rilevare anche gli errori Google che arrivano dopo il caricamento dello script, incluso `InvalidKeyMapError`, con un tempo massimo di attesa.
- Passare automaticamente alla mappa alternativa già presente nell’app, basata su OpenStreetMap/CARTO.
- Estendere la mappa alternativa con posizione, percorso registrato, percorso di navigazione, destinazione e punti di interesse, mantenendo i principali comandi della schermata.
- Consentire un nuovo tentativo con Google senza lasciare un contenitore bianco.
- Consentire l’audio silenzioso usato dal tracciamento nella politica di sicurezza della pagina.

## Verifica
- Simulare il rifiuto di Google e controllare che compaia subito la mappa alternativa.
- Controllare il normale caricamento, gli errori del browser e la resa su schermo desktop/mobile.
