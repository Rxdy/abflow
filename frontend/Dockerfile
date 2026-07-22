FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG VITE_APP_NAME=AbFlow
ENV VITE_APP_NAME=$VITE_APP_NAME
ARG VITE_INSTANCE_NAME=
ENV VITE_INSTANCE_NAME=$VITE_INSTANCE_NAME
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
