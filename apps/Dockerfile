##########
# Multi-stage Dockerfile for API (Hono) + built Web (Vite)
# - Build stage: install workspace deps with pnpm, build web into apps/api/public, build api
# - Runtime stage: copy built api and public assets, run node server
##########

# ---------- Base builder ----------
  FROM --platform=linux/amd64 amazonlinux:2023 AS base

  # Install build tools and Node.js 22
  RUN dnf install -y gcc gcc-c++ make git ca-certificates tar gzip
  ARG NODE_VERSION=22.21.0
  ENV NODE_VERSION=${NODE_VERSION}
  RUN curl -fsSL https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.gz | \
      tar -xz -C /usr/local --strip-components=1
  
  # Enable and activate pnpm
  RUN corepack enable && corepack prepare pnpm@10.13.1 --activate
  
  WORKDIR /app
  
  # Copy root manifests first for better cache
  COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
  
  # Copy package manifests to leverage layer cache for install
  COPY apps/api/package.json ./apps/api/package.json
  COPY apps/web/package.json ./apps/web/package.json
  
  # Install dependencies (hoisted, frozen lock)
  RUN pnpm install --frozen-lockfile
  
  # ---------- Builder ----------
  FROM base AS builder
  
  # Copy sources
  COPY apps ./apps
  
  # Build Web into API public
  WORKDIR /app/apps/web
  RUN pnpm build:local
  
  # Build API (bundle lambda target for compatibility) and Node server bundle
  WORKDIR /app/apps/api
  RUN pnpm run build && pnpm run build:node
  
  # ---------- Runtime ----------
  FROM --platform=linux/amd64 node:22-slim AS runtime
  
  ENV NODE_ENV=production \
      PORT=8080 \
      HOST=0.0.0.0
  
  # Lambda Web Adapter environment
  ENV AWS_LAMBDA_EXEC_WRAPPER=/opt/extensions/lambda-adapter \
      AWS_LAMBDA_HTTP_IGNORE_TRAILING_SLASH=true
  
  WORKDIR /app
  
  # Create non-root user
  RUN useradd -m -u 10001 appuser
  
  # Install DuckDB runtime dependencies
  RUN apt-get update -y && apt-get install -y --no-install-recommends \
      libstdc++6 libgcc-s1 libc6 \
      && apt-get clean \
      && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
  
  # Copy AWS Lambda Web Adapter
  COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter
  
  # Copy only runtime artifacts
  COPY --from=builder /app/apps/api/dist ./apps/api/dist
  COPY --from=builder /app/apps/api/public ./apps/api/public
  COPY --from=base /app/pnpm-workspace.yaml /app/package.json /app/pnpm-lock.yaml ./
  COPY --from=base /app/apps/api/package.json ./apps/api/package.json
  
  # Install dependencies with pnpm (preserves workspace structure)
  RUN corepack enable && corepack prepare pnpm@10.13.1 --activate && \
      pnpm install --frozen-lockfile --prod
  
  EXPOSE 8080
  
  USER appuser
  
  WORKDIR /app/apps/api
  
  # Start node server (use node build for container runtime)
  CMD ["node", "dist/server.cjs"]