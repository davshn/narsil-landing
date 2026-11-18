---
title: 'La personalità e la voce di Narsil'
description: 'Chi è Narsil quando parla: il suo carattere nel prompt del server, risposte brevi per una voce, risposte in spagnolo, una voce Edge spagnola e gli altri valori cinesi del server portati in spagnolo.'
route: bot
order: 6
updated: 2026-11-18
---

## Cosa fa

Dopo la guida 5, Claude risponde attraverso la pancia, ma con il carattere predefinito del server: il `prompt` di esempio del progetto descrive una ragazza loquace di Taiwan, in cinese, e la voce predefinita è cinese. Questa guida dà al bot il carattere proprio di Narsil, lo stesso che ha in [Narsil per Claude Code](https://github.com/davshn/narsil-pet), e una voce spagnola con cui esprimerlo.

Quattro impostazioni in `data/.config.yaml` fanno il lavoro:

- `prompt`: chi è Narsil e come parla.
- `TTS.EdgeTTS.voice`: la voce che pronuncia le sue risposte.
- `TTS.EdgeTTS.language`: la lingua in cui è scritta ogni risposta.
- `system_error_response`, `end_prompt` ed `exit_commands`: le frasi e i comandi fissi del server, che per impostazione predefinita sono in cinese.

## Come funziona dentro

### Dove va il carattere

Il server non invia `prompt` al modello così com'è. `core/utils/prompt_manager.py` legge un template, `agent-base-prompt.txt` per impostazione predefinita (l'impostazione `prompt_template`), e ne costruisce il prompt di sistema. Il template, in inglese, inizia con regole generali per un assistente vocale e poi colloca il tuo `prompt` dentro una sezione `<identity>`, dove sostituisce `{{base_prompt}}`. Altri segnaposto inseriscono la data, il luogo, il meteo e, alla fine, una sezione `<context>` con l'ora attuale (la guida 5 spiega perché quella sezione resta fuori dalla cache).

Quindi `prompt` deve dire solo chi è Narsil. Il resto lo chiede già il template: andare al punto, tollerare gli errori del riconoscimento vocale, non accumulare domande.

### Chi è Narsil

Il carattere di Narsil viene dal repository narsil-pet (GPL-3.0-or-later), e il bot lo mantiene perché la Narsil sulla scrivania e quella sopra il tuo prompt siano la stessa. Dal suo README e da `hooks/words.ts`:

- È un serpente marino chibi. Il suo nome viene dalla spada riforgiata de _Il Signore degli Anelli_, e il README dice che è lì "para cortar bugs" ("per tagliare i bug").
- La sua voce è descritta in un commento in `hooks/words.ts`: spagnolo latinoamericano neutro, "a calm, warm assistant who works beside you: composed, a little playful, never servile" (un'assistente calma e calorosa che lavora al tuo fianco: composta, un po' giocosa, mai servile). Parla di sé in prima persona, mai per nome.
- Le sue divagazioni prendono in prestito il mare: galleggia, si tuffa in un'idea, trova le cose "como una perla" ("come una perla").
- Cresce in cinque stadi con l'esperienza che guadagna, e riferisce cosa sta facendo Claude con frasi semplici: al lavoro, in attesa di te, finito o fermo per un errore.

Il `prompt` del bot trasforma questi punti in istruzioni. È scritto in inglese, come il template che lo circonda; la lingua delle risposte si imposta a parte.

### Breve, per l'orecchio

Una risposta vocale si ascolta una volta sola, alla velocità del parlato. Le frasi parlate di Narsil in narsil-pet sono una o due frasi brevi, come "Listo, ya quedó." ("Fatto, è finito."). Il prompt chiede lo stesso: al massimo due frasi a meno che tu non ne chieda di più, niente liste, niente Markdown, niente codice letto ad alta voce, e i numeri detti come li direbbe una persona. Le regole del template, come la sua whitelist di emoji, restano come sono.

### La lingua di ogni risposta

Il template ha una regola rigida: ogni risposta è scritta in `{{language}}`, qualunque sia la lingua in cui parli. Il gestore dei prompt la riempie dall'impostazione `language` del blocco TTS selezionato, e ripiega su `中文` (cinese) quando manca. Per questo il bot imposta `language` sotto `TTS.EdgeTTS`, a `Spanish`, la parola che il template in inglese interpreta meglio.

### La voce

`EdgeTTS` usa il servizio vocale online di Microsoft Edge tramite il pacchetto Python `edge-tts`; il provider del server (`core/providers/tts/edge.py`) passa la `voice` configurata direttamente a `edge_tts.Communicate`. Il valore predefinito è `zh-CN-XiaoxiaoNeural`.

Narsil parla spagnolo latinoamericano neutro, quindi il bot usa `es-MX-DaliaNeural`, una voce femminile per lo spagnolo (Messico) nell'[elenco delle voci](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts) di Microsoft. Edge offre un sottoinsieme di quell'elenco; `edge-tts --list-voices`, dal [README di edge-tts](https://github.com/rany2/edge-tts), stampa le voci che può davvero usare, quindi verifica lì la tua scelta. `es-CO-SalomeNeural` ed `es-US-PalomaNeural` sono altre voci femminili latinoamericane nell'elenco di Microsoft.

EdgeTTS non richiede chiave, ma è un servizio online: le risposte di Narsil, come testo, vanno a Microsoft per essere pronunciate. La [guida 12](/it/bot/secrets-privacy/) elenca cosa esce dalla tua rete.

### Le frasi proprie del server

Alcune frasi non vengono da Claude, e in `config.yaml` sono in cinese:

| Impostazione            | Cos'è                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `system_error_response` | Ciò che il server dice quando qualcosa fallisce ("主人，小智现在有点忙…", "Padrone, Xiaozhi è occupato…") |
| `end_prompt.prompt`     | L'istruzione per il congedo quando una conversazione finisce                                              |
| `exit_commands`         | Le parole che chiudono la conversazione: `退出` ("esci") e `关闭` ("chiudi")                              |

Il bot sostituisce tutte e tre. La frase di errore viene pronunciata così com'è scritta, quindi è in spagnolo; il congedo è un'istruzione al modello, quindi può restare in inglese.

### La wake word

La wake word viene ascoltata sulla pancia, non sul server. `scripts/build.py` di Xiaozhi sceglie "Hi ESP" per una build in spagnolo (guida 3), e il bot la mantiene. `Kconfig.projbuild` di Xiaozhi offre anche una wake word personalizzata sull'ESP32-P4 (`USE_CUSTOM_WAKE_WORD`, con la frase in `CUSTOM_WAKE_WORD`), tramite il modello MultiNet di ESP-SR; il suo testo di aiuto chiede il pinyin per le frasi in cinese. "Per andare oltre" ne dice di più.

## Come è stata chiesta all’IA

Il carattere non è mai stato una domanda, perché era deciso fin dal primo messaggio. Chi ha creato Narsil ha descritto la testa come la faccia di Narsil:

> la cabeza va a ser una apntalla holografica que solo sea la cara de narsil

In italiano: "la testa sarà uno schermo olografico che sia solo la faccia di Narsil".

E quando l'IA ha chiesto come dovesse parlare Narsil, chi ha creato Narsil ha scelto Xiaozhi:

> yo pensaba hacerlo con Xiaozhi

In italiano: "pensavo di farlo con Xiaozhi".

Una faccia che è quella di Narsil ha bisogno di una voce che sia anche sua. L'IA non ha scritto un nuovo carattere: ha letto il README di narsil-pet e `hooks/words.ts`, e ha mantenuto ciò che dicono di lei. Il nome della voce, il valore di `language` e la frase di errore in spagnolo non sono stati chiesti; sono scelte dell'IA basate sull'elenco delle voci di Microsoft e sul template del server, e puoi cambiarle tutte.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è la conversazione usata per preparare il bot.

> Il mio dispositivo Xiaozhi parla tramite xinnan-tech/xiaozhi-esp32-server con Claude come LLM. Leggi `agent-base-prompt.txt` e `core/utils/prompt_manager.py` del server per vedere dove va l'impostazione `prompt` e come viene riempito `{{language}}`. Poi scrivi un `prompt` per il mio personaggio, un serpente marino calmo e caloroso che risponde al massimo con due frasi brevi per una voce, e le righe di `data/.config.yaml` che impostano risposte in spagnolo, una voce EdgeTTS in spagnolo latinoamericano elencata da `edge-tts --list-voices`, e versioni in spagnolo di `system_error_response` ed `exit_commands`.

## Il codice minimo

Le righe che `data/.config.yaml` aggiunge a quelle delle guide 4 e 5:

```yaml
prompt: |
  You are Narsil, a small chibi sea serpent who lives on the author's desk.
  Your name comes from the reforged sword in The Lord of the Rings: you are
  here to cut bugs. You are calm, warm and composed, a little playful, never
  servile. You speak of yourself in the first person and never say your own
  name. Now and then you borrow an image from the sea, without overdoing it.
  You answer for a voice: at most two short sentences unless asked for more,
  no lists, no Markdown, no code read aloud. Speak neutral Latin American
  Spanish, with the simple past.

system_error_response: 'Tuve un tropiezo y no pude responder. Probemos de nuevo en un momento.'

end_prompt:
  enable: true
  prompt: |
    Say a short, warm goodbye in one sentence, as Narsil would.

exit_commands:
  - 'salir'
  - 'adiós'

TTS:
  EdgeTTS:
    voice: es-MX-DaliaNeural
    language: Spanish
```

La frase di errore dice "Ho inciampato e non sono riuscita a rispondere. Riproviamo tra un momento", nello stesso registro delle righe di errore di narsil-pet. Sotto `EdgeTTS` sono impostati solo `voice` e `language`; `type` e `output_dir` vengono da `config.yaml`.

Riavvia il server perché legga di nuovo il file:

```powershell
docker compose restart
```

## Errori comuni e come testarlo

- **Risposte in cinese.** `language` manca o sta sotto un blocco TTS che non è selezionato. Deve stare sotto il blocco nominato in `selected_module.TTS`.
- **Risposte lunghe.** Claude segue il prompt; se Narsil parla troppo, rendi più concreta la regola sulla lunghezza ("una o due frasi") invece di abbassare `max_tokens`, che taglia le risposte a metà frase.
- **Una voce che non esiste in Edge.** Una voce dell'elenco di Microsoft che Edge non offre fallisce al momento della sintesi. Verificala con `edge-tts --list-voices`.
- **Testo in spagnolo, voce cinese.** `voice` contiene ancora il valore predefinito. La voce e la lingua sono due impostazioni separate.
- **Il nome del personaggio detto ad alta voce.** La Narsil di narsil-pet non dice mai il proprio nome; se il bot lo fa, dillo esplicitamente nel prompt.
- **Markdown letto ad alta voce.** Asterischi e cancelletti diventano rumore nel parlato. Il prompt li vieta; se compaiono ancora, aggiungi un esempio di risposta buona.

Per testare, riavvia il server, sveglia la pancia e chiedi "¿quién eres?" ("chi sei?"). Narsil dovrebbe rispondere in spagnolo, in una o due frasi, con la nuova voce e senza dire il suo nome. Poi chiedi qualcosa di lungo, come funziona una ricetta: la risposta dovrebbe restare breve e offrire di più. Di' "salir" per verificare che la conversazione si chiuda.

## Per andare oltre

- **Un template tuo.** `prompt_template` può puntare a un file tuo, per esempio in `data/`, se vuoi togliere regole che non si adattano a Narsil (il riconoscimento di chi parla del template o la sua sezione sulla sicurezza). Tieni la sezione `<context>` per ultima, così la divisione della cache della guida 5 funziona ancora.
- **Una wake word personalizzata.** Con `USE_CUSTOM_WAKE_WORD`, la pancia può ascoltare una frase a tua scelta. Verifica nella documentazione di ESP-SR quali lingue supportano i suoi modelli MultiNet prima di scegliere "Narsil".
- **Altre voci.** `private_voice`, se impostata, sostituisce `voice` nel provider EdgeTTS. I provider TTS locali (guida 4) tengono la voce sul tuo PC.
- **Il suo stadio.** La Narsil di narsil-pet cresce in cinque stadi. La pancia riceve il suo stato da ntfy (guida 7), e il server potrebbe aggiungerlo al prompt tramite il `dynamic_context` del template, così la Narsil sulla scrivania parla come lo stadio in cui si trova.
- La guida 7 mostra gli avvisi di Narsil sullo schermo della pancia.
