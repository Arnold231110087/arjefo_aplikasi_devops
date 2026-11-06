# Container FRONTEND
# Tahap 1: build aplikasi React dengan Node
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Tahap 2: sajikan file statis dengan Nginx (image akhir kecil, tanpa Node)
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost/ >/dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]
