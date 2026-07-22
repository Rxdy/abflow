# CI/CD — déploiement automatique sur le Raspberry Pi

## Comment ça marche

- `.github/workflows/ci.yml` — tourne sur les runners GitHub (cloud), sur chaque push et
  chaque PR vers `main` : tests backend (`node --test`), typecheck + tests + build frontend.
- `.github/workflows/deploy.yml` — tourne sur un runner **self-hosted installé sur le Pi**,
  seulement après que `CI` a terminé avec succès sur `main` (trigger `workflow_run`). Il fait
  `docker compose up -d --build` directement sur place.

Comme `deploy.yml` ne se déclenche que via `workflow_run` (jamais directement sur `pull_request`),
une PR ne peut jamais exécuter de code sur le Pi — seul un push (ou merge) sur `main` qui passe
la CI le peut. C'est important : un runner self-hosted exécute du code arbitraire du repo, donc
il ne faut jamais l'exposer aux workflows déclenchés par des PRs externes.

## Installer le runner sur le Pi

1. Sur GitHub : `Settings` → `Actions` → `Runners` → `New self-hosted runner` (choisir Linux ARM64).
2. Sur le Pi, suivre les commandes affichées (téléchargement + `./config.sh --url ... --token ...`).
   Quand il demande les labels, ajouter `raspberry-pi` en plus du label par défaut `self-hosted`.
3. L'installer comme service pour qu'il survive aux reboots :
   ```bash
   sudo ./svc.sh install
   sudo ./svc.sh start
   ```
4. Vérifier qu'il apparaît "Idle" dans `Settings` → `Actions` → `Runners`.

## Pré-requis sur le Pi

- Le `.env` (avec `STORAGE_QUOTA_MB=2000`, secrets, etc.) doit déjà exister dans le dossier où
  tourne `docker compose` — il n'est **jamais** touché par le déploiement (`clean: false` dans
  le checkout), puisqu'il est gitignored et n'existe que localement sur le Pi.
- Docker + Docker Compose installés sur le Pi.
- Le dossier du runner (`actions-runner/`) doit être dans le même repo cloné que celui utilisé
  par `make up`, pour que `docker compose up -d --build` trouve le bon `docker-compose.yml`.

## Tester le pipeline

Pousser un commit sur `main` (ou merger une PR), puis suivre l'onglet **Actions** du repo :
`CI` doit passer, puis `Deploy` doit se déclencher automatiquement et redémarrer les conteneurs
sur le Pi.
