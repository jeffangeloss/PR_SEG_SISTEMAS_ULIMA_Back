#!/usr/bin/env bash
# Arranca el backend contra la base de laboratorio (ver LABORATORIO.md), con las variables de
# .env.laboratorio y sin crear un .env en la raíz. Escucha solo en 127.0.0.1 (servidor-local.ts).
# Queda en primer plano; se detiene con Ctrl+C.
#
#   BUN=/ruta/a/bun scripts/laboratorio/levantar-backend.sh
set -euo pipefail

. "$(dirname "${BASH_SOURCE[0]}")/comun.sh"

exigir_sin_env_en_raiz
exigir_url_local
exigir_bun
postgres_corriendo || fallar "El Postgres del laboratorio no está corriendo. Primero: scripts/laboratorio/levantar-bd.sh"

cd "$RAIZ"
exec "$BUN" --env-file="$ENV_FILE" run scripts/laboratorio/servidor-local.ts
