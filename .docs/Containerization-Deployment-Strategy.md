# Containerization & Local Deployment Strategy

## Current configuration

Use Node 24 LTS, MariaDB 10.11, NGINX 1.28, and Docker Compose 2.24.4 or newer. The root docker-compose.yml includes docker/docker-compose.yml. Both standard and development entry points use project name transcend, sharing the same network and database volume.

The backend and frontend Dockerfiles provide development, builder, and runner targets. Development targets include build tools, run as the node user, and own writable application directories. The backend runner installs production dependencies only; the frontend runner serves the built SPA through NGINX. Separate application lockfiles support npm ci in isolated build contexts.

## Backend Dockerfile

```dockerfile
FROM node:24-alpine AS development
WORKDIR /app
COPY --chown=node:node package*.json ./
RUN npm ci && chown -R node:node /app
COPY --chown=node:node . .
USER node
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

FROM development AS builder
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node --from=builder /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

## Frontend Dockerfile

```dockerfile
FROM node:24-alpine AS development
WORKDIR /app
COPY --chown=node:node package*.json ./
RUN npm ci && chown -R node:node /app
COPY --chown=node:node . .
USER node
EXPOSE 5173
CMD ["npm", "run", "dev"]

FROM development AS builder
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM nginx:1.28-alpine AS runner
RUN apk add --no-cache openssl
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
EXPOSE 80 443
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
```

## Orchestration and startup order

1. MariaDB becomes healthy using its connection/InnoDB healthcheck.
2. The one-shot migrate service applies pending TypeORM migrations.
3. NestJS starts after the migration exits successfully and checks database/schema readiness.
4. NGINX starts after the API becomes healthy. It auto-generates self-signed TLS certificates if absent, serves HTTPS on port 443, redirects HTTP port 80 to HTTPS, serves SPA deep links, and proxies /api/ to the backend.

Credentials are required through ignored .env files. Tracked .env.example files contain placeholders, not working secrets. All published ports bind to localhost. Example defaults are database 3306, API 3000, and frontend 8080; this workspace uses 3307 and 8081 because Windows blocks the example database/frontend ports. Docker services always connect to MariaDB on its internal port 3306.

## Commands

```sh
docker compose up --build -d
docker compose ps
docker compose down
```

The named MariaDB volume persists after down. Do not add volume deletion to routine shutdown commands.

## Development override

```sh
npm run docker:dev
```

The script runs `docker compose --env-file .env -f docker/docker-compose.yml -f docker/docker-compose.dev.yml up --build -d`. Both modes retain project name `transcend` and its existing database volume.

The development override selects the development image targets, mounts source directories, runs Nest watch mode and Vite on port 5173, and proxies Vite API requests to backend:3000. `WATCH_USE_POLLING=true` enables Vite polling for reliable source-change detection from Windows. Editing mounted frontend source does not require restarting or rebuilding the container. Dependencies remain inside the containers; rerun the script after dependency or configuration changes.

Return to the standard NGINX stack with `npm run docker:up`. That mode serves files built into the frontend image; restarting a container does not rebuild those files. Use `docker compose up -d --build --no-deps frontend` for a frontend-only refresh. Stop either mode with `npm run docker:down`; the database volume is retained.

## Schema and deployment boundaries

The baseline creates an empty database schema without destructive reset statements. Application schema synchronization is disabled; startup does not silently run migrations. MariaDB DDL commits implicitly, so failed migrations can leave partial changes and need inspection. Baseline rollback is intentionally disabled.

No production deployment is provisioned by this scaffold. Internet deployment requires HTTPS, managed secrets, restricted database exposure, backups, and a separately reviewed deployment configuration.

The current executable manifests in docker/ are authoritative; update this reference when image choices or startup behavior change.
