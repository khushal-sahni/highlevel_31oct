FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json jest.config.js ./
COPY src ./src
COPY db ./db
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3110
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/db/seed.js && node dist/main.js"]
