---
title: I colori e l'icona di Narsil
description: "Come Narsil in Claude veste claude.ai con i colori del mare notturno di Narsil Skin, chiari di giorno e scuri di notte secondo l'orologio del telefono, e dà all'app la sua icona."
route: claude
order: 4
updated: 2026-11-18
---

## Cosa fa

Con l'estensione attiva, l'intera pagina di `claude.ai` indossa la tavolozza del mare notturno di [Narsil Skin](https://github.com/davshn/narsil-skin): blu profondi di notte, azzurri marini pallidi di giorno. Cambia:

- **I colori della pagina**: sfondi, pannelli, testo, bordi, accenti e il menu laterale.
- **I blocchi di codice**, sia nella chat sia nei diff del codice, così si accordano con il resto.
- **Alcuni dettagli**: la casella dei messaggi riceve un bordo sottile che prende il colore d'accento quando scrivi, il testo che selezioni prende il colore d'accento, tutto il testo è in grassetto come nel tema, e la scintilla arancione che compare mentre Claude lavora diventa viola.

È chiara dalle 6:00 alle 17:59 e scura dalle 18:00 alle 5:59, secondo l'orologio del telefono, qualunque aspetto tu abbia scelto nelle impostazioni di Claude stesso.

E quando aggiungi `claude.ai` alla schermata home con l'estensione attiva, l'app riceve l'icona di Narsil al posto di quella di Claude.

> **Sperimentale.** I colori funzionano sovrascrivendo le variabili di design che la pagina di `claude.ai` dichiara per sé, e la modalità riscrivendo un attributo della pagina. Nessuna delle due è un'API pubblica, quindi un aggiornamento di Claude può rinominarle e la pagina torna ai colori di Claude stesso, senza niente di rotto. L'estensione cambia solo l'aspetto della pagina sul tuo telefono: non scrive niente nel tuo account. Per mostrare l'icona della schermata home, il browser la scarica dall'indirizzo della web app per telefono di Narsil, `narsil-pwa.vercel.app`, solo quando installi l'app.

## Come funziona dentro

I colori e l'icona sono il primo gruppo di content script del manifest, quello che gira a `document_start`, prima che la pagina disegni qualsiasi cosa ([MDN: content_scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/content_scripts)). Contiene un foglio di stile, `skin.css`, e quattro piccoli script: `lib/watch.js` (l'osservatore della pagina che descrive la [guida 2](/it/mods/claude/conversation-band/)), `lib/mode.js` e `mode.js` (l'ora), e `lib/manifest.js` e `app-icon.js` (l'icona).

Girare così presto conta: un foglio di stile arrivato dopo che la pagina si è disegnata mostrerebbe prima, per un momento, i colori di Claude stesso. Il commento del codice lo dice chiaramente: i colori della pagina stessa "never flash first" (non lampeggiano mai per primi).

### Solo le variabili della pagina, non un nuovo design

La pagina di `claude.ai` non scrive i suoi colori direttamente nel codice. Li dichiara come proprietà personalizzate CSS, come `--cds-page-bg` per lo sfondo della pagina e `--cds-text-primary` per il testo principale, e ogni parte della pagina le legge ([MDN: Using CSS custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)). Ne ha due serie, una per ogni modalità, scelte da un attributo `data-mode`.

Così `skin.css` non ridefinisce lo stile di pulsanti, menu e pannelli uno per uno. Dà nuovi valori a quelle stesse variabili, un blocco per `data-mode="dark"` e uno per `data-mode="light"`, ciascuno marcato `!important` così vince sulle dichiarazioni della pagina stessa. Il blocco scuro è costruito sui blu notturni del tema, come `#0f1a2c` per la pagina; quello chiaro sui suoi azzurri marini pallidi, come `#c9e7f1`. Il testo secondario e quello attenuato sono il testo principale mescolato con la trasparenza (`color-mix()`), così mantengono la stessa tonalità.

C'è un tranello che spiegano i commenti del foglio di stile: la pagina non dichiara le variabili solo su `<html>`. Ogni parte che monta con una propria radice le dichiara di nuovo per sé, quindi una regola solo su `<html>` dura soltanto finché quella parte non compare. Le regole coprono anche quelle radici.

Alcune cose non prendono le variabili, e ricevono regole proprie: lo sfondo del menu laterale, i diff del codice e i blocchi di codice della chat.

### Perché solo colori e stili, senza sfondo animato

Narsil Skin sul desktop può disegnare uno sfondo animato dietro Claude. L'estensione non ne tiene niente. Il commento in cima a `skin.css` dice che prende "only the page's own design variables and a few parts" (solo le variabili di design della pagina stessa e alcune parti), e niente dello sfondo, delle onde o delle stelle del tema; il README dice lo stesso: solo i colori e gli stili del tema, senza sfondi animati.

Nessuno dei due dice perché. Un motivo probabile è il telefono stesso: un livello animato dietro una pagina che già si ridisegna molte volte al secondo mentre Claude scrive costerebbe batteria e frame, e il lavoro successivo sull'estensione (più sotto) è stato tutto per rendere la pagina più leggera. Cambiare variabili non costa quasi niente, perché la pagina le legge già.

### I blocchi di codice in modalità chiara

I blocchi di codice della chat erano un caso speciale. I loro token sono colorati inline, in ogni `<pre>`, con la tavolozza scura della pagina, anche quando la modalità chiara è forzata. In modalità chiara, token pallidi su uno sfondo pallido si leggevano a stento.

Il commit `127ca62` (2026-11-13) "style: darken code block tokens in light mode" (scurisce i token dei blocchi di codice in modalità chiara) lo risolve con un filtro, non con una nuova tavolozza. Seleziona solo i blocchi di codice in modalità chiara il cui colore base inline è quello della tavolozza scura, li inverte e ruota la tonalità di mezzo giro ([MDN: filter](https://developer.mozilla.org/en-US/docs/Web/CSS/filter)). Invertire rende scuro il pallido; ruotare la tonalità di 180 gradi riporta ogni colore alla sua tonalità, così una parola chiave azzurro pallido diventa di un blu più scuro, non arancione. Un po' di saturazione in più evita che sembrino sbiaditi.

I diff del codice funzionano in modo diverso: vivono dentro una shadow root, che le regole della pagina non possono raggiungere. Ma le proprietà personalizzate passano dentro una shadow root, e una regola sull'elemento che la ospita vince sulle regole della shadow root stessa, così `skin.css` imposta le variabili di sfondo e di testo del diff su quell'elemento ospite.

### Chiara di giorno, scura di notte, secondo l'orologio del telefono

La regola è in `lib/mode.js`: un'ora da 6 fino a 17 è giorno e riceve `light`; qualsiasi altra ora riceve `dark`. Il suo commento dice che segue gli stessi orari del tema automatico di Narsil Skin.

`mode.js` la applica. Cerca ogni elemento il cui `data-mode` sia `light`, `dark` o `system`, e lo imposta sulla modalità dell'ora corrente. Non ogni `data-mode`: la pagina usa anche `data-mode="code"` per un'altra cosa, e quello viene lasciato stare. Scrive solo quando il valore è diverso, così l'osservatore della pagina non viene svegliato per niente.

Dato che l'impostazione dell'aspetto di Claude stesso funziona tramite lo stesso attributo, la modalità dell'estensione vince su di essa: qualunque cosa tu abbia scelto, l'esecuzione successiva rimette la modalità dell'ora.

Viene eseguita di nuovo:

- **Quando la pagina cambia**, tramite l'unico osservatore della pagina, che ascolta anche i cambiamenti di `data-mode` stesso. Quando la pagina monta una nuova parte con un proprio `data-mode`, o lo rimette sulla tua impostazione di Claude, viene corretto entro un frame.
- **Ogni minuto**, perché l'ora può scattare alle 6:00 o alle 18:00 senza alcun cambiamento nella pagina.
- **Quando la pagina torna visibile**, dato che una pagina nascosta non esegue frame e il telefono potrebbe aver dormito durante il cambio.

### Conversazioni più veloci

Il 2026-11-11, il commit `ce7d17e` "perf: lighten the styles and the page observers so claude.ai switches conversations faster" (alleggerisce gli stili e gli osservatori della pagina così claude.ai cambia conversazione più in fretta) ha scoperto che erano i colori stessi a rallentare la pagina. Il suo messaggio nomina tre cambiamenti:

1. **Due variabili di colore attenuato** venivano impostate su ogni elemento. Una proprietà personalizzata impostata su ogni elemento fa sì che ciascuno porti con sé la propria copia, e ogni ricalcolo degli stili la paga. Ora vengono impostate solo sugli elementi dove la pagina stessa le dichiara, ed ereditate da lì.
2. **La regola del grassetto** escludeva le parti proprie di Narsil con un `:not()` di discendenti, che fa percorrere al browser gli antenati di ogni elemento a ogni ricalcolo. È diventata una regola semplice per tutto il testo, e il foglio di stile della banda stessa rimette i suoi pesi.
3. **Un solo osservatore** per tutti i content script, eseguito al massimo una volta per frame, invece di uno per script.

### Quando Vivaldi salta i colori o la modalità

Vivaldi per Android ha portato due problemi suoi, spiegati nella [guida 5](/it/mods/claude/android-packaging/): dopo che Android chiude Vivaldi e questo si riapre, può caricare la banda senza i suoi fogli di stile, o saltare l'intero gruppo `document_start`, così `mode.js` non gira mai e la pagina mantiene la modalità di Claude stesso.

Le correzioni permettono alla pagina di accorgersi di ciò che manca e di chiederlo:

- **`a1e01b6`** (2026-11-18): ogni foglio di stile termina impostando un proprio segno su `:root`, una proprietà personalizzata come `--narsil-css-skin: 1`. Quando la banda parte, legge i segni con `getComputedStyle`; un foglio di stile il cui segno è vuoto non è arrivato.
- **`8e31a1d`** (2026-11-18): la banda controlla anche che `lib/mode.js` abbia lasciato la sua funzione nella pagina. Se no, il primo gruppo non è stato eseguito.

In entrambi i casi la banda chiede al background i pezzi mancanti, e il background rimette solo i fogli di stile e i gruppi del manifest stesso, prima gli stili.

### L'icona della schermata home

Quando aggiungi una pagina alla schermata home, il browser legge il suo web app manifest, il file che la pagina nomina in un `<link rel="manifest">` ([MDN: Web application manifest](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest)). Il suo membro `icons` dice quali immagini riceve l'app ([MDN: icons](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons)).

Quindi l'estensione non tocca la schermata home. Cambia quale manifest offre la pagina:

1. **`lib/manifest.js` costruisce un manifest** che è Claude così com'è: il nome `Claude`, visualizzazione standalone, avvio e scope su `https://claude.ai/`, il blu del mare notturno come colore di sfondo e del tema, e due icone, da 192 e 512 pixel.
2. **Lo trasforma in un indirizzo** tutto suo: un URL `data:` con il tipo `application/manifest+json` e il JSON codificato al suo interno. Per il manifest stesso non viene scaricato niente.
3. **`app-icon.js` fa puntare lì il link della pagina**: trova il `<link rel="manifest">` e ne sostituisce l'`href`, se non è già quello. L'osservatore della pagina ascolta i cambiamenti di `href`, quindi se la pagina rimette il proprio manifest, l'esecuzione successiva lo scambia di nuovo.

Le icone non sono dentro l'estensione. Un manifest `data:` non ha un indirizzo proprio rispetto a cui risolvere un percorso relativo dell'icona, quindi le icone hanno bisogno di indirizzi completi, e puntano a dove la web app per telefono di Narsil le serve già: `https://narsil-pwa.vercel.app`. Il browser le scarica solo quando installi l'app.

### Perché l'icona viene fissata all'installazione

Il browser copia l'icona quando crea l'app della schermata home; non la richiede di nuovo alla pagina ogni volta che la apri. Il messaggio del commit `083c03d` lo dice: "The icon is set at install, so an app already installed has to be installed again." (L'icona viene impostata all'installazione, quindi un'app già installata va installata di nuovo.)

Questo ha due conseguenze che il README spiega:

- **Se avevi già `claude.ai` sulla schermata home**, rimuovila e aggiungila di nuovo con l'estensione attiva.
- **Se rimuovi l'estensione**, l'app mantiene l'icona di Narsil. Non c'è niente in esecuzione che la rimetta com'era; resta finché non installi di nuovo l'app.

L'icona è stata testata in Firefox per Android, dove l'estensione la aggiunge dal menu con **Install** o **Add to Home screen**. In Vivaldi non è stata testata.

## Costruiscila con Claude

Chiedi a Claude un gruppo di content script che venga eseguito a `document_start`, con un foglio di stile e due piccoli script. L'unica idea che deve fare bene è cambiare solo ciò che la pagina legge già, le sue variabili di design e il suo attributo `data-mode`, invece di ridisegnare la pagina pezzo per pezzo.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt di chi ha creato Narsil.

> Nella mia estensione di Firefox per `https://claude.ai/*`, aggiungi un gruppo di content script a `document_start` con un foglio di stile e due script. Il foglio di stile sovrascrive solo le proprietà personalizzate CSS della pagina stessa, un blocco per `[data-mode="dark"]` e uno per `[data-mode="light"]`, con `!important`; niente sfondi, immagini o animazioni. Il primo script imposta ogni elemento il cui `data-mode` sia `light`, `dark` o `system` su `light` dalle 6:00 alle 17:59 ora locale e su `dark` altrimenti, scrivendo solo quando il valore è diverso; viene eseguito da un unico `MutationObserver` limitato con `requestAnimationFrame`, ogni 60 secondi e su `visibilitychange`. Il secondo script sostituisce l'`href` del `<link rel="manifest">` della pagina con un URL `data:application/manifest+json` che contiene un manifest con URL assoluti delle icone su `https://example.com`. Tieni la regola dell'ora in un modulo a sé e testala con `node --test`.

### Cosa controllare nella risposta di Claude

1. Il foglio di stile si carica a `document_start` e sovrascrive solo le proprietà personalizzate CSS della pagina, un blocco per lo scuro e uno per il chiaro, con `!important`, e niente sfondi, immagini o animazioni.
2. Lo script della modalità tocca solo gli elementi il cui `data-mode` sia `light`, `dark` o `system`, mai `data-mode="code"`, e scrive solo quando il valore è diverso.
3. La regola dell'ora vive in un modulo a sé: 5, 6, 17 e 18 danno `dark`, `light`, `light` e `dark`.
4. La modalità viene eseguita di nuovo da un unico osservatore limitato con `requestAnimationFrame`, ogni 60 secondi e su `visibilitychange`.
5. Il manifest è un URL `data:application/manifest+json` con indirizzi completi delle icone, non percorsi relativi, così il browser scarica le icone solo quando installi l'app, e l'`href` del link cambia solo quando è diverso.

Se un controllo fallisce, di' a Claude cosa vedi: "dopo le 18:00 la pagina resta chiara finché non la ricarico".

### Come l'ha chiesta l'autore

Nessuna richiesta per i colori o per l'icona è stata registrata. Le parole di chi ha creato Narsil registrate per questo percorso riguardano il sito (la [guida 1](/it/mods/claude/what-it-is/) le cita). Quanto segue è ricostruito dalla cronologia dei commit dell'estensione:

- `0d65509` (2026-11-09) "feat: wear Narsil's colors on claude.ai, light by day and dark by night" (veste claude.ai con i colori di Narsil, chiari di giorno e scuri di notte). Il suo messaggio descrive l'approccio: sovrascrive le variabili di design della pagina stessa con la tavolozza del mare notturno, "without its wallpaper" (senza il suo sfondo), e segue gli stessi orari della modalità automatica del tema.
- `083c03d` (2026-11-09) "feat: give claude.ai Narsil's icon when it is installed from Firefox" (dà a claude.ai l'icona di Narsil quando viene installata da Firefox). Offre a Firefox un manifest con le sue icone al posto di quello della pagina stessa.
- `ce7d17e` (2026-11-11) "perf: lighten the styles and the page observers so claude.ai switches conversations faster" (alleggerisce gli stili e gli osservatori della pagina così claude.ai cambia conversazione più in fretta).
- `127ca62` (2026-11-13) "style: darken code block tokens in light mode" (scurisce i token dei blocchi di codice in modalità chiara).
- `a1e01b6` (2026-11-18) "fix: ask for the styles when Vivaldi loads the band without them" (chiede gli stili quando Vivaldi carica la banda senza di essi).
- `8e31a1d` (2026-11-18) "fix: run the light and dark switch again when Vivaldi skips it" (esegue di nuovo il cambio tra chiaro e scuro quando Vivaldi lo salta).

La cronologia si legge come un primo giorno che ha azzeccato l'aspetto, seguito dal lavoro su quanto costava quell'aspetto: velocità su una pagina lunga, leggibilità in un angolo, e l'abitudine di Vivaldi di caricare solo una parte dell'estensione.

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida. Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

Gli stessi tre pezzi, scritti per questa guida (MIT). I nomi delle variabili sono quelli che la pagina di `claude.ai` dichiara oggi; i colori sono due della tavolozza del mare notturno; l'indirizzo dell'icona è un segnaposto per il tuo.

`skin.css`:

```css
html[data-mode='dark'],
[data-mode='dark'] {
  --cds-page-bg: #0f1a2c !important;
  --cds-text-primary: #dce6fa !important;
}

html[data-mode='light'],
[data-mode='light'] {
  --cds-page-bg: #c9e7f1 !important;
  --cds-text-primary: #0f2f47 !important;
}
```

`mode.js`:

```js
const modeAt = (hour) => (hour >= 6 && hour < 18 ? 'light' : 'dark')
const themed = '[data-mode="light"],[data-mode="dark"],[data-mode="system"]'

function applyMode() {
  const mode = modeAt(new Date().getHours())
  document.querySelectorAll(themed).forEach((element) => {
    if (element.dataset.mode !== mode) element.dataset.mode = mode
  })
}

const icons = [192, 512].map((size) => ({
  src: `https://example.com/icons/icon-${size}.png`,
  sizes: `${size}x${size}`,
  type: 'image/png',
}))
const manifest = { name: 'Claude', display: 'standalone', start_url: 'https://claude.ai/', icons }
const manifestUrl = `data:application/manifest+json,${encodeURIComponent(JSON.stringify(manifest))}`

function applyIcon() {
  const link = document.querySelector('link[rel~="manifest"]')
  if (link && link.getAttribute('href') !== manifestUrl) link.setAttribute('href', manifestUrl)
}

let queued = false
new MutationObserver(() => {
  if (queued) return
  queued = true
  requestAnimationFrame(() => {
    queued = false
    applyMode()
    applyIcon()
  })
}).observe(document.documentElement, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ['data-mode', 'href'],
})

setInterval(applyMode, 60_000)
document.addEventListener('visibilitychange', applyMode)
applyMode()
applyIcon()
```

Nel manifest, entrambi vanno in un'unica voce di content script con `"run_at": "document_start"` e `"matches": ["https://claude.ai/*"]`. A `document_start` la pagina non ha ancora un body, ed è per questo che tutto aspetta l'osservatore ([MDN: MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)): l'osservatore scatta mentre la pagina si costruisce, e ogni esecuzione sistema ciò che è comparso. L'`attributeFilter` limita i cambiamenti di attributo ai due che interessano allo script.

## Errori comuni e come testarlo

- **Caricare i colori a `document_idle`.** La pagina si disegna prima con i colori di Claude, poi cambia. Carica il foglio di stile a `document_start`.
- **Dare stile alle parti invece che alle variabili.** Ogni pulsante e pannello ha bisogno di una regola propria, e ogni aggiornamento di Claude ne rompe qualcuna. Sovrascrivi le variabili che la pagina legge già.
- **Impostare le variabili solo su `<html>`.** Parti della pagina le dichiarano di nuovo sulle proprie radici. Copri anche quelle radici, e controlla che un pannello appena aperto mantenga i colori.
- **Impostare una proprietà personalizzata su ogni elemento.** Funziona, e rallenta ogni ricalcolo degli stili. Impostala dove la dichiara la pagina e lasciala ereditare.
- **Riscrivere ogni `data-mode`.** La pagina usa `data-mode="code"` per un'altra cosa. Seleziona solo `light`, `dark` e `system`.
- **Scrivere quando niente è cambiato.** Ogni scrittura sveglia l'osservatore, che scrive di nuovo. Confronta prima.
- **Aspettare che la pagina cambi alle 18:00.** Potrebbe non farlo. Controlla l'ora con un timer, e quando la pagina torna visibile.
- **Un percorso relativo dell'icona in un manifest `data:`.** Non ha niente rispetto a cui risolversi. Usa indirizzi completi.
- **Aspettarsi che l'icona cambi su un'app già installata.** È stata fissata all'installazione. Rimuovi l'app e aggiungila di nuovo.

Per testare la regola dell'ora, tienila in un modulo senza DOM e controlla i limiti: 5, 6, 17 e 18 dovrebbero dare `dark`, `light`, `light` e `dark`. Per testare la pagina, cambia l'ora del telefono alle 17:59 e aspetta le 18:00, oppure imposta l'ora a mano nella regola mentre sviluppi: la pagina dovrebbe cambiare entro un minuto senza ricaricare. Poi cambia l'impostazione dell'aspetto di Claude stesso: la pagina dovrebbe tornare subito alla modalità dell'ora. Per l'icona, apri `claude.ai` con l'estensione attiva, aggiungila alla schermata home, e controlla che la nuova app mostri la tua icona; rimuovi l'estensione e controlla che resti.

## Per andare oltre

- La [guida 5](/it/mods/claude/android-packaging/) spiega perché Vivaldi a volte carica l'estensione a pezzi, e come il background rimette gli stili.
- [Narsil Skin](https://github.com/davshn/narsil-skin) ha il tema completo del mare notturno per il desktop, sfondo incluso, e altri temi le cui variabili potrebbero essere portate nello stesso modo.
- Gli orari potrebbero seguire l'alba e il tramonto invece delle 6:00 e delle 18:00 fisse. La regola vive in una piccola funzione, quindi cambierebbe solo quella funzione.
