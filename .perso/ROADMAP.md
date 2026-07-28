# AbFlow — Roadmap

## État des lieux

**Stack :** Node.js/Express · Vue 3 TypeScript · Docker Compose · nginx  
**Auth :** single-user, bcrypt + JWT 24h + rate limiting  
**Stockage :** local FS ou SFTP (configurable via `.env`)  
**En ligne :** `https://abflow.rxdy.fr` (Traefik + Let's Encrypt + Watchtower sur le Pi)

---

## Phase 1 — Nettoyage & quick wins ✅
## Phase 2 — Upload ✅
## Phase 3 — Navigation & confort fichiers ✅
## Phase 4 — Sécurité & robustesse ✅
## Phase 5 — Déploiement & infra ✅
## Phase 6 — Partage ✅
## Phase 7 — Audit Sécurité ✅ (backend/nginx non-root frontend et audit deps frontend restants)
## Phase 9 — Tests ✅ (102 backend + 154 frontend + e2e, ~99% de couverture)
## Intégration AbFlow ↔ AbView ✅ (préparé, pas encore remergé — voir feature/photos-carrousel côté AbView)

> Détail dans les sections archivées en bas de fichier.

---

---

## Phase 7 — Audit Sécurité ✅ (l'essentiel fait, le site est public depuis)

> Objectif initial : durcir le backend et l'infra avant toute exposition réseau. Le
> site est maintenant réellement public (`https://abflow.rxdy.fr`), donc cette phase
> est passée de "précaution" à "réellement nécessaire" et a été traitée en priorité.

### 7.1 Headers HTTP de sécurité (`helmet` + nginx) ✅

- [x] `helmet` dans Express — CSP, X-Content-Type-Options, X-Frame-Options,
      Referrer-Policy, HSTS, tous actifs par défaut. `crossOriginResourcePolicy`
      explicitement repassé à `cross-origin` (le défaut `same-origin` de helmet
      aurait cassé l'usage même des clés API — une app externe comme AbView qui
      charge des images cross-origin via `<img src="…?key=…">`)
- [x] HSTS — vient de helmet côté backend ; pas ajouté séparément dans
      `nginx.https.conf` (config HTTPS locale auto-signée, hors scope prod)
- [x] `Content-Security-Policy` — défaut helmet (`default-src 'self'`), protège
      surtout `/uploads/:filename` et `/share/:token` contre un SVG/HTML malveillant
      uploadé puis ouvert directement (script embarqué qui s'exécuterait sinon)
- [x] `Permissions-Policy` (caméra/micro/géoloc désactivés) — pas dans les
      défauts de helmet 8, ajouté à la main

### 7.2 JWT renforcé ✅

- [x] `{ algorithms: ['HS256'] }` sur `jwt.verify()` — testé (rejette un token
      forgé en `alg:"none"` et un token signé avec un autre algo)
- [x] Warning au démarrage si `JWT_SECRET` fait moins de 32 caractères

### 7.3 Rate limiting étendu ✅

- [x] Rate limiter sur `POST /api/images/upload` (20 req/min)
- [x] Rate limiter sur `POST /api/share` (30 req/min)
- [x] `express.json({ limit: '1mb' })` sur toutes les routes JSON

### 7.4 Nettoyage des share tokens ✅

- [x] `setInterval` de purge toutes les heures (`.unref()` pour ne pas bloquer
      l'arrêt du process)

### 7.5 Docker sécurisé (non-root) — backend fait, frontend en attente

- [x] Backend : tourne en non-root (uid 1000, matche le propriétaire de
      `~/abflow/uploads` sur le Pi — vérifié : upload/delete fonctionnent).
      **Piège trouvé en testant** : les fichiers existants sur le Pi appartenaient
      à root (créés par l'ancien conteneur root) — un `chown -R` sur le Pi est
      nécessaire au moment du déploiement, sinon écriture cassée pour tout le monde.
- [ ] Frontend : `nginx:alpine-slim` adopté (voir 8.x, gain de taille), mais pas
      passé en non-root — demanderait de remapper le port d'écoute (80 → 8080,
      requiert privilège root pour bind <1024) et de toucher au label Traefik en
      prod. Risque de mauvaise config pour un gain sécurité faible (nginx ne fait
      que servir du statique + proxy, pas de traitement de contenu utilisateur) —
      remis à plus tard plutôt que précipité dans ce lot.

### 7.6 Audit dépendances ✅ (backend), frontend en attente

- [x] `npm audit` backend — 2 vulnérabilités (multer DoS haute sévérité,
      body-parser) corrigées via `npm audit fix` (patch non-breaking)
- [ ] `npm audit` frontend — 10 vulnérabilités restantes, toutes dans la chaîne
      vite/esbuild/@vitejs-plugin-vue, **dev-only** (le serveur de dev accepte des
      requêtes de n'importe quel site — sans impact en prod, qui ne sert que du
      statique déjà buildé). Fix nécessite un saut majeur vite 5→8 (breaking) —
      pas fait ici, à traiter dans une session dédiée avec le temps de tout
      revalider derrière.

### 7.7 Nginx hardening ✅

- [x] `server_tokens off`
- [x] `client_max_body_size` déjà à `210M` (le `11M` de cette todo était obsolète)
- [x] `X-Content-Type-Options nosniff`, `X-Frame-Options SAMEORIGIN` (pas `DENY` —
      casserait la visionneuse PDF, qui affiche le fichier dans un `<iframe>`
      même origine)
- [x] `proxy_connect_timeout`/`proxy_read_timeout` sur les locations proxifiées

---

## Phase 8 — Audit Performance

> Objectif : rendre l'app fluide sur Raspberry Pi avec potentiellement des milliers de fichiers.

### 8.1 Cache mémoire `listFiles()`

- [ ] `listFiles()` est appelé à **chaque requête** (`GET /api/images`, `GET /api/stats`, quota check, share check) — ajouter un cache en mémoire invalidé uniquement à l'upload et à la suppression
- [ ] Mesurer l'impact : sur 1000 fichiers en SFTP, chaque requête fait une connexion SSH complète

### 8.2 Cache HTTP sur les fichiers ✅

- [x] `Cache-Control: private, max-age=31536000, immutable` sur `/uploads/:filename`
      (`private` plutôt que `public` du todo original — l'accès passe par un
      token/clé dans l'URL, un cache partagé ne devrait pas redistribuer ça).
      A fallu `proxy_hide_header Cache-Control` en même temps : `res.sendFile()`
      côté backend pose déjà son propre header, sans ça la réponse en avait deux
      contradictoires
- [x] ETag — déjà géré automatiquement par `res.sendFile()`, rien à faire

### 8.3 Compression nginx ✅

- [x] `gzip on` — types texte (JSON/JS/CSS), html couvert par défaut par nginx
- [x] Images/vidéos/audio pas dans `gzip_types` (déjà compressés, gzip dessus
      gaspillerait du CPU)

### 8.x Images Docker allégées (pas dans le plan initial, fait pendant l'audit)

- [x] Backend : `node:20-alpine` (embarque yarn, jamais utilisé) → `alpine:3.19`
      + `apk add nodejs npm`, **210 Mo → 118 Mo** (-44%). `npm ci` au lieu de
      `npm install` + `npm cache clean --force`. Vérifié : login bcrypt+JWT,
      upload, delete, ssh2-sftp-client — tout fonctionne à l'identique
    - [x] **Suite immédiate, en CI** : le build multi-arch (`linux/arm64` sous
      QEMU sur le runner amd64) plantait de façon non-déterministe pendant
      `npm ci` (exit 132 = SIGILL). Passage en Dockerfile multi-stage avec
      `--platform=$BUILDPLATFORM` sur le stage d'install (même trick que le
      frontend, cf. 8.x frontend ci-dessous) : `npm ci` tourne nativement sur
      le runner, seul `node_modules` est copié dans le stage final arm64.
      Aucun risque d'archi puisqu'aucune dépendance ne compile de binaire
      natif ici (l'addon optionnel `cpu-features` de `ssh2` retombe sur son
      fallback JS, faute de toolchain — vérifié, zéro fichier `.node` dans
      `node_modules`). Bonus : `npm` lui-même n'est plus nécessaire à
      l'exécution, retiré du stage final (~118 Mo → ~102 Mo)
- [x] Frontend : `nginx:alpine` → `nginx:alpine-slim` (exclut les modules non
      utilisés — image-filter, xslt, geoip…), **~93 Mo → ~21 Mo** (-77%).
      Vérifié : sert le statique et proxy vers le backend correctement
- [x] `.dockerignore` ajouté côté backend (n'existait que côté frontend)

### 8.4 Thumbnails images

- [ ] La grille charge les images originales — sur mobile avec une connexion WiFi lente, une photo RAW de 10 Mo dans une cellule de 100px est un gaspillage
- [ ] Options : `sharp` côté backend pour générer des thumbnails à la volée, ou `?w=300` query param

### 8.5 Pagination backend réelle

- [ ] Actuellement `GET /api/images?limit=50&offset=0` charge **tous** les fichiers puis découpe en mémoire — sur 10k fichiers, c'est 10k entrées chargées pour en retourner 50
- [ ] Implémenter un tri et une pagination natifs dans `listFiles()` (tri par date de modification, slice en amont)

### 8.6 Analyse bundle frontend

- [ ] Installer `rollup-plugin-visualizer` en devDependency
- [ ] Analyser le bundle : vérifier qu'aucune lib lourde n'a été importée accidentellement
- [ ] Activer `build.minify: true` et vérifier les chunks

---

## Phase 9 — Tests ✅ (largement dépassé le scope initial)

> Objectif initial : couvrir les fonctions critiques avec quelques dizaines de tests.
> Réalité fin juillet 2026 : **102 tests backend** (`node --test` + supertest, ~99%
> de couverture lignes) et **154 tests frontend** (Vitest + Testing Library, ~99.8%
> de couverture lignes) + 1 parcours e2e Playwright. Toutes les lignes ci-dessous
> sont couvertes, souvent avec plus de cas que listé (chemins d'erreur, doublons,
> annulations, backdrop-click, etc. — pas seulement le happy path).

### 9.1 Tests unitaires backend ✅

`node --test` (pas vitest — plus léger, aucune dépendance de test supplémentaire).
Couvre : auth (JWT algo pinning inclus), images CRUD, quota, partage + purge,
clés API, métadonnées (nom original, MIME, dimensions, EXIF, doublons sha256),
rate limiting (login/upload/partage), headers de sécurité, storage local et SFTP
(mocké), la factory de storage.

### 9.2 + 9.3 Tests frontend (composables + composants) ✅

Vitest + Testing Library. Couvre tous les composables (`useAuth`, `useApi`,
`useStats`) et toutes les vues/composants (`LoginView`, `UploadView`,
`TimelineView`, `SettingsView`, `AppHeader`, `AppFooter`, `BottomNav`).
`abflowService` (côté AbView) hors scope de ce repo.

### 9.4 Tests E2E (Playwright) ✅ (parcours critique)

Un parcours bout-en-bout via Docker Compose : login → upload → apparition dans
la timeline → suppression. Couvre le flow complet plutôt que 4 flows séparés —
suffisant pour un projet à cette échelle, extensible si un flow spécifique
casse un jour sans être couvert par les tests unitaires.

---

## Phase 10 — Audit Qualité & Architecture

> Objectif : code maintenable, détection d'erreurs en amont.

### 10.1 ESLint frontend

- [ ] Installer `eslint`, `@typescript-eslint/eslint-plugin`, `eslint-plugin-vue`
- [ ] Activer règles : `no-console`, `vue/no-unused-vars`, `@typescript-eslint/no-explicit-any`
- [ ] Optionnel : `eslint-plugin-security` pour détecter des patterns dangereux

### 10.2 ESLint backend

- [ ] Installer `eslint` + `eslint-plugin-security` dans le backend
- [ ] Règles clés : `security/detect-object-injection`, `security/detect-non-literal-regexp`, `security/detect-possible-timing-attacks`

### 10.3 Health check docker-compose

- [ ] Ajouter un `healthcheck` sur le service `backend` dans `docker-compose.yml` — le frontend démarre parfois avant que le backend soit prêt (Express lent à démarrer avec bcrypt.hash)
- [ ] Le frontend ne devrait pas servir les requêtes API tant que le backend n'est pas `healthy`

### 10.4 Validation `.env` au démarrage

- [ ] `CORS_ORIGIN` vide → avertissement explicite ("toutes les origines bloquées, pas de CORS configuré")
- [ ] `API_KEY` vide → avertissement (AbView ne peut pas se connecter)
- [ ] `STORAGE_QUOTA_MB` invalide → erreur fatale
- [ ] Documenter chaque variable dans `.env.example` avec une description plus complète

### 10.5 Gestion d'erreurs Vue globale

- [ ] Ajouter `app.config.errorHandler` dans `main.ts` pour logger les erreurs Vue non catchées
- [ ] Ajouter un composant `ErrorBoundary` optionnel pour afficher un message propre à l'utilisateur

### 10.6 CI/CD ✅ (dépassé le scope initial)

- [x] GitHub Actions : typecheck + tests (backend/frontend/e2e) sur chaque push/PR
- [x] Build & push des images sur GHCR à chaque push sur `main`, déploiement
      automatique sur le Pi via Watchtower (voir `DEPLOY_RUNNER.md`) — pas juste
      "build sur chaque tag", un vrai pipeline de déploiement continu
- [ ] `npm audit --audit-level=high` en étape CI dédiée — fait manuellement pour
      l'instant (voir Phase 7.6), pas encore automatisé dans le pipeline

---

## Fait ✅ (archive)

<details>
<summary>Voir le détail des phases 1 à 6 + intégration AbView</summary>

### Phase 1 — Nettoyage
- [x] Supprimer les composants inutilisés
- [x] Corriger le titre de la page upload
- [x] État vide avec CTA

### Phase 2 — Upload
- [x] Upload multiple + queue par fichier
- [x] Vraie barre de progression XHR
- [x] Confirmation `beforeunload`

### Phase 3 — Navigation & confort
- [x] Navigation clavier lightbox (← → Échap)
- [x] Swipe mobile lightbox
- [x] Bouton téléchargement (lightbox + liste)
- [x] Bouton partage + copie presse-papiers
- [x] Recherche par nom
- [x] Tri par date/nom/taille
- [x] Visionneuse vidéo, audio, PDF

### Phase 4 — Sécurité & robustesse
- [x] Détection 401 en session → redirect login avec message
- [x] Validation MIME côté backend
- [x] Quota de stockage configurable (`STORAGE_QUOTA_MB`)

### Phase 5 — Déploiement & infra
- [x] `make dev` — une seule commande
- [x] `make https` — certificat self-signed + docker-compose.https.yml
- [x] PWA — manifest.json + icônes SVG

### Phase 6 — Partage
- [x] Lien de partage temporaire 24h (`/share/:token`)
- [x] Copie URL dans le presse-papiers + toast de confirmation

### Intégration AbFlow ↔ AbView
- [x] Support `?key=` sur `/uploads/:filename` pour `<img src>`
- [x] `abflowService.ts` dans AbView (VITE_ABFLOW_URL + VITE_ABFLOW_API_KEY)
- [x] ScreensaverModule adapté — AbFlow en source principale, Google Photos en fallback
- [x] Détection d'inactivité (`VITE_IDLE_TIMEOUT_MS`, défaut 3 min) → screensaver automatique

</details>
