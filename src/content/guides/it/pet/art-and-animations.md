---
title: Disegno e animazioni
description: 'Come viene disegnata Narsil: una posa per stato, chiaro e scuro in un solo SVG, loop animati ricavati da video IA e il limite di 131072 caratteri della fascia.'
route: pet
order: 2
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/sprite.ts
  - repo: pet
    path: hooks/art.ts
  - repo: pet
    path: tools/build-art.ps1
  - repo: pet
    path: tools/anim-sources.ps1
  - repo: pet
    path: tools/encode-anim.ps1
  - repo: pet
    path: tools/build-animated.ps1
  - repo: pet
    path: odd/tasks/animated-poses.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Cosa fa

Fuori dal terminale, la fascia sopra il prompt mostra Narsil, un serpente marino in stile chibi, in una posa che corrisponde allo stato della conversazione. Saluta una nuova conversazione, sonnecchia mentre la conversazione aspetta te, lavora mentre Claude lavora, si sporge in avanti quando ha bisogno di te, festeggia quando il turno è finito e appare preoccupata davanti a un errore.

Ogni posa è disegnata due volte, una per lo sfondo chiaro e una per quello scuro, e la fascia sceglie quella giusta in base allo schema di colori del tuo sistema. Ogni posa è anche un breve loop animato: si muove davvero, respira, sbatte le palpebre e ondeggia, invece di essere un'immagine ferma con degli effetti attorno.

Narsil inoltre cresce. Man mano che guadagna esperienza attraversa cinque stadi, da piccola appena uscita dall'uovo ad adulta, e ogni stadio ha il suo insieme di pose. I passaggi di livello e i nuovi stadi hanno una loro celebrazione sopra l'immagine.

Nel terminale non c'è immagine. La fascia disegna invece una piccola faccina di testo per ogni umore, come `~(-ᴗ-)~ z` mentre dorme.

Il disegno è la parte che si nota per prima, e fa un lavoro vero: la posa e il bagliore colorato attorno a lei dicono lo stato prima che tu legga una parola.

## Come funziona dentro

### Da dove vengono le immagini

Le illustrazioni sono immagini dipinte, non forme vettoriali. Si trovano come file immagine in `assets/raw/<pose>-<claro|oscuro>.png` per lo stadio da piccola e in `assets/raw/etapa2` fino a `assets/raw/etapa5` per gli stadi successivi (`claro` è chiaro, `oscuro` è scuro). Le pose prendono il nome dagli stati: `hola`, `parada`, `trabajando`, `necesita`, `terminado` ed `error`, più una posa `base` usata come ripiego.

Una mod non può leggere file immagine al momento del disegno, quindi le immagini vengono trasformate in codice. `tools/build-art.ps1`, uno script di Windows PowerShell, rimuove lo sfondo uniforme di ogni immagine (bianco o trasparente, procedendo dai bordi verso l'interno), la ritaglia attorno al personaggio, la scala a 150 pixel di altezza e scrive `hooks/art.ts` e i file in `hooks/art/` con ogni immagine incorporata come dati. I suoi commenti dicono che rimuove anche "any fake 'transparency' checkerboard an image generator painted" (qualsiasi finta scacchiera di "trasparenza" dipinta da un generatore di immagini) e una sottile cornice chiara che "an image generator drew" (ha disegnato un generatore di immagini); il repository non registra quale strumento per le immagini sia stato usato.

`hooks/art.ts` è breve e generato: importa un modulo per ogni stadio e tema ed espone `ART`, indicizzato per stadio, poi per tema, poi per posa. La sua prima riga dice "do not edit by hand" (non modificare a mano).

### Scegliere un'immagine

`art` in `hooks/sprite.ts` sceglie l'immagine per un umore, un tema e uno stadio:

1. La posa voluta è `hola` per il saluto, e altrimenti la posa dello stato dell'umore (`POSE`).
2. Se esiste un loop animato per quello stadio, tema e posa (`ANIMATED`), vince il loop.
3. Altrimenti cerca l'immagine ferma, ripiegando sulla posa `base` dello stadio, poi sugli stadi precedenti, poi sull'altro tema.

La catena di ripieghi è il motivo per cui le illustrazioni si sono potute aggiungere uno stadio alla volta: uno stadio non ancora disegnato mostrava comunque qualcosa di sensato.

### Un SVG, due temi

`sprite` restituisce un unico documento SVG che contiene entrambi i temi. L'immagine chiara sta in un gruppo con la classe `th-claro`, quella scura in `th-oscuro`, e una regola CSS dentro l'SVG mostra l'una o l'altra:

```css
.th-oscuro {
  display: none;
}
@media (prefers-color-scheme: dark) {
  .th-claro {
    display: none;
  }
  .th-oscuro {
    display: inline;
  }
}
```

La mod non ha mai bisogno di conoscere il tema. La superficie che disegna l'SVG applica lo schema di colori di chi guarda, così lo stesso disegno è corretto nello stesso momento su un desktop chiaro e su un telefono scuro.

### Far muovere un'immagine ferma

Prima che esistessero i loop animati, tutta la vita veniva dal CSS dentro l'SVG, e quel codice si usa ancora per ogni posa senza loop. Il commento in cima a `hooks/sprite.ts` elenca i livelli:

- L'intera immagine nuota, ondeggia su e giù, salta o trema con trasformazioni CSS, a un ritmo dato dal suo stadio (`STAGE_MOTION`, `motion`), con un'ombra e degli spruzzi a tempo.
- Il suo corpo è tagliato in nove fasce che si toccano soltanto (`cuts`, `bands`), e ogni fascia ondeggia con un piccolo ritardo, così un'onda corre dalla testa alla coda. Dal collo in su è un'unica fascia, quindi nessun taglio le attraversa il viso.
- Attorno a lei: un'aura pulsante nel colore dello stato (`aura`), bolle, cerchi nell'acqua, coriandoli quando ha finito e oggetti di scena per ogni umore.
- `@media (prefers-reduced-motion: reduce)` disattiva tutte le animazioni.

La cronologia dei commit spiega la regola delle "fasce che si toccano soltanto". Un approccio precedente sovrapponeva alla prima immagine una seconda copia deformata, e correzioni come `9f9cc75` "fix: draw Narsil as one sharp picture so no part of her shows twice" (disegna Narsil come un'unica immagine nitida, così nessuna parte di lei appare due volte) e `6ac340e` "fix: draw Narsil's head once instead of a turning copy over the body" (disegna la testa di Narsil una sola volta invece di una copia che ruota sopra il corpo) hanno eliminato l'effetto doppio.

### I loop animati

Ora ogni posa ha anche un vero loop animato: un'immagine WebP animata ricavata da un breve video generato dall'IA, incorporata come dati in `hooks/art/anim/` e raccolta da `hooks/art/animated.ts`. Quando `art` trova un loop, `picture` lo disegna intero e salta il taglio in fasce, perché il loop si muove già da sé. L'aura, il badge e gli effetti continuano a stargli attorno.

### Il limite di dimensione

Tutto quanto descritto sopra deve stare in una sola stringa. Il `source` dell'elemento `Svg` è, con le parole dei tipi della 2.1.325, "The SVG document, `<svg ...>...</svg>`, at most 131072 characters." (il documento SVG, al massimo 131072 caratteri). Entrambi i temi condividono questo budget, perché stanno nello stesso disegno.

Quel limite ha dato forma ai loop:

- `tools/encode-anim.ps1` cerca la qualità migliore che mantiene un loop entro 38 KB (`-TargetKB 38`).
- `tools/build-animated.ps1` rifiuta qualsiasi loop oltre i 40 KB (`$MAX_BYTES`). Incorporati come dati base64, due loop da 40 KB occupano circa 109.000 caratteri, il che lascia spazio al resto del disegno.
- Un test in `tests/narsil.test.tsx` lo dimostra: "two loops of the largest size tools/build-animated.ps1 lets in, one per theme, still fit the band at every stage and celebration" (due loop della dimensione massima che tools/build-animated.ps1 accetta, uno per tema, stanno ancora nella fascia in ogni stadio e celebrazione).
- `tools/build-animated.ps1` scrive un modulo per ogni stadio e tema perché, come dice il suo commento, "the engine reads no file over 1 MiB" (il motore non legge nessun file oltre 1 MiB).

La finestra mobile non ha questo limite, quindi mostra una copia più nitida di ogni loop. `pictureDefs` contrassegna un loop con `data-loop="<name>"`, e la pagina della finestra lo sostituisce con una versione da 200 pixel che il server locale serve da `assets/anim-hq`.

### Il costo al momento del disegno

Un disegno completo è grande (il codice dice "some 100 KB", circa 100 KB), e la fascia e la finestra chiedono lo stesso disegno più e più volte. `sprite` conserva gli ultimi otto disegni in una `Map` con chiave umore, stadio e traguardo, e `pushOverlay` in `hooks/register.tsx` invia l'SVG alla finestra solo quando è cambiato (commit `19106d1` "perf: reuse Narsil's drawing and send it to the window only when it changes", riusa il disegno di Narsil e invialo alla finestra solo quando cambia).

## Costruiscila con Claude

Chiedi a Claude una funzione che costruisca un unico disegno SVG del tuo pet per la fascia, con dentro un'immagine chiara e una scura. L'unica idea che Claude deve fare bene: l'intero disegno, entrambi i temi inclusi, deve restare entro il limite della fascia di 131072 caratteri.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è uno dei prompt registrati in narsil-pet.

> Nella mia mod di Claude Code, aggiungi una funzione `petSvg(status)` che restituisca un unico documento SVG per l'elemento `Svg` della fascia `AbovePrompt`. Deve contenere una versione chiara e una scura del mio personaggio (data URL da `hooks/art.ts`), mostrare quella giusta con una media query `prefers-color-scheme` dentro l'SVG e dare a ogni stato una piccola animazione CSS (un su e giù mentre lavora, un respiro lento quando è ferma, un breve tremolio in caso di errore). Disattiva le animazioni con `prefers-reduced-motion`. Lancia un errore se il documento supera i 131072 caratteri, e aggiungi un test che verifichi che ogni stato, in entrambi i temi, ci stia. Nel terminale disegna invece una faccina di testo, perché il terminale non ha `Svg`.

### Cosa controllare nella risposta di Claude

1. L'SVG contiene entrambe le immagini, e una media query `prefers-color-scheme` dentro l'SVG ne mostra una. La mod stessa non sceglie mai il tema.
2. Il codice controlla la lunghezza del disegno finito rispetto a 131072 caratteri, e un test la controlla per ogni stato in entrambi i temi.
3. Una regola `prefers-reduced-motion: reduce` disattiva ogni animazione.
4. Nel terminale (`e.surface === 'terminal'`), la fascia disegna una faccina di testo, perché il terminale non ha `Svg`.
5. L'animazione muove l'immagine stessa, non una copia deformata sovrapposta.

Se un controllo fallisce, di' a Claude cosa vedi: "su un desktop scuro la fascia mostra l'immagine chiara", oppure "la fascia non mostra nulla per uno stato".

### Come l'ha chiesta l'autore

Questa storia ha due parti. Le illustrazioni ferme e il loro movimento CSS sono venuti prima, e le richieste relative non sono state registrate. I loop animati hanno un log pubblico dei task, `odd/tasks/animated-poses.md` in narsil-pet, che cita le richieste dell'autore parola per parola.

#### Ricostruzione dalla cronologia dei commit (illustrazioni ferme)

Da `git log -- hooks/sprite.ts hooks/art.ts tools/build-art.ps1`:

- `d48c95c` (2026-10-30) "feat(art): add painted art for each state and its build tool" (aggiunge le illustrazioni dipinte per ogni stato e il loro strumento di build), poi `d31a6ba` "feat(sprite): draw Narsil from the art with layered animations" (disegna Narsil dalle illustrazioni con animazioni a livelli).
- `9bfa039` (2026-10-30) "feat: let Narsil grow through five stages as she levels up" (fa crescere Narsil attraverso cinque stadi man mano che sale di livello) e `7a964d1` "feat: draw Narsil as a hatchling at stage 1 and split the art per stage" (disegna Narsil appena uscita dall'uovo allo stadio 1 e divide le illustrazioni per stadio).
- Il 2026-10-31, un commit per ogni stadio e tema, come `ff02847` "feat: draw stage 3 dark art" (disegna le illustrazioni scure dello stadio 3) ed `eed13b0` "feat: draw stage 5 light art" (disegna le illustrazioni chiare dello stadio 5).
- `9f9cc75` e `6ac340e` (2026-10-31), le correzioni dell'immagine doppia descritte sopra.
- `e79c512` (2026-11-09) "feat: make Narsil's body undulate and her rest less mechanical" (fa ondulare il corpo di Narsil e rende il suo riposo meno meccanico). Il suo messaggio descrive le fasce che "only meet" (si toccano soltanto) e dice che a riposo "only starts to snore after a minute" (inizia a russare solo dopo un minuto).

#### La richiesta registrata per i loop animati

La prima voce del log, L1, datata 2026-11-15:

> "quiero cambiar las imagenes de narsil, por unas realmente animadas, donde tenga movimiento la serpiente, esto es posible? podriamos usar mi suscripcion de gemini plis para generar las animaciones, estoi haria que el mod consumiera demasiados recursos?"

In italiano: l'autore vuole sostituire le immagini di Narsil con immagini davvero animate in cui il serpente si muova, chiede se sia possibile, propone di usare il suo abbonamento a Gemini per generare le animazioni e chiede se questo farebbe consumare troppe risorse alla mod.

Le specifiche dello stesso file citano le correzioni che sono seguite, e ognuna ha cambiato il risultato:

- Spec S2: "dile que no necesitas sonido, la oido sonar y chapoteando el agua y no es necesario" (traduzione: digli che il suono non serve; l'autore l'ha sentita fare rumore e sguazzare nell'acqua, e non è necessario). Il prompt per il video ora chiede silenzio, e l'encoder scarta qualsiasi traccia audio.
- Spec S3: "me gustaria que tuviera el color original, y sobretodo que se viera en la banda de chat" (traduzione: l'autore vuole i colori originali e, soprattutto, vederla nella fascia della chat). Questo ha reso il limite di 131072 caratteri il vincolo principale.
- Spec S4: "la version idle que es la dormida parpadea, lo que es curioso" (traduzione: la versione idle, quella addormentata, sbatte le palpebre, il che è strano). Ora ogni loop viene generato dall'immagine della propria posa, e il prompt della posa addormentata dice che i suoi occhi restano chiusi.
- Spec S5: "no podemos directamente generarla con menos tamano para ahorrar limite? se ve algomas delgado y algo pixelado" (traduzione: non si potrebbe generare il video più piccolo per risparmiare spazio? sembra più sottile e un po' pixelato). La risposta del log: la dimensione di output del video non cambia il costo; contano il movimento leggero e le impostazioni dell'encoder.
- L4 (2026-11-15): "si me agrada, vamos a cambiar todos" (traduzione: sì, mi piace, cambiamoli tutti). Ne sono venuti 60 loop: sei pose, cinque stadi, due temi.
- L6 (2026-11-15): "en ventana externa podemos poner el video sin recortar? para que se vea mas nitido?" (traduzione: nella finestra esterna possiamo mettere il video senza ritagli, così si vede più nitido?). Da qui sono nate le copie nitide in `assets/anim-hq`.

Il log registra anche come sono stati fatti i video. All'inizio i video venivano da Veo nell'app Gemini, e la quota si è esaurita dopo due video (L4). In L8 (2026-11-16) l'autore ha chiesto a Claude di creare i video nel suo browser e di fermarsi ogni volta che si arrivava al limite di Veo. In L9 (2026-11-16) l'autore ha chiesto "antes de continuar, no es posible avanzar en los videos usando flow?" (traduzione: prima di continuare, non si può andare avanti con i video usando Flow?). Flow aveva i suoi crediti, e la sua modalità Frames, con l'immagine di Narsil sia come primo sia come ultimo fotogramma, ha dato un loop chiuso. In L10 (2026-11-16) l'autore ha chiesto una qualità migliore o più movimento e poi ha detto "prioriza la nitidez y luego mas movimiento" (traduzione: dai priorità alla nitidezza e poi a più movimento). Il risultato, come registra L10: tutti i 60 loop realizzati in Flow, 3 secondi a 360p, con prompt che chiedono un movimento chiaro del corpo, della testa e delle pinne mentre l'acqua resta calma, perché l'acqua agitata faceva perdere nitidezza al loop della fascia.

#### Il prompt dato al modello video

Anche il prompt inviato al modello video è registrato, perché lo scrive uno script. `tools/anim-sources.ps1` prepara, per ogni loop mancante, l'immagine di Narsil su verde puro (`#00FF00`) e un file di testo con il prompt di `Get-Prompt`. Il prompt inizia così:

> "Create a SILENT video from this image: no audio at all, no music, no sound effects, no water sounds. Animate this exact character as a seamless loop of ..."

In italiano: "Crea un video SILENZIOSO da questa immagine: nessun audio, nessuna musica, nessun effetto sonoro, nessun suono d'acqua. Anima esattamente questo personaggio come un loop continuo di ...". Prosegue chiedendo acqua calma, un personaggio identico, una camera fissa, lo stesso sfondo verde uniforme e un ultimo fotogramma uguale al primo. La parte centrale viene da una tabella di movimenti per posa; per la posa addormentata dice che i suoi occhi "stay CLOSED the whole time" (restano CHIUSI per tutto il tempo), cioè la spec S4 trasformata in istruzione.

Poi `tools/encode-anim.ps1` rimuove il verde (`colorkey=0x00FF00`), scarta l'audio, ritaglia attorno a lei ed esegue una ricerca binaria sulla qualità WebP per arrivare sotto la dimensione obiettivo. `tools/build-animated.ps1`, che viene chiamato da questo script, incorpora il risultato.

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida. Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

Una versione ridotta, scritta per questa guida e verificata sui tipi della 2.1.325. La struttura (due temi in un SVG, il controllo della dimensione, la faccina del terminale) è adattata da `hooks/sprite.ts` e `hooks/register.tsx` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). Anche i disegni di Narsil sono GPL v3: se li usi, mantieni l'attribuzione e un link al repository.

```ts
// hooks/drawing.ts
const MAX_SVG = 131072 // the Svg element's limit for `source`

export function petSvg(lightSrc: string, darkSrc: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 120" width="150" height="120">` +
    `<style>.dark{display:none}` +
    `@media (prefers-color-scheme: dark){.light{display:none}.dark{display:inline}}` +
    `.bob{transform-box:fill-box;transform-origin:50% 100%;animation:bob 2s ease-in-out infinite}` +
    `@keyframes bob{50%{transform:translateY(-3px)}}` +
    `@media (prefers-reduced-motion: reduce){*{animation:none!important}}</style>` +
    `<g class="bob">` +
    `<image class="light" href="${lightSrc}" x="25" y="4" width="100" height="112"/>` +
    `<image class="dark" href="${darkSrc}" x="25" y="4" width="100" height="112"/>` +
    `</g></svg>`
  if (svg.length > MAX_SVG)
    throw new Error(`the drawing has ${svg.length} characters; the band takes ${MAX_SVG}`)
  return svg
}
```

Il disegno, con il ripiego per il terminale:

```tsx
on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
  if (e.props.hasSurvey) return next(e)
  if (e.surface === 'terminal') {
    const { Text } = $.ui.resolve(e)
    return <Text>~(•ᴗ•)~ working</Text>
  }
  const { Svg } = $.ui.resolve(e)
  return <Svg source={petSvg(LIGHT, DARK)} alt="My pet: working" width={132} height={118} />
})
```

`LIGHT` e `DARK` stanno per le tue immagini incorporate, per esempio stringhe `data:image/png;base64,...` generate da uno script di build nel modo in cui `tools/build-art.ps1` scrive `hooks/art.ts`. Restringere prima su `e.surface` è importante: la tabella degli elementi del terminale non ha `Svg`.

## Errori comuni e come testarlo

- **Superare il limite senza accorgersene.** Un disegno oltre i 131072 caratteri non viene disegnato. I dati base64 crescono di un terzo, quindi un'immagine da 40 KB costa circa 54.600 caratteri, e due temi raddoppiano la cifra. Controlla la lunghezza nel codice e in un test, come fa Narsil con "every state is drawn from the art, light and dark, within the Svg size limit" (ogni stato è disegnato dalle illustrazioni, chiare e scure, entro il limite di dimensione di Svg).
- **Scegliere il tema nella mod.** La mod non può vedere lo schema di colori di chi guarda, e più superfici possono disegnare nello stesso momento. Metti entrambi i temi nell'SVG e lascia scegliere al CSS.
- **Animare una copia sopra l'immagine.** Un duplicato deformato si vede come un'immagine doppia. Le correzioni di Narsil (`9f9cc75`, `6ac340e`) sono passate a fasce con bordi netti che si toccano soltanto.
- **Animare una posa fino a trasformarla in un'altra.** La spec S4 del log registra la posa addormentata che sbatte le palpebre. Genera ogni loop dalla sua posa e scrivi nel prompt cosa non deve cambiare.
- **Suono e sfondi movimentati nei video IA.** Chiedi silenzio e scarta comunque l'audio (spec S2). L'acqua calma mantiene il loop nitido a una dimensione ridotta (L10). Fai in modo che il loop si chiuda su se stesso: la modalità Frames di Flow con lo stesso primo e ultimo fotogramma lo ha ottenuto (L9).
- **Bordi morbidi che costano troppo.** L2 del log registra che un bordo alfa morbido e sfumato costava circa 45 KB; i loop della fascia usano un bordo netto ristretto di un pixel, che elimina anche la frangia verde. Le copie nitide della finestra usano il bordo morbido.
- **File che il motore non carica.** I moduli oltre 1 MiB vengono rifiutati, quindi dividi le illustrazioni incorporate in più file (uno per stadio e tema in Narsil).
- **Ridisegnare a ogni battito.** Tieni in cache i disegni e inviali solo quando cambiano.

Per testare, `claude plugin test .` esegue i test di disegno di Narsil in `tests/narsil.test.tsx`, tra cui "Narsil moves visibly in every state" (Narsil si muove visibilmente in ogni stato) e "a pose with an animated loop shows the loop, whole and within the Svg size limit, and its still picture elsewhere" (una posa con un loop animato mostra il loop, intero ed entro il limite di dimensione di Svg, e altrove la sua immagine ferma). `node tests/overlay-drawing.check.cjs` controlla il disegno della finestra mobile. Il repository di Narsil ha anche `tools/preview.mjs`, aggiunto come "chore: add a local preview page for every animation" (aggiunge una pagina di anteprima locale per ogni animazione, `75e1525`), per vedere tutte le pose insieme.

## Per andare oltre

- `draw` in `hooks/sprite.ts` assembla l'intero documento: l'acqua, il livello del traguardo dietro, l'ombra, le immagini di entrambi i temi, le bolle, le gocce e una celebrazione oppure gli oggetti di scena dell'umore.
- `LAYOUT` contiene, per ogni posa, dove si trova la sua testa, così il badge e i cerchi cadono su di essa; `place` scala ogni immagine nel riquadro di 150 per 120.
- `props` aggiunge i piccoli oggetti di ogni umore, e `ASLEEP_AFTER_S` aspetta un minuto prima che inizi a russare.
- `celebration`, `behind` e `grows` disegnano un nuovo livello e un nuovo stadio sopra il suo stato.
- `FACE` è la faccina di testo del terminale per ciascuno dei dodici umori.
- `tools/anim-sources.ps1`, `tools/encode-anim.ps1` e `tools/build-animated.ps1` sono la pipeline dei loop; la sezione "Desarrollo" del README elenca i passi esatti e le impostazioni di Flow, e `tools/ffmpeg.ps1` individua ffmpeg.
- `overlay/server.cjs` serve i loop nitidi su `GET /anim/<loop>.webp` per la finestra mobile, trattata in una guida successiva.
