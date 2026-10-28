FROM node:24-alpine AS development
WORKDIR /app
COPY --chown=node:node package*.json ./
RUN npm ci && mkdir -p storage && chown -R node:node /app
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
# Uploaded files; the Compose volume mounts here and keeps this owner.
RUN mkdir -p /app/storage && chown node:node /app/storage
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
