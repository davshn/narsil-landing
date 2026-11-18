---
title: Il tuo server
description: 'Eseguire xiaozhi-esp32-server di xinnan-tech in modalità minima con Docker sul tuo PC, solo sulla rete locale: la sua configurazione, le sue porte e come lo trova la pancia.'
route: bot
order: 4
updated: 2026-11-18
---

## Cosa fa

Xiaozhi sulla pancia non capisce il parlato e non pensa. Registra, comprime e riproduce. L'ascolto, il pensiero e il parlato avvengono su un server: per impostazione predefinita quello ufficiale su xiaozhi.me e, in questo bot, un server sul tuo PC.

Quel server è [xinnan-tech/xiaozhi-esp32-server](https://github.com/xinnan-tech/xiaozhi-esp32-server), il server in Python che il README di Xiaozhi elenca per primo per l'installazione su computer personali. Per ogni conversazione:

1. Riceve l'audio della pancia via WebSocket.
2. Rileva dove inizi e finisci di parlare (rilevamento dell'attività vocale).
3. Trasforma il tuo parlato in testo (riconoscimento vocale, ASR).
4. Invia il testo a un modello linguistico (LLM). In questo bot, Claude, dalla guida 5.
5. Trasforma la risposta in parlato (sintesi, TTS) e la rimanda in streaming.

Risponde anche alla richiesta OTA della pancia, ed è così che la pancia scopre dove si trova il WebSocket (guida 3).

Il bot lo esegue nella **modalità minima** del progetto, che il README in inglese chiama "Simplified Installation" (installazione semplificata): un solo agente, dati salvati in file di configurazione, nessun database e nessuna console web. Gira in Docker sul PC su cui lavori ed è raggiungibile solo dalla tua rete locale.

## Come funziona dentro

### Perché solo sulla tua rete locale

Il README del progetto è diretto sulla sua maturità. La sua traduzione inglese dice che il progetto "has not passed network security assessment" (non ha superato una valutazione di sicurezza di rete), chiede di non usarlo in produzione e chiede misure di protezione se lo installi su una rete pubblica per imparare. L'originale cinese dice lo stesso: "未通过网络安全测评".

Il bot ne dà la lettura prudente: il server non si affaccia mai su internet. Nessuna porta viene inoltrata sul router, e solo i dispositivi della tua rete possono raggiungerlo. La configurazione predefinita è coerente con questo uso: l'autenticazione è disattivata (`server.auth.enabled: false`), cosa accettabile su una rete domestica e non su internet.

### Moduli: cosa usa ogni passo

`main/xiaozhi-server/config.yaml` sceglie un provider per passo sotto `selected_module`. I valori predefiniti:

| Passo                 | Chiave   | Predefinito     | Note da `config.yaml`                                     |
| --------------------- | -------- | --------------- | --------------------------------------------------------- |
| Attività vocale       | `VAD`    | `SileroVAD`     | Modello locale                                            |
| Riconoscimento vocale | `ASR`    | `FunASR`        | Locale, offline, modello SenseVoiceSmall                  |
| Modello linguistico   | `LLM`    | `ChatGLMLLM`    | Richiede una chiave; la guida 5 lo sostituisce con Claude |
| Modello di visione    | `VLLM`   | `ChatGLMVLLM`   | Non usato dal bot                                         |
| Sintesi vocale        | `TTS`    | `EdgeTTS`       | Voce `zh-CN-XiaoxiaoNeural` per impostazione predefinita  |
| Memoria               | `Memory` | `nomem`         | Nessuna memoria tra le conversazioni                      |
| Intento               | `Intent` | `function_call` | Il modello chiama direttamente i tool                     |

Ogni nome punta a un blocco con lo stesso nome più in basso nel file (`ASR.FunASR`, `TTS.EdgeTTS` e così via) con le impostazioni di quel provider.

### `config.yaml` e `data/.config.yaml`

I commenti all'inizio di `config.yaml` danno la regola: crea `data/.config.yaml` e metti lì le tue modifiche, non in `config.yaml`. Il server legge prima `data/.config.yaml` e prende da `config.yaml` tutto ciò che manca. La guida all'installazione lo chiama il modo più conciso, e il commento aggiunge perché è importante: tiene le tue chiavi fuori dal file del progetto.

Per il bot questo significa che `data/.config.yaml` contiene solo ciò che differisce dai valori predefiniti: l'indirizzo WebSocket, il fuso orario, i provider scelti e le loro chiavi. Vive sul tuo PC, fuori da qualsiasi repository.

### Porte

Il `docker-compose.yml` del progetto pubblica due porte:

| Porta | Impostazione       | Cosa serve                                                               |
| ----- | ------------------ | ------------------------------------------------------------------------ |
| 8000  | `server.port`      | Il WebSocket con cui parla la pancia, su `/xiaozhi/v1/`                  |
| 8003  | `server.http_port` | HTTP: la semplice interfaccia OTA su `/xiaozhi/ota/`, e l'analisi visiva |

Il server ascolta su `0.0.0.0` (`server.ip`), cioè su ogni interfaccia di rete del container. Docker pubblica quelle porte sul PC.

### Come lo trova la pancia

Contano due indirizzi, entrambi costruiti dall'indirizzo del tuo PC sulla rete locale (qui l'inventato `192.168.1.50`):

- **URL OTA:** `http://192.168.1.50:8003/xiaozhi/ota/`. Lo scrivi sulla pancia una volta, nella scheda Advanced del portale Wi-Fi (guida 3).
- **URL WebSocket:** `ws://192.168.1.50:8000/xiaozhi/v1/`. Il server lo invia alla pancia nella sua risposta OTA.

Il secondo richiede attenzione in Docker. Il server costruisce da solo l'indirizzo WebSocket solo finché `server.websocket` contiene ancora il segnaposto di `config.yaml` (`ws://你的ip或者域名:端口号/xiaozhi/v1/`, "il tuo IP o dominio : porta"). Dentro un container, l'indirizzo che vede è quello del container, non quello del tuo PC. La [guida all'installazione](https://github.com/xinnan-tech/xiaozhi-esp32-server/blob/main/docs/Deployment.md) avverte che con Docker gli indirizzi nel log di avvio non sono quelli reali, e che il metodo giusto è usare l'indirizzo LAN del PC. Così il bot imposta `server.websocket` in modo esplicito, e il gestore OTA invia esattamente quel valore. Poiché non è configurato nessun `mqtt_gateway`, invia un oggetto `websocket`, ed è questo che seleziona WebSocket sulla pancia.

Insieme va un'altra impostazione: `server.timezone_offset`, il fuso orario che la risposta OTA comunica alla pancia. Il valore predefinito `+8` è l'ora della Cina; imposta il tuo.

### Locale o API: scegliere riconoscimento e sintesi vocale

Ogni passo può girare sul tuo PC o chiamare un'API cloud. `config.yaml` documenta entrambi i tipi:

| Tipo   | Riconoscimento vocale (ASR)                              | Sintesi vocale (TTS)                                                                                           |
| ------ | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Locale | `FunASR` (predefinito), `SherpaASR`, `VoskASR` (offline) | `FishSpeech`, `PaddleSpeechTTS`, `IndexStreamTTS`, `GPT_SOVITS_V2` (ognuno richiede una propria installazione) |
| API    | `OpenaiASR`, `GroqASR`, `AliyunASR`, `DoubaoASR` e altri | `OpenAITTS`, `AliyunTTS`, `DoubaoTTS` e altri                                                                  |

I compromessi:

- **Il locale tiene la tua voce in casa e non costa niente per utilizzo**, ma usa la memoria e la CPU del tuo PC. Il README nota che eseguire `FunASR` in locale richiede più memoria, e che usare API per tutto mantiene basso l'uso di risorse.
- **La lingua conta.** Narsil parla spagnolo. Il commento del blocco `FunASR` elenca i tag di lingua supportati da SenseVoice come zh, en, ja, ko e yue, quindi per lo spagnolo il bot usa un altro riconoscitore. `OpenaiASR` (modello `gpt-4o-mini-transcribe` per impostazione predefinita) e `GroqASR` (`whisper-large-v3-turbo`) sono API multilingue; `VoskASR` è offline e supporta diverse lingue con un modello scaricato.
- **Un'API invia il tuo audio fuori dalla tua rete** e richiede una chiave. La guida 12 elenca cosa esce dalla rete e perché.

Il bot usa `OpenaiASR` per il riconoscimento e mantiene `EdgeTTS` per la sintesi, che in `config.yaml` non richiede chiave. La voce di Narsil in sé, e l'impostazione `voice`, sono la guida 6.

### Senza il server, si ferma solo la voce

Il server fa un solo lavoro: la voce. La pancia si collega da sola a ntfy e a GitHub (guide 7 e 8), e la testa disegna ciò che la pancia le invia. Se il tuo PC è spento, o Docker è fermo, gli avvisi di Narsil, le tue pull request e la sua faccia continuano a funzionare. Solo la wake word non porta da nessuna parte finché il server non torna.

## Come è stata chiesta all’IA

La decisione di eseguire un server è arrivata nella guida 3: chi ha creato Narsil ha scelto "servidor propio", un server proprio, invece di xiaozhi.me. L'IA ha poi proposto questo server in modalità minima, con Docker, solo sulla rete locale, e ha chiesto di nuovo prima di andare avanti. Chi ha creato Narsil ha confermato:

> vamos con el propio de una

In italiano: "andiamo con il nostro, subito".

La domanda successiva era dove sarebbe girato: sul PC o su un'altra macchina di casa. La risposta:

> en el pc, igual la idea es usarlo para trabajar con claude

In italiano: "sul PC; tanto l'idea è usarlo per lavorare con Claude".

Quella seconda risposta spiega due cose di questa guida. Il server gira in Docker sul PC su cui chi ha creato Narsil lavora già, quindi niente di nuovo deve restare acceso. E Claude è il cervello: la decisione successiva, registrata come specifica S5, ha scelto l'opzione "1", un provider Anthropic nativo scritto in Python con l'Anthropic SDK invece di un endpoint compatibile con OpenAI. La guida 5 lo costruisce.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è la conversazione usata per preparare il bot.

> Voglio eseguire xinnan-tech/xiaozhi-esp32-server nella sua modalità minima con Docker sul mio PC Windows, raggiungibile solo dalla mia rete locale, per un dispositivo Xiaozhi. Leggi il README del progetto, `docs/Deployment.md`, `main/xiaozhi-server/config.yaml` e `docker-compose.yml`, poi dammi: la struttura delle cartelle, un `data/.config.yaml` che sovrascriva solo ciò che mi serve (indirizzo WebSocket con il mio IP LAN, fuso orario, un riconoscitore vocale che capisca lo spagnolo), i comandi per avviarlo e leggerne i log, e l'URL OTA che devo dare al dispositivo. Cita l'avviso di sicurezza del progetto e dimmi quali porte apre.

## Il codice minimo

La cartella sul PC, dalla guida all'installazione:

```text
xiaozhi-server
├─ docker-compose.yml
├─ data
│  └─ .config.yaml
└─ models
   └─ SenseVoiceSmall
      └─ model.pt
```

`docker-compose.yml` è il file del progetto, scaricato da `main/xiaozhi-server/`. Il file compose monta `models/SenseVoiceSmall/model.pt` nel container, quindi la guida all'installazione ti fa scaricare quel modello (da ModelScope o Baidu) anche se il bot riconosce il parlato tramite un'API.

`data/.config.yaml`, con un indirizzo e una chiave inventati:

```yaml
server:
  websocket: ws://192.168.1.50:8000/xiaozhi/v1/
  timezone_offset: -5

selected_module:
  ASR: OpenaiASR
  TTS: EdgeTTS

ASR:
  OpenaiASR:
    api_key: sk-EXAMPLE-not-a-real-key
```

Sotto `OpenaiASR` è impostato solo `api_key`; il resto di quel blocco (`type`, `base_url`, `model_name`) viene da `config.yaml`. Usa lo scostamento del tuo fuso orario. La sezione `LLM` arriva nella guida 5; fino ad allora il server seleziona ancora il predefinito `ChatGLMLLM`, che secondo la guida all'installazione ha bisogno della sua chiave per partire.

Avvialo dalla cartella `xiaozhi-server` e segui il suo log:

```powershell
docker compose up -d
docker logs -f xiaozhi-esp32-server
```

L'immagine è `ghcr.nju.edu.cn/xinnan-tech/xiaozhi-esp32-server:server_latest`, il container si chiama `xiaozhi-esp32-server`, e `restart: always` lo fa ripartire dopo un riavvio di Docker.

## Errori comuni e come testarlo

- **Modificare `config.yaml` invece di `data/.config.yaml`.** Le tue modifiche si mescolano con il file del progetto e si perdono al download successivo. Mettile in `data/.config.yaml`.
- **Fidarsi degli indirizzi nel log di Docker.** Sono quelli del container. Usa l'indirizzo LAN del tuo PC in `server.websocket` e nell'URL OTA della pancia.
- **Inoltrare la 8000 o la 8003 sul router.** Il progetto non ha una valutazione di sicurezza e l'autenticazione è disattivata per impostazione predefinita. Tienilo sulla tua rete.
- **Il firewall del PC.** Se la pancia non raggiunge il server ma il browser del PC sì, consenti le connessioni in ingresso sulla 8000 e sulla 8003 dalla tua rete privata.
- **Un indirizzo del PC che cambia.** Se il router assegna al PC un nuovo indirizzo, l'URL OTA della pancia e `server.websocket` diventano entrambi obsoleti. Una prenotazione DHCP sul router mantiene fisso l'indirizzo.
- **Aggiornare sovrascrivendo `.config.yaml`.** I passi di aggiornamento della guida all'installazione dicono di farne un backup e di copiare le tue chiavi una per una in quello nuovo, perché un nuovo `config.yaml` può portare nuove impostazioni.

Per testare, apri l'URL OTA in un browser sul PC, per esempio `http://192.168.1.50:8003/xiaozhi/ota/`. La guida al firmware di xinnan-tech dice che un server funzionante risponde "OTA接口运行正常" ("l'interfaccia OTA funziona normalmente") seguito dall'indirizzo WebSocket che invia ai dispositivi. Se quell'indirizzo mostra il tuo IP LAN e la porta 8000, la pancia lo troverà. Poi di' la wake word e guarda `docker logs -f xiaozhi-esp32-server`: dovresti vedere la pancia che si collega e il testo che ha sentito.

## Per andare oltre

- L'installazione completa dei moduli aggiunge un database, più utenti e agenti e una console web. Il bot non ne ha bisogno, e il suo indirizzo OTA è diverso (la guida al firmware usa la porta 8002).
- Il server può servire aggiornamenti del firmware per la pancia dalla sua cartella `data/bin`, come descrive la guida agli aggiornamenti OTA del progetto (`docs/ota-upgrade-guide.md`).
- `server.auth` può richiedere un token, con `allowed_devices` che elenca gli indirizzi MAC che saltano il controllo. È un livello utile anche su una rete domestica.
- La maggior parte dei blocchi dei provider in `config.yaml` ha commenti, in cinese, su dove ottenere la chiave e, per alcuni, quanto costa; leggi quello che scegli prima di impegnarti.
- La guida 5 aggiunge l'`LLM` che fa pensare Narsil con Claude, e la guida 6 le dà una voce e una personalità.
