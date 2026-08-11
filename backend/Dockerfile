# =============================================================================
# RomaneioHub API — Production Dockerfile (Railway)
# =============================================================================
# Multi-stage build: builder instala dependências e compila TypeScript,
# runner copia apenas o necessário para a imagem final leve.
# =============================================================================

# Stage 1: Builder
FROM node:20-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

# Copia manifesto do monorepo para resolver workspaces
COPY package.json package-lock.json turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/

# Instala todas as dependências (incluindo devDependencies para build)
RUN npm ci

# Copia schema Prisma e gera o client
COPY packages/db/prisma ./packages/db/prisma
RUN npx prisma generate --schema=./packages/db/prisma/schema.prisma

# Copia código fonte
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Compila TypeScript
RUN npm run build -w @romaneio-hub/api

# ─────────────────────────────────────────────────────────────────────────────

# Stage 2: Runner
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl

WORKDIR /app

# Copia manifesto para instalar apenas dependências de produção
COPY package.json package-lock.json turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/

RUN npm ci --omit=dev

# Copia Prisma client gerado e schema (necessário em runtime)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY packages/db/prisma ./packages/db/prisma

# Copia artefatos compilados
COPY --from=builder /app/apps/api/dist ./apps/api/dist

EXPOSE 3001

ENV NODE_ENV=production

CMD ["node", "apps/api/dist/main.js"]
