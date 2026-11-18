---
title: La toolchain
description: "Quale versione di ESP-IDF serve al bot e perché, la build di entrambe le schede nell'immagine Docker di Espressif e il flashing da Windows, dove Docker non vede le porte USB."
route: bot
order: 2
updated: 2026-11-18
---

## Cosa fa

Entrambe le schede si programmano con ESP-IDF, il framework ufficiale di Espressif per i chip ESP32. Questa guida prepara un'unica toolchain che compila la pancia (ESP32-P4, Xiaozhi) e la testa (ESP32-S3, il nostro firmware), e spiega come il firmware arriva dal tuo PC a ciascuna scheda.

In breve:

- **Una sola versione di ESP-IDF per entrambe le schede:** il branch `release/v6.1`.
- **La build avviene in Docker**, nell'immagine di Espressif `espressif/idf:release-v6.1`, così sul PC non si installa altro che Docker.
- **Il flashing avviene da Windows stesso**, perché un container Docker su Windows non vede le porte seriali USB.

Se preferisci un editor con i pulsanti, l'estensione ESP-IDF per VS Code fa lo stesso lavoro in modo nativo, e questa guida copre anche quella.

## Come funziona dentro

### Due versioni documentate, una scelta

Le due fonti per la pancia non sono d'accordo sulla versione:

- **Waveshare** consiglia ESP-IDF V5.3.1 o successiva per la ESP32-P4-WIFI6-Touch-LCD-4.3 nella sua [pagina ESP-IDF](https://docs.waveshare.com/ESP32-P4-WIFI6-Touch-LCD-4.3/ESP-IDF/), e la sua procedura usa la V5.5.2.
- **Xiaozhi** (78/xiaozhi-esp32) dice nel suo README che il progetto ora richiede ESP-IDF v6.0.1 o successiva, consiglia il branch `release/v6.1` e afferma che ESP-IDF 5.x non è più supportato.

Il bot segue Xiaozhi, perché Xiaozhi è il firmware che gira sulla pancia. Una toolchain 5.x non riesce proprio a compilarlo, mentre alla scheda in sé non importa: il board support package di Waveshare dichiara `idf: '>=5.4'`, quindi la 6.x rientra nel suo intervallo. La 5.3.1 di Waveshare è un minimo per i suoi esempi, non un massimo.

Xiaozhi consiglia il branch, non il tag `v6.1`, per un motivo concreto: il suo README rimanda alla issue #2344, in cui il tag `v6.1` include una libreria Wi-Fi per ESP32-C3 che non corrisponde al suo stesso header. La CI di Xiaozhi compila ogni scheda nell'immagine `espressif/idf:release-v6.1`, quindi il bot usa esattamente quell'immagine. Dopo aver cambiato revisione di ESP-IDF, il README chiede `idf.py fullclean` nel progetto prima di ricompilare.

La testa esegue un nostro piccolo firmware, quindi non ha un requisito di versione proprio. Si compila con la stessa immagine, il che significa una sola toolchain, un solo insieme di abitudini e una sola cache.

### La build in Docker

Espressif pubblica ESP-IDF come immagine Docker, documentata nella [guida IDF Docker Image](https://docs.espressif.com/projects/esp-idf/en/latest/esp32p4/api-guides/tools/idf-docker-image.html). I suoi tag seguono tre schemi: `latest` segue `master`, `vX.Y` corrisponde a una release e `release-vX.Y` segue quel branch di release. Il container ha ESP-IDF, i compilatori e Python già pronti; la cartella del tuo progetto viene montata al suo interno.

Il comando documentato, dalla cartella del progetto, è:

```bash
docker run --rm -v $PWD:/project -w /project -u $UID -e HOME=/tmp espressif/idf idf.py build
```

- `--rm` rimuove il container quando la build finisce.
- `-v $PWD:/project` monta la tua cartella in `/project`, così l'output della build finisce nella tua cartella.
- `-w /project` parte da quella cartella.
- `-u $UID` (Linux e macOS) mantiene i file di output di tua proprietà, non di root.
- `-e HOME=/tmp` dà a `idf.py` un posto dove tenere la sua cache.

La guida documenta anche `-e IDF_GIT_SAFE_DIR='/project'` per il caso in cui git segnali "dubious ownership" (proprietà dubbia) del repository montato, cosa che succede facilmente su un'unità Windows.

### Target: `esp32p4` ed `esp32s3`

ESP-IDF compila per un chip alla volta, scelto con `idf.py set-target`. I comandi della [guida di avvio per Windows](https://docs.espressif.com/projects/esp-idf/en/v6.1/esp32p4/get-started/windows-start-project.html) di Espressif sono:

```bash
idf.py set-target esp32p4
idf.py menuconfig
idf.py build
idf.py -p PORT flash
idf.py -p PORT monitor
```

La testa usa `idf.py set-target esp32s3`. La guida alle schede personalizzate di Xiaozhi imposta il target "first time, or when switching targets" (la prima volta, o quando si cambia target), non prima di ogni build. Per uscire dal monitor, premi `Ctrl+]`.

Per la pancia, Xiaozhi raccoglie questi passi in `scripts/build.py`, che legge il `config.json` della scheda, imposta il target e le opzioni della scheda, compila e unisce tutto in `build/merged-binary.bin`. La guida 3 lo usa.

### Perché Docker non può fare il flashing su Windows

La guida IDF Docker lo dice chiaramente: i comandi che parlano con la scheda, come `idf.py flash` e `idf.py monitor`, hanno bisogno che la porta seriale sia passata al container. Su Linux lo fa l'opzione device di Docker. Su Windows la guida dice "currently, this is not possible with Docker for Windows" (al momento non è possibile con Docker per Windows), e la stessa limitazione vale per Docker per Mac.

Così il bot divide il lavoro: Docker compila, Windows fa il flashing. Ci sono due modi per fare la seconda metà, entrambi dalla documentazione di Espressif.

**Dall'host con esptool.** esptool è lo strumento di flashing di Espressif. Un binario unito, come il `merged-binary.bin` di Xiaozhi, va all'offset `0x0`; la [pagina dei comandi di base](https://docs.espressif.com/projects/esptool/en/latest/esp32p4/esptool/basic-commands.html) di esptool mostra la forma `esptool --port COM4 write-flash 0x1000 my_app-0x01000.bin` e dice che un file unito si scrive con `write-flash 0x0`. Nota anche che `--chip` è facoltativo in scrittura, perché esptool rileva il chip quando si collega. Su Windows, esptool è distribuito come eseguibile pronto nello ZIP della release di esptool; su Linux o macOS, `pip install esptool`.

**Attraverso un bridge seriale (RFC2217).** La soluzione della guida IDF Docker: esegui `esp_rfc2217_server` su Windows per condividere la porta COM in rete, e punta `idf.py` dentro il container verso di essa. `host.docker.internal` è il nome che Docker dà all'host. Così `idf.py flash` continua a funzionare per qualsiasi progetto, compresa la testa, che non ha un binario unito.

### Porte USB e driver su Windows

Su Windows, le porte seriali si chiamano `COM` seguito da un numero. La [guida alla connessione seriale](https://docs.espressif.com/projects/esp-idf/en/v6.1/esp32p4/get-started/establish-serial-connection.html) di Espressif dà il modo più semplice per trovare quella giusta: apri Gestione dispositivi, scollega la scheda, ricollegala, e la porta che sparisce e ricompare è la tua. Dice anche che i driver USB-seriale di solito arrivano con il sistema operativo e si installano da soli.

Per ciascuna scheda:

- **La pancia** si flasha dalla sua porta Type-C marcata "USB to UART", che Waveshare descrive come la porta per alimentazione, programmazione e debug. La pagina ESP-IDF di Waveshare consiglia di installare i driver tramite l'ESP-IDF Installation Manager (EIM).
- **La testa** ha un chip USB-seriale CH343P (WCH), indicato nella pagina prodotto di Waveshare.

Se una scheda non entra da sola in modalità download, o per il suo primo flashing, la guida di Espressif dà il metodo manuale: tieni premuto BOOT, premi RESET una volta, rilascia BOOT.

### L'alternativa: VS Code

La [pagina Get Started](https://docs.espressif.com/projects/esp-idf/en/v6.1/esp32p4/get-started/index.html) di Espressif consiglia due percorsi di installazione: l'ESP-IDF Installation Manager (EIM) e un IDE, Espressif-IDE oppure VS Code con l'estensione ESP-IDF. La pagina ESP-IDF di Waveshare illustra EIM più l'estensione per VS Code su Windows: installa ESP-IDF con EIM (in un percorso senza spazi), poi l'estensione, che dalla versione 2.0 rileva l'installazione da sola. La barra degli strumenti in basso ha poi i pulsanti per scegliere la porta COM, impostare il target (`esp32p4`), compilare, flashare e aprire il monitor.

Un'installazione nativa flasha direttamente, senza bridge. Il costo è un'installazione pesante sul PC, e devi installare lo stesso branch `release/v6.1` che chiede Xiaozhi, non la prima versione che offre EIM.

## Come è stata chiesta all’IA

La questione della toolchain è nata da una decisione precedente. Quando l'IA ha chiesto cosa dovesse eseguire la pancia per dare una voce a Narsil, chi ha creato Narsil ha risposto:

> yo pensaba hacerlo con Xiaozhi

In italiano: "pensavo di farlo con Xiaozhi".

L'IA ha poi letto il README di Xiaozhi, ne ha trovato il requisito, ESP-IDF 6.0.1 o successiva, e l'ha messo accanto alla 5.3.1 documentata da Waveshare. Ha registrato la differenza come rischio nel documento dei task, insieme al piano di compilare nell'immagine Docker di Espressif e di lasciare il flashing e le verifiche sullo schermo a chi ha le schede. La regola che ha applicato è quella di questa guida: la versione la decide il firmware che gira, e la documentazione della scheda fissa solo un minimo.

La seconda decisione che dà forma alla toolchain è dove vive il codice. Alla domanda sulla casa del firmware, chi ha creato Narsil ha scelto:

> repo propio como fork

In italiano: "repository proprio, come fork".

Poi, alla domanda se dovesse essere pubblico o privato fin dall'inizio, chi ha creato Narsil ha risposto "1", la prima opzione proposta: pubblico fin dall'inizio. Per questo entrambe le schede si compilano da un unico repository, `davshn/narsil-bot`, e per questo la toolchain deve gestire due target in un solo albero.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è la conversazione usata per preparare il bot.

> Compilo firmware ESP32 su Windows con Docker e non voglio ESP-IDF installato in modo nativo. Il mio progetto è un fork di 78/xiaozhi-esp32 per una scheda ESP32-P4, più una piccola app ESP-IDF per un ESP32-S3 in una sottocartella. Leggi il README e il workflow di CI di Xiaozhi e la guida IDF Docker Image di Espressif, poi dimmi: quale tag di `espressif/idf` usare e perché, il comando `docker run` esatto per compilare ogni target da PowerShell, e come flashare e monitorare ogni scheda da Windows, dato che Docker non può passare le porte seriali USB. Cita la documentazione per ogni versione e comando.

## Il codice minimo

La build della pancia, dalla radice del fork in PowerShell (`${PWD}` è la cartella corrente di PowerShell; il flag `-u $UID` è per Linux e macOS e qui è omesso):

```powershell
docker run --rm -v ${PWD}:/project -w /project -e HOME=/tmp -e IDF_GIT_SAFE_DIR=/project `
  espressif/idf:release-v6.1 `
  python scripts/build.py waveshare/esp32-p4-wifi6-touch-lcd --name esp32-p4-wifi6-touch-lcd-4.3 --language es-ES
```

La guida 3 spiega la cartella della scheda, `--name` e la lingua. La build della testa, dalla sua cartella:

```powershell
docker run --rm -v ${PWD}:/project -w /project/head -e HOME=/tmp -e IDF_GIT_SAFE_DIR=/project `
  espressif/idf:release-v6.1 `
  sh -c "idf.py set-target esp32s3 && idf.py build"
```

Il flashing della pancia da Windows con esptool, con un nome di porta inventato:

```powershell
esptool --port COM5 write-flash 0x0 build/merged-binary.bin
```

Il flashing della testa attraverso il bridge seriale. In un terminale, condividi la porta:

```powershell
esp_rfc2217_server -v -p 4000 COM6
```

In un altro, flasha dal container:

```powershell
docker run --rm -v ${PWD}:/project -w /project/head -e HOME=/tmp -e IDF_GIT_SAFE_DIR=/project `
  espressif/idf:release-v6.1 `
  idf.py --port "rfc2217://host.docker.internal:4000?ign_set_control" flash
```

Per il monitor, lo stesso `--port` funziona con `idf.py monitor`; aggiungi `-it` a `docker run` perché il container abbia un terminale in cui disegnare.

## Errori comuni e come testarlo

- **Compilare Xiaozhi con ESP-IDF 5.x.** Il README di Xiaozhi è esplicito: la 5.x non è più supportata. Se hai seguito la pagina di configurazione di Waveshare e installato la 5.5.2, la pancia non si compila; usa `release-v6.1`.
- **Mescolare cartelle di build dopo un cambio di versione.** Il README di Xiaozhi chiede `idf.py fullclean` dopo aver cambiato revisione di ESP-IDF. Una cartella `build` vecchia di un'altra versione dà errori che sembrano scollegati.
- **Provare `--device` su Windows.** Funziona solo su Linux. Su Windows, flasha dall'host o attraverso `esp_rfc2217_server`.
- **"dubious ownership" da git dentro il container.** Passa `-e IDF_GIT_SAFE_DIR=/project`, come documenta la guida IDF Docker.
- **Non compare nessuna porta COM.** Scollega e ricollega guardando Gestione dispositivi. Se non cambia niente, prova un altro cavo: un cavo USB solo di ricarica non ha le linee dati.
- **La porta sbagliata sulla pancia.** Flasha dalla porta Type-C marcata "USB to UART", non da quella USB OTG.
- **La scheda non risponde a esptool.** Tieni premuto BOOT, premi RESET, rilascia BOOT e flasha di nuovo.

Per testare la toolchain prima di Xiaozhi, compila l'esempio `hello_world` di ESP-IDF per ogni target nel container, flashalo e cerca il suo output nel monitor. Se entrambe le schede stampano, la toolchain, i driver e i cavi sono a posto.

## Per andare oltre

- `docker run` con `-it` e nessun comando apre una shell nel container, dove puoi eseguire `idf.py menuconfig` e gli altri comandi in modo interattivo, come mostra la guida IDF Docker.
- Fissa l'immagine per digest invece che per tag se vuoi che ogni build del bot usi esattamente lo stesso commit di ESP-IDF; `release-v6.1` si sposta man mano che si sposta il branch.
- `scripts/build.py --list-boards` di Xiaozhi stampa ogni scheda e variante che conosce, un modo rapido per verificare il nome di una scheda prima di una build lunga.
- Il riferimento completo dei comandi ESP-IDF si trova nella documentazione di Espressif per ogni chip; cambia il chip nell'URL (`esp32p4`, `esp32s3`) per vedere le sue pagine.
