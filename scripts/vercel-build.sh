#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL precisa estar configurada na Vercel antes do build." >&2
  exit 1
fi

# O desenvolvimento local usa SQLite. O build isolado da Vercel usa PostgreSQL
# sem alterar o arquivo versionado no repositório.
sed -i 's/provider = "sqlite"/provider = "postgresql"/g' prisma/schema.prisma

npx prisma generate
npm run build
