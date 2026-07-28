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

- [x] **Métadonnées EXIF (photos)** — via [`exifr`](https://www.npmjs.com/package/exifr)
      v7 (pur JS). Extrait modèle d'appareil (`Make`+`Model`, dédupliqués si le
      modèle répète déjà la marque) et date de prise de vue réelle
      (`DateTimeOriginal`). **Le GPS n'est jamais lu** : `pick: ['Make', 'Model',
      'DateTimeOriginal']` désactive le bloc GPS d'exifr à la source (il n'est
      même pas parsé, pas juste filtré après coup) — vérifié avec une photo de
      test contenant de vraies coordonnées GPS, absentes du résultat. Modèle
      d'appareil affiché dans la lightbox ; la date de prise de vue est utilisée
      pour grouper les photos par jour dans la timeline (`takenAt ?? uploadedAt`)
      plutôt que la date d'upload — résout le cas "vieilles photos importées
      d'un coup" qui motivait cette suggestion.

## Coût quasi nul restant

- **Date de dernière modification** vs **date d'upload** — `storage.stat()`
  ne remonte que `mtimeMs`, traité comme date d'upload. Pas de distinction
  upload/modification, mais toujours pas utile tant qu'il n'y a pas d'édition
  de fichier possible côté serveur.

## Coût moyen (nouvelle dépendance, à peser)

- **Durée vidéo/audio** — nécessiterait `ffprobe`/ffmpeg (binaire externe,
  lourd à installer et faire tourner sur un Pi). Probablement pas rentable
  pour la valeur ajoutée — à ne considérer que si le besoin devient concret.

## Idée transverse pas encore traitée

- **Avertissement de doublon dans l'UI d'upload** — le rejet 409 remonte déjà
  proprement un message d'erreur exploitable côté frontend (testé), mais rien
  d'affiné visuellement pour l'instant (pas de bouton "voir le fichier
  existant" par ex.) — actuellement juste affiché comme n'importe quelle autre
  erreur d'upload dans `UploadView`.
