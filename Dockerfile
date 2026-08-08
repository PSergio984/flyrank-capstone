# ---- builder stage: install all dependencies from the lockfile ----
# npm ci needs package-lock.json; everything below uses it to produce a
# reproducible node_modules. This stage exists only to build that folder.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- runner stage: the actual image ----
# Production dependencies only (npm ci --omit=dev would duplicate the install
# above; copying the builder's prod node_modules keeps it a single install),
# run as the non-root "node" user, with only the files the app needs.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
# COPY of a directory keeps its structure — repository/ stays repository/.
COPY index.js redis-ping.js openapi.json ./
COPY repository ./repository
USER node
EXPOSE 3000
# "node index.js" — the same entrypoint as "npm start" (npm is unnecessary
# inside the container once dependencies are installed).
CMD ["node", "index.js"]
