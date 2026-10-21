# ==============================================================================
# Multi-stage Dockerfile para LeadRadar (Frontend Vite + Backend Puppeteer Scraper)
# ==============================================================================

# ------------------------------------------------------------------------------
# ETAPA 1: Construcción del Frontend React con Vite
# ------------------------------------------------------------------------------
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar todas las dependencias (incluyendo devDependencies para compilar Vite)
RUN npm ci

# Copiar código fuente necesario para la compilación del cliente
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src

# Compilar el bundle estático de producción (genera la carpeta dist/)
RUN npm run build

# ------------------------------------------------------------------------------
# ETAPA 2: Entorno de Ejecución de Producción (Node.js + Chromium + Puppeteer)
# ------------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runner

# Variables de entorno para Puppeteer y Chromium del sistema
ENV NODE_ENV=production \
    PORT=3001 \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Instalar Chromium del sistema, fuentes internacionales y dumb-init
# dumb-init actúa como proceso PID 1 para recolectar procesos zombie de Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-freefont-ttf \
    fonts-ipafont-gothic \
    fonts-kacst \
    fonts-thai-tlwg \
    fonts-wqy-zenhei \
    dumb-init \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar package.json e instalar ÚNICAMENTE dependencias de producción
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copiar el backend (servidor y bot de WhatsApp)
COPY server ./server
COPY server.js ./

# Copiar el frontend compilado desde la etapa builder
COPY --from=builder /app/dist ./dist

# Crear la carpeta de datos persistentes si no existe
RUN mkdir -p /app/server/data

# Puerto del servidor Express
EXPOSE 3001

# Healthcheck para verificar que el servidor Express y el scraper respondan
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

# dumb-init gestiona adecuadamente señales (SIGTERM, SIGINT) y procesos huérfanos de Chromium
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
