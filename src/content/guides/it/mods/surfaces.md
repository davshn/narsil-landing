---
title: 'Superfici: terminale, desktop, VS Code e mobile'
description: Dove disegna una mod, quali elementi ha ogni superficie e come scrivere un solo hook di render che funzioni nel terminale, nell'app desktop, in VS Code e nell'app mobile.
route: mods
order: 4
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: README.md
  - repo: pet
    path: hooks/register.tsx
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: README.md
---

## Cosa fa

La stessa mod può disegnare nel terminale, nell'app desktop di Claude, in VS Code e nell'app mobile di Claude. Ognuno di questi posti è una superficie, e ognuno ha il proprio insieme di elementi (riquadri, testo, pulsanti, campi).

Questa guida spiega come una mod scopre su quale superficie disegna, cosa offre ciascuna superficie e come chiedere a Claude un solo design che regga su tutte.

## Come funziona dentro

Una mod disegna agganciando `ui.render` per un componente. L'hook riceve in `e` un'istanza del componente:

- `e.component`: quale punto viene disegnato (`AbovePrompt`, `Pane`, `ToolUse` e altri).
- `e.surface`: dove viene disegnato: `terminal`, `desktop`, `mobile` o `vscode`.
- `e.props`: le props proprie del punto, come dati semplici.
- `e.viewport`: quando la superficie ha preso le misure, lo spazio in cui disegna, in celle di carattere.

Una sessione può disegnare su più superfici contemporaneamente, per esempio un terminale e due telefoni. `$.session.surfaces()` elenca tutte le superfici su cui disegna la sessione, con il terminale per primo. Un hook di render non ha bisogno di quell'elenco: viene interpellato una volta per superficie e legge `e.surface` ogni volta.

Gli elementi non sono globali. `$.ui.resolve(e)` restituisce la tabella della superficie su cui viene disegnato `e`, e l'hook ne estrae i tag JSX con la destrutturazione. Restringere `e.surface` restringe il tipo della tabella.

| Superficie | Elementi                                                                                                                            |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `terminal` | `Box`, `Text`, `Button`, `Input`, `Select`, `Link`, `Code`, `Markdown`, `Progress`, più `Client`, `Raster` e `Image`. Niente `Svg`. |
| `desktop`  | I nove elementi condivisi, più `Svg` e `Client`.                                                                                    |
| `vscode`   | La tabella del desktop senza `Client`.                                                                                              |
| `mobile`   | I nove elementi condivisi, più `Svg`. Niente `Client`.                                                                              |

Su mobile, un'app riceve un `Input` o un `Select` solo se ha dichiarato di disegnarli, e altrimenti un `Box` vuoto; lo stesso vale per un `Progress`, che ripiega sul suo `Box` e sul suo `Text`. Un hook non può sapere quale dei due ha ricevuto l'app.

Dove viene disegnato ciascun punto, come lo indica il file di dichiarazioni:

| Punto                                           | Sollevato su                     | Note                                                                                                                                                                                       |
| ----------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AbovePrompt` (la banda sopra il prompt)        | solo terminale, desktop e mobile | Una riga per plugin. La persona può comprimerla o metterla a fuoco.                                                                                                                        |
| `Pane` (aperto con `$.ui.open`)                 | ogni superficie collegata        | Agganciato nel layout a schermo intero del terminale, altrimenti sopra il prompt. Nell'app desktop può essere anche un piccolo `widget`, letto da `e.props.placement`.                     |
| `ToolUse` (la riga di una chiamata a strumento) | ogni superficie collegata        | Su mobile, un albero che mantiene la riga di solito viene disegnato come una riga discreta sotto di essa; un `borderStyle` o un `backgroundColor` sul `Box` contenitore chiede una scheda. |

Due output non passano per `ui.render`. `$.ui.status(text)` fissa una riga per il plugin sotto il prompt. `$.ui.toast(text)` fluttua nell'angolo in alto a destra della trascrizione, e dove la trascrizione viene stampata nello scrollback è una riga nella barra delle notifiche. Il file di dichiarazioni non elenca superficie per superficie dove compaiono questi due.

## Costruiscila con Claude

La trappola delle superfici è che una mod può sembrare corretta sulla superficie che provi e rompersi su un'altra. Per questo il prompt chiede a Claude di controllare la tabella degli elementi prima di usare un elemento, e di testare ogni superficie:

> Usando la skill plugin-authoring, aggiungi alla mia mod di Claude Code `greeter` una banda sopra il prompt: un hook `ui.render` su `AbovePrompt` che mostri il numero di chiamate a strumenti e la superficie su cui viene disegnata, e che restituisca `next(e)` quando `e.props.hasSurvey` è true. Prendi gli elementi da `$.ui.resolve(e)`. Poi disegna un `Pane` con l'id di richiesta `notes` che mostri un campo di testo solo dove la superficie ha `Input` e non è mobile, e la riga "Ask Claude to add a note." in tutti gli altri casi. Scrivi un test con `claude-code/testing` che monti il pannello su `terminal`, `desktop`, `vscode` e `mobile` in un unico ciclo.

Quando Claude risponde, controlla:

1. Gli elementi vengono da `$.ui.resolve(e)`. Nessuno è importato o dato per scontato.
2. Ogni elemento che non è in tutte e quattro le tabelle (`Input`, `Svg`, `Raster`, `Image`, `Client`) viene controllato prima dell'uso, con un'alternativa.
3. Il test percorre tutte e quattro le superfici.
4. Nessun hook di render chiama `$.state.set`.

Anche se usi solo il terminale, quel ciclo di test è il modo in cui scopri se la mod regge nell'app desktop e su un telefono.

## Capisci il codice, passo dopo passo

Ecco come appare una buona risposta. Leggila per capire perché c'è ogni controllo e per confrontarla con ciò che ha scritto Claude.

### 1. Una banda che legge la propria superficie

```tsx
import { atom, read } from 'claude-code'
import type { Register } from 'claude-code'

const calls = atom({ plugin: 'greeter', key: 'calls' } as const, 0)

export const register: Register = (on) => {
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const count = await read($, calls)
    const where = e.surface === 'terminal' ? 'in the terminal' : `on ${e.surface}`

    return (
      <Box>
        <Text dimColor>
          {count} tool calls {where}
        </Text>
      </Box>
    )
  })
}
```

`Box` e `Text` sono in ogni tabella, quindi questo albero si disegna ovunque venga sollevata la banda. L'hook cede il posto a un sondaggio (`e.props.hasSurvey`) restituendo `next(e)`.

### 2. Usa un elemento solo dove la superficie lo ha

Quando un albero ha bisogno di un elemento che alcune superfici non hanno, controlla la tabella invece di darlo per scontato. Questo è adattato dall'hook `Pane` nel `hooks/register.tsx` di narsil-check, che mostra un SVG solo dove c'è `Svg` e un campo di testo ovunque tranne che su mobile:

```tsx
on('ui.render', { component: 'Pane', requestId: 'notes' }, async ($, e) => {
  const elements = $.ui.resolve(e)
  const { Box, Text } = elements
  const Input = e.surface !== 'mobile' && 'Input' in elements ? elements.Input : undefined

  return (
    <Box flexDirection="column">
      <Text bold>Notes</Text>
      {Input ? (
        <Input key="new" label="New note" onSubmit={() => undefined} />
      ) : (
        <Text dimColor>Ask Claude to add a note.</Text>
      )}
    </Box>
  )
})
```

Lo stesso controllo con `'Svg' in elements` lascia il terminale, che non ha `Svg`, su un'alternativa testuale.

### 3. Adattati allo spazio che ricevi

Un hook di `Pane` o di `AbovePrompt` dimensiona il suo albero su `e.props.bodyColumns`, il riquadro in cui disegna. È più stretto del viewport mentre un pannello è agganciato accanto alla trascrizione. Un cambio di larghezza riesegue ogni punto agganciato, quindi un albero dimensionato a partire da `bodyColumns` resta corretto.

### 4. Testalo su ogni superficie

`claude plugin test` monta un componente su una superficie che il test indica, mai su una presunta. Ripeti lo stesso corpo in un ciclo sulle superfici:

```tsx
for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
  const ui = await $.ui.mount({ ...PANE, surface })
  expect(await ui.find({ type: 'Text', text: /Notes/ })).toBeDefined()
  await ui.unmount()
}
```

`PANE` contiene `plugin`, `component`, `requestId` e `props`, come nell'esempio `pane.test.tsx` della skill.

## Errori comuni e come testarlo

- **Dare per scontata la tabella di una superficie.** `Svg` non è nella tabella del terminale, e `Raster` e `Image` sono solo in quella del terminale. Controlla la tabella (`'Svg' in elements`) o restringi `e.surface`, e i tipi ti dicono quali elementi puoi usare.
- **Un albero che non supera la validazione.** Un elemento che la superficie non ha, una prop che non accetta o un figlio dove non ne vanno fa fallire l'hook. Viene saltato da solo, e le parti degli altri plugin si disegnano comunque. Il log di debug, e la trascrizione mentre una cartella di plugin si ricarica a caldo, indicano il motivo.
- **Contare su `Input` su mobile.** Un'app mobile che non lo disegna non mostra nulla al suo posto. Offri un'altra strada, per esempio chiedere a Claude tramite uno strumento registrato.
- **Aspettarsi la banda ovunque.** In questa build il file di dichiarazioni solleva `AbovePrompt` solo sulle superfici terminale, desktop e mobile. Un `Pane` viene sollevato su ogni superficie collegata.
- **Una sola superficie nei test.** Un test che monta solo `terminal` non dimostra nulla sulle altre. Ripetilo in un ciclo su tutte e quattro.

## Per andare oltre

Il README di narsil-pet dice che la sua banda, le animazioni, i consigli e le barre di consumo funzionano ovunque Claude Code li disegni, ed elenca il terminale, l'app desktop, VS Code e l'app mobile. La voce, le notifiche e la finestra flottante girano sul computer dove gira la sessione, quindi dipendono da quel sistema e non dalla superficie. Il suo hook `ui.render` su `AbovePrompt` in `hooks/register.tsx` registra quali superfici hanno chiesto la banda, e `surfaceReport` combina questa informazione con `$.session.surfaces()`.

Il README di narsil-check ha una tabella per superficie: le sezioni di aggiornamenti, vulnerabilità e attività in sospeso funzionano su ogni superficie, l'app mobile non ha un campo per scrivere attività (si aggiungono chiedendolo a Claude), e le sezioni di ambiente, connettori e controllo remoto compaiono solo nell'app desktop, perché vengono lette dai server MCP propri dell'app desktop. In `hooks/register.tsx`, l'hook `Pane` ottiene `Svg` e `Input` dalla tabella come nel passo 2.
