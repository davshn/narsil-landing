---
title: 'Riutilizzare il codice di Narsil: la GPL v3'
description: Entrambe le mod di Narsil hanno licenza GPL-3.0-or-later. Cosa significa quando studi, modifichi o condividi codice preso da esse.
route: mods
order: 5
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: LICENSE
  - repo: pet
    path: .claude-plugin/plugin.json
  - repo: pet
    path: README.md
  - repo: check
    path: LICENSE
  - repo: check
    path: .claude-plugin/plugin.json
  - repo: check
    path: README.md
---

## Cosa fa

narsil-pet e narsil-check sono open source, e le guide di questo sito ne citano e adattano il codice. Quando chiedi a Claude di costruire una mod basata su queste guide, il risultato può includere codice preso da lì. Questa guida spiega, in parole semplici, cosa ti permette di fare la loro licenza con quel codice e cosa ti chiede quando lo passi ad altri.

Questa non è una consulenza legale. Riassume il testo della licenza distribuito con entrambe le mod. Per una decisione importante, leggi la licenza completa e rivolgiti a un avvocato.

## Come funziona dentro

Entrambe le mod hanno la stessa licenza:

- `plugin.json` imposta `"license": "GPL-3.0-or-later"`.
- Il file `LICENSE` del repository è il testo completo della GNU General Public License, versione 3.
- Il README dice che la mod può essere ridistribuita e modificata secondo la GPL v3 o, a tua scelta, qualsiasi versione successiva pubblicata dalla Free Software Foundation.

La licenza distingue due situazioni:

| Situazione                                                                                        | Cosa dice la GPL v3                                                                                                                               |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Usi o modifichi il codice senza darne copie a nessuno                                             | Puoi crearlo, eseguirlo e modificarlo senza condizioni, finché la tua licenza resta in vigore (sezione 2).                                        |
| Lo trasmetti (in inglese "convey"): ne dai o ne rendi disponibili copie ad altri, modificate o no | Si applicano delle condizioni (sezioni da 4 a 6). Interagire con un programma attraverso una rete senza trasferirne una copia non è trasmetterlo. |

Quando trasmetti il codice, le condizioni principali sono:

- **Sorgente non modificato (sezione 4):** mantieni intatti gli avvisi di copyright e di licenza, mantieni gli avvisi di assenza di garanzia e dai a chi lo riceve una copia della licenza.
- **Sorgente modificato (sezione 5):** l'opera deve riportare "prominent notices stating that you modified it", cioè avvisi ben visibili che dichiarano che l'hai modificata, con una data pertinente; deve dire che è rilasciata con questa licenza; e devi concedere in licenza l'intera opera, nel suo insieme, secondo la GPL v3 a chiunque ne riceva una copia.
- **Altre forme (sezione 6):** trasmettere l'opera in una forma diversa dal sorgente richiede di trasmettere anche il sorgente corrispondente.

Una mod si distribuisce come file sorgente, quindi in pratica condividere una mod costruita con codice di Narsil significa condividere quel sorgente secondo la GPL v3.

## Costruiscila con Claude

Preparare una mod per condividerla è un buon lavoro per Claude: è un lavoro accurato e ripetitivo. Chiedi:

> La mia mod di Claude Code `my-band` include codice adattato da narsil-pet (https://github.com/davshn/narsil-pet), che ha licenza GPL-3.0-or-later. Preparala per la condivisione: aggiungi il testo della GPL v3 come `LICENSE`, copiato dal file `LICENSE` di narsil-pet, non scritto a memoria; imposta `"license": "GPL-3.0-or-later"` in `.claude-plugin/plugin.json`; e in cima a ogni file con codice di narsil-pet, aggiungi un commento che indichi il repository e il file originali, cosa ho cambiato con la data di oggi, e la licenza. Mantieni gli avvisi che c'erano già. Poi esegui `claude plugin validate` e dimmi se riporta ancora `LICENSE_MISSING`.

Quando Claude risponde, controlla:

1. `LICENSE` contiene il testo completo della GPL v3, non un riassunto. Confronta le sue prime righe con il `LICENSE` di narsil-pet.
2. `plugin.json` dice `GPL-3.0-or-later`.
3. Ogni file adattato indica la sua origine e cosa è cambiato.
4. `claude plugin validate` non riporta più `LICENSE_MISSING`.

Claude può scrivere gli avvisi, ma la decisione di condividere, e come, spetta a te. Né Claude né questa guida danno consulenza legale.

## Cosa significa ogni passo

I passi qui sotto spiegano perché serve ogni modifica, così puoi controllare il lavoro di Claude e spiegarlo ad altri.

### 1. Decidi se la condividerai

Se la mod resta sul tuo computer, le condizioni per la trasmissione non si applicano. Appena pubblichi un repository, invii un file `.plugin` o passi la cartella a qualcuno, si applicano.

### 2. Mantieni la licenza

Includi il testo della GPL v3 come file `LICENSE` e imposta la licenza nel tuo manifest:

```json
{
  "name": "my-band",
  "version": "0.1.0",
  "description": "A status band adapted from narsil-pet",
  "license": "GPL-3.0-or-later"
}
```

Mantieni "or later" solo se mantieni l'opzione che dà l'originale. Non sostituire la licenza con una più permissiva per le parti che vengono da Narsil.

### 3. Indica cosa hai preso e cosa hai cambiato

Indica la fonte e la modifica vicino al codice. Un'intestazione come questa copre l'attribuzione, il link al repository e l'avviso di modifica:

```ts
// Adapted from narsil-pet (https://github.com/davshn/narsil-pet), hooks/register.tsx.
// Changed 2026-11-17: renamed the band and removed the floating window.
// Licensed under the GNU General Public License, version 3 or later.
```

Mantieni gli avvisi che c'erano già nei file che hai copiato.

### 4. Rendi disponibile il sorgente

Pubblica il sorgente completo della mod che condividi, non solo i file che hai preso da Narsil. La licenza si applica all'intera opera.

## Errori comuni e come testarlo

- **Distribuire senza un file di licenza.** `claude plugin validate` riporta `LICENSE_MISSING` tra i controlli della directory dei plugin quando non c'è un file `LICENSE` né una `license` in `plugin.json`. Eseguilo prima di condividere.
- **Cambiare la licenza del codice copiato.** Il codice preso da Narsil non può essere condiviso con licenza MIT, Apache o proprietaria.
- **Eliminare l'attribuzione.** Rimuovere il link al repository originale o l'avviso che hai modificato il codice va contro le condizioni sugli avvisi.
- **Condividere solo una parte del sorgente.** Chi riceve la mod deve poter ottenere il sorgente dell'intera mod.

Prima di condividere, verifica che la tua cartella contenga il testo della licenza, che `plugin.json` indichi la licenza e che ogni file adattato dica da dove viene e cosa è cambiato.

## Per andare oltre

Leggi il file `LICENSE` in uno dei due repository per il testo completo; le sezioni 2, 4, 5 e 6 sono quelle riassunte qui. La sezione sulla licenza alla fine di ogni README dà il riassunto breve del progetto stesso: puoi usare, studiare, modificare e condividere la mod, e una versione modificata che distribuisci deve essere pubblicata anch'essa come open source con la stessa licenza, senza garanzia. Le guide di questo sito seguono la stessa pratica: ogni frammento adattato da Narsil indica il suo repository e il suo file, e ogni guida elenca quei file tra le sue fonti.

Se una mod che scrivi da zero, dopo aver letto il codice di Narsil, conti come opera basata su di esso è una questione legale a cui questa guida non risponde.
