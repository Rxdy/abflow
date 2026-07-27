# AbFlow

Gestionnaire de fichiers et de photos **self-hosted**, pensé pour tourner sur un
Raspberry Pi (ou tout petit serveur) à la maison. Upload, organisation en
timeline, partage temporaire, et une API en lecture seule pour brancher
d'autres apps (écran de veille, dashboard…) sans exposer tout le reste.

Usage personnel — pas de multi-compte pour l'instant (voir [Roadmap](#roadmap)).

## Fonctionnalités

- **Upload** multi-fichiers avec vraie barre de progression, tous types de
  fichiers acceptés (images, vidéos, audio, documents, archives…)
- **Timeline** groupée par jour, recherche par nom, tri (date/nom/taille),
  filtres par type, sélection multiple avec suppression groupée
- **Visionneuse** intégrée : lightbox images (swipe mobile, clavier ← → Échap),
  lecteur vidéo/audio, aperçu PDF
- **Détection de doublons** à l'upload (empreinte sha256) — un fichier déjà
  présent est rejeté avant même d'être écrit sur le disque
- **Métadonnées** : nom de fichier original, type MIME, dimensions d'image
- **Partage** : lien temporaire (24h par défaut) vers un fichier, sans donner
  accès au reste de l'espace
- **Quota de stockage** configurable, avec barre d'usage visible dans l'app
- **Clés API** nommées, générées et révocables depuis l'interface — pour
  connecter une app externe en lecture seule, restreinte aux images
- **PWA** installable (iOS/Android/desktop), thème sombre, mobile-first
- **Stockage** local ou SFTP distant, au choix via `.env`

## Stack

| | |
|---|---|
| Frontend | Vue 3 + TypeScript (`<script setup>`), Vite |
| Backend | Node.js + Express |
| Auth | bcrypt + JWT (24h) + rate limiting sur le login |
| Déploiement | Docker Compose, image nginx pour le frontend |
| Tests | `node --test` + supertest (backend) · Vitest + Testing Library (frontend) · Playwright (e2e) |

## Démarrage rapide

Prérequis : Docker, Docker Compose, Node.js 20+ (pour le mode dev avec hot-reload).

```bash
cp .env.example .env   # remplir AUTH_PASSWORD, JWT_SECRET (voir commentaires dans le fichier)
make dev                # backend en Docker + frontend Vite avec hot-reload
```

Autres commandes utiles (voir `make help`) :

```bash
make up       # build + démarre tout en Docker (prod-like, HTTP)
make https    # idem avec certificat auto-signé
make status   # état des services + URL
make e2e      # stack isolée + suite Playwright
```

L'app démarre sur `http://localhost:8080`. Le premier compte se configure
entièrement via `.env` (`AUTH_USERNAME` / `AUTH_PASSWORD`) — pas d'inscription,
c'est un seul compte personnel.

## Configuration

Toute la configuration passe par `.env` (voir `.env.example` pour la liste
complète et commentée) : identifiants, secret JWT, origines CORS autorisées,
type de stockage (local ou SFTP), quota optionnel, nom de l'app affiché.

Les clés API pour les intégrations externes ne se configurent plus par
variable d'environnement — elles se génèrent depuis l'interface (icône clé
dans le header une fois connecté).

## Déploiement

En production, l'app tourne derrière [Traefik](https://traefik.io/traefik/)
(routing + HTTPS Let's Encrypt) et se met à jour automatiquement via
[Watchtower](https://containrrr.dev/watchtower/) : chaque push sur `main` qui
passe la CI build et publie des images sur GHCR, que Watchtower détecte et
redéploie sans intervention manuelle. Voir `docker-compose.prod.yml`.

## Tests

```bash
cd backend  && npm test         # 73 tests (node --test + supertest)
cd frontend && npm test         # tests unitaires (Vitest)
cd frontend && npm run typecheck
make e2e                        # parcours critique de bout en bout (Playwright)
```

## Structure du projet

```
backend/            API Express — auth, upload, stockage, partage, clés API
  storage/          Adaptateurs de stockage (local, SFTP)
  tests/
frontend/
  src/
    views/           Login, Timeline (fichiers), Upload, Settings (clés API)
    components/       Header, navigation basse, footer
    composables/      Logique réutilisable (auth, appels API, stats)
  e2e/               Suite Playwright
docker-compose.yml            Développement / usage local
docker-compose.prod.yml       Production (images GHCR, Traefik, Watchtower)
```

## Roadmap

Idées non implémentées : multi-compte avec espaces de stockage cloisonnés par
utilisateur, système de sauvegarde pour la maintenance. Suivi personnel du
projet (backlog, historique des phases, audits) dans `.perso/`, séparé du
code pour ne pas polluer la racine du repo.
