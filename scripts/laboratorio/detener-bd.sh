#!/usr/bin/env bash
# Detiene el Postgres del laboratorio (ver LABORATORIO.md). No borra datos: el clúster queda en
# LAB_DIR/pgdata y levantar-bd.sh lo vuelve a arrancar tal cual.
set -euo pipefail

. "$(dirname "${BASH_SOURCE[0]}")/comun.sh"

if postgres_corriendo; then
  "$LAB_PG_BIN/pg_ctl" -D "$PGDATA_LAB" -m fast -w stop >/dev/null
  echo "✓ Postgres del laboratorio detenido."
else
  echo "Postgres del laboratorio no estaba corriendo."
fi
