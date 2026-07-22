# AbFlow — Roadmap

## État des lieux

**Stack :** Node.js/Express · Vue 3 TypeScript · Docker Compose · nginx  
**Auth :** single-user, bcrypt + JWT 24h + rate limiting  
**Stockage :** local FS ou SFTP (configurable via `.env`)

---

## Phase 1 — Nettoyage & quick wins ✅
## Phase 2 — Upload ✅
## Phase 3 — Navigation & confort fichiers ✅
## Phase 4 — Sécurité & robustesse ✅
## Phase 5 — Déploiement & infra ✅
## Phase 6 — Partage ✅
## Intégration AbFlow ↔ AbView ✅

> Détail dans les sections archivées en bas de fichier.

---

---

## Phase 7 — Audit Sécurité

> Objectif : durcir le backend et l'infra avant toute exposition réseau (Raspberry Pi local = surface d'attaque réelle).

### 7.1 Headers HTTP de sécurité (`helmet` + nginx)

- [ ] Installer `helmet` dans Express — active automatiquement : `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `X-DNS-Prefetch-Control`
- [ ] Ajouter HSTS dans `nginx.https.conf` (`Strict-Transport-Security: max-age=31536000`)
- [ ] Ajouter `Content-Security-Policy` : autoriser uniquement `self` + blob: pour les previews
- [ ] Ajouter `Permissions-Policy` (désactiver caméra, micro, géolocalisation)

### 7.2 JWT renforcé

- [ ] Passer `{ algorithms: ['HS256'] }` à `jwt.verify()` — sans ça, l'algorithme `none` peut être accepté si l'attaquant forge un token
- [ ] Logger un warning si `JWT_SECRET` fait moins de 32 caractères au démarrage

### 7.3 Rate limiting étendu

- [ ] Ajouter un rate limiter sur `POST /api/images/upload` (ex. 20 req/min) — actuellement seul le login est limité
- [ ] Ajouter un rate limiter sur `POST /api/share` (ex. 30 req/min) — éviter la génération massive de tokens
- [ ] Limiter la taille du body JSON sur toutes les routes non-upload (`express.json({ limit: '1mb' })`)

### 7.4 Nettoyage des share tokens

- [ ] Ajouter un `setInterval` de purge toutes les heures — les tokens en mémoire ne sont jamais purgés actuellement (leak mémoire sur le long terme)
- [ ] Optionnel : persister les tokens dans un fichier JSON pour survivre aux restarts

### 7.5 Docker sécurisé (non-root)

- [ ] Backend `Dockerfile` : ajouter `USER node` avant `CMD` — actuellement le process tourne en root dans le conteneur
- [ ] Frontend `Dockerfile` : utiliser `nginx:alpine-unprivileged` ou configurer nginx pour écouter sur le port 8080 en non-root
- [ ] Passer l'image de base backend de `node:20-alpine` à `node:20-alpine` avec `--no-new-privileges`

### 7.6 Audit dépendances

- [ ] Exécuter `npm audit` dans `backend/` et corriger les vulnérabilités critiques/hautes
- [ ] Exécuter `npm audit` dans `frontend/` idem
- [ ] Vérifier les dépendances outdated : `npm outdated` dans les deux projets

### 7.7 Nginx hardening

- [ ] Ajouter `server_tokens off` dans nginx.conf (masque la version nginx)
- [ ] Corriger `client_max_body_size 11M` → `210M` (incohérent avec la limite backend de 200 Mo)
- [ ] Ajouter `add_header X-Content-Type-Options nosniff` et `add_header X-Frame-Options DENY`
- [ ] Ajouter un timeout sur les connexions upstream (`proxy_connect_timeout`, `proxy_read_timeout`)

---

## Phase 8 — Audit Performance

> Objectif : rendre l'app fluide sur Raspberry Pi avec potentiellement des milliers de fichiers.

### 8.1 Cache mémoire `listFiles()`

- [ ] `listFiles()` est appelé à **chaque requête** (`GET /api/images`, `GET /api/stats`, quota check, share check) — ajouter un cache en mémoire invalidé uniquement à l'upload et à la suppression
- [ ] Mesurer l'impact : sur 1000 fichiers en SFTP, chaque requête fait une connexion SSH complète

### 8.2 Cache HTTP sur les fichiers

- [ ] Ajouter `Cache-Control: public, max-age=31536000, immutable` sur `/uploads/:filename` — les noms de fichiers incluent un timestamp donc ils sont immuables
- [ ] Ajouter `ETag` pour les fichiers (déjà géré par express.static si on l'utilisait, mais on pipe manuellement — implémenter à la main)

### 8.3 Compression nginx

- [ ] Activer `gzip on` dans nginx.conf pour les réponses JSON/HTML/JS/CSS
- [ ] Exclure les images et vidéos (déjà compressés)

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

## Phase 9 — Tests

> Objectif : couvrir les fonctions critiques. `vitest` et `@testing-library/vue` sont déjà installés.

### 9.1 Tests unitaires backend

> Installer `vitest` ou `node:test` côté backend.

| Test | Cas couverts |
|------|-------------|
| `POST /api/auth/login` | credentials valides → 200 + token, invalides → 401, manquants → 400 |
| `GET /api/images` | sans token → 401, avec token → 200, filtre `?type=image` |
| `POST /api/images/upload` | fichier valide → 201, extension bloquée → 415, pas de fichier → 400, quota dépassé → 413 |
| `DELETE /api/images` | suppression multiple, fichier inexistant → errors[], auth requise |
| `POST /api/share` | token généré, TTL respecté, `GET /share/:token` sert le fichier, token expiré → 410 |
| `anyAuth` | JWT valide, JWT expiré, API key valide, `?key=` query param, aucun → 401 |

### 9.2 Tests unitaires frontend (composables)

| Test | Cas couverts |
|------|-------------|
| `useAuth` | `login()` stocke le token, `logout()` le supprime + redirige, `authHeaders()` retourne le header correct |
| `useApi` — `getImages()` | appel correct, gestion 401 → logout automatique |
| `useApi` — `uploadImageWithProgress()` | progrès émis, résolution sur 201, rejet sur erreur |
| `useApi` — `createShareLink()` | appel POST correct, retourne url + expiresAt |
| `abflowService` (AbView) | `isConfigured()` false sans env vars, `getPhotos()` mappe correctement les images |

### 9.3 Tests composants frontend

| Composant | Cas couverts |
|-----------|-------------|
| `LoginView` | affiche le form, soumet, affiche les erreurs, affiche le message "session expirée" si `?expired=1` |
| `UploadView` | drop zone reçoit des fichiers, queue affichée, bouton "Publier" actif, progress bar |
| `TimelineView` | filtres changent les résultats, recherche filtre par nom, tri réordonne, lightbox s'ouvre |

### 9.4 Tests E2E (Playwright)

> Installer `@playwright/test`.

| Flow | Étapes |
|------|--------|
| Login complet | visiter `/`, remplir le form, vérifier la redirection vers `/upload` |
| Upload → voir | uploader un fichier image, aller dans `/files`, vérifier qu'il apparaît dans la liste |
| Partage | cliquer "Partager", vérifier que le toast "Lien copié" s'affiche |
| Logout + 401 | supprimer le token localStorage, appuyer sur refresh, vérifier redirect login |

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

### 10.6 CI/CD minimal (optionnel — si GitHub)

- [ ] GitHub Actions : `npm run typecheck` + `npm test` sur chaque push
- [ ] `npm audit --audit-level=high` dans le CI
- [ ] Build Docker sur chaque tag

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
