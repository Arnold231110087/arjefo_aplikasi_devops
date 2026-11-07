# Container BACKEND (Anggota 5)
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Install dependency dulu agar layer ini ter-cache saat hanya kode yang berubah
COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

# Jalankan sebagai user non-root
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD wget -qO- http://localhost:5000/api/health >/dev/null || exit 1
CMD ["node", "src/index.js"]
