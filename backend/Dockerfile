# API de ShopCart. Imagen en tres etapas: dependencias, compilación de TypeScript y
# una imagen final solo con lo necesario para producción (sin TypeScript ni pruebas).

FROM node:24-alpine AS dependencias
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencias AS compilacion
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:24-alpine AS produccion
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=compilacion /app/dist ./dist
# No se corre como root
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -qO- http://localhost:3000/api/salud || exit 1
CMD ["node", "dist/server.js"]
