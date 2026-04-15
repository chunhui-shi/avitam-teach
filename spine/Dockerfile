# syntax=docker/dockerfile:1.6
#
# v2-deployed multi-stage build for avitam-teach.
#
#   deps    — installs production + dev node_modules (dev needed for `next build`)
#   build   — runs `next build` (which emits a standalone bundle into .next/standalone)
#   runner  — copies the standalone output + static assets into a minimal image
#             and runs as a non-root user.
#
# Base image: node:18-alpine. We pin 18.20.x to match the development runtime
# (`.nvmrc`-equivalent) declared in CLAUDE.md.

# ---- deps stage --------------------------------------------------------------
FROM node:18.20.8-alpine AS deps
WORKDIR /app

# Alpine musl needs libc6-compat for some native modules (bcryptjs is pure-JS
# but pg and others can pull it in). Keeping this here is cheap insurance.
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci

# ---- build stage -------------------------------------------------------------
FROM node:18.20.8-alpine AS build
WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# next.config.mjs has `output: 'standalone'` — the build emits
# .next/standalone/server.js plus a minimal node_modules tree.
#
# `next build` evaluates module-level code in every API route as part of its
# "collect page data" phase, so the Stripe / Anthropic SDK constructors
# (which read env vars at import time) need *something* set. These are
# placeholders used ONLY during the build; the runtime container reads real
# values from .env.docker via docker-compose and src/lib/env.ts re-validates
# at startup. If real secrets are missing at runtime, the container exits.
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=postgresql://build-placeholder@localhost:5432/build
ENV JWT_SECRET=build-placeholder-secret-minimum-32-characters-long
ENV STRIPE_SECRET_KEY=sk_test_build_placeholder
ENV STRIPE_WEBHOOK_SECRET=whsec_build_placeholder
ENV ANTHROPIC_API_KEY=sk-ant-build-placeholder
ENV NEXT_PUBLIC_APP_URL=http://localhost:3000
RUN npm run build

# ---- runner stage ------------------------------------------------------------
FROM node:18.20.8-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user. UID/GID 1001 avoids collisions with alpine's default users.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Copy the standalone build output. These paths are what `output: 'standalone'`
# emits — don't rename them without updating the CMD below.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

# The standalone bundle's entrypoint is a plain server.js at the image root.
CMD ["node", "server.js"]
