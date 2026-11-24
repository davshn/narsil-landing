---
title: I colori di Narsil, di giorno e di notte
description: "Come skin.css veste claude.ai con la tavolozza del mare notturno di Narsil Skin, come mode.js sceglie chiaro o scuro in base all'ora qualunque cosa dica Claude, e come le barre seguono senza un lampo."
route: android
order: 5
updated: 2026-11-24
sources:
  - repo: android
    path: app/src/main/assets/page/skin.css
  - repo: android
    path: app/src/main/assets/page/mode.js
  - repo: android
    path: app/src/main/assets/page/lib/mode.js
  - repo: android
    path: app/src/main/assets/page/lib/watch.js
  - repo: android
    path: app/src/main/assets/host.js
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/MainActivity.kt
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/PageScript.kt
---

## Cosa fa

Dentro l'app, Claude veste i colori di Narsil: la tavolozza del mare notturno di [Narsil Skin](https://github.com/davshn/narsil-skin), i temi di colore dell'autore per l'app desktop di Claude. Cambiano gli sfondi, il testo, i bordi, i blocchi di codice e il bagliore mentre Claude lavora:

- **Di notte**, dalle 18:00 alle 5:59, uno sfondo blu marino profondo (`#0f1a2c`), testo azzurro pallido e un accento blu brillante.
- **Di giorno**, dalle 6:00 alle 17:59, uno sfondo azzurro marino pallido (`#c9e7f1`), testo blu scuro e un accento verde acqua.
- **La scintilla arancione** che Claude mostra mentre lavora diventa viola.
- **Tutto il testo è in grassetto**, come nel tema.

Decide l'ora, secondo l'orologio del telefono, qualunque aspetto tu abbia scelto in Claude: l'app non legge la tua impostazione e non la cambia. La barra di stato e la barra di navigazione seguono, con lo stesso sfondo dietro e icone scure o chiare in accordo. E i colori entrano all'inizio stesso di ogni pagina, così quelli di Claude non lampeggiano mai per primi.

> **Sperimentale.** La skin sostituisce le variabili di design di `claude.ai` stesso e dà stile ad alcune sue parti tramite nomi di classe e attributi del markup attuale della pagina. Niente di tutto questo è un'API pubblica. Un aggiornamento di Claude può rinominarli; quando succede, alcune parti della pagina tornano ai colori di Claude, o, di rado, una parte diventa difficile da leggere finché la skin non viene aggiornata. Claude continua a funzionare.

## Come funziona dentro

Tre file fanno il lavoro, e un'impostazione in Kotlin lo completa:

| File                       | Compito                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| `assets/page/skin.css`     | La tavolozza, come valori per le variabili di design di Claude, e qualche regola propria. |
| `assets/page/lib/mode.js`  | Quale modalità veste ogni ora: una sola regola, condivisa dagli script di pagina.         |
| `assets/page/mode.js`      | Imposta la modalità chiara o scura della pagina in base all'ora, e la mantiene.           |
| `MainActivity.paintBars()` | Dipinge lo sfondo dietro le barre di sistema e sceglie il colore delle loro icone.        |

### Dipingere con le variabili della pagina stessa

Una web app moderna non scrive i colori in ogni regola. Li definisce una volta, come proprietà personalizzate CSS, e ogni componente le legge. `claude.ai` lo fa con una famiglia di variabili i cui nomi iniziano con `--cds-` (sfondo della pagina, superfici, testo, bordi, accenti), più una famiglia più vecchia di valori `--bg-*`, `--text-*` e `--accent-*` scritti come terne HSL.

Questo rende piccola la skin. Invece di ridefinire lo stile di centinaia di componenti, `skin.css` dà nuovi valori a quelle variabili, e la pagina si ridipinge da sola. L'inizio della metà scura, da `skin.css` in narsil-android (MIT):

<!-- prettier-ignore -->
```css
/* Each .cds-root the app mounts declares these again for itself, so setting
   them on html alone lasts only until it has mounted. */
html[data-mode="dark"],
html[data-mode="dark"] .cds-root:not([data-mode="light"]),
html[data-mode="dark"] #static-composer,
.cds-root[data-mode="dark"],
.cds-dark-scope {
  --cds-page-bg: #0f1a2c !important;
  --cds-surface-0: #0b1422 !important;
  --cds-surface-1: #0f1a2c !important;
  --cds-surface-2: #16243b !important;
  --cds-surface-3: #1a2a44 !important;
  --cds-surface-panel: #16243b !important;
  --cds-surface-popover: #22344f !important;
  --cds-text-primary: #dce6fa !important;
  --cds-text-secondary: color-mix(in srgb, #dce6fa 68%, transparent) !important;
```

Tre dettagli in queste poche righe spiegano tutto il file:

- **I selettori si ripetono.** Come dice il commento, ogni `.cds-root` che la pagina monta dichiara di nuovo le variabili per sé, e una dichiarazione più vicina vince su quella su `html`. Così la skin le imposta in ogni posto in cui le imposta la pagina: `html`, ogni `.cds-root`, la casella statica dei messaggi e gli ambiti scuri.
- **`!important` ovunque.** Altrimenti le dichiarazioni della pagina stessa vincerebbero quando sono specifiche quanto quelle della skin. Una dichiarazione importante batte una normale indipendentemente dall'ordine.
- **Sfumature da un solo colore.** Il testo secondario e quello attenuato sono il testo principale mescolato con la trasparenza (`color-mix(in srgb, #dce6fa 68%, transparent)`), così ogni sfumatura resta nella stessa tonalità.

I valori principali della tavolozza a confronto:

| Variabile             | Notte (`dark`)             | Giorno (`light`)          |
| --------------------- | -------------------------- | ------------------------- |
| `--cds-page-bg`       | `#0f1a2c`                  | `#c9e7f1`                 |
| `--cds-surface-0`     | `#0b1422`                  | `#b7deed`                 |
| `--cds-surface-2`     | `#16243b`                  | `#d6eef5`                 |
| `--cds-text-primary`  | `#dce6fa`                  | `#0f2f47`                 |
| `--cds-text-accent`   | `#5aaeff`                  | `#1f83a8`                 |
| `--cds-border-strong` | 26 % di un azzurro pallido | 26 % del colore del testo |

### Dove le variabili non arrivano

Alcune parti della pagina non prendono i loro colori da quelle variabili, e `skin.css` dà loro stile una per una:

- **Il menu laterale**, dipinto con `--cds-surface-0`.
- **I blocchi di codice nei diff**, che vivono in uno shadow root, dove le regole esterne non arrivano. Le proprietà personalizzate invece passano dentro, e una regola sull'host dello shadow batte quella del componente stesso, così la skin imposta `--diffs-light-bg`, `--diffs-dark-bg` e i loro colori del testo su `diffs-container`.
- **I blocchi di codice della chat in modalità chiara.** Colorano i loro token inline con la tavolozza scura della pagina anche quando la modalità chiara è forzata, quindi dei token pallidi finirebbero su uno sfondo pallido. La skin li trova dal loro colore base inline e li gira con `filter: invert(1) hue-rotate(180deg) saturate(1.3)`: invertire scambia il chiaro con lo scuro, e ruotare la tonalità di mezzo giro rimette a posto la tonalità di ogni token.
- **La selezione**, il bordo della casella dei messaggi (più forte quando ha il focus), e **la scintilla**: `[data-cds="Spark"]` e `[data-cds="WorkingMark"]` ricevono `filter: hue-rotate(262deg) saturate(1.3)`, che trasforma l'arancione di Claude in viola.
- **Il testo in grassetto**: `body, body *` ricevono `font-weight: 700 !important`. Il commento spiega perché è una regola semplice e non un `:not()` che risparmi le parti di Narsil: un `:not()` di discendenti "would walk every element's ancestors on each recalculation" (percorrerebbe gli antenati di ogni elemento a ogni ricalcolo). Invece, `band.css` rimette i pesi della banda con un `!important` suo.

I commenti badano anche alla velocità. Due variabili che la pagina eredita vengono impostate "Only where the page declares them" (solo dove la pagina le dichiara), perché su ogni elemento "they would make each one carry its own copy and slow every style recalculation" (farebbero portare a ciascuno la propria copia e rallenterebbero ogni ricalcolo degli stili). Su un telefono, mentre Claude trasmette una risposta e la pagina cambia molte volte al secondo, conta.

Alla fine, `skin.css` imposta `--narsil-css-skin: 1` su `:root`. Non cambia niente di visibile: è un segno che gli script della banda leggono per sapere che il foglio di stile è arrivato alla pagina (la [guida 3](/it/android/conversation-band/) spiega cosa fanno quando manca).

### Come arrivano gli stili alla pagina

`skin.css` e `band.css` vengono uniti da `PageScript.kt` in una sola stringa JavaScript, `NARSIL_CSS`, e `host.js` la trasforma in un foglio di stile costruito:

<!-- prettier-ignore -->
```js
const sheet = new CSSStyleSheet()
sheet.replaceSync(NARSIL_CSS)

// The page sets adoptedStyleSheets of its own at times: the sheet goes back on each change the watch sees.
function adopt() {
  if (!document.adoptedStyleSheets.includes(sheet)) document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
}
adopt()
```

Questo estratto è da `host.js` in narsil-android (MIT). Un foglio costruito non è un elemento della pagina, quindi i cambiamenti al markup della pagina non possono toglierlo, e il commento del file nota che la Content Security Policy della pagina non lo governa, mentre uno `<style>` aggiunto da uno script potrebbe essere rifiutato. La pagina può sostituire il proprio elenco di fogli adottati, quindi `PageScript` registra `adopt` con l'osservatore della pagina: dopo qualsiasi cambiamento, il foglio di Narsil torna al suo posto.

### Chiaro di giorno, scuro di notte

La regola per l'ora è una riga, in `lib/mode.js` (MIT):

<!-- prettier-ignore -->
```js
// Which mode claude.ai wears at each hour, as narsil-skin's auto theme does.

self.narsilMode = (() => {
  const isDay = (hour) => hour >= 6 && hour < 18
  const modeOfHour = (hour) => (isDay(hour) ? 'light' : 'dark')
  return { modeOfHour }
})()
```

Rispecchia il tema automatico di Narsil Skin sul desktop, così il telefono e il computer cambiano nello stesso momento.

`claude.ai` segna la sua modalità con un attributo `data-mode`: `light`, `dark` o `system`, sull'elemento `<html>` e su alcuni dei suoi componenti. Quell'attributo è ciò che scrive la tua impostazione dell'aspetto, ed è ciò che leggono i selettori della skin. Così `mode.js` non combatte gli stili della pagina; scrive semplicemente l'attributo. Il file intero, da `mode.js` (MIT):

<!-- prettier-ignore -->
```js
// Light by day and dark by night, whatever claude.ai's own setting says: its
// data-mode attribute, on every element that carries one, as the page sets it
// again whenever it mounts one. Not every data-mode: data-mode=code means
// something else.

(() => {
  const MODES = '[data-mode=light],[data-mode=dark],[data-mode=system]'
  const CHECK_MS = 60_000
  function apply() {
    const mode = self.narsilMode.modeOfHour(new Date().getHours())
    for (const element of document.querySelectorAll(MODES)) if (element.dataset.mode !== mode) element.dataset.mode = mode
  }

  self.narsilWatch(apply)

  // The hour turns with no change on the page; a hidden page runs no frames.
  const timer = setInterval(apply, CHECK_MS)
  const onVisibility = () => apply()
  document.addEventListener('visibilitychange', onVisibility)
  self.narsilWatch.onStop(() => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisibility)
  })
  apply()
})()
```

Ogni parte ha un motivo:

- **Solo tre valori.** `data-mode=code` esiste nella pagina e "means something else" (significa un'altra cosa), quindi il selettore nomina `light`, `dark` e `system` e lascia stare il resto.
- **Ogni elemento che ne porta uno,** non solo `<html>`. La pagina monta componenti con un proprio `data-mode`, e lo imposta di nuovo quando li monta.
- **A ogni cambiamento della pagina,** tramite `self.narsilWatch(apply)`. L'osservatore della pagina di `lib/watch.js` osserva anche gli attributi, con `attributeFilter: ['data-mode', 'href']`, quindi la pagina che rimette il suo `data-mode` è essa stessa un cambiamento che lo risveglia.
- **Ogni 60 secondi,** perché l'ora cambia senza che cambi niente nella pagina.
- **Su `visibilitychange`,** perché, come dice il commento, "a hidden page runs no frames" (una pagina nascosta non esegue frame): le callback dell'osservatore aspettano un frame, e i timer rallentano in una pagina nascosta. Quando lo schermo torna dopo una notte in tasca, la modalità giusta c'è subito, non fino a un minuto dopo.
- **Solo quando è diversa.** Scrivere l'attributo è un cambiamento che l'osservatore vede, quindi `apply` scrive solo quando il valore è diverso. Altrimenti ogni scrittura risveglierebbe l'osservatore, che scriverebbe di nuovo.

L'app non tocca mai la tua impostazione di Claude. `mode.js` riscrive solo l'attributo nella pagina che hai davanti. Sul tuo computer, o nell'app di Claude stessa, la tua impostazione è come l'hai lasciata.

### Prima del primo disegno

Il README promette che "The colors go on from the very start of each page, so Claude's own never flash first." (i colori entrano fin dall'inizio stesso di ogni pagina, così quelli di Claude non lampeggiano mai per primi.) Tre cose lo rendono vero:

1. **Lo script gira all'inizio del documento.** `addDocumentStartJavaScript` lo esegue prima di qualsiasi script di `claude.ai` stesso ([guida 2](/it/android/webview-host/)). A quel punto il foglio di stile è già adottato, quindi le sue regole aspettano il markup della pagina.
2. **La modalità va nel primo gruppo.** `PageScript` esegue `lib/watch.js`, `lib/mode.js` e `mode.js` subito, non dopo che il documento è stato analizzato, che è quando girano gli script della banda.
3. **L'osservatore lavora prima del disegno.** Esegue le sue callback con `requestAnimationFrame`, e un browser esegue quelle callback appena prima di disegnare il frame. Quindi quando la pagina imposta `data-mode` al proprio valore, `mode.js` ha già riscritto quello di Narsil prima che quel frame arrivi sullo schermo.

Il log dei task registra il controllo su un telefono reale, tramite i DevTools: "both style marks and the night ground rgb(15, 26, 44)" (entrambi i segni di stile e lo sfondo notturno rgb(15, 26, 44)), che è `#0f1a2c`.

### Le barre di sistema

La pagina sta tra le barre di sistema (la [guida 2](/it/android/webview-host/) spiega il margine), quindi ciò che si vede dietro di esse è il riquadro dell'activity stessa. `MainActivity` lo dipinge con lo sfondo della pagina e sceglie il colore delle icone. Da `MainActivity.kt` (MIT):

```kotlin
    // Behind the system bars, the page's own ground, light by day and dark by night as the band's mode.js sets it.
    private fun paintBars() {
        val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        val isDay = hour in 6..17
        frame.setBackgroundColor(Color.parseColor(if (isDay) "#c9e7f1" else "#0f1a2c"))
        WindowCompat.getInsetsController(window, frame).apply {
            isAppearanceLightStatusBars = isDay
            isAppearanceLightNavigationBars = isDay
        }
    }
```

`hour in 6..17` è la stessa regola di `lib/mode.js`, scritta in Kotlin: dalle 6:00 alle 17:59. I due colori sono il `--cds-page-bg` di ogni modalità. `isAppearanceLightStatusBars = true` chiede icone scure, che servono su uno sfondo chiaro; di notte diventano chiare.

La regola vive due volte, una in JavaScript e una in Kotlin, perché la pagina e l'activity non possono condividere codice facilmente. I valori devono cambiare insieme, e vale la pena di scrivere un test tutto tuo (vedi il codice di riferimento).

`paintBars` gira in `onResume`, ogni volta che l'app torna in primo piano. Non gira con un timer, come fa `mode.js`.

## Costruiscila con Claude

Chiedi a Claude una skin in due parti: un foglio di stile che dia nuovi valori alle variabili di design della pagina stessa sotto `html[data-mode=…]`, e un piccolo script che imposti quell'attributo in base all'ora e lo mantenga. L'unica idea che deve fare bene è che la skin segue il meccanismo della pagina stessa invece di combatterlo: scrive variabili e l'attributo della modalità, e lascia che la pagina si ridipinga da sola.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> La mia app Android esegue uno script all'inizio del documento su `https://claude.ai` e adotta un foglio di stile costruito. Scrivi il foglio di stile: sotto `html[data-mode="dark"]`, ogni `.cds-root` senza `data-mode="light"` e `.cds-root[data-mode="dark"]`, dai a `--cds-page-bg`, da `--cds-surface-0` a `-3`, `--cds-text-primary` e `--cds-text-accent` della pagina una tavolozza blu marino con `!important`, e una tavolozza azzurro marino pallido per `light`. Poi scrivi uno script che, su ogni elemento con `data-mode` impostato a `light`, `dark` o `system` (mai `code`), scriva `light` dalle 6:00 alle 17:59 e `dark` altrimenti, secondo l'ora locale del telefono. Eseguilo subito, a ogni cambiamento che vede un unico `MutationObserver` (limitato con `requestAnimationFrame`, che osservi anche l'attributo `data-mode`), ogni 60 secondi, e su `visibilitychange`; scrivi solo quando il valore è diverso. In Kotlin, in `onResume`, dipingi il riquadro dietro le barre di sistema con lo stesso sfondo e imposta icone delle barre chiare o scure con gli stessi orari. Testa la regola dell'ora in entrambi i linguaggi.

### Cosa controllare nella risposta di Claude

1. Le variabili sono impostate su ogni elemento su cui le dichiara la pagina, non solo su `html`.
2. Lo script della modalità lascia stare `data-mode=code`.
3. Scrive l'attributo solo quando il valore è diverso, così l'osservatore non entra in un ciclo.
4. L'osservatore osserva l'attributo `data-mode`, così la pagina che lo rimette viene intercettata.
5. C'è un timer per l'ora e un listener `visibilitychange` per quando lo schermo torna.
6. La regola Kotlin e quella JavaScript concordano alle 5, alle 6, alle 17 e alle 18.
7. Niente cambia l'impostazione di Claude della persona; solo l'attributo nella pagina.

Se un controllo fallisce, di' a Claude cosa vedi: "alle 18:00 la pagina diventa scura ma la barra di stato resta chiara".

### Come l'ha chiesta l'autore

Le parole del proprietario sono registrate in `odd/tasks/android-app.md`. L1 chiedeva una web view che "modifique sus estilos como lo hace esta extension" (ne modifichi gli stili come fa questa estensione), e L3: "recuerda que los estilos que va a inyectar seran los de la extension […]" (ricorda che gli stili che inietterà saranno quelli dell'estensione; il nome del progetto precedente qui è omesso). Così i colori non sono stati ridisegnati per l'app: `skin.css`, `mode.js` e `lib/mode.js` sono arrivati dall'estensione precedente così com'erano, e il lavoro dell'app è stato metterli sulla pagina abbastanza presto.

Il resto è ricostruito dalla cronologia dei commit (il nome di un progetto in un oggetto è sostituito da una descrizione tra parentesi quadre):

- `3bcea35` (2026-11-24) "feat: build the script that hosts [l'estensione precedente] in a WebView, and what alerts and states keep" (costruisce lo script che ospita l'estensione precedente in una WebView, e ciò che conservano avvisi e stati). Il suo messaggio: "the styles go on as a constructed style sheet." (gli stili entrano come foglio di stile costruito.)
- `53c55c1` (2026-11-24) "feat: host claude.ai with [l'estensione precedente] in a WebView, and show Narsil's alerts from a foreground service" (ospita claude.ai con l'estensione precedente in una WebView, e mostra gli avvisi di Narsil da un servizio in primo piano). `paintBars` arriva con `MainActivity`.
- `5ad4577` (2026-11-24) "refactor: make the band's scripts the app's own, and stop naming the projects it replaces" (rende gli script della banda propri dell'app, e smette di nominare i progetti che sostituisce).

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida (MIT). Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

La regola dell'ora e i colori delle barre in un solo oggetto Kotlin, così l'activity e il suo test li condividono:

```kotlin
package io.github.davshn.narsil

object DayNight {
    const val DAY_GROUND = "#c9e7f1"
    const val NIGHT_GROUND = "#0f1a2c"

    fun isDay(hour: Int): Boolean = hour in 6..17

    fun groundOf(hour: Int): String = if (isDay(hour)) DAY_GROUND else NIGHT_GROUND
}
```

```kotlin
package io.github.davshn.narsil

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DayNightTest {
    @Test
    fun theDayRunsFromSixToFiveFiftyNine() {
        assertFalse(DayNight.isDay(5))
        assertTrue(DayNight.isDay(6))
        assertTrue(DayNight.isDay(17))
        assertFalse(DayNight.isDay(18))
    }

    @Test
    fun theGroundIsThePagesOwn() {
        assertEquals("#c9e7f1", DayNight.groundOf(12))
        assertEquals("#0f1a2c", DayNight.groundOf(23))
    }
}
```

E la skin più piccola possibile per una sola variabile, per vedere il meccanismo da solo. Mettila in un foglio costruito e imposta `data-mode` a mano nei DevTools per guardare la pagina che segue:

```css
html[data-mode='dark'],
html[data-mode='dark'] .cds-root:not([data-mode='light']),
.cds-root[data-mode='dark'] {
  --cds-page-bg: #0f1a2c !important;
}

html[data-mode='light'],
html[data-mode='light'] .cds-root:not([data-mode='dark']),
.cds-root[data-mode='light'] {
  --cds-page-bg: #c9e7f1 !important;
}
```

## Errori comuni e come testarlo

- **Variabili solo su `html`.** Il primo componente che si monta dichiara le sue e la pagina torna ai colori di Claude a chiazze. Impostale ovunque le imposti la pagina.
- **Un elemento `<style>` dallo script.** La Content Security Policy di una pagina può rifiutarlo. Un foglio di stile costruito, come quello che usa l'app, o il foglio di stile proprio di un'estensione, è la strada per entrare.
- **Riscrivere ogni `data-mode`.** `data-mode=code` in questa pagina significa un'altra cosa; sovrascriverlo rompe quella parte.
- **Scrivere l'attributo a ogni esecuzione.** L'osservatore si risveglia per la sua stessa scrittura e non si ferma mai. Confronta prima.
- **Nessun timer.** La pagina non cambia alle 18:00, quindi senza un timer la modalità aspetta il tuo prossimo tocco.
- **Grassetto ovunque, anche nella banda di Narsil.** `body *` arriva alla banda. Rimetti i pesi alle tue parti.
- **Blocchi di codice illeggibili in modalità chiara.** I colori inline ignorano le variabili. Cercali, come fa `skin.css` con il suo filtro.
- **Aspettarsi che conti l'impostazione dell'aspetto di Claude.** Nell'app vince l'ora. È il design, non un bug.

Per testarla, apri la pagina da `chrome://inspect` con una build di debug ed esegui, nella console: `document.documentElement.dataset.mode` (`light` o `dark` in base all'ora), `getComputedStyle(document.documentElement).getPropertyValue('--narsil-css-skin')` (`1`), e `getComputedStyle(document.documentElement).getPropertyValue('--cds-page-bg')` (`#0f1a2c` di notte, `#c9e7f1` di giorno). Poi scrivi `document.documentElement.dataset.mode = 'system'`: entro un frame dovrebbe tornare a dire la modalità dell'ora. Per provare l'altra metà della giornata, imposta a mano l'orologio del telefono nelle impostazioni di data e ora di Android, e torna all'app: la pagina cambia su `visibilitychange`, le barre su `onResume`.

### Dove il codice e il README differiscono

- Il README dice che le barre di sistema seguono il cambio dei colori in base all'ora. La pagina segue entro un minuto; le barre seguono solo quando l'app torna in primo piano, dato che `paintBars` gira in `onResume` e da nessun'altra parte. Con l'app aperta a cavallo delle 6:00 o delle 18:00, le barre tengono il vecchio sfondo finché non esci e rientri.

## Per andare oltre

- La [guida 3](/it/android/conversation-band/) mostra l'osservatore della pagina che la modalità condivide con la banda, e i segni di stile che la banda controlla.
- La [guida 2](/it/android/webview-host/) spiega gli script di inizio documento e l'ordine che costruisce `PageScript`.
- [Narsil Skin](https://github.com/davshn/narsil-skin) ha il tema completo per l'app desktop, con i suoi sfondi animati, che l'app lascia fuori: il commento in cima a `skin.css` dice che non prende "none of that theme's wallpaper, waves or stars" (niente dello sfondo, delle onde o delle stelle di quel tema).
- Il codice sorgente è su [github.com/davshn/narsil-android](https://github.com/davshn/narsil-android).
