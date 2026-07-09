# syntax=docker/dockerfile:1

# Build the Word Golf web app (apps/web) into static assets, then serve them
# with nginx. Build context is the word-golf/ monorepo root, because the web app
# depends on the engine + ld workspace packages and the bundled word lists.

# ---- Stage 1: build the static site ----
FROM node:22-alpine AS build
WORKDIR /app

# Install workspace deps first (cached unless a manifest or the lockfile changes).
COPY package.json package-lock.json ./
COPY packages/engine/package.json packages/engine/
COPY packages/ld/package.json packages/ld/
COPY apps/web/package.json apps/web/
RUN npm ci

# Build the web app (Vite inlines the word lists from data/).
COPY tsconfig.base.json tsconfig.json ./
COPY packages ./packages
COPY apps ./apps
COPY data ./data
# The LaunchDarkly *client-side ID* is a public, browser-embedded identifier, so
# it's a build arg (not a secret). Vite inlines VITE_* env vars at build time; if
# it's absent the app still builds and runs offline with safe flag defaults.
ARG VITE_LD_CLIENT_ID=""
ENV VITE_LD_CLIENT_ID=$VITE_LD_CLIENT_ID
RUN npm run build --workspace apps/web

# ---- Stage 2: serve with nginx ----
FROM nginx:1.27-alpine AS runtime

# The app listens on $PORT (default 8080); the nginx:alpine entrypoint runs
# envsubst over /etc/nginx/templates/*.template at startup, substituting ${PORT}.
# Works on any "run my container" host (AWS App Runner, Cloud Run, etc.).
ENV PORT=8080

COPY apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 8080
# Default nginx:alpine CMD already runs `nginx -g 'daemon off;'` after templating.
