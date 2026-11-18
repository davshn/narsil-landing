---
title: Reazioni ai comandi
description: 'Come Narsil legge i comandi di shell che Claude esegue: festeggia i test che passano, nota quelli che falliscono e avvisa dei comandi irreversibili senza mai bloccarli.'
route: pet
order: 9
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/watch.ts
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Cosa fa

Ogni volta che Claude esegue un comando di shell (lo strumento `Bash` o `PowerShell`), Narsil legge la riga di comando e reagisce a due tipi di comando.

**Test.** Quando il comando esegue i test di un progetto, Narsil aspetta il risultato:

- Se riesce, festeggia nella fascia: "¡Los tests pasan! 🎉" ("i test passano!"), e guadagna 5 punti esperienza.
- Se fallisce, sussulta (la posa "spaventata" delle guide precedenti) e dice "Los tests fallan; vamos a ver por qué." ("i test falliscono; vediamo perché").
- La volta successiva in cui passano dopo un fallimento, dice "¡Recuperados! Los tests vuelven a pasar." ("recuperati! i test passano di nuovo").

Il README elenca i runner che riconosce: npm, pnpm, yarn, bun, vitest, jest, pytest, go, cargo, dotnet, maven, gradle e altri.

**Comandi che non si possono annullare.** Prima che un comando del genere venga eseguito, il commento della fascia si trasforma in un avviso, "⚠️ Cuidado: … no tiene vuelta atrás." ("attenzione: … non si può annullare"), con il nome del tipo di comando nello spazio vuoto. Una riga va anche nel log del terminale, con la prima riga del comando. Poi il comando prosegue come al solito. Il README lo dice chiaramente: "Solo avisa: nunca bloquea nada." (avvisa soltanto, non blocca mai nulla).

Cosa ti dà: un'occhiata alla fascia ti dice se l'ultima esecuzione dei test è passata, e un comando distruttivo riceve un secondo paio d'occhi mentre la finestra di dialogo dei permessi, se c'è, è ancora sullo schermo.

## Come funziona dentro

### Un hook davanti a ogni strumento: `tool.call`

Entrambe le reazioni vivono nell'hook `tool.call` in `hooks/register.tsx`. Un hook `tool.call` avvolge la chiamata: il codice prima di `next(e)` viene eseguito prima dello strumento, e `await next(e)` restituisce il risultato dello strumento. È questa forma che permette a Narsil di avvisare prima del comando e di reagire ai test dopo.

L'hook scarta prima ciò che non è lavoro di Claude:

- Anche una chiamata fatta da un'altra mod (con `$.tool.call` o `$.mcp.call`) solleva `tool.call`. `isClaudesCall` in `hooks/watch.ts` tiene solo le chiamate il cui `next.origin.plugin` è `"engine"`. Il commento spiega il bug che ha corretto: nessun turno chiude una chiamata fatta da un'altra mod, quindi lasciava Narsil "al lavoro" fino al prompt successivo (`21df208`).
- Solo `Bash` e `PowerShell` portano una riga di comando (`SHELL_TOOLS` in `hooks/words.ts`). Per ogni altro strumento il comando è la stringa vuota, e nessuna delle due reazioni può scattare.

A differenza dello stato della fascia, questa parte non salta i subagenti: anche un test eseguito da un subagente viene festeggiato.

### Riconoscere un'esecuzione dei test

`TEST_COMMAND` in `hooks/words.ts` è una sola espressione regolare sulla riga di comando:

```ts
export const TEST_COMMAND =
  /\b(?:(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?test|(?:go|cargo|dotnet|mvn|gradle|gradlew|deno|mix)\s+test|claude\s+plugin\s+test|python3?\s+-m\s+(?:pytest|unittest)|vitest|jest|pytest|mocha|phpunit|rspec)\b/
```

Cerca in qualsiasi punto della riga, quindi conta anche un comando che prima cambia directory e poi esegue i test.

Se i test sono passati non viene letto dal loro output. Narsil guarda solo `result.isError`, il verdetto dello strumento stesso sulla chiamata. Analizzare l'output di una dozzina di runner, ciascuno con il proprio formato di riepilogo, si romperebbe a ogni nuovo runner o versione; il flag di errore dello strumento è lo stesso segnale per tutti, ed è anche quello su cui si basa un job di CI. Il prezzo è che Narsil sa solo "passati" o "falliti", non quanti.

Una variabile di modulo, `areTestsFailing`, ricorda che l'ultima esecuzione è fallita. È quel solo flag a trasformare il successo successivo in "recuperati" invece di un semplice festeggiamento.

Un fallimento alimenta anche i consigli della guida 11: il testo dell'errore viene conservato, e due fallimenti dello stesso strumento in un turno chiedono un consiglio di debug.

### Riconoscere un comando pericoloso

`DANGEROUS_COMMANDS` in `hooks/words.ts` è un elenco di coppie: il nome con cui Narsil avvisa, e il pattern che lo trova. Un estratto, ridotto ai pattern:

```ts
const DANGEROUS_COMMANDS: readonly (readonly [name: string, pattern: RegExp])[] = [
  ['rm -rf', /\brm\s+(?:-[a-zA-Z]*(?:[rR]f|f[rR])[a-zA-Z]*|-[rR]\s+-f|-f\s+-[rR])\b/],
  ['git push --force', /\bgit\s+push\b[^|;&\n]*\s(?:--force(?!-with-lease)|-f)\b/],
  ['git reset --hard', /\bgit\s+reset\s+--hard\b/],
  ['Remove-Item -Recurse -Force', /\bRemove-Item\b(?=[^|;\n]*-Recurse\b)(?=[^|;\n]*-Force\b)/i],
  ['DROP', /\bdrop\s+(?:table|database|schema)\b/i],
  // ... also git clean -f, git branch -D, chmod -R 777, mkfs, dd onto a device
  // and 'descargar y ejecutar' (download and run): curl, wget or
  // Invoke-WebRequest piped into a shell
]
```

Alcuni dettagli mostrano la cura nei pattern:

- Il push forzato esclude `--force-with-lease`, la variante che si rifiuta di sovrascrivere lavoro che non ha visto.
- `[^|;&\n]*` tiene il flag dentro lo stesso comando: un `--force` dopo una pipe o un `;` appartiene a un altro comando.
- Il pattern di `rm` accetta i flag uniti in qualsiasi ordine o scritti separati.
- Quello di PowerShell richiede sia `-Recurse` sia `-Force`, in qualsiasi ordine, con dei lookahead.

`dangerOf(command)` restituisce il nome del primo pattern che corrisponde, oppure `null`.

### Perché avvisa invece di negare

Un hook `tool.call` potrebbe rifiutare la chiamata: i tipi della 2.1.325 documentano `{ deny: reason }` come risposta, e il modello riceve allora il testo come risultato di errore. Narsil non lo fa mai. Né il codice né il README dicono esplicitamente perché; il README afferma solo che non blocca mai. Le ragioni qui sotto sono la lettura che questa guida dà del codice e dei tipi:

- **I pattern sono supposizioni.** Cancellare ricorsivamente una cartella di build è routine in molti script. Un blocco a ogni corrispondenza fermerebbe lavoro legittimo, e il modello cercherebbe un altro modo per fare la stessa cosa. I pattern inoltre si lasciano sfuggire delle cose (nomi lunghi delle opzioni, un file di script che contiene il comando), quindi un blocco prometterebbe una sicurezza che non può dare.
- **Claude Code ha già il lucchetto.** I tipi descrivono `tool.check` come qualcosa che scatta "after the `tool.call` and PreToolUse hooks and before the mode settles an ask" (dopo gli hook `tool.call` e PreToolUse e prima che la modalità risolva una richiesta). Le regole dei permessi e la finestra di dialogo dei permessi sono il punto in cui un comando viene fermato; l'avviso di Narsil arriva prima di quella decisione, mentre puoi ancora rispondere di no.
- **L'hook di una mod è comunque una protezione debole.** I tipi avvertono che "a guard that fails is skipped and the tool runs" (una protezione che fallisce viene saltata e lo strumento viene eseguito). Una protezione vera richiede una cura che Narsil, come compagna, non ha bisogno di prendersi.

### Cosa mostra

Le reazioni passano per `setMood`, l'unico punto di ingresso della prima guida: l'umore resta quello dello strumento ("in esecuzione" per una shell, "spaventata" in caso di fallimento), e la riga del commento porta l'avviso o il festeggiamento. La riga del log del terminale viene scritta con `$.ui.log`, tagliata alla prima riga del comando e a 120 caratteri. L'avviso viene impostato prima di `next(e)`, così è sullo schermo mentre il comando aspetta il permesso o viene eseguito.

## Costruiscila con Claude

Chiedi a Claude un hook `tool.call` che legga i comandi della shell, avvisi prima dei comandi che non si possono annullare e reagisca ai risultati dei test. L'unica idea che Claude deve fare bene: l'hook avvisa, e non blocca mai.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Nella mia mod di Claude Code `my-pet`, aggiungi un hook `tool.call` che reagisca ai comandi di shell. Salta le chiamate il cui `next.origin.plugin` non è `"engine"`, e gli strumenti diversi da `Bash` e `PowerShell`. Prima di chiamare `next(e)`, confronta `e.command` con un elenco di espressioni regolari con un nome per i comandi che non si possono annullare (cancellazione ricorsiva forzata, push forzato ma non `--force-with-lease`, reset hard, eliminazione di una tabella); in caso di corrispondenza, scrivi un avviso con il nome in un atom mostrato nella fascia `AbovePrompt` e registralo con `$.ui.log`, e non restituire mai `{ deny }`. Dopo `next(e)`, se il comando corrisponde a un pattern di runner di test, mostra "I test passano" quando `result.isError` è false e "I test falliscono" quando è true, e "Recuperati" quando passano dopo un fallimento. Aggiungi test con `claude-code/testing` in cui allo strumento risponde un hook, così niente viene eseguito davvero.

### Cosa controllare nella risposta di Claude

1. L'hook salta le chiamate il cui `next.origin.plugin` non è `"engine"`, e ogni strumento diverso da `Bash` e `PowerShell`.
2. L'avviso viene impostato prima di `next(e)`, così è sullo schermo mentre il comando attende il permesso o è in esecuzione.
3. Nessun percorso dell'hook restituisce `{ deny }`.
4. Il successo o il fallimento si legge da `result.isError`, non dall'output dei test, e un flag ricorda un fallimento, così il successo seguente dice "Recovered".
5. I test rispondono allo strumento da un hook, così nessun comando distruttivo viene eseguito davvero.

Se un controllo fallisce, di' a Claude cosa vedi: "l'avviso compare solo dopo che il comando è finito", oppure "il pet resta nello stato di lavoro dopo che un'altra mod chiama uno strumento".

### Come l'ha chiesta l'autore

La richiesta originale per queste reazioni non è stata registrata. Sono arrivate il 2026-10-30, prima dei log pubblici dei task del progetto (`odd/tasks/fleet-view.md` inizia il 2026-11-06 e non le menziona).

#### Ricostruzione dalla cronologia dei commit

Da `git log -- hooks/register.tsx hooks/words.ts hooks/watch.ts` in narsil-pet:

- `c885292` (2026-10-30) "feat: estimate when the context fills, react to tests and dangerous commands, show subagents" (stima quando si riempie il contesto, reagisce ai test e ai comandi pericolosi, mostra i subagenti). Il pattern dei test, l'elenco dei comandi pericolosi e il flag "recuperati" arrivano insieme in questo commit, dentro l'hook `tool.call`.
- `8913cdd` (2026-10-30) "feat: let Narsil earn experience and levels kept across sessions" (permette a Narsil di guadagnare esperienza e livelli conservati tra le sessioni). I test che passano iniziano a far guadagnare esperienza.
- `0cfc369` (2026-10-31) "refactor: move Narsil's wording and labels out of the hooks module" (sposta i testi e le etichette di Narsil fuori dal modulo degli hook). I pattern passano a `hooks/words.ts`, dove si trovano oggi.
- `21df208` (2026-11-06) "fix: ignore tool calls other mods make, so Narsil no longer sticks at working" (ignora le chiamate agli strumenti fatte da altre mod, così Narsil non resta più bloccata su al lavoro). Il filtro `isClaudesCall` descritto sopra.

I pattern stessi non sono cambiati da quando sono stati scritti: `git log -S` li trova solo nel primo commit e nello spostamento.

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida. Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

Scritto per questa guida e verificato con i tipi della 2.1.325 (`tool.call`, `next.origin`, `$.ui.log`, `ui.render`). È adattato da `hooks/register.tsx` e `hooks/words.ts` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). L'atom `line` è dichiarato in `types/index.d.ts` come nella prima guida, con il tipo `string`.

```tsx
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const line = atom({ plugin: 'my-pet', key: 'line' } as const, '')

const TEST =
  /\b(?:(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?test|vitest|jest|pytest|cargo\s+test|go\s+test)\b/
const DANGER: readonly (readonly [string, RegExp])[] = [
  ['rm -rf', /\brm\s+(?:-[a-zA-Z]*(?:[rR]f|f[rR])[a-zA-Z]*|-[rR]\s+-f|-f\s+-[rR])\b/],
  ['git push --force', /\bgit\s+push\b[^|;&\n]*\s(?:--force(?!-with-lease)|-f)\b/],
  ['git reset --hard', /\bgit\s+reset\s+--hard\b/],
]
let testsFailing = false

export const register: Register = (on) => {
  on('tool.call', async ($, e, next) => {
    if (next.origin.plugin !== 'engine') return next(e)
    if (e.tool !== 'Bash' && e.tool !== 'PowerShell') return next(e)
    const command = e.command

    const danger = DANGER.find(([, pattern]) => pattern.test(command))?.[0]
    if (danger) {
      $.ui.log(`⚠️ my-pet: ${danger} cannot be undone: ${command.split('\n')[0]!.slice(0, 120)}`)
      await update($, line, () => `⚠️ Careful: ${danger} cannot be undone.`)
    }

    // Warn only: the call always goes on to the engine.
    const result = await next(e)

    if (TEST.test(command)) {
      const text = result.isError
        ? 'The tests fail; let us see why.'
        : testsFailing
          ? 'Recovered! The tests pass again.'
          : 'The tests pass! 🎉'
      testsFailing = !!result.isError
      await update($, line, () => text)
    }
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const text = await read($, line)
    if (!text) return next(e)
    const { Text } = $.ui.resolve(e)
    return <Text wrap="truncate-end">{text}</Text>
  })
}
```

## Errori comuni e come testarlo

- **Reagire alle chiamate di altre mod.** Anche il `$.tool.call` di un'altra mod solleva `tool.call`, e nessun turno lo chiude. Controlla `next.origin.plugin === 'engine'` (`21df208`).
- **Avvisare a cose fatte.** Un avviso impostato dopo `await next(e)` arriva quando il comando è già stato eseguito. Impostalo prima.
- **Trasformare l'avviso in un blocco.** Restituire `{ deny }` a una corrispondenza di pattern ferma lavoro legittimo e invita il modello a trovare un modo per aggirarlo. Lascia la decisione al sistema dei permessi.
- **Fidarsi troppo del flag di errore.** Un comando che nasconde il proprio stato di uscita (passare l'esecuzione dei test in pipe a un altro programma, o terminarla con un fallback che riesce sempre) risulta come passato. Narsil non può accorgersene, e nemmeno la tua copia.
- **Testare con comandi distruttivi veri.** Non eseguirli mai per vedere l'avviso. In un test, rispondi allo strumento da un hook così che niente venga eseguito.

Per testare, `claude plugin test .` esegue `tests/narsil.test.tsx`. "a dangerous command is flagged before it runs, and an ordinary one is not" (un comando pericoloso viene segnalato prima di essere eseguito, e uno ordinario no) risponde a ogni `tool.call` da un hook con `{ result: {} }`, così nessun comando raggiunge una shell, e legge la riga del commento inviata alla finestra mobile nel momento in cui arriva ogni chiamata. Si aspetta i quattro avvisi per quattro comandi distruttivi, e nessun avviso per un push ordinario. "tests that pass are cheered, and failing ones are noticed until they pass again" (i test che passano vengono festeggiati, e quelli che falliscono vengono notati finché non passano di nuovo) copre il festeggiamento, il fallimento e il recupero.

## Per andare oltre

- `describeCall` in `hooks/words.ts` costruisce il dettaglio della fascia per ogni strumento (il nome di un file, la prima riga di un comando); le reazioni riutilizzano lo stesso dettaglio.
- `gainXp($, 'tests')` aggiunge i 5 punti; `hooks/xp.ts` contiene le quantità e i livelli.
- I fallimenti che questo hook registra (`seen.failures`) fanno parte di ciò che i consigli della guida 11 inviano al modello.
- `DANGEROUS_COMMANDS` è facile da estendere: un nome e un pattern per riga. Tieni ogni pattern dentro un solo comando con `[^|;&\n]`, come fanno quelli esistenti.
