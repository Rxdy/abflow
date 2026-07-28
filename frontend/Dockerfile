FROM --platform=$BUILDPLATFORM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG VITE_APP_NAME=AbFlow
ENV VITE_APP_NAME=$VITE_APP_NAME
ARG VITE_INSTANCE_NAME=
ENV VITE_INSTANCE_NAME=$VITE_INSTANCE_NAME
RUN npm run build

# alpine-slim exclut les modules qu'on n'utilise pas (image-filter, xslt,
# geoip...) — même comportement pour ce qu'on utilise (fichiers statiques +
# proxy_pass), 21 Mo au lieu de 185 (vérifié : sert les fichiers et proxy
# correctement vers le backend).
FROM nginx:alpine-slim
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
