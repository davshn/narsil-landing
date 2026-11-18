---
title: La chaîne d’outils
description: 'La version d’ESP-IDF dont le bot a besoin et pourquoi, la compilation des deux cartes dans l’image Docker d’Espressif, et leur flashage depuis Windows, où Docker n’accède pas aux ports USB.'
route: bot
order: 2
updated: 2026-11-18
---

## Ce que ça fait

Les deux cartes se programment avec ESP-IDF, le framework officiel d’Espressif pour les puces ESP32. Ce guide met en place une seule chaîne d’outils qui compile le ventre (ESP32-P4, Xiaozhi) et la tête (ESP32-S3, notre propre firmware), et explique comment le firmware passe de votre PC à chaque carte.

En bref :

- **Une seule version d’ESP-IDF pour les deux cartes :** la branche `release/v6.1`.
- **La compilation se fait dans Docker**, dans l’image d’Espressif `espressif/idf:release-v6.1`, si bien que rien d’autre que Docker n’est installé sur le PC.
- **Le flashage se fait depuis Windows lui-même**, parce qu’un conteneur Docker sous Windows ne voit pas les ports série USB.

Si vous préférez un éditeur avec des boutons, l’extension ESP-IDF pour VS Code fait le même travail en natif, et ce guide la couvre aussi.

## Comment ça marche à l’intérieur

### Deux versions documentées, un seul choix

Les deux sources pour le ventre ne s’accordent pas sur la version :

- **Waveshare** recommande ESP-IDF V5.3.1 ou ultérieure pour l’ESP32-P4-WIFI6-Touch-LCD-4.3 sur sa [page ESP-IDF](https://docs.waveshare.com/ESP32-P4-WIFI6-Touch-LCD-4.3/ESP-IDF/), et son pas-à-pas utilise V5.5.2.
- **Xiaozhi** (78/xiaozhi-esp32) indique dans son README que le projet exige désormais ESP-IDF v6.0.1 ou ultérieure, recommande la branche `release/v6.1`, et précise qu’ESP-IDF 5.x n’est plus pris en charge.

Le bot suit Xiaozhi, parce que Xiaozhi est le firmware qui tourne sur le ventre. Une chaîne d’outils 5.x ne peut pas le compiler du tout, alors que la carte elle-même n’y attache pas d’importance : le propre paquet de support de carte de Waveshare déclare `idf: '>=5.4'`, donc la 6.x est dans sa plage. Le 5.3.1 de Waveshare est un plancher pour ses exemples, pas un plafond.

Xiaozhi recommande la branche, et non l’étiquette `v6.1`, pour une raison concrète : son README renvoie au ticket #2344, où l’étiquette `v6.1` livre une bibliothèque Wi-Fi pour ESP32-C3 qui ne correspond pas à son propre en-tête. La CI de Xiaozhi compile chaque carte dans l’image `espressif/idf:release-v6.1`, donc le bot utilise exactement cette image. Après un changement de révision d’ESP-IDF, le README demande un `idf.py fullclean` dans le projet avant de recompiler.

La tête exécute notre propre petit firmware, elle n’a donc pas d’exigence de version propre. Elle est compilée avec la même image, ce qui signifie une seule chaîne d’outils, un seul ensemble d’habitudes et un seul cache.

### Compiler dans Docker

Espressif publie ESP-IDF sous forme d’image Docker, documentée dans le [guide IDF Docker Image](https://docs.espressif.com/projects/esp-idf/en/latest/esp32p4/api-guides/tools/idf-docker-image.html). Ses étiquettes suivent trois motifs : `latest` suit `master`, `vX.Y` correspond à une version, et `release-vX.Y` suit la branche de cette version. Le conteneur a ESP-IDF, les compilateurs et Python prêts à l’emploi ; votre dossier de projet y est monté.

La commande documentée, depuis le dossier du projet, est :

```bash
docker run --rm -v $PWD:/project -w /project -u $UID -e HOME=/tmp espressif/idf idf.py build
```

- `--rm` supprime le conteneur à la fin de la compilation.
- `-v $PWD:/project` monte votre dossier sur `/project`, si bien que le résultat de la compilation arrive dans votre dossier.
- `-w /project` démarre dans ce dossier.
- `-u $UID` (Linux et macOS) fait que les fichiers produits vous appartiennent, et non à root.
- `-e HOME=/tmp` donne à `idf.py` un endroit où garder son cache.

Le guide documente aussi `-e IDF_GIT_SAFE_DIR='/project'` pour le cas où git signale une « dubious ownership » (propriété douteuse) du dépôt monté, ce qui arrive facilement sur un disque Windows.

### Les cibles : `esp32p4` et `esp32s3`

ESP-IDF compile pour une seule puce à la fois, choisie avec `idf.py set-target`. Les commandes du [guide de démarrage sous Windows](https://docs.espressif.com/projects/esp-idf/en/v6.1/esp32p4/get-started/windows-start-project.html) d’Espressif sont :

```bash
idf.py set-target esp32p4
idf.py menuconfig
idf.py build
idf.py -p PORT flash
idf.py -p PORT monitor
```

La tête utilise `idf.py set-target esp32s3`. Le guide de carte personnalisée de Xiaozhi définit la cible « first time, or when switching targets » (la première fois, ou lors d’un changement de cible), et non avant chaque compilation. Pour quitter le moniteur, appuyez sur `Ctrl+]`.

Pour le ventre, Xiaozhi regroupe ces étapes dans `scripts/build.py`, qui lit le `config.json` de la carte, définit la cible et les options de la carte, compile, et fusionne le tout dans `build/merged-binary.bin`. Le guide 3 l’utilise.

### Pourquoi Docker ne peut pas flasher sous Windows

Le guide IDF Docker le dit clairement : les commandes qui parlent à la carte, comme `idf.py flash` et `idf.py monitor`, ont besoin que le port série soit transmis au conteneur. Sous Linux, l’option de périphérique de Docker s’en charge. Sous Windows, le guide indique « currently, this is not possible with Docker for Windows » (actuellement, ce n’est pas possible avec Docker pour Windows), et la même limite s’applique à Docker pour Mac.

Le bot répartit donc le travail : Docker compile, Windows flashe. Il y a deux façons de faire la seconde moitié, toutes deux tirées de la documentation d’Espressif.

**Depuis l’hôte avec esptool.** esptool est l’outil de flashage d’Espressif. Un binaire fusionné, comme le `merged-binary.bin` de Xiaozhi, va à l’offset `0x0` ; la [page des commandes de base](https://docs.espressif.com/projects/esptool/en/latest/esp32p4/esptool/basic-commands.html) d’esptool montre la forme `esptool --port COM4 write-flash 0x1000 my_app-0x01000.bin` et indique qu’un fichier fusionné s’écrit avec `write-flash 0x0`. Elle précise aussi que `--chip` est facultatif à l’écriture, car esptool détecte la puce à la connexion. Sous Windows, esptool est fourni comme exécutable prêt à l’emploi dans le ZIP de la version d’esptool ; sous Linux ou macOS, `pip install esptool`.

**Par un pont série (RFC2217).** Le contournement du guide IDF Docker : lancer `esp_rfc2217_server` sous Windows pour partager le port COM sur le réseau, et faire pointer `idf.py` vers lui depuis le conteneur. `host.docker.internal` est le nom que Docker donne à l’hôte. Cela permet à `idf.py flash` de fonctionner pour n’importe quel projet, y compris la tête, qui n’a pas de binaire fusionné.

### Ports USB et pilotes sous Windows

Sous Windows, les ports série s’appellent `COM` suivi d’un numéro. Le [guide de connexion série](https://docs.espressif.com/projects/esp-idf/en/v6.1/esp32p4/get-started/establish-serial-connection.html) d’Espressif donne la façon la plus simple de trouver le bon : ouvrez le Gestionnaire de périphériques, débranchez la carte, rebranchez-la, et le port qui disparaît puis revient est le vôtre. Il indique aussi que les pilotes USB-série sont généralement fournis avec le système d’exploitation et s’installent d’eux-mêmes.

Pour chaque carte :

- **Le ventre** se flashe par son port Type-C marqué « USB to UART », que Waveshare décrit comme le port d’alimentation, de programmation et de débogage. La page ESP-IDF de Waveshare recommande d’installer les pilotes via l’ESP-IDF Installation Manager (EIM).
- **La tête** a une puce USB-série CH343P (WCH), indiquée sur la page produit de Waveshare.

Si une carte n’entre pas d’elle-même en mode téléchargement, ou pour son premier flashage, le guide d’Espressif donne la méthode manuelle : maintenez BOOT, appuyez une fois sur RESET, relâchez BOOT.

### L’alternative : VS Code

La [page Get Started](https://docs.espressif.com/projects/esp-idf/en/v6.1/esp32p4/get-started/index.html) d’Espressif recommande deux voies d’installation : l’ESP-IDF Installation Manager (EIM), et un IDE, soit Espressif-IDE, soit VS Code avec l’extension ESP-IDF. La page ESP-IDF de Waveshare détaille EIM plus l’extension VS Code sous Windows : installez ESP-IDF avec EIM (dans un chemin sans espaces), puis l’extension, qui à partir de la version 2.0 détecte l’installation d’elle-même. La barre d’outils du bas a alors des boutons pour choisir le port COM, définir la cible (`esp32p4`), compiler, flasher et ouvrir le moniteur.

Une installation native flashe directement, sans pont. Le prix est une installation volumineuse sur le PC, et vous devez installer la même branche `release/v6.1` que demande Xiaozhi, et non la première version que propose EIM.

## Le construire avec Claude

Demandez à Claude les commandes pour compiler les deux cartes dans l’image Docker d’Espressif et pour les flasher depuis Windows. L’idée que Claude doit bien saisir : c’est le firmware exécuté qui décide de la version ; Xiaozhi a besoin d’ESP-IDF 6.0.1 ou plus récent, donc la compilation utilise `espressif/idf:release-v6.1`, et le flashage se fait hors de Docker.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas la conversation qui a servi à configurer le bot.

> Je compile du firmware ESP32 sous Windows avec Docker et je ne veux pas installer ESP-IDF en natif. Mon projet est un fork de 78/xiaozhi-esp32 pour une carte ESP32-P4, plus une petite application ESP-IDF pour un ESP32-S3 dans un sous-dossier. Lis le README et le workflow de CI de Xiaozhi ainsi que le guide IDF Docker Image d’Espressif, puis dis-moi : quelle étiquette `espressif/idf` utiliser et pourquoi, la commande `docker run` exacte pour compiler chaque cible depuis PowerShell, et comment flasher et surveiller chaque carte depuis Windows sachant que Docker ne peut pas transmettre les ports série USB. Cite la documentation pour chaque version et chaque commande.

### Ce qu’il faut vérifier dans la réponse de Claude

1. L’image est `espressif/idf:release-v6.1`, la branche `release/v6.1` que recommande Xiaozhi, pas le tag `v6.1` ni une version 5.x de la page de Waveshare.
2. La compilation s’exécute dans Docker avec le dossier du projet monté sur `/project`, et passe `-e IDF_GIT_SAFE_DIR=/project` pour l’erreur « dubious ownership ».
3. Le ventre est compilé pour `esp32p4` avec `scripts/build.py`, et la tête pour `esp32s3` avec `idf.py set-target esp32s3`.
4. Le flashage n’utilise pas `--device` sous Windows. Il utilise esptool sur l’hôte avec `write-flash 0x0` pour le binaire fusionné, ou `esp_rfc2217_server` avec `host.docker.internal` comme hôte du port.
5. Le ventre est flashé par son port Type-C marqué « USB to UART », et la réponse mentionne `idf.py fullclean` après un changement de version d’ESP-IDF.

Si une vérification échoue, décrivez à Claude ce que vous voyez : « la compilation du ventre échoue avec ESP-IDF 5.5.2 » ou « le conteneur ne trouve pas mon port COM ».

### Comment l’auteur l’a demandé

La question de la chaîne d’outils est née d’une décision antérieure. Quand l’IA a demandé ce que le ventre devait exécuter pour donner une voix à Narsil, l’auteur ou l’autrice a répondu :

> yo pensaba hacerlo con Xiaozhi

Traduction en français : je pensais le faire avec Xiaozhi.

L’IA a alors lu le README de Xiaozhi, y a trouvé son exigence, ESP-IDF 6.0.1 ou ultérieure, et l’a mise à côté du 5.3.1 documenté par Waveshare. Elle a consigné l’écart comme un risque dans le document de tâches, avec le plan de compiler dans l’image Docker d’Espressif et de laisser le flashage et les vérifications à l’écran à la personne qui a les cartes. La règle appliquée est celle de ce guide : le firmware qui tourne décide de la version, et la documentation de la carte ne fixe qu’un minimum.

La seconde décision qui façonne la chaîne d’outils est l’endroit où vit le code. Interrogé sur l’emplacement du firmware, l’auteur ou l’autrice a choisi :

> repo propio como fork

Traduction en français : un dépôt à soi, sous forme de fork.

Puis, à la question de savoir s’il devait être public ou privé dès le départ, l’auteur ou l’autrice a répondu « 1 », la première option proposée : public dès le départ. C’est pourquoi les deux cartes se compilent depuis un seul dépôt, `davshn/narsil-bot`, et pourquoi la chaîne d’outils doit gérer deux cibles dans une seule arborescence.

## Code de référence

Ce code est une réponse correcte, écrite pour ce guide. Lisez-le pour comprendre comment les pièces s’assemblent et pour le comparer avec ce que Claude a écrit pour vous : Claude peut choisir d’autres noms ou un autre ordre et avoir quand même raison.

Compiler le ventre, depuis la racine du fork dans PowerShell (`${PWD}` est le dossier courant de PowerShell ; l’option `-u $UID` est pour Linux et macOS et n’apparaît pas ici) :

```powershell
docker run --rm -v ${PWD}:/project -w /project -e HOME=/tmp -e IDF_GIT_SAFE_DIR=/project `
  espressif/idf:release-v6.1 `
  python scripts/build.py waveshare/esp32-p4-wifi6-touch-lcd --name esp32-p4-wifi6-touch-lcd-4.3 --language es-ES
```

Le guide 3 explique le dossier de la carte, le `--name` et la langue. Compiler la tête, depuis son dossier :

```powershell
docker run --rm -v ${PWD}:/project -w /project/head -e HOME=/tmp -e IDF_GIT_SAFE_DIR=/project `
  espressif/idf:release-v6.1 `
  sh -c "idf.py set-target esp32s3 && idf.py build"
```

Flasher le ventre depuis Windows avec esptool, avec un nom de port inventé :

```powershell
esptool --port COM5 write-flash 0x0 build/merged-binary.bin
```

Flasher la tête par le pont série. Dans un terminal, partagez le port :

```powershell
esp_rfc2217_server -v -p 4000 COM6
```

Dans un autre, flashez depuis le conteneur :

```powershell
docker run --rm -v ${PWD}:/project -w /project/head -e HOME=/tmp -e IDF_GIT_SAFE_DIR=/project `
  espressif/idf:release-v6.1 `
  idf.py --port "rfc2217://host.docker.internal:4000?ign_set_control" flash
```

Pour le moniteur, le même `--port` fonctionne avec `idf.py monitor` ; ajoutez `-it` à `docker run` pour que le conteneur ait un terminal où s’afficher.

## Erreurs fréquentes et comment tester

- **Compiler Xiaozhi avec ESP-IDF 5.x.** Le README de Xiaozhi dit explicitement que la 5.x n’est plus prise en charge. Si vous avez suivi la page d’installation de Waveshare et installé la 5.5.2, le ventre ne compilera pas ; utilisez `release-v6.1`.
- **Mélanger les dossiers de compilation après un changement de version.** Le README de Xiaozhi demande un `idf.py fullclean` après un changement de révision d’ESP-IDF. Un dossier `build` périmé issu d’une autre version donne des erreurs qui semblent sans rapport.
- **Essayer `--device` sous Windows.** Cela ne fonctionne que sous Linux. Sous Windows, flashez depuis l’hôte ou via `esp_rfc2217_server`.
- **« dubious ownership » de git dans le conteneur.** Passez `-e IDF_GIT_SAFE_DIR=/project`, comme le documente le guide IDF Docker.
- **Aucun port COM n’apparaît.** Débranchez et rebranchez en observant le Gestionnaire de périphériques. Si rien ne change, essayez un autre câble : un câble USB qui ne fait que charger n’a pas de lignes de données.
- **Le mauvais port sur le ventre.** Flashez par le port Type-C marqué « USB to UART », et non par le port USB OTG.
- **La carte ne répond pas à esptool.** Maintenez BOOT, appuyez sur RESET, relâchez BOOT, et flashez de nouveau.

Pour tester la chaîne d’outils avant Xiaozhi, compilez l’exemple `hello_world` d’ESP-IDF pour chaque cible dans le conteneur, flashez-le, et cherchez sa sortie dans le moniteur. Si les deux cartes affichent quelque chose, la chaîne d’outils, les pilotes et les câbles sont corrects.

## Pour aller plus loin

- `docker run` avec `-it` et sans commande ouvre un shell dans le conteneur, où vous pouvez lancer `idf.py menuconfig` et les autres commandes de façon interactive, comme le montre le guide IDF Docker.
- Épinglez l’image par son digest plutôt que par son étiquette si vous voulez que chaque compilation du bot utilise exactement le même commit d’ESP-IDF ; `release-v6.1` bouge avec la branche.
- `scripts/build.py --list-boards` de Xiaozhi affiche chaque carte et variante qu’il connaît, ce qui permet de vérifier rapidement un nom de carte avant une longue compilation.
- La référence complète des commandes d’ESP-IDF se trouve dans la documentation d’Espressif pour chaque puce ; changez la puce dans l’URL (`esp32p4`, `esp32s3`) pour voir ses propres pages.
