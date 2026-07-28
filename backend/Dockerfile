# alpine + apk nodejs/npm plutôt que l'image officielle node:20-alpine — celle-ci
# embarque yarn (jamais utilisé ici) et pèse ~210 Mo pour cette app ; cette base
# fait ~118 Mo pour un résultat fonctionnellement identique (vérifié : login
# bcrypt+JWT, ssh2-sftp-client se chargent correctement).
FROM alpine:3.19
RUN apk add --no-cache nodejs npm && \
    addgroup -g 1000 app && \
    adduser -D -u 1000 -G app app
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server.js app.js ./
COPY storage/ ./storage/
# uid 1000 — même utilisateur que celui qui possède ~/abflow/uploads sur le Pi
# (bind mount), donc les écritures marchent sans avoir à toucher aux permissions
# côté hôte. Le process ne tourne plus en root dans le conteneur.
USER app
EXPOSE 3000
CMD ["node", "server.js"]
