# PROJECT STATUS — Lido App

> Ultimo aggiornamento: 19 giugno 2026
> Incolla questo file all'inizio di una nuova chat per dare contesto rapido, invece di ricaricare l'intera cronologia.

## Info generali
- **Progetto**: app web per gestione completa di uno stabilimento balneare (lido) a Vigna di Valle, Italia
- **Stack**: React + Firebase + Vercel
- **Deploy**: https://lido-app-zeta.vercel.app
- **GitHub**: https://github.com/proimaxx/lido-app
- **Locale**: ~/Desktop/lido-app/

## Comando di deploy standard
```bash
rm -rf build && npm run build && vercel --prod --force
```

## Firebase
- Progetto: `lido-balneare-2bd05`
- Tutto lo stato salvato in un unico documento: `lido/dati`
- Campi principali: `disdette`, `gruppi`, `umbrellas`, `rows`, `cols`, `nameFontSize`, `cellHeight`, `cellWidth`

## Feature implementate

### Griglia ombrelloni
- Righe lettera (A/B/C…), colonne numeriche
- 5 stati prenotazione: libero (verde), occupato (rosso), prenotato (giallo), pagato (blu), pagato POS (viola)
- Scambio ombrelloni: click destro per selezionare, click per scambiare (scoped alla data corrente)
- Toggle lettino aggiuntivo: icona 🛏️ sulla cella

### Clienti
- Database con deduplicazione
- Tracking disdette con badge
- Contatori presenze
- Assegnazione a gruppi con bordo cella colorato (colori neon)
- Storico cliente (popup) con export WhatsApp delle prenotazioni future

### Pagamenti
- Popup rapido con pulsanti pagamento veloce (€5–€30)

### WhatsApp
- Conferme prenotazione, cancellazioni, promemoria giornalieri, messaggi storico stagionale
- Pannello "Msg Giorno": traccia messaggi inviati via localStorage, reset giornaliero

### Gruppi
- Fino a 20 gruppi, colori neon, persistiti nel profilo cliente

### Mappa spiaggia (visuale)
- Ingresso color sabbia, strada con tratteggio giallo, pista verde ciclo/pedonale con marker emoji, parcheggio, bar, etichetta "Lungolago delle Muse"

### Sicurezza
- PIN admin: 2411, PIN collaboratore: 8080
- Lockout dopo 3 tentativi falliti (countdown 5 minuti)

### Meteo
- Widget OpenWeatherMap per Vigna di Valle (API key: 002d7da12aba36c5e8bbeca3ef46bfdd)

## Note tecniche importanti
- **Editing App.jsx**: si usano script Python di text-replacement; i fallimenti di string matching per spazi/encoding sono comuni → sempre ispezionare con `sed -n 'X,Yp'` prima di sostituire
- **Tree-shaking React**: può eliminare variabili sempre vuote; workaround: notazione a parentesi quadre (`prenView["nota"]`) o `Object.assign`
- **Campo `nota`**: contiene ID gruppo (non testo libero); il colore del gruppo si recupera dall'array `gruppi` a runtime
- **Agente VS Code parallelo**: a volte fa modifiche in conflitto — controllare sempre se ci sono conflitti durante il debug

## Preferenze di lavoro di Maxx
- Guida tecnica diretta, passo-passo, con conferma ad ogni fase
- Preferisce comandi terminale semplici a tooling complesso

## URL di deploy
- **Ufficiale (uso quotidiano)**: https://lido-app-zeta.vercel.app — protetto da PIN admin/collaboratore, come deve essere
- Alias secondario `lido-public...vercel.app`: protetto da autenticazione Vercel (login email), non usato per il lavoro quotidiano — ignorare

## Repo / Git
- Repo Git effettivo: `~/Desktop/lido-public` (NON `~/Desktop/lido-app`, che è solo una cartella locale separata)
- `.gitignore` aggiornato (19/06/2026) per escludere `node_modules/`, `build/`, `.firebase/`
- `node_modules` e `build` rimossi dal tracking Git (restano in locale, si rigenerano con `npm install` / `npm run build`)

## TODO / problemi aperti
- (da aggiornare — aggiungi qui i bug o le feature in corso al momento)
