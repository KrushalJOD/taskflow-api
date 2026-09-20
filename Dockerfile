# --- Build stage -----------------------------------------------------------
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src

# --- Runtime stage -----------------------------------------------------------
# A separate, minimal runtime image keeps the shipped artefact small and
# excludes dev/test tooling (jest, eslint, supertest) from production.
FROM node:18-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}

# Run as a non-root user for defence-in-depth (picked up by the Security stage).
RUN addgroup -S taskflow && adduser -S taskflow -G taskflow
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/src ./src
USER taskflow

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "src/index.js"]
