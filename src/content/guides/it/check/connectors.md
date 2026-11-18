---
title: Connettori
description: "Come Narsil Check elenca i server MCP della sessione con il loro stato e quanti strumenti ha ciascuno, chiesti una volta al server dei connettori dell'app desktop."
route: check
order: 4
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/session.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: types/index.d.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/session.test.tsx
---

## Cosa fa

La sezione **Conectores** ("connettori") elenca i server MCP della sessione, lo stesso elenco che mostra la barra della sessione dell'app desktop. Risponde a due domande rapide: quali server può usare Claude in questo momento, e quale ha bisogno di te.

L'intestazione dice `▸ Conectores · 2`, dove il numero conta i server connessi. Aperta, mostra:

- **Prima i server connessi**, ciascuno con un punto verde e quanti strumenti offre, come `notes-server · 19 herramientas` ("19 strumenti").
- **Poi gli altri**, ciascuno con un punto giallo e il suo stato come lo riporta l'app, come `Mail · needs_auth`.

Quando non c'è niente di connesso dice "No hay conectores conectados." ("non ci sono connettori connessi"). Quando l'elenco non si può leggere, dice perché in rosso: "No pude leer los conectores: …" ("non ho potuto leggere i connettori: …").

Il punto della sezione riassume tutto: verde quando ogni server è attivo, giallo quando uno richiede un accesso o è fallito, rosso quando l'elenco non si è potuto leggere, grigio prima della prima lettura.

Ogni sessione inizia con questa sezione chiusa; l'avvio della sessione la imposta così (`isConnectorsOpen` a `false`) comunque tu l'abbia lasciata.

## Come funziona dentro

### Da dove viene l'elenco

L'elenco è una chiamata al server dei connettori dell'app desktop stessa, fatta in `loadSession` in `hooks/register.tsx`, accanto alle letture della sessione della guida precedente:

```tsx
const result = await $.mcp.call(CONNECTORS_SERVER, CONNECTORS_TOOL)
const list = result.isError
  ? undefined
  : parseConnectors(result.structuredContent ?? jsonOf(result.content))
connectors = list
  ? { connectors: list }
  : { connectors: [], connectorsError: textOf(result.content) || 'respuesta sin conectores' }
```

`CONNECTORS_SERVER` è `'ccd_connectors'` e `CONNECTORS_TOOL` è `'session_connectors_status'`, entrambi in `hooks/session.ts`. La chiamata non prende argomenti. Come per ogni `$.mcp.call` (vedi la guida precedente), la risposta viene letta da `structuredContent` quando c'è e altrimenti dal JSON nei blocchi di testo, e un fallimento viene catturato e tenuto come `connectorsError`.

`parseConnectors` trasforma la risposta nel tipo della mod, `Connector` in `types/index.d.ts`: `{ name, status, tools? }`. Legge un array `servers`; scarta ogni voce senza un `name` di tipo stringa; tiene `status` come testo, o `'unknown'` quando manca; e tiene `tool_count` come `tools` solo quando è un numero. Se non c'è nessun array `servers`, restituisce `undefined`, che il chiamante trasforma in un errore invece che in un elenco vuoto.

Quella distinzione è voluta: "nessun server è connesso" e "non ho potuto leggere i server" sono risposte diverse, e la sezione le mostra in modo diverso.

### Cosa mostra, e cosa no

La sezione mostra il nome, lo stato e il numero di strumenti di ogni server. Non elenca i nomi degli strumenti. Il README descrive lo stesso: i server connessi "con cuántas herramientas tiene cada uno" ("con quanti strumenti ha ciascuno"), poi gli altri con il loro stato.

I campi che legge (`servers`, `name`, `status`, `tool_count`) sono la risposta del server dell'app desktop, non fanno parte dell'API delle mod, quindi i tipi della 2.1.325 non li documentano. La fixture in `tests/session.test.tsx` mostra la forma con cui ha lavorato l'autore, con un campo `kind` che la mod ignora. Il parser accetta ciò che non conosce: uno stato diverso da `connected` viene mostrato com'è arrivato, e il punto giallo di una riga significa solo "non connesso".

Le parole sono funzioni pure in `hooks/session.ts`, così si possono testare da sole:

- `connected(view)` filtra i server il cui stato è `connected`.
- `connectorsLabel(isOpen, view)` disegna l'intestazione, con il conteggio solo quando è sopra zero.
- `connectorLine(c)` disegna una riga: il nome, poi il numero di strumenti per un server connesso, altrimenti lo stato.
- `toolsLabel(n)` dice `1 herramienta` o `N herramientas`.
- `connectorsColor(view)` sceglie il punto, controllando prima l'errore, poi se l'elenco è stato letto, poi se qualche server è `needs_auth` o `failed`.

### Quando viene riletto

I connettori vengono letti nello stesso `loadSession` del resto della sessione, quindi seguono la stessa programmazione prudente: una volta dieci secondi dopo l'avvio della sessione, un'altra volta al primo turno se quella è fallita, e dopo un turno solo quando il turno ha usato uno strumento che cambia la risposta dei server. Per i connettori significa qualsiasi strumento `mcp__ccd_connectors__`, che fa parte di `SESSION_TOOLS`. Aprire la chiusura rilegge tutto, quindi aprire la sezione è il modo per aggiornarla a mano.

Il motivo è lo stesso dell'ambiente: ogni chiamata ai server dell'app viene vista da tutte le altre mod come una chiamata a uno strumento, e una troppo presto può far chiedere il permesso all'app desktop.

### Perché un server del desktop, e non il motore

I tipi della 2.1.325 danno alla mod due chiamate su `$.mcp`: `call`, per chiamare uno strumento di un server connesso, e `connect`, per portare nella sessione un server trattenuto. Nessuna delle due elenca i server con i loro stati. L'app desktop ha uno strumento che lo fa, quindi Narsil Check lo chiede a lei.

Il costo è la superficie. Fuori dall'app desktop non c'è `ccd_connectors`, la chiamata fallisce, e la sezione lo dice. La tabella delle superfici del README lo afferma: Conectores funziona nell'app desktop, e altrove "la sección dice por qué no pudo leerlos" ("la sezione dice perché non ha potuto leggerli").

### A cosa serve la sezione

I commit mostrano che lo scopo della sezione è cambiato una volta. In `2bd1919` un clic su qualsiasi riga di connettore apriva `/mcp`, l'elenco dei server del motore stesso. Un commit dopo, `c07f5e9` ha reso di nuovo semplici le righe, e il suo messaggio dice perché: "/mcp from a mod only prints a summary in the desktop app" (/mcp da una mod stampa solo un riassunto nell'app desktop). Quindi la sezione serve a leggere a colpo d'occhio, e il posto dove accedere a un server o sistemarlo resta quello dell'app.

## Costruiscila con Claude

Chiedi a Claude una sezione che elenchi i server MCP della sessione e il loro stato. L'unica idea che deve fare bene è che "nessun server è connesso" e "non sono riuscito a leggere i server" sono risposte diverse, e la sezione le mostra in modo diverso.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Nella mia mod di Claude Code `my-panel`, aggiungi al pannello una sezione "Connectors". Nell'app desktop, leggi i server MCP della sessione una volta con `$.mcp.call('ccd_connectors', 'session_connectors_status')`, preferendo `structuredContent` e ripiegando sul JSON nel contenuto di testo. Analizza un array `servers` in `{ name, status, tools }` a partire da `name`, `status` e `tool_count`, scartando le voci senza nome, e tratta un array mancante come un errore, non come un elenco vuoto. Mostra prima i server connessi con un punto verde e il loro numero di strumenti, poi gli altri con un punto giallo e il loro stato. Colora il punto della sezione di rosso quando la lettura è fallita, di grigio prima, di giallo quando un server è `needs_auth` o `failed`, e di verde altrimenti. Rileggi solo quando la chiusura si apre. Testa il parser e i colori come funzioni pure.

### Cosa controllare nella risposta di Claude

1. L'elenco viene da una sola `$.mcp.call('ccd_connectors', 'session_connectors_status')`, letta prima da `structuredContent` e altrimenti dal JSON nel contenuto di testo.
2. Il parser scarta le voci senza un `name` di tipo stringa, conserva come testo uno `status` sconosciuto, e restituisce `undefined`, non un elenco vuoto, quando non c'è un array `servers`.
3. Il punto della sezione è rosso quando la lettura è fallita, grigio prima della prima lettura, giallo quando un server è `needs_auth` o `failed`, e verde negli altri casi.
4. I server connessi vengono per primi con un punto verde e il numero dei loro strumenti, poi gli altri con un punto giallo e il loro stato.
5. L'elenco non viene letto a intervalli regolari. Aprire la sezione lo legge di nuovo.

Se un controllo fallisce, di' a Claude cosa vedi: "fuori dall'app desktop la sezione dice che nessun connettore è connesso, invece di dire perché non è riuscita a leggerli".

### Come l'ha chiesta l'autore

La richiesta originale per la sezione dei connettori non è stata registrata. Nessuno dei log di task pubblici di narsil-check (`odd/tasks/*.md`) la copre.

#### Ricostruzione dalla cronologia dei commit

Da `git log -- hooks/session.ts`, con i commit correlati a `hooks/register.tsx`:

- `be8eac0` (2026-11-05) "feat: show the session bar's environment, connectors and Remote Control in the pane" (mostra nel pannello l'ambiente, i connettori e il Remote Control della barra della sessione). I connettori arrivano insieme all'ambiente, come parte della sostituzione della barra della sessione dell'app.
- `2bd1919` (2026-11-05) "feat: repository link, Remote Control switch in Entorno and /mcp from connectors" (link al repository, interruttore del Remote Control in Entorno e /mcp dai connettori). Il suo messaggio: "Any connector row opens /mcp." (qualsiasi riga di connettore apre /mcp).
- `c07f5e9` (2026-11-05) "feat: Entorno starts open, other sections fold until they have something" (Entorno parte aperta, le altre sezioni restano chiuse finché non hanno qualcosa). Conectores parte chiusa, e le righe sono di nuovo semplici.
- `55fe118` (2026-11-06) e `4770a49` (2026-11-06), le due correzioni che hanno reso più rara ogni lettura dei server dell'app, trattate nella guida precedente. Si applicano ai connettori perché vengono letti nella stessa chiamata.

Lo schema: una funzionalità aggiunta con il resto della barra della sessione, un clic che si è rivelato inutile nell'app desktop ed è stato rimosso, e la regola di interrogare di rado, ereditata dall'ambiente.

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida. Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

Questa è una versione ridotta dell'idea, scritta per questa guida e verificata con i tipi di Claude Code 2.1.325. È adattata da `hooks/session.ts` e `hooks/register.tsx` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later).

La parte pura, `hooks/connectors.ts`:

```ts
export type Connector = { name: string; status: string; tools?: number }

export function parseConnectors(value: unknown): Connector[] | undefined {
  const servers = (value as { servers?: unknown } | undefined)?.servers
  if (!Array.isArray(servers)) return undefined
  return servers
    .filter(
      (s): s is Record<string, unknown> =>
        typeof s === 'object' && s !== null && typeof s.name === 'string',
    )
    .map((s) => ({
      name: s.name as string,
      status: typeof s.status === 'string' ? s.status : 'unknown',
      ...(typeof s.tool_count === 'number' ? { tools: s.tool_count } : {}),
    }))
}

export function connectorLine(c: Connector): string {
  if (c.status !== 'connected') return `${c.name} · ${c.status}`
  return c.tools === undefined ? c.name : `${c.name} · ${c.tools} tools`
}
```

La chiamata, in `hooks/register.tsx`, che restituisce l'elenco o il motivo per cui non si è potuto leggere:

```tsx
import type { EngineInterface } from 'claude-code'
import { parseConnectors, type Connector } from './connectors'

async function readConnectors($: EngineInterface): Promise<{ list: Connector[]; error?: string }> {
  try {
    const result = await $.mcp.call('ccd_connectors', 'session_connectors_status')
    const list = result.isError ? undefined : parseConnectors(result.structuredContent)
    return list ? { list } : { list: [], error: 'no list in the answer' }
  } catch (err) {
    return { list: [], error: err instanceof Error ? err.message : String(err) }
  }
}
```

Tieni il risultato in un atom e disegnalo nell'hook `ui.render` del pannello come nella prima guida: prima le righe connesse, poi le altre, ciascuna con `connectorLine`. Questa versione minima legge solo `structuredContent`; Narsil Check analizza anche il JSON nei blocchi di testo (`jsonOf` in `hooks/session.ts`), nel caso il server risponda solo con testo.

## Errori comuni e come testarlo

Questi vengono dal codice e dai commit di Narsil Check:

- **Trattare una lettura fallita come "nessun server".** Restituisci `undefined` dal parser quando la forma è sbagliata, e mostra l'errore. "Nessun connettore" è una risposta reale che dovrebbe venire solo da un elenco reale.
- **Fidarsi della forma della risposta dell'app.** Questi campi sono dell'app desktop, non dell'API delle mod. Controlla il tipo di ogni campo, come fa `parseConnectors`, e mostra uno stato sconosciuto come testo.
- **Aggiornare con un timer.** Ogni chiamata è una chiamata a uno strumento che le altre mod vedono. Leggi sugli eventi: l'avvio, un turno che ha toccato i connettori, l'apertura della chiusura.
- **Collegare le righe a `/mcp`.** Narsil Check ci ha provato e l'ha rimosso (`c07f5e9`): da una mod, nell'app desktop, stampa solo un riassunto.
- **Aspettarselo su ogni superficie.** `ccd_connectors` è dell'app desktop; altrove la sezione può solo dire perché è vuota.

Per testare, i parser e le etichette sono puri: `tests/session.test.tsx` li controlla direttamente in "the session section reads the app servers and names what it found" (la sezione della sessione legge i server dell'app e nomina ciò che ha trovato). Per la sezione stessa, rispondi al server con un hook come `on('mcp.call', (_, e) => e.server === 'ccd_connectors' ? { value: { content: [{ type: 'text', text: JSON.stringify({ servers: [...] }) }], isError: false } } : ...)`, monta il pannello, premi `section-connectors` e cerca le righe. Usa nomi di server sintetici nelle fixture, come `notes-server` e `Mail`.

## Per andare oltre

- La sezione va in coppia con l'ambiente della guida precedente: entrambi vengono letti in un solo `loadSession`, quindi una sola programmazione governa ogni chiamata ai server dell'app.
- I tipi offrono un'altra fonte che funziona su ogni superficie: `$.tool.list()` restituisce gli strumenti che il modello può chiamare adesso, ciascuno con `name`, `description` e `mcp: true` per uno strumento di un server MCP. Raggruppare i nomi `mcp__server__tool` per server dà i server connessi e i loro strumenti, per nome. Non dice quali server aspettano un accesso o sono falliti, che è ciò a cui servono qui le righe gialle. È un vero compromesso, e narsil-check ha scelto il server del desktop.
- `$.mcp.connect(server)` può portare dentro un server che la sessione ha trattenuto, che è il passo successivo dopo aver visto un server non connesso. Narsil Check non lo usa.
