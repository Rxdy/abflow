# Déploiement — GHCR + Traefik + Watchtower

AbFlow suit le même pattern que les autres projets hébergés sur le Pi (charlene,
portfolio, abview, metryx…). L'approche "runner self-hosted + `docker compose up
--build` en local" décrite ici auparavant n'a jamais été installée sur le Pi
(aucun runner enregistré, aucun dossier `actions-runner`) et est abandonnée.

## Comment ça marche

- `.github/workflows/ci.yml` — tourne sur les runners GitHub (cloud) à chaque push
  et PR vers `main` : tests backend/frontend, e2e Playwright, puis (seulement sur
  push vers `main`, après succès des jobs précédents) le job `build-and-push`
  build les images `backend` et `frontend` en arm64 et les pousse sur
  `ghcr.io/rxdy/abflow-backend` et `ghcr.io/rxdy/abflow-frontend`.
- Sur le Pi, **Watchtower** (conteneur partagé entre tous les projets, poll
  toutes les 5 min) détecte les nouvelles images taguées `latest` sur les
  conteneurs labellisés `com.centurylinklabs.watchtower.enable=true` et les
  redémarre automatiquement — pas d'action manuelle nécessaire après le premier
  déploiement.
- **Traefik** (conteneur partagé, `~/infra/docker-compose.yml`) route
  `abflow.rxdy.fr` vers le conteneur frontend via les labels dans
  `docker-compose.prod.yml`, et gère le certificat HTTPS (Let's Encrypt).

## Sur le Pi

- Compose file de prod : `~/abflow/docker-compose.prod.yml` (référence les
  images GHCR, pas de build local).
- `~/abflow/.env` — secrets de prod (`AUTH_PASSWORD`, `JWT_SECRET`, `API_KEY`),
  généré une fois, jamais commité, jamais touché par un déploiement automatique.
- `~/abflow/uploads/` — stockage des fichiers, monté en volume.

## Premier déploiement / changement de compose

Si `docker-compose.prod.yml` change (nouveau service, nouveau label…), il faut
le mettre à jour manuellement sur le Pi et relancer :

```bash
ssh rp-meliodas
cd ~/abflow
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Pour un changement de code applicatif (backend/frontend), rien à faire à la
main : push sur `main`, la CI build et push l'image, Watchtower la récupère
sous 5 minutes.
