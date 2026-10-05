# Variables y guardas que comparten los scripts del laboratorio (ver LABORATORIO.md).
# Se carga con `.` desde levantar-bd.sh, detener-bd.sh y levantar-backend.sh; no se ejecuta solo.

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$RAIZ/.env.laboratorio"

fallar() {
  echo "✗ $*" >&2
  exit 1
}

[[ -f "$ENV_FILE" ]] || fallar "Falta .env.laboratorio. Créalo desde la plantilla: cp .env.laboratorio.example .env.laboratorio"

# Lee NOMBRE=valor del archivo SIN ejecutarlo: hay valores con espacios y <>, y un `source`
# los interpretaría como comandos. Quita las comillas que rodeen al valor, si las hay.
leer_var() {
  local valor
  valor="$(grep -E "^$1=" "$ENV_FILE" | tail -n 1 || true)"
  valor="${valor#*=}"
  valor="${valor%\"}"
  valor="${valor#\"}"
  printf '%s' "$valor"
}

DATABASE_URL="$(leer_var DATABASE_URL)"
LAB_DIR="$(leer_var LAB_DIR)"
# Vacío, los datos van a la carpeta .lab junto a la que contiene el repositorio.
LAB_DIR="${LAB_DIR:-$(dirname "$RAIZ")/.lab}"
LAB_PG_BIN="$(leer_var LAB_PG_BIN)"
LAB_PG_PORT="$(leer_var LAB_PG_PORT)"
LAB_DB_NAME="$(leer_var LAB_DB_NAME)"
LAB_DB_USER="$(leer_var LAB_DB_USER)"
LAB_DB_PASSWORD="$(leer_var LAB_DB_PASSWORD)"

for nombre in DATABASE_URL LAB_PG_BIN LAB_PG_PORT LAB_DB_NAME LAB_DB_USER LAB_DB_PASSWORD; do
  [[ -n "${!nombre}" ]] || fallar "Falta $nombre en .env.laboratorio."
done
[[ "$LAB_PG_PORT" =~ ^[0-9]+$ ]] || fallar "LAB_PG_PORT no es un número."
[[ "$LAB_DB_NAME" =~ ^[a-z_][a-z0-9_]*$ && "$LAB_DB_USER" =~ ^[a-z_][a-z0-9_]*$ ]] \
  || fallar "LAB_DB_NAME y LAB_DB_USER solo admiten minúsculas, dígitos y _."
[[ -x "$LAB_PG_BIN/pg_ctl" ]] || fallar "No encuentro pg_ctl en LAB_PG_BIN=$LAB_PG_BIN (Postgres 16 de Homebrew)."

PGDATA_LAB="$LAB_DIR/pgdata"

# En macOS, sin LC_ALL el postmaster aborta al arrancar con «postmaster became multithreaded
# during startup». Es la misma locale con la que initdb crea el clúster.
export LC_ALL=en_US.UTF-8

# Los datos de Postgres viven fuera del repositorio.
case "$LAB_DIR/" in
  "$RAIZ"/*) fallar "LAB_DIR está dentro del repositorio ($LAB_DIR). Ponlo fuera." ;;
esac

# bun y dotenv cargan solos un .env de la raíz, que podría traer la DATABASE_URL de otra base.
# Solo se admiten las plantillas y la copia del laboratorio.
exigir_sin_env_en_raiz() {
  local f
  for f in "$RAIZ"/.env "$RAIZ"/.env.*; do
    [[ -e "$f" ]] || continue
    case "$(basename "$f")" in
      .env.example | .env.laboratorio | .env.laboratorio.example) ;;
      *) fallar "Existe $(basename "$f") en la raíz del repositorio. Muévelo fuera antes de usar el laboratorio." ;;
    esac
  done
}

# La única base admitida es la local del laboratorio, con los mismos datos que LAB_DB_*.
exigir_url_local() {
  local esperada="postgres://$LAB_DB_USER:$LAB_DB_PASSWORD@127.0.0.1:$LAB_PG_PORT/$LAB_DB_NAME"
  [[ "$DATABASE_URL" == "$esperada" ]] \
    || fallar "DATABASE_URL no es la base local del laboratorio (postgres://LAB_DB_USER:…@127.0.0.1:LAB_PG_PORT/LAB_DB_NAME)."
}

exigir_bun() {
  BUN="${BUN:-$(command -v bun || true)}"
  [[ -n "$BUN" && -x "$BUN" ]] || fallar "No encuentro bun. Pásalo con BUN=/ruta/a/bun."
}

postgres_corriendo() {
  "$LAB_PG_BIN/pg_ctl" -D "$PGDATA_LAB" status >/dev/null 2>&1
}
