---
title: Un sorgente, due pacchetti Android
description: 'Come Narsil in Claude distribuisce un solo sorgente in due pacchetti: un .xpi unlisted firmato per Firefox per Android, e una cartella Manifest V3 per Vivaldi che rimette i suoi stili se ricaricata.'
route: claude
order: 5
updated: 2026-11-18
---

## Cosa fa

Narsil in Claude è scritta una volta sola, in una cartella, e arriva sul telefono in due forme:

| Browser             | Pacchetto                                   | Come arriva sul telefono                                       |
| ------------------- | ------------------------------------------- | -------------------------------------------------------------- |
| Firefox per Android | La cartella così com'è, Manifest V2         | Firmata da Mozilla come `.xpi` unlisted, installata da un file |
| Vivaldi per Android | Una copia con un Manifest V3 derivato da lì | Copiata sul telefono via USB, caricata unpacked, senza firma   |

Serve **Firefox 142 o successivo** oppure **Vivaldi 8.2 o successivo**, come dice il README. Chrome per Android non accetta estensioni, quindi Vivaldi è il browser Chromium che la esegue.

Il pacchetto per Vivaldi fa anche una cosa di cui quello per Firefox non ha bisogno: quando Vivaldi ricarica l'estensione, o Android chiude Vivaldi e questo si riapre, la pagina può perdere gli stili o gli script dell'estensione. Il pacchetto Chromium se ne accorge, e li rimette senza ricaricare la pagina.

> **Sperimentale.** L'estensione si basa sulla struttura della pagina di `claude.ai`, non su un'API pubblica, quindi un aggiornamento di Claude può romperla. Caricare un'estensione unpacked in Vivaldi su Android è una funzione per sviluppatori, e i browser possono cambiare il modo in cui funziona. L'estensione legge soltanto `claude.ai`: non scrive mai nel tuo account né invia le tue conversazioni da nessuna parte, anche se carica i disegni di Narsil da GitHub e legge il suo topic di stato su ntfy.sh. Firmare per Firefox richiede credenziali API tutte tue su addons.mozilla.org; questa guida ne mostra solo dei segnaposto.

## Come funziona dentro

### Il sorgente: un'estensione di Firefox

La cartella `extension/` è un'estensione di Firefox completa: JavaScript semplice, senza passaggio di build, senza librerie. Il suo `manifest.json` è **Manifest V2**, con una pagina di background (`"persistent": true`) che carica `background.js` e i suoi moduli ([MDN: background](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background)).

Firefox legge una chiave di cui nessun altro browser ha bisogno, `browser_specific_settings` ([MDN: browser_specific_settings](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings)):

- **`gecko.id`**, l'id dell'estensione, nella forma di un indirizzo email. Ogni nuova versione firmata mantiene lo stesso id, così Firefox la tratta come la stessa estensione.
- **`gecko.strict_min_version`** e **`gecko_android.strict_min_version`**, entrambe `142.0`. Un Firefox più vecchio di così non installa l'estensione. La prima versione chiedeva la 121; il commit `40be528` le ha alzate entrambe a 142 quando ha aggiunto la chiave successiva. Il suo messaggio non dice perché.
- **`gecko.data_collection_permissions`**, con `required` impostato a `none`: l'estensione dichiara che non raccoglie né trasmette dati. MDN dice che questa chiave è obbligatoria per le nuove estensioni inviate ad addons.mozilla.org dal 3 novembre 2025.

### Firefox: firmare come unlisted

Firefox per Android installa solo estensioni firmate da Mozilla. Firmare non significa pubblicare: il canale **unlisted** firma l'estensione "for self-distribution" (per l'autodistribuzione), nelle parole del riferimento di `web-ext`, e non compare mai nello store dei componenti aggiuntivi ([Extension Workshop: web-ext sign](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#web-ext-sign)).

La firma la fa lo strumento `web-ext` di Mozilla stessa, eseguito come `web-ext sign --channel=unlisted`. Due file gli dicono cosa fare:

- **`web-ext-config.mjs`**, nella radice, che `web-ext` trova da solo ([Extension Workshop: getting started with web-ext](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/)). Imposta due opzioni: la cartella sorgente è `./extension` e la cartella degli artefatti è `./dist`. Così viene impacchettata solo la cartella dell'estensione, mai i test o gli script, e il `.xpi` firmato finisce in `dist/`, che git ignora.
- **`scripts/sign.ps1`**, che esegue `npm run sign`. Il commit `40be528` (2026-11-09) "build: sign the extension as unlisted with Mozilla" (firma l'estensione come unlisted con Mozilla) ne spiega lo scopo: "asks for the API credentials and keeps them only in its own process" (chiede le credenziali API e le tiene solo nel proprio processo).

Le credenziali sono il **JWT issuer** e il **JWT secret** che generi su [addons.mozilla.org](https://addons.mozilla.org/developers/addon/api/key/). `web-ext` le legge da `--api-key` e `--api-secret`, oppure dalle variabili d'ambiente `WEB_EXT_API_KEY` e `WEB_EXT_API_SECRET`. Lo script le chiede entrambe quando gira, il secret come input nascosto, le mette in quelle due variabili solo per il proprio processo, esegue `web-ext`, e le rimuove quando finisce, anche se la firma fallisce. Non finiscono mai in un file, nella cronologia della shell o nel repository.

Mozilla firma ogni versione una sola volta, quindi ogni nuova firma richiede una nuova `version` in `manifest.json`.

### Firefox: installare il file firmato

Il `.xpi` è uno zip firmato della cartella dell'estensione. Per installarlo, copialo sul telefono e usa il menu nascosto di Firefox: **Settings → About Firefox**, tocca il logo cinque volte, poi torna in **Settings** e usa l'opzione per installare un'estensione da un file. La [guida 1](/it/mods/claude/what-it-is/) elenca i passi.

Mentre sviluppi c'è una strada più rapida che non richiede firma: `npm run phone` esegue `web-ext run --target=firefox-android` con il telefono collegato via USB. Firefox carica la cartella come estensione temporanea e la ricarica a ogni modifica, finché il comando è in esecuzione ([Extension Workshop: web-ext run](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#web-ext-run)). `npm run lint` esegue `web-ext lint`, che controlla il manifest e il codice in cerca di problemi prima che tu firmi.

### Vivaldi: il pacchetto Chromium

Vivaldi è un browser Chromium, e dalla versione 8.2 la sua versione per Android carica le estensioni di Chrome da una cartella sul telefono, senza store e senza firma. Il commit `11dadb3` (2026-11-10) "feat: run the extension in Vivaldi for Android as a Chromium package" (esegue l'estensione in Vivaldi per Android come pacchetto Chromium) ha aggiunto il secondo pacchetto.

Non è una seconda copia del codice. `scripts/chromium.mjs` copia `extension/` in `dist/chromium` e scrive due file nella copia:

1. **Un `manifest.json` Manifest V3**, derivato da quello di Firefox.
2. **`background-worker.js`**, un service worker di una riga che carica, con `importScripts()`, gli stessi script di background che carica la pagina di background di Firefox.

Il manifest derivato cambia ciò che Manifest V3 richiede ([Chrome: migrate to Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate)):

| Firefox, Manifest V2                                 | Vivaldi, Manifest V3                                                                    |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `manifest_version: 2`                                | `manifest_version: 3`                                                                   |
| `browser_specific_settings`                          | Rimossa: è propria di Firefox                                                           |
| Una pagina di background con `scripts`               | `background.service_worker`, il worker di una riga                                      |
| Indirizzi dentro `permissions` (`https://ntfy.sh/*`) | Spostati in `host_permissions`, con l'aggiunta di `https://claude.ai/*`                 |
| `storage`                                            | `storage` e `scripting`                                                                 |
| `web_accessible_resources` come elenco di file       | Un elenco di oggetti, ciascuno con le sue `resources` e le pagine che possono caricarle |
| I content script così come sono                      | Gli stessi, con `lib/browser.js` caricato per primo in ogni gruppo                      |

Tutto il resto, i content script, la pagina delle opzioni, le icone, passa senza modifiche.

### Un solo codice per due API

Firefox chiama l'API delle estensioni `browser`; Chromium la chiama `chrome`. In Manifest V3 entrambe rispondono con promise, quindi il codice ha bisogno di un solo nome. `lib/browser.js`, che esiste solo per essere caricato per primo nel pacchetto Chromium, imposta `browser` a `chrome`. Il resto del codice dice `browser` ovunque.

Il background ha avuto bisogno di un cambiamento vero. Un service worker non ha `EventSource`, quindi il background segue lo stream di ntfy.sh con `fetch` e un lettore di stream, in entrambi i browser. E Chromium ferma un service worker inattivo dopo 30 secondi ([Chrome: the extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)), così il blocco nel menu laterale gli invia una parola ogni 25 secondi mentre è visibile. La [guida 3](/it/mods/claude/sidebar/) tratta entrambe le cose.

### Vivaldi: caricarla da `Download/narsil-chromium`

`npm run phone:chromium` costruisce il pacchetto e, con `--push`, lo copia sul telefono con `adb` di Android: cancella `Download/narsil-chromium` sul telefono e ci invia la nuova cartella. Con più di un dispositivo collegato, la variabile d'ambiente `ANDROID_SERIAL` ne sceglie uno. Il telefono deve avere il debug USB attivato.

Poi, in Vivaldi:

1. Apri `vivaldi://extensions` e attiva **Developer mode**.
2. Tocca **Load unpacked**, vai su **Download → narsil-chromium**, tocca **Use this folder**, poi **Allow**.
3. Apri le opzioni dell'estensione e scrivi il tuo topic, e la chiave se ne hai una.
4. Apri `claude.ai` e ricaricala.

La cartella resta sul telefono: Vivaldi carica l'estensione da lì ogni volta.

### Quando Vivaldi ricarica l'estensione

È qui che i due browser differiscono di più. Quando l'estensione se ne va con `claude.ai` aperta, perché Vivaldi la ricarica o la aggiorna o Android la scarica, Chromium toglie i suoi stili dalla pagina e non rimette mai i suoi script. Nel frattempo, il vecchio content script era ancora nella pagina, senza la sua estensione, e piazzava la banda senza i suoi stili. Firefox rimette tutto da solo.

Tre correzioni, nell'arco di una settimana, fanno sì che il pacchetto Chromium si rimetta in sesto da solo.

**1. I vecchi script si fermano** (`1d9db3d`, 2026-11-11, e `6b24ccb`, 2026-11-17). L'osservatore della pagina che ogni content script condivide, in `lib/watch.js`, controlla a ogni esecuzione se la sua estensione esiste ancora: una volta sparita, `browser.runtime.id` è vuoto o lancia un'eccezione. Allora l'osservatore si ferma, e ogni script che lo usava si ferma con lui: timer cancellati, banda rimossa. Una copia più recente degli script ferma anche quella vecchia, lanciando un evento sul documento della pagina, l'unica cosa che due copie condividono. `1d9db3d` carica anche `lib/watch.js` in entrambi i gruppi di content script, dato che Vivaldi a volte eseguiva solo il secondo gruppo, e la banda chiedeva un osservatore che non esisteva ancora.

**2. Il background rimette gli script** (`6b24ccb`). Ogni volta che il background parte, `lib/restore.js` chiede a ogni scheda di `claude.ai` aperta se i suoi script rispondono ancora. Il content script risponde con `true` a un messaggio tutto suo. Una scheda che non risponde riceve di nuovo i gruppi di content script del manifest, in ordine, ogni foglio di stile con `scripting.insertCSS` e ogni gruppo di script con `scripting.executeScript` ([Chrome: chrome.scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting)). Questo richiede il permesso `scripting` e l'accesso host alle pagine, ed è per questo che il manifest Chromium aggiunge entrambi. Una scheda che non riesce a raggiungere, scartata o ancora in caricamento, li riceve comunque al suo caricamento successivo.

**3. La pagina chiede ciò che le manca** (`a1e01b6` e `8e31a1d`, 2026-11-18). Dopo che Android chiude Vivaldi e questo si riapre, Vivaldi può eseguire i content script senza i fogli di stile, o saltare l'intero primo gruppo. Gli script che sono stati eseguiti rispondono ancora, quindi il passo 2 salta la scheda. Così la pagina controlla sé stessa: ogni foglio di stile imposta un segno su `:root`, e la banda controlla i segni e se il primo gruppo ha lasciato la sua funzione della modalità nella pagina (la [guida 4](/it/mods/claude/colors-and-icon/) descrive entrambe le cose). Ciò che manca, lo chiede al background. Il background accetta solo fogli di stile e numeri di gruppo del proprio manifest, mai un file arbitrario, e li inserisce solo in quella scheda e in quel frame.

In Firefox niente di tutto questo viene eseguito: il suo manifest non chiede il permesso `scripting`, quindi lì `browser.scripting` non esiste, e il codice di ripristino ritorna subito.

### Aggiornare e disinstallare

**In Firefox**, cambia `version` in `manifest.json`, firma di nuovo, e installa il nuovo `.xpi` nello stesso modo. Il manifest non dichiara alcun indirizzo di aggiornamento, quindi Firefox non cerca nuove versioni da solo. **In Vivaldi**, esegui di nuovo `npm run phone:chromium` e tocca **Update** in `vivaldi://extensions`, come dice il README.

Per disinstallarla da Firefox, apri il menu, vai su **Extensions**, scegli **Narsil en Claude** e rimuovila. Da Vivaldi, rimuovila in `vivaldi://extensions`; poi la cartella `Download/narsil-chromium` può essere cancellata. In entrambi, il topic e la chiave nello spazio di archiviazione dell'estensione se ne vanno con lei, e Claude torna ai suoi colori. L'icona della schermata home resta (la [guida 4](/it/mods/claude/colors-and-icon/) spiega perché).

Se non firmi più niente, revoca le credenziali API sulla stessa pagina di addons.mozilla.org dove le hai create.

## Come è stata chiesta all’IA

Nessuna richiesta per i pacchetti è stata registrata. Le parole di chi ha creato Narsil registrate per questo percorso riguardano il sito (la [guida 1](/it/mods/claude/what-it-is/) le cita). Quanto segue è ricostruito dalla cronologia dei commit dell'estensione:

- `40be528` (2026-11-09) "build: sign the extension as unlisted with Mozilla" (firma l'estensione come unlisted con Mozilla). Lo stesso giorno della prima versione, così da poterla installare in Firefox per Android.
- `11dadb3` (2026-11-10) "feat: run the extension in Vivaldi for Android as a Chromium package" (esegue l'estensione in Vivaldi per Android come pacchetto Chromium). Il suo messaggio descrive il Manifest V3 derivato, il service worker che carica gli stessi script di background, `lib/browser.js`, e il passaggio da `EventSource` a `fetch`; e dice "The Firefox manifest stays V2" (il manifest di Firefox resta V2).
- `1d9db3d` (2026-11-11) "fix: load the page observer with the band and stop when the extension goes away" (carica l'osservatore della pagina con la banda e si ferma quando l'estensione se ne va).
- `6b24ccb` (2026-11-17) "fix: restore the styles and the band when Vivaldi brings the extension back" (ripristina gli stili e la banda quando Vivaldi riporta l'estensione).
- `a1e01b6` (2026-11-18) "fix: ask for the styles when Vivaldi loads the band without them" (chiede gli stili quando Vivaldi carica la banda senza di essi).
- `8e31a1d` (2026-11-18) "fix: run the light and dark switch again when Vivaldi skips it" (esegue di nuovo il cambio tra chiaro e scuro quando Vivaldi lo salta).

Il secondo browser ha richiesto un giorno per essere aggiunto e una settimana per assestarsi: ogni correzione dopo `11dadb3` risponde a un modo in cui Vivaldi su Android caricava l'estensione solo in parte, scoperto usandola.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt di chi ha creato Narsil.

> La mia estensione di Firefox vive in `extension/` con un `manifest.json` Manifest V2. Scrivi uno script Node, senza dipendenze, che copi la cartella in `dist/chromium` e ci scriva un `manifest.json` Manifest V3: elimina `browser_specific_settings`, sposta i pattern URL da `permissions` a `host_permissions` e aggiungici i `matches` dei content script, aggiungi il permesso `scripting`, trasforma gli script di background in un service worker di una riga che chiami `importScripts()` con essi, metti un file che imposti `self.browser = self.chrome` per primo in ogni gruppo di content script, e converti `web_accessible_resources` nella forma a oggetti di V3. Esporta la conversione del manifest come funzione e testala con `node --test`. Poi, nel background, all'avvio, invia a ogni scheda corrispondente un ping con `tabs.sendMessage`; dove nessuno risponde, inserisci di nuovo il CSS e il JS dei content script del manifest con `scripting.insertCSS` e `scripting.executeScript`. Usa solo API documentate su MDN e developer.chrome.com.

## Il codice minimo

Tre pezzi, scritti per questa guida (MIT): la conversione, il ripristino all'avvio e la firma.

`build-chromium.mjs`, eseguito con `node build-chromium.mjs`:

```js
import fs from 'node:fs'

const source = JSON.parse(fs.readFileSync('extension/manifest.json', 'utf8'))
const isAddress = (permission) => permission.includes('://')
const pages = source.content_scripts.flatMap((group) => group.matches)

const target = {
  manifest_version: 3,
  name: source.name,
  version: source.version,
  icons: source.icons,
  options_ui: source.options_ui,
  permissions: [...source.permissions.filter((p) => !isAddress(p)), 'scripting'],
  host_permissions: [...new Set([...source.permissions.filter(isAddress), ...pages])],
  background: { service_worker: 'worker.js' },
  content_scripts: source.content_scripts.map((group) => ({
    ...group,
    js: ['shim.js', ...(group.js ?? [])],
  })),
}

fs.rmSync('dist/chromium', { recursive: true, force: true })
fs.cpSync('extension', 'dist/chromium', { recursive: true })
fs.writeFileSync('dist/chromium/manifest.json', JSON.stringify(target, null, 2))
fs.writeFileSync('dist/chromium/shim.js', 'self.browser = self.chrome\n')
const scripts = ['shim.js', ...source.background.scripts].map((file) => `'${file}'`)
fs.writeFileSync('dist/chromium/worker.js', `importScripts(${scripts.join(', ')})\n`)
```

Alla fine dello script di background, il ripristino all'avvio:

```js
async function restoreOpenPages() {
  if (!browser.scripting) return
  const groups = browser.runtime.getManifest().content_scripts ?? []
  const tabs = await browser.tabs.query({ url: groups.flatMap((group) => group.matches) })
  for (const tab of tabs) {
    const alive = await browser.tabs.sendMessage(tab.id, 'ping').catch(() => false)
    if (alive === true) continue
    const target = { tabId: tab.id }
    for (const group of groups) {
      if (group.css) await browser.scripting.insertCSS({ target, files: group.css }).catch(() => {})
      if (group.js)
        await browser.scripting.executeScript({ target, files: group.js }).catch(() => {})
    }
  }
}

restoreOpenPages()
```

E in un content script, la risposta:

```js
browser.runtime.onMessage.addListener((message, _sender, reply) => {
  if (message === 'ping') reply(true)
})
```

Per la firma, un `web-ext-config.mjs` nella radice:

```js
export default {
  sourceDir: './extension',
  artifactsDir: './dist',
}
```

Poi, in una shell sul tuo computer, con `dist/` nel tuo `.gitignore`:

```sh
read -r -p 'JWT issuer: ' WEB_EXT_API_KEY
read -r -s -p 'JWT secret: ' WEB_EXT_API_SECRET
export WEB_EXT_API_KEY WEB_EXT_API_SECRET
npx web-ext sign --channel=unlisted
unset WEB_EXT_API_KEY WEB_EXT_API_SECRET
```

L'issuer ha un aspetto come `user:00000000:000` e il secret come `EXAMPLE-not-a-real-secret`; quei due sono segnaposto, mai valori reali. Digitarli a un prompt li tiene fuori dalla cronologia della shell, cosa che una riga di comando con i valori dentro non farebbe. Se preferisci tenerli in un file, tienilo fuori dal repository o in un file ignorato da git sul tuo computer, mai in un commit.

## Errori comuni e come testarlo

- **Mettere le credenziali AMO nel repository.** Chiunque abbia l'issuer e il secret può firmare a nome del tuo account. Digitale quando firmi, oppure tienile in un file ignorato da git. Se una arriva mai in un commit, revocale subito su [addons.mozilla.org](https://addons.mozilla.org/developers/addon/api/key/) e generane di nuove; rimuovere il commit non basta.
- **Firmare senza cambiare la versione.** Mozilla firma ogni versione una sola volta. Cambia prima `version`.
- **Scegliere il canale `listed`.** Quello invia l'estensione allo store pubblico. Per il tuo telefono, usa `unlisted`.
- **Dimenticare `gecko.id`.** Per un'estensione Manifest V2 senza id, `web-ext` ne genera uno e lo salva in `.web-extension-id`; perdi quel file e la firma successiva è un'estensione diversa. Imposta l'id nel manifest.
- **Tenere una pagina di background in Manifest V3.** Chromium vuole un service worker, che non ha DOM né `EventSource`.
- **Lasciare i pattern URL in `permissions`.** In Manifest V3 vanno in `host_permissions`.
- **Aspettarsi che Chromium rimetta gli script.** Quando l'estensione si ricarica, le pagine aperte perdono i loro stili e non ricevono nuovi script. Chiedi a ogni scheda, e inietta di nuovo dove nessuno risponde.
- **Vecchi script che continuano a girare.** Un content script rimasto senza la sua estensione gira ancora. Controlla `browser.runtime.id`, e fermati quando è sparito.
- **Iniettare qualsiasi cosa chieda una pagina.** Il messaggio di una pagina non è affidabile. Inietta solo file del tuo manifest.

Per testare il pacchetto Firefox prima di firmare, esegui `web-ext lint` e `web-ext run --target=firefox-android` con il telefono collegato. Per testare la conversione, esportala come funzione e controlla un piccolo oggetto Manifest V2: i suoi pattern URL dovrebbero finire in `host_permissions`, `scripting` dovrebbe essere aggiunto, e ogni gruppo di content script dovrebbe iniziare con lo shim. Per testare il ripristino, carica il pacchetto Chromium in Vivaldi, apri `claude.ai`, poi tocca **Update** in `vivaldi://extensions` e torna alla scheda senza ricaricarla: i colori e la banda dovrebbero tornare in un attimo.

## Per andare oltre

- La [guida 1](/it/mods/claude/what-it-is/) elenca le parti dell'estensione e cosa legge ciascuna dalla rete.
- Il pacchetto Firefox potrebbe aggiornarsi da solo: un `update_url` in `browser_specific_settings` che punta a un file tutto tuo permette a Firefox di trovare nuove versioni firmate ([Extension Workshop: updating your extension](https://extensionworkshop.com/documentation/manage/updating-your-extension/)).
- Lo stesso pacchetto Chromium potrebbe caricarsi in Chrome su un computer, come estensione unpacked, per testare la banda su uno schermo più largo.
