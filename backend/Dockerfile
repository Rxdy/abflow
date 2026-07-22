FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY server.js app.js ./
COPY storage/ ./storage/
EXPOSE 3000
CMD ["node", "server.js"]
