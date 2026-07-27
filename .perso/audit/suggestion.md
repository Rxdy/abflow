# Métadonnées de fichiers — pistes

Audit de ce qu'on pourrait afficher en plus dans les propriétés d'un fichier
(lightbox, panneau détail), classé par coût d'implémentation.

## Déjà fait

- [x] Taille exacte visible dans la lightbox image (ajouté suite à la confusion
      sur la barre de quota)
- [x] Date/heure d'upload (`formatDateTime`)
- [x] Nom d'affichage personnalisable (`displayName`, sans toucher au fichier physique)
- [x] Type de fichier détecté par extension (`fileType`)
- [x] **Nom de fichier original** — capturé à l'upload (`req.file.originalname`),
      stocké dans `.file-meta.json`, utilisé comme titre du bouton téléchargement
      dans la lightbox (`originalName ?? filename`). Uniquement pour les fichiers
      uploadés après ce changement — pas de backfill des anciens.
- [x] **Type MIME détaillé** — capturé à l'upload (`req.file.mimetype`), exposé
      via l'API (`GET /api/images`, `/api/images/:filename`) mais pas encore
      affiché dans l'UI (pas de demande spécifique dessus pour l'instant).
- [x] **Dimensions image (largeur × hauteur)** — via [`image-size`](https://www.npmjs.com/package/image-size)
      v2 (pur JS, pas de binding natif). Calculées à l'upload sur les fichiers
      `fileType === 'image'` uniquement, lues depuis `req.file.path` avant le
      transfert vers le storage backend (local ou SFTP). Affichées dans la
      lightbox à côté de la taille. Échec de parsing (format non supporté)
      non-bloquant : `width`/`height` restent `null`.
- [x] **Checksum (sha256)** — calculé à l'upload (stream, pas de chargement
      complet en mémoire), stocké dans `.file-meta.json`, **jamais exposé via
      l'API** (usage interne uniquement pour la détection de doublons).
- [x] **Détection de doublons à l'upload** (idée transverse validée) — un
      upload dont le sha256 correspond à un fichier déjà présent est rejeté
      avec `409 { error, duplicateOf }` et n'est jamais écrit sur le storage
      final (ni compté dans le quota). Le message reprend le `displayName` du
      fichier existant si personnalisé. Ré-uploader le même contenu redevient
      possible après suppression de l'original (l'entrée `.file-meta.json`
      est nettoyée par les deux endpoints DELETE, single et bulk).

## Coût quasi nul restant

- **Date de dernière modification** vs **date d'upload** — `storage.stat()`
  ne remonte que `mtimeMs`, traité comme date d'upload. Pas de distinction
  upload/modification, mais toujours pas utile tant qu'il n'y a pas d'édition
  de fichier possible côté serveur.

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

## Idée transverse pas encore traitée

- **Avertissement de doublon dans l'UI d'upload** — le rejet 409 remonte déjà
  proprement un message d'erreur exploitable côté frontend (testé), mais rien
  d'affiné visuellement pour l'instant (pas de bouton "voir le fichier
  existant" par ex.) — actuellement juste affiché comme n'importe quelle autre
  erreur d'upload dans `UploadView`.
