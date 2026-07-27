# Métadonnées de fichiers — pistes

Audit rapide de ce qu'on pourrait afficher en plus dans les propriétés d'un
fichier (lightbox, panneau détail), classé par coût d'implémentation. Rien
d'implémenté ici sauf mention contraire — c'est une liste d'idées.

## Déjà fait

- [x] Taille exacte visible dans la lightbox image (ajouté suite à la confusion
      sur la barre de quota — voir date du jour dans le changelog)
- [x] Date/heure d'upload (`formatDateTime`)
- [x] Nom d'affichage personnalisable (`displayName`, sans toucher au fichier physique)
- [x] Type de fichier détecté par extension (`fileType`)

## Coût quasi nul (déjà dans `storage.stat()` / le nom de fichier, aucune dépendance)

- **Nom de fichier original** — utile pour retrouver la source une fois qu'un
  `displayName` a été mis dessus. Actuellement invisible une fois renommé.
- **Extension / type MIME détaillé** — `fileType` regroupe déjà par catégorie
  (image/video/…), mais l'extension précise (`.heic` vs `.jpg`) n'est montrée
  nulle part dans les détails, seulement dans le nom de fichier.
- **Date de dernière modification** vs **date d'upload** — actuellement
  `storage.stat()` ne remonte que `mtimeMs`, traité comme date d'upload. Pas
  de distinction upload/modification, mais pas forcément utile tant qu'il n'y
  a pas d'édition de fichier possible.

## Coût faible (pure JS, pas de dépendance binaire/native)

- **Dimensions image (largeur × hauteur)** — via un parseur d'en-têtes léger
  type [`image-size`](https://www.npmjs.com/package/image-size) (pur JS, lit
  juste les headers du fichier, pas de décodage complet ni de binding natif —
  donc pas de souci de cross-compile arm64 sur le Pi). Calculé à l'upload et
  stocké à côté de `displayNames`/`apiKeys` (même pattern `.json` via
  `storage.readTextFile`/`writeTextFile`).
- **Checksum (sha256)** — calculable au moment de l'upload avec `crypto`
  (déjà utilisé pour les clés API). Permet de détecter les doublons (même
  fichier uploadé deux fois sous des noms différents) et donne une empreinte
  stable pour un futur système de sync/backup.

## Coût moyen (nouvelle dépendance, à peser)

- **Métadonnées EXIF (photos)** — via [`exifr`](https://www.npmjs.com/package/exifr)
  (pur JS). Intéressant : modèle d'appareil/téléphone, date de prise de vue
  réelle (différente de la date d'upload — utile pour trier de vieilles
  photos importées d'un coup). **Attention vie privée** : l'EXIF contient
  souvent des coordonnées GPS précises. Si on extrait l'EXIF, il faudrait soit
  ne jamais exposer le GPS dans l'API/l'UI, soit le rendre opt-in explicite —
  ne pas le stocker/afficher par défaut vu l'usage (photos personnelles/famille).
- **Durée vidéo/audio** — nécessiterait `ffprobe`/ffmpeg (binaire externe,
  lourd à installer et faire tourner sur un Pi). Probablement pas rentable
  pour la valeur ajoutée — à ne considérer que si le besoin devient concret.

## Idée transverse (pas une métadonnée en soi)

- **Détection de doublons à l'upload** — si le hash sha256 est calculé, on
  peut avertir "ce fichier existe déjà sous le nom X" avant même de finaliser
  l'upload, plutôt que de le découvrir après coup en fouillant la liste.
