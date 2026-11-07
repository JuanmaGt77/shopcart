# Frontend de ShopCart. Se compila con Node y se sirve con nginx, que además reenvía
# /api y /socket.io a la API: el navegador habla con un solo origen (sin CORS) y la cookie
# httpOnly del refresh token funciona igual que en desarrollo.

FROM node:24-alpine AS dependencias
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencias AS compilacion
COPY . .
RUN npm run build

# nginx sin privilegios de root (escucha en el 8080)
FROM nginxinc/nginx-unprivileged:1.29-alpine AS produccion
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=compilacion /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1:8080/ > /dev/null || exit 1
