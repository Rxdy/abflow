# --platform=$BUILDPLATFORM : npm ci tourne nativement sur le runner (amd64),
# jamais sous QEMU — sous émulation arm64 ça finissait par planter (exit 132,
# SIGILL, non-déterministe) pendant l'installation. Sans danger pour l'arch
# finale : aucune dépendance ici ne compile de binaire natif (cpu-features,
# l'addon optionnel de ssh2, échoue silencieusement à se compiler faute de
# toolchain dans l'image et retombe sur son fallback pur JS — vérifié, aucun
# fichier .node dans node_modules après install).
FROM --platform=$BUILDPLATFORM alpine:3.19 AS build
RUN apk add --no-cache nodejs npm
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# alpine + apk nodejs plutôt que l'image officielle node:20-alpine — celle-ci
# embarque yarn (jamais utilisé ici) et pèse ~210 Mo pour cette app ; cette base
# fait ~118 Mo pour un résultat fonctionnellement identique (vérifié : login
# bcrypt+JWT, ssh2-sftp-client se chargent correctement). npm n'est pas
# nécessaire à l'exécution, seulement node.
FROM alpine:3.19
RUN apk add --no-cache nodejs && \
    addgroup -g 1000 app && \
    adduser -D -u 1000 -G app app
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY server.js app.js ./
COPY storage/ ./storage/
# uid 1000 — même utilisateur que celui qui possède ~/abflow/uploads sur le Pi
# (bind mount), donc les écritures marchent sans avoir à toucher aux permissions
# côté hôte. Le process ne tourne plus en root dans le conteneur.
USER app
EXPOSE 3000
CMD ["node", "server.js"]
