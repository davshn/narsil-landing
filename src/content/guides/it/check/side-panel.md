---
title: Il pannello laterale
description: 'Come Narsil Check disegna un pannello accanto alla chat con sezioni comprimibili, un punto colorato per sezione, chiusure che ricorda e righe che copi con un clic.'
route: check
order: 1
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/words.ts
  - repo: check
    path: types/index.d.ts
  - repo: check
    path: README.md
  - repo: check
    path: hooks/explain.ts
  - repo: check
    path: hooks/osv.ts
  - repo: check
    path: tests/pane.test.tsx
  - repo: check
    path: odd/tasks/vulnerabilities.md
  - repo: check
    path: odd/tasks/ecosystems-wave-2.md
---

## Cosa fa

Narsil Check è un pannello che sta accanto alla chat, con il titolo **● Narsil Check**. È il compagno di Narsil, la mascotte di stato del primo percorso, e parla con i suoi colori. Dove Narsil risponde a "devo fare qualcosa adesso?", il pannello risponde a "come sta andando questo progetto?".

Il pannello è una colonna di sezioni, una per controllo: **Mapa mental** (una mappa in diretta del lavoro di Claude, la prossima guida), **Entorno** (l'ambiente della sessione), **Conectores** (connettori), **Actualizaciones** (aggiornamenti), **Vulnerabilidades** (vulnerabilità) e **Pendientes** (un elenco di attività per progetto). Le etichette sono in spagnolo, come in Narsil.

Ogni sezione ha un'intestazione in tre parti:

- **Un punto colorato** che dice la cosa più urgente dentro la sezione, così puoi leggere il pannello anche chiuso.
- **Una freccia**: `▾` quando la sezione è aperta, `▸` quando è chiusa. Un clic sull'intestazione la chiude o la apre.
- **Un nome e un conteggio**, come `▾ Actualizaciones · 3` o `▸ Vulnerabilidades · 2`.

Dentro **Actualizaciones** e **Vulnerabilidades**, anche ogni gruppo (aggiornamenti bloccati, versioni major, avvisi critici e così via) si chiude sulla propria intestazione, e il pannello ricorda quali hai chiuso. Un clic su una libreria o su un avviso la copia negli appunti, con un breve messaggio che dice se ha funzionato.

Il valore è un solo posto in cui guardare. Il README dice che con il pannello aperto puoi nascondere la barra della sessione dell'app desktop e tenere un solo pannello.

## Come funziona dentro

### Un pannello è qualcosa che apri e poi disegni

Una mod non ottiene un pannello dichiarandolo. Lo chiede con `$.ui.open`, e poi disegna il suo contenuto in un hook `ui.render` per il componente `Pane`. Sono due passi separati, ed entrambi sono in `hooks/register.tsx`.

L'apertura avviene nell'hook `session.start`:

```tsx
// Opens on every session: it stands in for the app's session bar.
await $.ui.open({ id: PANE, title: TITLE }).catch(() => undefined)
```

`PANE` è `'narsil-check'` e `TITLE` è `'Narsil Check'`, entrambi in `hooks/words.ts`. L'id dà il nome al pannello; aprire un id già aperto cambia solo il suo titolo, secondo i tipi della 2.1.325.

Il disegno è un hook filtrato su quell'id:

```tsx
on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
  const { Box, Text, Button, Link } = $.ui.resolve(e)
  // ...reads the atoms and returns the tree
})
```

`$.ui.resolve(e)` dà gli elementi che questa superficie può disegnare. L'hook controlla cosa ha ricevuto: `Svg` esiste solo fuori dal terminale (quindi la mappa del lavoro, con la piccola Narsil al centro, viene disegnata solo lì), e l'app mobile non riceve `Input` (quindi lì le attività si aggiungono chiedendolo a Claude). Legge anche `e.surface` per decidere se colorare lo sfondo delle intestazioni dei gruppi: il terminale mantiene i bordi e non disegna sfondi colorati.

### Cosa significa `isPlaced`

`$.ui.open` risolve un risultato, `UiOpenResult` nei tipi. `{ isPlaced: true }` significa che il pannello è aperto e disegnato, e segue il primo `ui.render` per `{ component: "Pane", requestId: id }`. `{ isPlaced: false, reason }` significa che il pannello è aperto ma non ancora disegnato.

I tipi danno la regola: un pannello aperto in risposta alla persona (un comando, un prompt, una pressione) viene posizionato a qualsiasi larghezza. Un pannello che la mod apre da sola aspetta senza essere disegnato sotto le 144 colonne di terminale, o 110 una volta che la persona ha chiesto quell'id. Un pannello che un altro plugin tiene viene rifiutato, e la chiamata viene respinta.

Narsil Check apre il suo pannello da sola a ogni avvio di sessione, quindi su un terminale stretto può aspettare senza essere disegnato. Il codice non legge `isPlaced`; cattura solo il rifiuto, così un pannello rifiutato non rompe l'avvio della sessione. I test rispondono all'evento `ui.open` con `{ value: { isPlaced: true } }`, come se fosse sempre disegnato. Quando la persona digita `/narsil-check upgrade` o `/narsil-check vulns`, il comando chiama di nuovo `$.ui.open`, e dato che quell'apertura risponde alla persona, viene posizionato a qualsiasi larghezza. Il README descrive `/narsil-check upgrade` come il modo per riaprire il pannello dopo averlo chiuso.

### I colori del punto

I colori sono una tabella, `PALETTE` in `hooks/words.ts`, con gli stessi valori degli stati di Narsil. Il suo commento ne dà il significato: "blue for what is running or informs, gray for what rests, yellow for what waits on you, green for what is done, red for what failed or blocks" (blu per ciò che è in esecuzione o informa, grigio per ciò che riposa, giallo per ciò che aspetta te, verde per ciò che è fatto, rosso per ciò che è fallito o blocca).

| Colore | Valore    | Significato nel codice                               |
| ------ | --------- | ---------------------------------------------------- |
| Rosso  | `#F0435A` | Qualcosa è fallito o blocca.                         |
| Giallo | `#F5B400` | Qualcosa aspetta te.                                 |
| Verde  | `#22B573` | Fatto, aggiornato, niente da fare.                   |
| Blu    | `#3B8BFF` | Informazione, o qualcosa in esecuzione.              |
| Grigio | `#8A90A6` | A riposo: non ancora letto, o non merita attenzione. |

Ogni sezione sceglie il suo punto con una piccola funzione pura che controlla prima il caso più urgente:

- **Actualizaciones**, `sectionColor`: rosso se la scansione è fallita o un aggiornamento è bloccato, giallo se una versione major va rivista, blu se una versione è fuori dall'SDK di Expo, verde altrimenti, grigio finché la scansione non è finita.
- **Vulnerabilidades**, `vulnsColor`: rosso per un controllo fallito, grigio prima che finisca, verde per nessuna, altrimenti il colore della gravità peggiore (`SEVERITY_COLOR`: rosso per critical e high, giallo per moderate, grigio per low o senza valutazione).
- **Conectores**, `connectorsColor` in `hooks/session.ts`: rosso quando non si sono potuti leggere, grigio prima del caricamento, giallo quando uno richiede un accesso o è fallito, verde quando sono tutti attivi.
- **Entorno**: blu una volta letta la sessione, grigio prima.

Dal commit `6291eaf` lo stesso colore disegna anche il bordo arrotondato della sezione (`borderStyle: 'round'`, `borderColor`), e sulle superfici diverse dal terminale l'intestazione di un gruppo ha lo sfondo del suo colore con alpha basso (`${tone}1F`), che secondo il commento funziona allo stesso modo su pannelli chiari e scuri.

Il motivo di una funzione per sezione, invece di un colore salvato accanto ai dati, è che il colore non può mai essere in disaccordo con il contenuto: viene calcolato da esso a ogni disegno.

### Chiusure: un atom per chiusura, o un elenco di chiavi chiuse

Ogni chiusura è stato, tenuto in un atom (`atom` da `claude-code`). Ci sono due forme:

- **Una sezione** ha il proprio atom booleano: `isEnvOpen`, `isConnectorsOpen`, `isUpgradeOpen`, `isVulnsOpen`, `isTodosOpen`, `isCiOpen`. Il `Button` dell'intestazione lo inverte con `update($, isUpgradeOpen, value => !value)`.
- **Un gruppo dentro una sezione** va in un unico elenco, `closedGroups`, delle chiavi chiuse (come `upgrade-blocked` o `vulns-high`). `toggleGroup` aggiunge la chiave se manca e la toglie se c'è. Ogni gruppo parte aperto, perché un elenco vuoto significa che niente è chiuso.

L'hook di render legge questi atom con `read`, e una lettura durante un disegno lo iscrive: quando una pressione chiama `update`, il pannello si ridisegna senza nessuna chiamata in più.

### Cosa ricorda, e dove

Qui il codice, i suoi commenti e i tipi richiedono una lettura attenta.

A ogni `session.start` l'hook imposta le sezioni a valori fissi: Mapa mental ed Entorno aperte, Conectores, Actualizaciones e Vulnerabilidades chiuse, e Pendientes aperta solo quando contiene attività. Actualizaciones e Vulnerabilidades si aprono da sole quando trovano qualcosa. Il commit che lo ha introdotto, `c07f5e9`, dice "Fold state is no longer kept across sessions." (lo stato delle chiusure non viene più mantenuto tra le sessioni).

I gruppi (`closedGroups`) e la chiusura della CI (`isCiOpen`) non vengono reimpostati all'avvio della sessione. I commenti del codice dicono che mantengono come li hai lasciati "across sessions" (tra le sessioni), e il README dice che il pannello "recuerda cuáles cerraste" ("ricorda quali hai chiuso").

Sono tutti atom, e gli atom passano per `$.state`. I tipi della 2.1.325 descrivono `$.state` come "Named values held by the host for the session" (valori con nome tenuti dall'host per la sessione) che sopravvivono a un ricaricamento a caldo del codice del plugin, e aggiungono "Persist through `$.store`." (rendi persistente tramite `$.store`). Un commento in `hooks/register.tsx` nota che un `/clear` mantiene il modulo caricato sotto una nuova sessione, che è un caso in cui un atom sopravvive a una sessione. Se ti serve che una chiusura sopravviva a un riavvio di Claude Code, i tipi indicano `$.store`, non un atom.

Gli atom vengono creati con un'opzione `shape` (`{ shape: 'closed-1' }`). I tipi la spiegano: il valore viene tenuto sotto quell'etichetta, e una versione più recente del codice che nomina un'altra etichetta trova il valore assente. Il commento sopra gli atom dice di cambiare l'etichetta "when its type's fields change" (quando cambiano i campi del suo tipo), così un vecchio valore salvato non arriva mai a codice che si aspetta campi nuovi.

### Copiare negli appunti

Ogni riga di libreria e ogni riga di avviso è un `Button` `plain`. La sua pressione chiama `copyRow`:

```tsx
async function copyRow($: EngineInterface, text: string, surface: Surface): Promise<void> {
  const copied = await $.ui.copy({ text, surface })
  $.ui.toast(copied.isCopied ? 'Copiado al portapapeles.' : `No pude copiar: ${copied.reason}`)
}
```

La superficie viene dalla pressione: `onPress={press => copyRow($, copy, press.surface)}`. Quel dettaglio conta. I tipi dicono che `$.ui.copy` mette il testo "on the clipboard of a surface the session draws on" (negli appunti di una superficie su cui la sessione disegna), e che un hook di pressione passa `e.surface` per indicare quale; se lo ometti, è la prima superficie della sessione. Una persona che clicca nell'app desktop vuole il testo negli appunti del desktop, non su un terminale collegato alla stessa sessione.

Il risultato dice se ha funzionato: `{ isCopied: true }`, o `{ isCopied: false, reason }` con un motivo da un insieme chiuso (`no-surface`, `no-clipboard`, `refused`). Il toast riporta entrambi i casi, così una copia fallita non sembra mai una riuscita.

Ciò che viene copiato è più dell'etichetta della riga. Due funzioni pure costruiscono il testo: `upgradeCopyText` in `hooks/explain.ts` (un aggiornamento con il suo salto e ciò che lo blocca o il motivo di Haiku) e `vulnCopyText` in `hooks/osv.ts` (un avviso con la sua gravità, la correzione e il link a OSV).

### Perché le parole vivono in `hooks/words.ts`

Come in Narsil, il modulo degli hook decide cosa è successo e `hooks/words.ts` decide come si dice: la palette, le etichette e i suggerimenti dei gruppi (`GROUPS`), le etichette delle intestazioni (`sectionLabel`, `vulnsLabel`, `groupLabel`) e i colori. Sono funzioni pure, ed è per questo che `tests/pane.test.tsx` può controllarle senza montare niente, come in "the section is colored by what most needs you, and its toggle names it" (la sezione è colorata da ciò che più ha bisogno di te, e il suo interruttore lo nomina).

## Costruiscila con Claude

Chiedi a Claude un pannello laterale con sezioni che si comprimono e righe che si copiano. L'unica idea che deve fare bene è che il pannello viene aperto una volta e poi disegnato da un hook filtrato sul suo id, con lo stato di ogni sezione comprimibile conservato in un atom che il disegno legge.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Crea una mod di Claude Code chiamata `my-panel` con un pannello laterale. In `session.start`, chiama `$.ui.open({ id: 'my-panel', title: 'My panel' })` e cattura un rifiuto. Disegnalo in `ui.render` per `{ component: 'Pane', requestId: 'my-panel' }` con `$.ui.resolve(e)`. Mostra due sezioni, ciascuna in un riquadro con un bordo arrotondato del suo colore, e un'intestazione con un punto colorato (rosso per fallito, giallo per in attesa di me, verde per fatto, blu per informazione, grigio prima del caricamento) e un `Button` `plain` con l'etichetta `▾ Name` o `▸ Name` che la chiude. Tieni le chiavi delle sezioni chiuse in un unico atom dichiarato in `types/index.d.ts`. Fai di ogni riga un `Button` `plain` che copia il suo testo con `$.ui.copy({ text, surface: press.surface })` e mostra un toast che dice se `isCopied` era true. Controlla ogni API con i tipi di plugin-authoring e aggiungi un test con `claude-code/testing` che verifichi che una pressione su un'intestazione nasconde le sue righe.

### Cosa controllare nella risposta di Claude

1. `session.start` chiama `$.ui.open` con l'id e il titolo del pannello, e intercetta un rifiuto, così un pannello occupato da un altro plugin non rompe l'avvio della sessione.
2. L'hook `ui.render` è filtrato su `{ component: 'Pane', requestId }` con l'id del pannello stesso, e prende i suoi elementi da `$.ui.resolve(e)`.
3. Il punto di ogni sezione viene da una piccola funzione che controlla per primo il caso più urgente. Viene calcolato dai contenuti a ogni disegno, non conservato accanto ai dati.
4. Una pressione su un'intestazione cambia un atom con `update`, e il pannello si ridisegna senza chiamate in più, perché il disegno legge quell'atom.
5. Una pressione su una riga chiama `$.ui.copy` con `press.surface`, e il toast riporta entrambi i casi: `isCopied` true o false.

Se un controllo fallisce, di' a Claude cosa vedi: "premo l'intestazione di una sezione e le sue righe restano sullo schermo".

### Come l'ha chiesta l'autore

La richiesta originale per il pannello non è stata registrata. Due log di task pubblici in narsil-check citano le parole dell'autore su alcune sue parti.

#### Registrato: la copia, e una sezione comprimibile

`odd/tasks/vulnerabilities.md` registra, nella sua voce di log L1 (2026-11-05), i due messaggi che hanno avviato la sezione delle vulnerabilità. S1 cita il primo:

> "podemos checkear vulnerabilidades de la misma forma? es decir crear un sub menu de vulnerabilidades que haga pnpm audit o similar?"

In italiano: possiamo controllare le vulnerabilità allo stesso modo, cioè creare un sottomenu delle vulnerabilità che esegua pnpm audit o simile?

Il log del task registra poi la proposta che l'autore ha accettato con "si" ("sì"): tra le altre cose, "a collapsible section "▾ Vulnerabilidades · N" under Actualizaciones, its dot red for critical or high, yellow for moderate, green for none" (una sezione comprimibile "▾ Vulnerabilidades · N" sotto Actualizaciones, con il punto rosso per critical o high, giallo per moderate, verde per nessuna). Quel design è la proposta dell'agente, scritta nel log del task; le parole dell'autore sono la domanda e il "si".

S2 cita il secondo messaggio:

> "solo agregar que me gustaria la opcion de copiar las vulnerabilidades por criticidad al porta papeles, como esta en el upgrade"

In italiano: aggiungo solo che mi piacerebbe l'opzione di copiare le vulnerabilità per gravità negli appunti, come c'è nella sezione degli aggiornamenti.

#### Registrato: quando il pannello dovrebbe aprirsi

`odd/tasks/ecosystems-wave-2.md` (il suo log inizia il 2026-11-04) elenca in S3 il comportamento che doveva restare, inclusa una regola precedente citata con le parole dell'autore:

> "el panel solo deberia abrirse automaticamente cuando haya versiones por actualizar, ya de resto que deba abrirse con /upgrades"

In italiano: il pannello dovrebbe aprirsi automaticamente solo quando ci sono versioni da aggiornare; per il resto dovrebbe aprirsi con /upgrades.

Quella regola non è durata. `/upgrades` è diventato `/narsil-check upgrade` in `684837f`, e da `be8eac0` il pannello si apre a ogni sessione, perché ha preso il posto della barra della sessione dell'app (vedi sotto).

#### Ricostruzione dalla cronologia dei commit

Da `git log -- hooks/register.tsx hooks/words.ts` in narsil-check:

- `1bf736a` (2026-11-04) "feat: add upgrade panel for npm and Expo projects" (aggiunge un pannello di aggiornamenti per progetti npm ed Expo). Il pannello nasce come elenco di aggiornamenti.
- `684837f` (2026-11-04) "feat!: rename to narsil-check, with /narsil-check upgrade and Narsil's look" (rinomina in narsil-check, con /narsil-check upgrade e l'aspetto di Narsil). Il suo messaggio: il pannello usa la palette e le intestazioni di Narsil ("a colored dot and a bold name", un punto colorato e un nome in grassetto), e la sezione degli aggiornamenti si chiude dalla sua intestazione.
- `912478b` (2026-11-04) "feat: check known vulnerabilities with OSV.dev in a collapsible section" (controlla le vulnerabilità note con OSV.dev in una sezione comprimibile).
- `be8eac0` (2026-11-05) "feat: show the session bar's environment, connectors and Remote Control in the pane" (mostra nel pannello l'ambiente, i connettori e il Remote Control della barra della sessione). Il suo messaggio: "The pane opens on every session" (il pannello si apre a ogni sessione).
- `c07f5e9` (2026-11-05) "feat: Entorno starts open, other sections fold until they have something" (Entorno parte aperta, le altre sezioni restano chiuse finché non hanno qualcosa). Le chiusure iniziali fisse.
- `b3ad055` (2026-11-06) "feat: fold upgrade and vulnerability groups, copy a row on click, show baby Narsil and pull the branch" (chiude i gruppi di aggiornamenti e vulnerabilità, copia una riga con un clic, mostra la piccola Narsil e fa il pull del branch). Il suo messaggio: ogni gruppo "folds on its own header and stays as left" (si chiude sulla propria intestazione e resta come lasciato), e "A press on a library or an advisory copies it, replacing the per-group copy buttons" (una pressione su una libreria o su un avviso lo copia, al posto dei pulsanti di copia per gruppo).
- `d5b08c3` (2026-11-06) "feat: center the pane's title and baby Narsil" (centra il titolo del pannello e la piccola Narsil). In seguito la piccola Narsil ha lasciato la cima del pannello per il centro della mappa del lavoro (la prossima guida).
- `6291eaf` (2026-11-06) "feat: give the pane a health bar, state-colored panels and tinted group heads" (dà al pannello una barra della salute, riquadri colorati per stato e intestazioni dei gruppi con sfondo colorato).

Lo schema: prima un elenco di aggiornamenti, poi l'aspetto di Narsil, poi una sezione per controllo, ogni volta con la stessa intestazione (punto, freccia, nome, conteggio), e la copia che passa da un pulsante per gruppo a un clic sulla riga stessa.

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida. Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

Questa è una versione ridotta dell'idea, scritta per questa guida e verificata con i tipi di Claude Code 2.1.325. È adattata da `hooks/register.tsx` e `hooks/words.ts` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later); i colori sono la sua `PALETTE`, e le righe sono sintetiche.

Il tipo dello stato, in `types/index.d.ts`:

```ts
declare module 'claude-code' {
  interface PluginState {
    'my-panel': { closed: string[] }
  }
}
export {}
```

Il modulo degli hook, `hooks/register.tsx`:

```tsx
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const PANE = 'my-panel'
const COLOR = { error: '#F0435A', waiting: '#F5B400', done: '#22B573', info: '#3B8BFF' } as const

const SECTIONS = [
  {
    key: 'checks',
    title: 'Checks',
    color: COLOR.waiting,
    rows: ['lint · 2 warnings', 'build · ok'],
  },
  { key: 'notes', title: 'Notes', color: COLOR.info, rows: ['Release acme/shop on Friday'] },
]

const closed = atom({ plugin: 'my-panel', key: 'closed' } as const, [] as string[])

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await $.ui.open({ id: PANE, title: 'My panel' }).catch(() => undefined)
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const shut = new Set(await read($, closed))
    const toggle = (key: string) =>
      update($, closed, (keys) =>
        keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key],
      )
    const copy = async (text: string, surface: Parameters<typeof $.ui.copy>[0]['surface']) => {
      const copied = await $.ui.copy({ text, surface })
      $.ui.toast(copied.isCopied ? 'Copied.' : `Could not copy: ${copied.reason}`)
    }

    return (
      <Box flexDirection="column">
        {SECTIONS.map((s) => (
          <Box
            key={s.key}
            flexDirection="column"
            borderStyle="round"
            borderColor={s.color}
            paddingX={1}
            marginTop={1}
          >
            <Box flexDirection="row" gap={1}>
              <Text bold color={s.color}>
                ●
              </Text>
              <Button
                key={`section-${s.key}`}
                plain
                label={`${shut.has(s.key) ? '▸' : '▾'} ${s.title}`}
                onPress={() => toggle(s.key)}
              />
            </Box>
            {!shut.has(s.key) &&
              s.rows.map((row, i) => (
                <Button
                  key={`row-${s.key}-${i}`}
                  plain
                  label={row}
                  onPress={(press) => copy(row, press.surface)}
                />
              ))}
          </Box>
        ))}
      </Box>
    )
  })
}
```

Tre dettagli reggono il design. Il pannello viene aperto una volta e disegnato da un hook filtrato sul proprio `requestId`, così non disegna mai il pannello di un altro plugin. La chiusura vive in un atom che l'hook di render legge, così a una pressione basta fare `update`. E la copia prende la `surface` della pressione, così il testo arriva dove la persona ha cliccato.

## Errori comuni e come testarlo

Questi vengono dal codice e dai commit di Narsil Check:

- **Dare per scontato che il pannello sia disegnato perché `open` è stato risolto.** Su un terminale stretto un'apertura non richiesta risolve `{ isPlaced: false, reason }` e aspetta. Se qualcosa dipende dal fatto che il pannello sia visibile, leggi `isPlaced`; un comando digitato dalla persona lo apre a qualsiasi larghezza.
- **Lasciare che un'apertura rifiutata rompa l'avvio.** Un altro plugin può tenere l'id e la chiamata viene respinta. Narsil Check chiude la chiamata con `.catch(() => undefined)`.
- **Copiare sulla superficie sbagliata.** Omettere `surface` copia sulla prima superficie della sessione. Passa `press.surface` dal pulsante.
- **Fidarsi ciecamente di `isCopied` su un terminale.** I tipi notano che OSC 52 non dà riscontro: un terminale che lo ignora, senza nessuno strumento per gli appunti sulla macchina, dà comunque true.
- **Salvare un valore i cui campi sono cambiati sotto la stessa etichetta.** Cambia la `shape` dell'atom quando cambia il suo tipo, come dice il commento sopra gli atom di Narsil Check.
- **Aspettarsi che un atom sopravviva a un riavvio.** I tipi tengono `$.state` per la sessione e indicano `$.store` per la persistenza.
- **Disegnare sfondi colorati sul terminale.** Narsil Check colora le intestazioni dei gruppi solo quando `e.surface !== 'terminal'`; il terminale mantiene i bordi.

Per testare, `claude plugin test .` esegue i file `*.test.tsx` della mod. `tests/pane.test.tsx` in narsil-check è un buon modello: risponde a `ui.open` con `{ value: { isPlaced: true } }`, monta il pannello con `$.ui.mount({ plugin, component: 'Pane', requestId, props, surface })`, preme le intestazioni per chiave (`ui.press({ key: 'section-upgrade' })`) e cerca i testi con `find`. Tra i test da copiare per nome ci sono "the section is colored by what most needs you, and its toggle names it" (la sezione è colorata da ciò che più ha bisogno di te, e il suo interruttore lo nomina), "the work map is the first section, open, with baby Narsil at its core; the terminal draws neither" (la mappa del lavoro è la prima sezione, aperta, con la piccola Narsil al centro; il terminale non disegna né l'una né l'altra) e "each section is a panel bordered in the color of its state; the desktop tints group heads and counts, the terminal keeps borders alone" (ogni sezione è un riquadro bordato del colore del suo stato; il desktop colora lo sfondo delle intestazioni dei gruppi e dei conteggi, il terminale mantiene solo i bordi).

## Per andare oltre

Il pannello completo in narsil-check aggiunge molto attorno alla stessa struttura:

- Una barra della salute sotto il titolo (`healthOf` e `healthSvg` in `hooks/words.ts`) che divide lo stato del progetto in quote, una per colore.
- La mappa del lavoro (la prossima guida): un SVG animato con la piccola Narsil al centro, ridipinto da una media query `prefers-color-scheme` dentro l'SVG, così segue il tema dell'app senza nessuna parola dal motore.
- Le sezioni della sessione (la terza e la quarta guida) e la chiusura della CI della tua pull request (la quinta).
- **Actualizar rama** in fondo, un `git pull -r` che la mod esegue da sola, e un grande avviso in cima quando il branch è indietro rispetto al suo remoto.
- Il comando `/narsil-check` con `upgrade`, `vulns` e `template "…"`, registrato in `session.start` con `$.command.register`.
