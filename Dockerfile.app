FROM node:22-slim AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY src ./src
COPY migrations ./migrations

FROM base AS api
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]

FROM base AS worker
COPY --from=docker:27-cli /usr/local/bin/docker /usr/local/bin/docker
CMD ["node", "src/worker.js"]
