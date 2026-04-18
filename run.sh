#!/usr/bin/env sh
set -eu

bun run prisma:migrate:deploy
exec bun src/main.ts
