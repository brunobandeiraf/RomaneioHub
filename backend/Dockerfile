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

# Copia manifesto de dependências
COPY package.json ./

# Instala todas as dependências (incluindo devDependencies para build)
RUN npm install

# Copia schema Prisma e gera o client
COPY prisma ./prisma
RUN npx prisma generate --schema=./prisma/schema.prisma

# Copia código fonte
COPY tsconfig.json nest-cli.json ./
COPY src ./src

# Compila TypeScript
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────

# Stage 2: Runner
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl

WORKDIR /app

# Copia manifesto para instalar apenas dependências de produção
COPY package.json ./

RUN npm install --omit=dev

# Copia Prisma client gerado e schema (necessário em runtime)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma

# Copia artefatos compilados
COPY --from=builder /app/dist ./dist

EXPOSE 3001

ENV NODE_ENV=production

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
