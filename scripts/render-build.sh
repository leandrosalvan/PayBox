#!/bin/bash
set -e

# Ajusta o provider do Prisma para PostgreSQL no Render
sed -i 's/provider = "sqlite"/provider = "postgresql"/g' prisma/schema.prisma

npx prisma generate
npx prisma db push --accept-data-loss

npm run build
