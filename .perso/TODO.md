# AbFlow — TODO

> Tout ce qui était dans cette liste a été implémenté. Voir ROADMAP.md pour le détail.

## Idées futures

- [ ] **Renommer** un fichier depuis l'interface
- [ ] **Détail fichier** — panneau avec nom complet, taille, date, type
- [ ] **Navigation clavier lightbox** — déjà fait ✅
- [ ] **Refresh token** — ou avertissement quand le JWT est proche d'expirer (24h)
- [ ] **Multi-compte / multi-tenant** — plusieurs comptes utilisateurs, sessions séparées,
      chaque user avec son propre espace de stockage cloisonné (upload/liste/quota isolés
      des autres). Prévu pour le jour où AbFlow tourne sur un serveur plus gros que le Pi
      avec plus de stockage — pas la priorité tant que c'est un seul utilisateur sur le Pi.
      Implique de repenser `AUTH_USERNAME`/`AUTH_PASSWORD` (actuellement un seul compte en
      dur dans `.env`) vers une vraie table de comptes, et de scoper `uploads/`,
      `.display-names.json`, `.api-keys.json` et le quota par utilisateur.
- [ ] **Système de sauvegarde** — pour la maintenance (avant mise à jour, changement de
      matériel, etc.). À définir : quoi sauvegarder (`uploads/`, `.env`, `.display-names.json`,
      `.api-keys.json`), où (autre disque ? SFTP externe ? cloud ?), et si ça doit être
      automatique/planifié ou déclenché à la main avant une opération de maintenance.

## Fait ✅

- [x] Tests backend (`node --test` + supertest) — auth, images, quota, share
- [x] Tests frontend (vitest + testing-library/vue) — format, useAuth, useApi, AppHeader
- [x] CI GitHub Actions — tests + typecheck + build sur chaque push/PR
- [x] CD — build & push GHCR (arm64) après CI verte sur `main`, Watchtower redéploie
      automatiquement sur le Pi (voir `DEPLOY_RUNNER.md`)
- [x] Barre de stockage restant + quota configurable (`STORAGE_QUOTA_MB`)
- [x] Exposition publique via Tailscale Funnel
- [x] Auth bcrypt + JWT + rate limiting
- [x] CORS strict
- [x] `/uploads` protégé (auth requise)
- [x] Frontend TypeScript (Vue 3 `<script setup lang="ts">`)
- [x] Stockage SFTP en alternative au stockage local
- [x] Nom d'app configurable (`VITE_APP_NAME`)
- [x] Layout shell — header sticky (connecté), footer copyright (déconnecté), BottomNav (connecté)
- [x] Page de connexion sans header
- [x] Vue fichiers — liste, filtres par type, sélection multiple, suppression, pagination "charger plus"
- [x] Lightbox images — navigation précédent/suivant, date, compteur
- [x] Vue upload — drag & drop, tous types de fichiers, aperçu image, stats stockage
- [x] Upload multiple + vraie barre de progression XHR
- [x] Confirmation si navigation pendant un upload
- [x] Navigation clavier lightbox (← → Échap)
- [x] Swipe mobile lightbox
- [x] Bouton téléchargement (lightbox + liste)
- [x] Bouton partage — lien temporaire 24h + copie presse-papiers
- [x] Recherche par nom
- [x] Tri par date/nom/taille
- [x] Visionneuse vidéo, audio, PDF
- [x] Détection 401 en session → redirect login avec message
- [x] Validation MIME côté backend
- [x] Quota de stockage configurable (`STORAGE_QUOTA_MB`)
- [x] `make dev` — une seule commande
- [x] HTTPS — `make https` + docker-compose.https.yml
- [x] PWA — manifest.json + icônes
- [x] Clés API nommées, générées/révoquées depuis l'interface, restreintes aux images
      (remplace l'ancienne clé statique `API_KEY` en `.env`)
- [x] Intégration AbView (screensaver depuis AbFlow via clé API + détection d'inactivité —
      code présent sur `feature/photos-carrousel` côté AbView, pas encore remergé sur `main`)
