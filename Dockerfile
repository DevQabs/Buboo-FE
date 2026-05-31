# ── Stage 1: deps ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: builder ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# standalone 모드로 빌드 (node_modules 없이 실행 가능한 최소 번들)
ENV NEXT_OUTPUT=standalone

# API_INTERNAL_URL은 런타임에 주입되지만 next.config.mjs가 빌드 시 읽으므로
# 빌드 시에는 placeholder를 사용하고 실제 URL은 런타임 환경변수로 주입됩니다.
# (rewrites는 서버 사이드에서 동적으로 처리됩니다)
RUN npm run build

# ── Stage 3: runner ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV TZ=Asia/Seoul

# standalone 출력물만 복사 (node_modules 불필요)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
