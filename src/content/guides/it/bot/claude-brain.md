---
title: Claude come cervello
description: 'Un provider Anthropic nativo in Python per xiaozhi-esp32-server: come il server chiama un modello linguistico, la Messages API di Claude in streaming, il prompt caching, il costo e la chiave API.'
route: bot
order: 5
updated: 2026-11-18
---

## Cosa fa

Il server della guida 4 sente la tua voce e la trasforma in testo, ma non pensa. A ogni turno passa la conversazione a un modello linguistico (LLM) e pronuncia qualunque cosa ne esca. In questo bot quel modello è Claude.

Questa guida aggiunge un nuovo provider LLM a [xinnan-tech/xiaozhi-esp32-server](https://github.com/xinnan-tech/xiaozhi-esp32-server): un solo file Python che riceve la conversazione del server, la invia alla [Messages API di Claude](https://platform.claude.com/docs/en/api/overview) con l'[SDK Python ufficiale `anthropic`](https://github.com/anthropics/anthropic-sdk-python) e rimanda la risposta in streaming parola per parola, così la pancia inizia a parlare prima che Claude abbia finito di scrivere.

Verso Anthropic passa solo testo: ciò che ha capito il riconoscitore vocale, il prompt di sistema e i turni precedenti. Il tuo audio mai; resta tra la pancia e il PC (e il riconoscitore vocale che hai scelto nella guida 4).

## Come funziona dentro

### Come il server carica un modello linguistico

Il server sceglie il suo modello in `selected_module.LLM`, che nomina un blocco sotto `LLM:` nella configurazione. `core/utils/modules_initialize.py` legge il `type` di quel blocco (o il nome del blocco, quando non ha un `type`) e passa l'intero blocco a `core/utils/llm.py`, la cui `create_instance` cerca un file in:

```text
core/providers/llm/<type>/<type>.py
```

e costruisce la classe `LLMProvider` che trova lì, con il blocco come unico argomento. Il provider Gemini, `core/providers/llm/gemini/gemini.py`, è un buon modello da leggere: una cartella, un file, una classe.

Quindi `type: claude` significa un file `core/providers/llm/claude/claude.py`. La cartella si chiama `claude`, non `anthropic`, così non può mai essere confusa con il pacchetto dell'SDK che importa.

### L'interfaccia che implementa un provider

Ogni provider estende `LLMProviderBase` da `core/providers/llm/base.py`. Il suo contratto è piccolo:

- `response(self, session_id, dialogue)` è astratto e deve essere un **generatore**: restituisce (con `yield`) pezzi di testo man mano che arrivano. Il server li passa al sintetizzatore vocale frase per frase.
- `response_with_functions(self, session_id, dialogue, functions=None)` è la versione con chiamata di tool. La classe base lo implementa già chiamando `response` e restituendo coppie `(token, None)`, quindi un provider senza tool lo ottiene gratis.
- `response_no_stream` costruisce un dialogo di due messaggi e unisce ciò che restituisce `response`; non ti chiede niente.

`dialogue` è una lista di dizionari nella forma di chat che già conosci, `{"role": ..., "content": ...}`. La costruisce `core/utils/dialogue.py`: prima un messaggio `system` (il prompt di sistema già composto), poi i turni `user` e `assistant` della conversazione. Con la chiamata di tool attiva possono comparire anche messaggi `tool` e `tool_calls`.

`core/connection.py` chiama `response_with_functions` solo quando il modulo di intento è `function_call`; altrimenti chiama `response`. Il bot imposta `Intent: nointent`, quindi al provider basta `response`, e Claude si limita a parlare. I tool sono in "Per andare oltre".

### Dal dialogo del server alla Messages API

La Messages API vuole il prompt di sistema a parte, in un parametro `system`, e una lista `messages` di turni `user` e `assistant` che inizia con un turno `user`. Il provider converte:

1. I messaggi di sistema escono dalla lista e diventano il parametro `system`.
2. I turni dell'utente e dell'assistente restano, come testo.
3. Tutto ciò che precede il primo turno dell'utente (un saluto dell'assistente, per esempio) viene scartato, perché il primo messaggio deve essere dell'utente.

Poi apre uno stream con `client.messages.stream(...)` e restituisce dal suo `text_stream`, che fornisce il testo della risposta man mano che viene generato, esattamente ciò che vuole l'interfaccia a generatore del server. Gli [helper di streaming](https://github.com/anthropics/anthropic-sdk-python/blob/main/helpers.md) dell'SDK Python documentano entrambi.

### Perché l'API nativa e non quella compatibile con OpenAI

Il server ha già un provider `openai`, e Anthropic offre un [livello di compatibilità con l'SDK di OpenAI](https://platform.claude.com/docs/en/cli-sdks-libraries/libraries/openai-sdk), quindi puntare il provider esistente a Claude funzionerebbe. La pagina stessa di Anthropic spiega perché il bot non lo fa: dice che il livello "is primarily intended to test and compare model capabilities, and is not considered a long-term or production-ready solution for most use cases" (è pensato soprattutto per testare e confrontare le capacità dei modelli, e non è considerato una soluzione a lungo termine o pronta per la produzione per la maggior parte dei casi d'uso). La stessa pagina elenca cosa gli manca, e il primo pezzo mancante qui conta: il prompt caching "is not supported" (non è supportato) attraverso di esso. L'SDK nativo ha il caching, errori tipizzati e l'insieme completo dei parametri.

### Il modello, e quanto costa un turno

Il provider legge il modello dalla configurazione. L'esempio usa `claude-opus-5-5`, Claude Opus 5.5. Per un assistente vocale, `claude-haiku-5-5`, Claude Haiku 5.5, è la scelta più economica e più veloce; entrambi usano lo stesso codice. Prezzi dalla [pagina dei prezzi](https://platform.claude.com/docs/en/about-claude/pricing) di Anthropic, per milione di token, alla data di questa guida:

| Modello          | Input | Scrittura in cache da 5 minuti | Lettura dalla cache | Output |
| ---------------- | ----- | ------------------------------ | ------------------- | ------ |
| Claude Opus 5.5  | $4    | $5                             | $0.20               | $20    |
| Claude Haiku 5.5 | $0.10 | $0.125                         | $0.01               | $0.50  |

La riga di Haiku vale per prompt fino a 100.000 token, che una chat vocale non raggiunge mai.

Un turno vocale indicativo: il prompt di sistema del server è di qualche migliaio di caratteri (il suo template `agent-base-prompt.txt` più il carattere di Narsil della guida 6), circa 2.000 token; tu dici una frase, circa 20 token; Narsil risponde con due frasi brevi, circa 60 token di testo. Su Opus 5.5 sono circa $0.008 di input senza caching, circa $0.0004 con il caching, più circa $0.0012 di output. Su Haiku 5.5 l'intero turno è una piccola frazione di centesimo. Due cose fanno crescere il conto: la cronologia, che viene inviata di nuovo a ogni turno, e il ragionamento (thinking). Su Claude Opus 5.5 il ragionamento è sempre attivo e fatturato come output; il provider imposta `output_config.effort` a `low` perché una risposta vocale non ragioni a lungo. Controlla la pagina dei prezzi aggiornata prima di fare affidamento su questi numeri.

### Prompt caching

Il [prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) permette all'API di riutilizzare l'inizio di una richiesta che ha visto di recente. Segni un blocco con `cache_control: {"type": "ephemeral"}`; tutto ciò che arriva fino a quel segno viene conservato per cinque minuti, rinnovati gratis a ogni utilizzo. Una scrittura in cache costa 1,25 volte il prezzo dell'input; una lettura dalla cache costa 0,05 volte su Opus 5.5 e 0,1 volte su Haiku 5.5. Il prefisso deve essere di almeno 512 token su entrambi i modelli, altrimenti semplicemente non viene messo in cache, senza alcun avviso.

Il problema è che il caching è una corrispondenza di prefisso: cambia un carattere e tutto ciò che viene dopo è nuovo. Il template del server termina con una sezione `<context>` che contiene dati in tempo reale, e `core/utils/dialogue.py` sostituisce `{{current_time}}` con l'ora in formato `HH:MM` a ogni turno. Così il provider divide il prompt di sistema in `<context>`: la parte stabile va prima, con il segno di cache, e la parte di contesto va dopo, fuori dalla cache. La parte stabile supera ampiamente i 512 token.

### La chiave API

L'SDK legge la chiave dalla variabile d'ambiente `ANTHROPIC_API_KEY` quando il provider non ne passa una. Il provider accetta anche `api_key` nel suo blocco di configurazione, che vive in `data/.config.yaml` sul tuo PC (guida 4). In entrambi i casi la chiave resta sul PC e non entra mai in un repository.

Per ottenerne una:

1. Apri la [Claude Console](https://platform.claude.com/) e vai su **API keys** ([platform.claude.com/settings/keys](https://platform.claude.com/settings/keys)). Crea una chiave con un nome che dica dove vive, per esempio `narsil-bot-pc`. La Console la mostra una sola volta.
2. Imposta un limite mensile in [Spend limits](https://platform.claude.com/settings/spend-limits) (`platform.claude.com/settings/spend-limits`): accanto a **Monthly spend limit**, fai clic su **Adjust limit** o **Set limit**. Secondo la [pagina dei limiti di frequenza](https://platform.claude.com/docs/en/api/rate-limits), una volta raggiunto il tuo limite l'API risponde HTTP 400 fino al mese successivo o finché non lo alzi, quindi un ciclo fuori controllo costa al massimo quella cifra.
3. Per revocarla, elimina la chiave nella stessa pagina **API keys**. Le richieste che la usano smettono subito di funzionare; creane una nuova e aggiorna il PC.

## Costruiscila con Claude

Chiedi a Claude un nuovo provider di modello linguistico per lo xiaozhi-esp32-server: un solo file Python che chiami la Messages API di Claude tramite l'SDK ufficiale `anthropic`. L'unica idea che deve fare bene è che il provider è un generatore: restituisce il testo man mano che Claude lo scrive, così la pancia inizia a parlare prima che la risposta sia finita.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è la conversazione usata per preparare il bot.

> Eseguo xinnan-tech/xiaozhi-esp32-server in Docker. Scrivi un nuovo provider LLM che chiami Claude tramite l'SDK Python ufficiale `anthropic`, non l'endpoint compatibile con OpenAI. Prima leggi `core/providers/llm/base.py`, `core/providers/llm/gemini/gemini.py`, `core/utils/llm.py` e `core/utils/dialogue.py` per capire l'interfaccia e il formato del dialogo. Converti i messaggi di sistema nel parametro `system`, fai lo streaming con `messages.stream` e restituisci da `text_stream`, leggi il modello, `max_tokens` e la chiave API dal blocco di configurazione del provider, e metti in cache la parte stabile del prompt di sistema con `cache_control`. Mostrami la voce di `.config.yaml` e come aggiungere il file e l'SDK al container Docker.

### Cosa controllare nella risposta di Claude

1. Il file è `core/providers/llm/claude/claude.py`, la sua classe è `LLMProvider` ed estende `LLMProviderBase`, e il blocco di configurazione dice `type: claude`, così `create_instance` lo trova.
2. `response` apre `client.messages.stream(...)` e restituisce con yield il testo di `text_stream`. Usa l'SDK nativo, non l'endpoint compatibile con OpenAI, che non ha il prompt caching.
3. I messaggi di sistema diventano il parametro `system`, e tutto ciò che precede il primo turno dell'utente viene scartato, così `messages` inizia sempre con un turno `user`.
4. Il prompt di sistema è diviso in corrispondenza di `<context>`: la parte stabile porta `cache_control: {"type": "ephemeral"}`, e la parte con l'ora va dopo, senza cache.
5. La chiave API viene dalla variabile d'ambiente `ANTHROPIC_API_KEY` o da `api_key` in `data/.config.yaml` sul tuo PC. Non compare mai nel codice né in un repository, e la risposta ti ricorda di impostare un limite di spesa mensile nella Console.

Se un controllo fallisce, di' a Claude cosa vedi: "`usage.cache_read_input_tokens` è zero a ogni turno".

### Come l'ha chiesta l'autore

Questa guida nasce da una sola decisione. Nella guida 4, chi ha creato Narsil ha messo il server sul PC con una ragione:

> en el pc, igual la idea es usarlo para trabajar con claude

In italiano: "sul PC; tanto l'idea è usarlo per lavorare con Claude".

L'IA ha poi chiesto come il server dovesse raggiungere Claude. Ha offerto due opzioni: (1) un provider Anthropic nativo scritto in Python con l'Anthropic SDK, oppure (2) il provider di tipo OpenAI già presente nel server, puntato all'endpoint compatibile con OpenAI di Anthropic, senza codice nuovo. Ha citato la pagina di compatibilità di Anthropic e la sua nota secondo cui l'endpoint è pensato per test e confronti. Chi ha creato Narsil ha risposto:

> 1

Quella risposta è la specifica S5: un provider nativo. Il modello, il livello di effort e la divisione della cache non sono stati chiesti; l'IA li ha presi dalla documentazione di Anthropic e dal template del server stesso, e sono impostazioni che puoi cambiare.

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida. Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

Il provider, `providers/claude/claude.py` nella tua cartella `xiaozhi-server` sul PC (MIT, come gli esempi del sito):

```python
import anthropic

from core.providers.llm.base import LLMProviderBase

CONTEXT_MARK = "<context>"


def to_messages_api(dialogue):
    system_text = "\n".join(m["content"] for m in dialogue if m["role"] == "system")
    stable, mark, context = system_text.partition(CONTEXT_MARK)
    system = [{"type": "text", "text": stable, "cache_control": {"type": "ephemeral"}}]
    if mark:
        system.append({"type": "text", "text": mark + context})

    messages = []
    for m in dialogue:
        content = str(m.get("content") or "")
        if m["role"] not in ("user", "assistant") or not content:
            continue
        if not messages and m["role"] != "user":
            continue
        messages.append({"role": m["role"], "content": content})
    return system, messages


class LLMProvider(LLMProviderBase):
    def __init__(self, config):
        self.model_name = config.get("model_name", "claude-opus-5-5")
        self.max_tokens = int(config.get("max_tokens", 4096))
        self.effort = config.get("effort", "low")
        self.client = anthropic.Anthropic(api_key=config.get("api_key") or None)

    def response(self, session_id, dialogue, **kwargs):
        system, messages = to_messages_api(dialogue)
        with self.client.messages.stream(
            model=self.model_name,
            max_tokens=self.max_tokens,
            system=system,
            messages=messages,
            output_config={"effort": self.effort},
        ) as stream:
            yield from stream.text_stream
            if stream.get_final_message().stop_reason == "refusal":
                yield "Prefiero no responder a eso."
```

L'ultima riga è ciò che Narsil dice, in spagnolo ("preferisco non rispondere a questo"), quando Claude rifiuta una richiesta.

Il suo blocco in `data/.config.yaml`, accanto a ciò che ci ha messo la guida 4:

```yaml
selected_module:
  LLM: ClaudeLLM
  Intent: nointent

LLM:
  ClaudeLLM:
    type: claude
    model_name: claude-opus-5-5
    max_tokens: 4096
    effort: low
```

Per Haiku, cambia `model_name` in `claude-haiku-5-5`. `max_tokens` è un tetto, non un obiettivo: la lunghezza delle risposte di Narsil la decide il suo prompt (guida 6).

L'immagine del server non include l'SDK né il nuovo file. Un piccolo `Dockerfile` accanto a `docker-compose.yml` aggiunge l'SDK sopra l'immagine del progetto:

```dockerfile
FROM ghcr.nju.edu.cn/xinnan-tech/xiaozhi-esp32-server:server_latest
RUN pip install anthropic
```

E un `docker-compose.override.yml`, che Docker Compose unisce da solo al file del progetto, costruisce quell'immagine, monta il provider dove lo cerca `create_instance` e passa la chiave dalla tua shell:

```yaml
services:
  xiaozhi-esp32-server:
    build: .
    image: xiaozhi-esp32-server-claude
    environment:
      - ANTHROPIC_API_KEY
    volumes:
      - ./providers/claude/claude.py:/opt/xiaozhi-esp32-server/core/providers/llm/claude/claude.py
```

Poi, in PowerShell, con una chiave inventata:

```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-EXAMPLE-not-a-real-key"
docker compose up -d --build
docker logs -f xiaozhi-esp32-server
```

## Errori comuni e come testarlo

- **Un `type` che non corrisponde alla cartella.** `type: claude` richiede `core/providers/llm/claude/claude.py` dentro il container. Il server risponde `不支持的LLM类型` ("tipo di LLM non supportato") quando il percorso è sbagliato; controlla la riga del volume.
- **`ModuleNotFoundError: anthropic`.** Il container sta ancora eseguendo l'immagine del progetto. Ricostruiscila con `docker compose up -d --build`.
- **Il primo messaggio non è dell'utente.** L'API rifiuta una lista `messages` che inizia con `assistant`; la conversione scarta tutto ciò che precede il primo turno dell'utente.
- **`max_tokens` troppo basso.** Il ragionamento ne fa parte; con poche centinaia di token, una risposta può interrompersi a metà. Mantieni le risposte brevi tramite il prompt.
- **Una cache che non viene mai letta.** Qualunque cosa cambi prima del segno di cache la invalida. Leggi `usage.cache_read_input_tokens` nel messaggio finale: zero a ogni turno significa che la parte stabile sta cambiando, per esempio perché un template personalizzato ha spostato l'ora sopra `<context>`.
- **La chiave nel repository.** Tienila nell'ambiente o in `data/.config.yaml`, entrambi fuori da qualsiasi repository. Se una chiave trapela, eliminala subito nella Console.

Per testare, avvia il server e segui il suo log. Riporta `初始化组件: llm成功 ClaudeLLM` ("componente inizializzato: llm riuscito") quando il provider si carica. Poi sveglia la pancia e chiedi qualcosa di breve: il log mostra il testo riconosciuto, e la risposta inizia a essere riprodotta mentre Claude sta ancora scrivendo. Nella pagina [Usage](https://platform.claude.com/usage) della Console, le richieste compaiono entro pochi minuti, con i loro token in cache e fuori cache.

## Per andare oltre

- **Tool.** Con `Intent: function_call`, il server passa i suoi plugin (meteo, musica, l'intento di uscita) a `response_with_functions`. Implementarlo significa convertire la lista di funzioni in stile OpenAI del server nel formato `tools` di Claude e restituire la forma di chiamata di funzione del server, come fa il provider Gemini.
- **Fallback in caso di rifiuto.** Su Claude Opus 5.5, la beta `server-side-fallback-2026-07-01` permette all'API di ritentare una richiesta rifiutata su un altro modello all'interno della stessa chiamata (`fallbacks: "default"` su `client.beta.messages`).
- **Effort.** `low` mantiene le risposte rapide. Prova `medium` per domande che richiedono più riflessione, e misura il ritardo prima di tenerlo.
- **Messaggi di sistema a metà conversazione.** Per cambiare le istruzioni di Narsil durante una conversazione senza toccare il prompt di sistema in cache, l'API accetta un ruolo `system` dentro `messages` sui modelli attuali.
- La guida 6 scrive il carattere che entra in quel prompt di sistema, e la voce spagnola che lo pronuncia.
