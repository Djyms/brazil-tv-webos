# Brazil TV pour webOS — sélection pour la France

Français · [Português](README.pt-BR.md)

**Chaînes brésiliennes HD sélectionnées, configurées et testées depuis la France.**
Ce projet rassemble une sélection de flux et une personnalisation indépendante du
[webOS IPTV Player](https://github.com/lennylxx/webos-iptv-player) de **lennylxx**.
Il ne s'agit pas d'une application officielle des diffuseurs, de LG ou de l'auteur du lecteur original.

## Optimisation et tests depuis la France

Le choix des sources, les réglages de lecture et les préférences HD ont été mis au
point pour une utilisation **depuis la France**, sur une **LG OLED CX sous webOS 5.6.2**.
Il s'agit du pays des essais, pas d'une garantie de disponibilité dans tous les pays
ou sur tous les modèles de TV. Aucun géoblocage, abonnement ou contrôle d'accès n'est supprimé.

Les indications 720p/1080p correspondent aux observations faites lors de la sélection.
Les flux peuvent changer de qualité, être interrompus ou devenir indisponibles.
La validation du paquet public a confirmé l'installation, le chargement des 167 chaînes,
leur rechargement après redémarrage, ainsi que la lecture de TV Brasil et Band en
1280 × 720, avec son et image en progression. Toutes les chaînes n'ont pas été
retestées lors de cette publication. Voir aussi les [notes de version](https://github.com/Djyms/brazil-tv-webos/releases).

## Quelle playlist choisir ?

Ajoute **une seule** de ces adresses : elle permet une recherche commune dans les chaînes sélectionnées.

| Utilisation | Adresse à importer | Nombre initial |
| --- | --- | --- |
| Application Brazil TV de ce dépôt | `https://raw.githubusercontent.com/Djyms/brazil-tv-webos/main/brasil-braziltv.m3u` | **167 chaînes** |
| Autres lecteurs M3U classiques | `https://raw.githubusercontent.com/Djyms/brazil-tv-webos/main/brasil.m3u` | **164 chaînes** |

Les chaînes sont classées par thème. Les deux listes se recoupent : les importer
toutes les deux créerait des doublons, sans ajouter de chaînes à la liste Brazil TV.

## Comment obtenir les trois chaînes supplémentaires ?

Les trois chaînes concernées sont **Band**, **TV Gazeta** et **Rede Vida**.
Leur entrée utilise une page ou des métadonnées de lecteur public, plutôt qu'une
adresse HLS permanente. Elles sont donc absentes de la liste M3U classique de 164 chaînes.
L'application Brazil TV contient les résolveurs nécessaires pour demander l'adresse
de lecture au démarrage, lorsque le lecteur public autorise l'accès.

1. Télécharge le fichier `.ipk` Brazil TV dans les [Releases](https://github.com/Djyms/brazil-tv-webos/releases/tag/v1.17.0-brazil.1).
2. Installe-le avec webOS Dev Manager ou les outils de développement webOS.
3. Dans les paramètres des sources/playlists de l'application, ajoute **la première URL du tableau**, celle qui se termine par `brasil-braziltv.m3u`.
4. Enregistre/applique les paramètres : la liste initiale comporte **167 chaînes**, dont ces trois chaînes supplémentaires.

Ajouter simplement leurs adresses de métadonnées à un lecteur HLS classique ne suffit
pas. Le résolveur doit être pris en charge. Cette fonction ne fournit ni compte,
abonnement, clé DRM ni accès à un flux refusé par son diffuseur.

## Pourquoi la configuration personnelle comptait-elle 169 chaînes ?

La sélection personnelle d'origine comprenait aussi **Globo – TV Bahia** et **Unisul TV**.
Le lien TV Bahia n'a pas une provenance suffisamment confirmée pour cette publication,
et le lien Unisul comportait un jeton d'accès. Ils ne sont pas inclus dans les listes publiques.

Les **trois chaînes supplémentaires ci-dessus sont déjà comprises dans les 167 chaînes** :
elles ne font pas passer le total de 167 à 170. Il n'existe pas de réglage « 169 chaînes ».
Pour compléter personnellement une liste, il faut disposer de sources supplémentaires
valides et autorisées, puis les ajouter dans les paramètres des sources. Le dépôt ne
distribue pas ces deux anciens liens ni de jeton personnel. La disponibilité de Globo
n'est pas garantie par cette publication.

## Application et personnalisations

Identifiant de l'application publique : **`com.djyms.braziltv`**.
Elle peut coexister avec `com.lennylxx.iptv`. Favoris, historique et configuration
personnelle ne sont pas migrés automatiquement.

Cette personnalisation de la version **1.17.0** du lecteur comprend :

- l'icône Brazil TV sur fond noir ;
- la récupération des playlists envoyées après le démarrage du service, pour éviter l'affichage de zéro chaîne ;
- la correction de la zone des paramètres sur webOS 5 ;
- l'activation HLS par chaîne et la préférence HD pour les entrées explicitement marquées ;
- les résolveurs de lecteurs publics utilisés par les trois chaînes décrites ci-dessus.

Les traductions et fonctions du lecteur original sont conservées. Le projet ne
constitue pas un nouveau lecteur développé de zéro.

## Fabriquer le paquet

Prérequis : Node.js 20 ou plus récent et accès Internet. L'outil officiel webOS CLI
3.2.6 est fixé dans les dépendances de développement.

```sh
npm ci
npm run build
npm test
```

Le script télécharge le paquet officiel 1.17.0 et hls.js 1.6.16, vérifie leurs
empreintes SHA-256, applique les transformations publiées et utilise l'outil officiel
pour produire `dist/com.djyms.braziltv_1.17.0_all.ipk`.
`SHA256SUMS` et `build-info.json` accompagnent le résultat. Les contrôles de fichiers
ne remplacent pas les essais sur TV. Le build ne lit aucun fichier, adresse ou
identifiant du téléviseur personnel.

## Sources, licences et crédits

Code et kit de personnalisation : Apache-2.0, voir [LICENSE](LICENSE) et [NOTICE](NOTICE).
Lecteur original : **lennylxx**. hls.js : **video-dev / Dailymotion**, Apache-2.0.
Les licences et mentions des composants d'origine sont conservées dans l'application.

Collections utilisées : **iptv-org/iptv**, **Free-TV/IPTV** et **iptv-com/iptv** ;
voir [sources.json](sources.json). Les contenus, noms et logos des chaînes restent
la propriété de leurs titulaires. Aucun programme vidéo n'est hébergé ici. Un lien
public ne confère pas de droits sur son contenu : utilise les flux là où leur
diffusion est autorisée. Les demandes de correction ou retrait peuvent être adressées
dans les Issues du dépôt.
