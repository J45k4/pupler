FROM oven/bun:1

ARG version=dev

WORKDIR /app

COPY package.json bun.lock tsconfig.json prisma.config.ts ./
COPY prisma ./prisma

RUN bun install --frozen-lockfile

COPY src ./src
COPY run.sh ./run.sh

RUN bun run prisma:generate
RUN chmod +x ./run.sh

ENV NODE_ENV=production
ENV APP_VERSION=$version
ENV PORT=5995
ENV DATABASE_URL=file:/data/pupler.db

RUN mkdir -p /data

VOLUME ["/data"]

EXPOSE 5995

CMD ["./run.sh"]
