FROM node:24 AS base

WORKDIR /app

COPY package*.json ./

# Desarrollo (docker-compose.dev.yml): todas las dependencias (nodemon incluido). El código
# no se copia: se monta desde backend/ y nodemon reinicia la API al guardar.
FROM base AS dev

RUN npm ci

EXPOSE 3000

CMD ["npx", "nodemon", "--legacy-watch", "--watch", "src", "src/server.js"]

# Producción (por defecto: última etapa).
FROM base AS prod

RUN npm ci --omit=dev

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
