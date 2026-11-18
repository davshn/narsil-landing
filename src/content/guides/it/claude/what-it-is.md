---
title: "Cos'è Narsil in Claude"
description: "L'estensione del browser che porta Narsil dentro claude.ai su Android: cosa mostra, perché è sperimentale, quali browser la eseguono, le sue opzioni e come è fatta."
route: claude
order: 1
updated: 2026-11-18
---

## Cosa fa

Narsil in Claude ("Narsil en Claude" nel suo nome proprio) è un'estensione del browser per Firefox e Vivaldi su Android. Porta Narsil dentro `claude.ai`, così puoi vedere come vanno le tue conversazioni senza lasciare la pagina in cui parli con Claude. Aggiunge quattro cose:

- **Una banda sopra la casella dei messaggi**, in ogni conversazione su `claude.ai/code`: Narsil nella posa dello stato della conversazione, lo stato stesso (`TRABAJANDO`, `TE NECESITA`, `TERMINADA` o `EN REPOSO`), il contesto usato, il conto alla rovescia della cache e l'ultima cosa che ha detto Claude. Ne parla la [guida 2](/it/mods/claude/conversation-band/).
- **Un blocco nel menu laterale**, sotto Cerca: il livello e l'esperienza di Narsil, i limiti di utilizzo di 5 ore e settimanali, e il conteggio ntfy del giorno. Ne parla la [guida 3](/it/mods/claude/sidebar/).
- **I colori di Narsil** su tutta la pagina, chiari di giorno e scuri di notte, dalla tavolozza del mare notturno di [Narsil Skin](https://github.com/davshn/narsil-skin). Ne parla la [guida 4](/it/mods/claude/colors-and-icon/).
- **L'icona di Narsil**, quando aggiungi `claude.ai` alla schermata home con l'estensione attiva. Anche questa nella [guida 4](/it/mods/claude/colors-and-icon/).

L'estensione lavora sopra la vera web app di Claude. Niente viene sostituito: continui a leggere l'intera conversazione, ad approvare i permessi e a rispondere alle domande di Claude come sempre. L'estensione aggiunge solo ciò che disegna intorno.

> **Sperimentale.** L'estensione si basa sulla struttura della pagina di `claude.ai` e su indirizzi interni che la pagina stessa usa, non su un'API pubblica. Un aggiornamento di Claude può romperla in qualsiasi momento. Quando succede, la banda o il blocco semplicemente smettono di comparire; non coprono niente. Legge soltanto, e non invia mai i tuoi dati da nessuna parte. Il suo codice non è pubblico, quindi questo percorso spiega come è fatta e dà piccoli esempi tutti tuoi.

L'estensione fa parte della famiglia Narsil. Il livello e il conteggio ntfy arrivano da [Narsil per Claude Code](https://github.com/davshn/narsil-pet), la mod sul tuo computer; tutto il resto funziona senza di essa.

## Come funziona dentro

### Perché un'estensione, e perché su Android

Claude Code sul tuo computer mostra già Narsil nella sua fascia e nella finestra mobile. Quando guidi una conversazione dal telefono tramite Remote Control, sei su `claude.ai/code` in un browser mobile, e Narsil è fuori dalla tua vista. L'app Claude per Android non si può estendere, ma una pagina in un browser sì: un'estensione del browser esegue i propri script dentro la pagina che apri.

Così l'estensione è l'unico modo per mettere Narsil sullo stesso schermo della conversazione, ed è il motivo per cui supporta solo due browser mobili:

| Browser                | Banda e blocco         | Colori      | Icona       |
| ---------------------- | ---------------------- | ----------- | ----------- |
| Vivaldi per Android    | Sì                     | Sì          | Non testata |
| Firefox per Android    | Sì                     | Sì          | Sì          |
| Firefox sul desktop    | Non testato            | Non testati | Non serve   |
| Chrome per Android     | Non accetta estensioni | No          | No          |
| L'app nativa di Claude | No                     | No          | No          |

Serve **Firefox 142 o successivo** oppure **Vivaldi 8.2 o successivo**. Il minimo di Firefox viene dal manifest (`strict_min_version` impostato a `142.0`, sia per Firefox sia per Firefox per Android); quello di Vivaldi dal README, che dice che Vivaldi su Android carica le estensioni di Chrome da una cartella dalla 8.2.

### Le parti dell'estensione

L'estensione è JavaScript semplice, senza passaggio di build e senza librerie. La sua cartella contiene:

- **`manifest.json`**, la descrizione da cui parte ogni estensione del browser ([MDN: manifest.json](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json)). È un file Manifest V2 per Firefox. Chiede solo due permessi: `storage`, per le opzioni, e `https://ntfy.sh/*`, per leggere lo stato della mod. Dichiara anche `data_collection_permissions` come `none`, il modo di Firefox per far dire a un'estensione che non raccoglie dati.
- **Due gruppi di content script**, entrambi su `https://claude.ai/*` ([MDN: content_scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/content_scripts)). Il primo gira a `document_start`, prima che la pagina si disegni, con i colori (`skin.css`, `mode.js`) e l'icona (`app-icon.js`). Il secondo gira a `document_idle`, una volta caricata la pagina, con la banda e il blocco (`content.js` e `band.css`).
- **Uno script di background**, `background.js`. È l'unica parte che parla con ntfy.sh. In Firefox è una pagina di background; nel pacchetto Chromium per Vivaldi, un service worker carica gli stessi file.
- **La pagina delle opzioni**, `options.html` e `options.js`, dove scrivi il tuo topic e la tua chiave.
- **Piccoli moduli in `lib/`**, ognuno caricato dove serve: `live.js` (cosa ricavano la banda e i limiti dai dati di `claude.ai`), `state.js` (cosa viene conservato e mostrato dello stato della mod), `seal.js` (aprire i messaggi sigillati), `stream.js` (seguire lo stream di ntfy.sh), `watch.js` (l'unico osservatore della pagina), `mode.js` (quale modalità riceve ogni ora), `manifest.js` (l'icona della schermata home), `restore.js` (rimettere a posto stili e script in Vivaldi) e `browser.js` (permette al codice di dire `browser` anche in Chromium).

La divisione segue una regola: **la pagina non vede niente di segreto**. I content script girano dentro `claude.ai` e disegnano; lo script di background custodisce il topic e la chiave, legge ntfy.sh e invia alla pagina solo lo stato che ha già aperto. Il codice lo dice chiaramente: il topic e la chiave "never reach the page" (non arrivano mai alla pagina).

### Le opzioni: il tuo topic e la tua chiave

La pagina delle opzioni ha due campi e un pulsante Salva:

- **Topic**, quello che ti dà `/narsil movil` in Claude Code ([Avvisi sul telefono e sull'orologio](/it/mods/pet/phone-and-watch/) spiega come lo crea la mod). La pagina accetta solo lettere, numeri, `-` e `_`, fino a 64 caratteri, e rifiuta qualsiasi altra cosa.
- **Chiave**, solo se ne hai creata una con `/narsil movil clave`. È un campo password.

Entrambi vengono salvati con `storage.local` ([MDN: storage.local](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/local)), lo spazio di archiviazione dell'estensione sul telefono. Non finiscono mai nel pacchetto che viene firmato, e mai nella pagina. Quando uno dei due cambia, lo script di background se ne accorge (`storage.onChanged`) e ricomincia a leggere con i nuovi valori.

Se il blocco nel menu laterale mostra `Toca y escribe tu topic` ("tocca e scrivi il tuo topic") o `🔒 Toca y pon la clave` ("tocca e inserisci la chiave"), un tocco su di esso apre la pagina delle opzioni.

### Cosa le serve dalla mod, e cosa funziona senza

| Parte                                  | Serve narsil-pet? | Da dove arriva                           |
| -------------------------------------- | ----------------- | ---------------------------------------- |
| La banda sopra la casella dei messaggi | No                | `claude.ai` stesso                       |
| I limiti di 5 ore e settimanali        | No                | `claude.ai` stesso                       |
| I colori e l'icona                     | No                | L'estensione                             |
| Il livello e l'esperienza di Narsil    | Sì                | Il topic di stato della mod su ntfy.sh   |
| Il conteggio ntfy del giorno           | Sì                | Il topic di stato della mod su ntfy.sh   |
| Lo stadio di Narsil nelle immagini     | Sì                | L'immagine che nomina lo stato della mod |

Per le righe che hanno bisogno della mod, `/narsil movil` deve essere attivo. Senza, il blocco nel menu laterale mostra solo i limiti, e la banda mostra l'icona propria dell'estensione dove sarebbe l'immagine di Narsil al suo stadio.

### Cosa passa per la rete

L'estensione legge soltanto. Ogni richiesta che fa, dal suo codice:

- **A `claude.ai`**, con la tua sessione, come fa la pagina stessa: l'elenco delle tue conversazioni attive e in pausa, gli ultimi eventi di quella che hai aperta, e l'utilizzo del tuo account. Solo richieste `GET`. Niente viene scritto nel tuo account.
- **A ntfy.sh**, dallo script di background: legge il topic di stato della mod (il tuo topic con `-estado` alla fine). Leggere un topic richiede il suo nome nell'indirizzo, quindi ntfy.sh vede il topic e la rete del tuo telefono. Niente viene pubblicato.
- **A GitHub**, per le immagini di Narsil: la banda e il blocco mostrano i suoi disegni dal repository narsil-pet, quindi il telefono scarica quelle immagini. Il nome del file dice la sua posa e il suo stadio, come la posa al lavoro o quella in attesa.
- **L'icona della schermata home** punta alle icone della web app per telefono di chi ha creato Narsil, che il browser scarica solo quando aggiungi `claude.ai` alla schermata home.

Nessuna di queste invia ciò che mostra la pagina (le tue conversazioni, il tuo utilizzo, il tuo topic o la tua chiave) da qualche altra parte.

### Installarla

Il codice non è pubblico, quindi questi sono i passi che segue chi ha creato Narsil, e i passi che valgono per un'estensione che costruisci tu. La [guida 5](/it/mods/claude/android-packaging/) spiega i pacchetti nel dettaglio.

**In Vivaldi**, l'estensione si carica da una cartella sul telefono, senza firma:

1. Costruisci il pacchetto Chromium (Manifest V3) dall'estensione di Firefox e copialo nella cartella `Download` del telefono via USB.
2. In Vivaldi, apri `vivaldi://extensions` e attiva **Developer mode**.
3. Tocca **Load unpacked**, scegli la cartella, poi **Use this folder** e **Allow**.
4. Apri le opzioni dell'estensione e scrivi il tuo topic, e la chiave se ne hai una.
5. Apri `claude.ai` e ricaricala.

**In Firefox**, un'estensione deve essere firmata da Mozilla. La firma è _unlisted_: non pubblica l'estensione nello store dei componenti aggiuntivi.

1. Crea delle credenziali API su [addons.mozilla.org](https://addons.mozilla.org/developers/addon/api/key/) e firma l'estensione con `web-ext sign --channel=unlisted` di Mozilla ([Extension Workshop: web-ext command reference](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#web-ext-sign)). Il risultato è un file `.xpi`.
2. Copia il `.xpi` sul telefono.
3. In Firefox, apri **Settings → About Firefox** e tocca il logo cinque volte per mostrare il menu nascosto.
4. Di nuovo in **Settings**, usa l'opzione per installare un'estensione da un file.
5. Apri le impostazioni dell'estensione e scrivi il tuo topic, e la chiave se ne hai una.

### Disinstallarla

In Firefox, apri il menu, vai su **Extensions**, scegli **Narsil en Claude** e rimuovila. In Vivaldi, rimuovila da `vivaldi://extensions`. Claude torna ai suoi colori. L'icona della schermata home resta finché non installi di nuovo l'app, perché il browser la fissa al momento dell'installazione.

Per fermare il livello e il conteggio senza rimuovere niente, svuota il topic nelle opzioni. Per impedire del tutto alla mod di inviare lo stato, esegui `/narsil movil off` sul tuo computer.

## Come è stata chiesta all’IA

### Registrato: su questo percorso, non sull'estensione

Le richieste fatte all'IA per l'estensione stessa non sono state registrate. È registrato come chi ha creato Narsil ha chiesto che comparisse su questo sito. Nella fase 2 del log dei task del sito:

> "tambien quiero agregar la informacion de narsil-claude ponla como experimental, aunque he hecho muchas pruebas y fujnciona bastante bien"

In italiano: voglio anche aggiungere le informazioni su narsil-claude; segnala come sperimentale, anche se l'ho provata molto e funziona piuttosto bene.

E per questo percorso, il 2026-11-18:

> "hay otra cosa, no metimos la guia de narsul claude en celular, pusimos que era experimental pero que explicariamos como hacerlo, falta esa guia, el repositorio es narsil-claude"

In italiano: c'è un'altra cosa, non abbiamo messo la guida di narsil claude sul cellulare; abbiamo scritto che era sperimentale ma che avremmo spiegato come farla; manca quella guida; il repository è narsil-claude. Chi ha creato Narsil ha chiesto una "Ruta corta", un percorso breve, che è questo.

### Ricostruzione dalla cronologia dei commit

Il resto è ricostruito dalla cronologia dei commit dell'estensione; le richieste stesse non sono state conservate. Il primo giorno ne ha costruito la maggior parte:

- `c200e8a` (2026-11-09) "feat: show Narsil's state in claude.ai's sidebar on Firefox for Android" (mostra lo stato di Narsil nel menu laterale di claude.ai su Firefox per Android). Il suo messaggio spiega l'obiettivo: "so the state is on the same screen as Claude" (così lo stato è sullo stesso schermo di Claude), leggendo ntfy.sh dalla pagina di background, con il topic e la chiave nello spazio di archiviazione dell'estensione.
- `0d65509` (2026-11-09) "feat: wear Narsil's colors on claude.ai, light by day and dark by night" (veste claude.ai con i colori di Narsil, chiari di giorno e scuri di notte).
- `40be528` (2026-11-09) "build: sign the extension as unlisted with Mozilla" (firma l'estensione come unlisted con Mozilla).
- `083c03d` (2026-11-09) "feat: give claude.ai Narsil's icon when it is installed from Firefox" (dà a claude.ai l'icona di Narsil quando viene installata da Firefox).
- `19677ac` (2026-11-09) "feat: show each conversation's state, context and cache above the prompt" (mostra lo stato, il contesto e la cache di ogni conversazione sopra il prompt).
- `00adbb9` (2026-11-09) "feat: show only Narsil's level, the limits and ntfy's count in the sidebar" (mostra nel menu laterale solo il livello di Narsil, i limiti e il conteggio di ntfy).
- `11dadb3` (2026-11-10) "feat: run the extension in Vivaldi for Android as a Chromium package" (esegue l'estensione in Vivaldi per Android come pacchetto Chromium).

L'ordine mostra un design che si è ristretto: è nato come un unico pannello nel menu laterale alimentato da ntfy.sh, ed è finito diviso in due, con ntfy.sh usato solo per ciò che la pagina non può sapere.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt di chi ha creato Narsil.

> Costruisci un'estensione di Firefox (Manifest V2, JavaScript semplice, senza passaggio di build) per Firefox per Android che aggiunga una piccola banda di stato a `https://claude.ai/*`. Usa due gruppi di content script: uno a `document_start` per gli stili, uno a `document_idle` che disegna la banda. Aggiungi una pagina delle opzioni (`options_ui`) con un campo "topic", validato come `[-_A-Za-z0-9]{1,64}`, salvato con `browser.storage.local`. Solo lo script di background può leggere il topic e parlare con `https://ntfy.sh`; il content script riceve lo stato tramite `runtime.connect` e non vede mai il topic. Non chiedere permessi oltre a `storage` e `https://ntfy.sh/*`. Inserisci ogni pezzo di testo con `textContent`, mai come HTML. Usa solo API documentate su MDN, ed elenca ciascuna di quelle che hai usato con la sua pagina MDN.

## Il codice minimo

Uno scheletro della stessa forma, scritto per questa guida (MIT). È un'estensione Manifest V2 per Firefox con un content script, uno script di background e una pagina delle opzioni; le [guide 2](/it/mods/claude/conversation-band/) e [3](/it/mods/claude/sidebar/) li riempiono.

`manifest.json`:

```json
{
  "manifest_version": 2,
  "name": "My band on claude.ai",
  "version": "0.1.0",
  "browser_specific_settings": {
    "gecko": {
      "id": "my-band@example.com",
      "strict_min_version": "142.0",
      "data_collection_permissions": { "required": ["none"] }
    }
  },
  "permissions": ["storage", "https://ntfy.sh/*"],
  "background": { "scripts": ["background.js"] },
  "content_scripts": [
    {
      "matches": ["https://claude.ai/*"],
      "js": ["band.js"],
      "css": ["band.css"],
      "run_at": "document_idle"
    }
  ],
  "options_ui": { "page": "options.html", "open_in_tab": true }
}
```

`options.html` contiene un modulo con un input `topic`, un pulsante di invio e un paragrafo `status`, e carica `options.js`:

```js
const form = document.getElementById('form')
const input = document.getElementById('topic')
const status = document.getElementById('status')

browser.storage.local.get('topic').then(({ topic }) => {
  input.value = topic ?? ''
})

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  const topic = input.value.trim()
  if (!/^[-_A-Za-z0-9]{1,64}$/.test(topic)) {
    status.textContent = 'Only letters, numbers, - and _.'
    return
  }
  await browser.storage.local.set({ topic })
  status.textContent = 'Saved.'
})
```

Provalo con un topic inventato come `narsil-0123456789abcdef0123`. Le API sono su MDN: [`storage.local`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/local), [`options_ui`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/options_ui) e [`browser_specific_settings`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings).

## Errori comuni e come testarlo

- **Aspettarsela nell'app Claude.** L'app nativa non accetta estensioni, e nemmeno Chrome per Android. Usa Firefox o Vivaldi, su `claude.ai` nel browser.
- **Un'estensione non firmata in Firefox.** Firefox nella versione stabile installa solo estensioni firmate. Ogni nuova firma richiede anche una nuova `version` nel manifest.
- **Il topic nel pacchetto.** Non scriverlo mai nel codice: il pacchetto va a Mozilla per essere firmato. Tienilo in `storage.local`.
- **Un topic con spazi o una barra.** La pagina delle opzioni lo rifiuta. Copia il topic esattamente come lo ha stampato `/narsil movil`.
- **Niente dopo l'installazione.** Ricarica `claude.ai`, come dice l'ultimo passo dell'installazione, così la pagina si carica con gli script dell'estensione.
- **Una banda e nessun livello.** Il livello ha bisogno della mod sul tuo computer con `/narsil movil` attivo, e si aggiorna quando la mod invia uno stato (guida 3).

Per testare lo scheletro prima su un desktop, caricalo come componente aggiuntivo temporaneo in `about:debugging` ([Extension Workshop: test and debug](https://extensionworkshop.com/documentation/develop/debugging/)), apri le opzioni da `about:addons`, salva un topic inventato, e rileggilo con `browser.storage.local.get('topic')` nella console dell'estensione. Per un telefono, `web-ext run --target=firefox-android` lo esegue su un dispositivo collegato via USB ([web-ext run](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#web-ext-run)).

## Per andare oltre

- Leggi la [guida 2](/it/mods/claude/conversation-band/) per la banda, che non ha bisogno di niente dal computer.
- Leggi [Contesto e limiti](/it/mods/pet/context-and-limits/) e [L'orologio della cache](/it/mods/pet/cache-clock/) per vedere come Narsil mostra gli stessi numeri dentro Claude Code.
- [Narsil Skin](https://github.com/davshn/narsil-skin) è il tema pubblico da cui vengono i colori dell'estensione.
