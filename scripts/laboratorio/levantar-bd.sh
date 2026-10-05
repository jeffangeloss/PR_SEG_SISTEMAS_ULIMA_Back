#!/usr/bin/env bash
# Levanta la base de LABORATORIO de ULima++ (ver LABORATORIO.md): un Postgres 16 propio en
# LAB_DIR, que escucha solo en 127.0.0.1:LAB_PG_PORT, con el esquema de la variante sin portal,
# el catálogo institucional y los datos sintéticos.
#
#   BUN=/ruta/a/bun scripts/laboratorio/levantar-bd.sh            # crea o arranca, sin borrar nada
#   BUN=/ruta/a/bun scripts/laboratorio/levantar-bd.sh --reset    # borra la base y la reconstruye
#
# Lee todo de .env.laboratorio (copia de .env.laboratorio.example). Es repetible: si el clúster
# o la base ya existen, no los vuelve a crear, y el seed deja los mismos conteos.
set -euo pipefail

. "$(dirname "${BASH_SOURCE[0]}")/comun.sh"

RESET=0
case "${1:-}" in
  "") ;;
  --reset) RESET=1 ;;
  *) fallar "Uso: levantar-bd.sh [--reset]" ;;
esac

# 1. Guardas, todas antes de escribir nada.
exigir_sin_env_en_raiz
exigir_url_local
exigir_bun

# El esquema sale del journal de drizzle (0000 a 0009, con db:migrate) y de estos archivos, que
# van fuera del journal y se aplican uno por uno con db:apply, en este orden. No se aplica
# 0002_app_user_linkedin_link.sql (teacher.linkedin_link no está en schema.ts) ni se corre
# stamp-baseline.ts, que marca el baseline sin crear las tablas.
MIGRACIONES_SUELTAS=(
  0001_course_offering_total_hours
  0010_course_weekly_hours
  0011_academic_record
  0012_time_blocks
  0013_chatbot_message_history
  0014_specialty_test_result
  0015_portal_scores
  0016_app_setting
  0017_laboratorio_sin_portal
)
for m in "${MIGRACIONES_SUELTAS[@]}"; do
  [[ -f "$RAIZ/drizzle/$m.sql" ]] || fallar "Falta drizzle/$m.sql."
done

# 2. Clúster propio, creado una sola vez.
mkdir -p "$LAB_DIR"
chmod 700 "$LAB_DIR"
if [[ ! -f "$PGDATA_LAB/PG_VERSION" ]]; then
  echo "→ initdb en $PGDATA_LAB"
  "$LAB_PG_BIN/initdb" -D "$PGDATA_LAB" -U postgres --auth-local=trust --auth-host=scram-sha-256 \
    --encoding=UTF8 --locale=en_US.UTF-8 >/dev/null
  # El socket va a LAB_DIR (700), así que la confianza local solo alcanza a este usuario del
  # sistema. Por TCP se exige contraseña y solo se escucha en 127.0.0.1.
  cat >>"$PGDATA_LAB/postgresql.conf" <<EOF

# Laboratorio de ULima++: solo esta máquina, en un puerto propio.
port = $LAB_PG_PORT
listen_addresses = '127.0.0.1'
unix_socket_directories = '$LAB_DIR'
EOF
fi

# 3. Arranque.
if postgres_corriendo; then
  echo "→ Postgres del laboratorio ya estaba corriendo"
else
  echo "→ arrancando Postgres en 127.0.0.1:$LAB_PG_PORT"
  "$LAB_PG_BIN/pg_ctl" -D "$PGDATA_LAB" -l "$LAB_DIR/postgres.log" -w start >/dev/null
fi

PSQL=("$LAB_PG_BIN/psql" -h "$LAB_DIR" -p "$LAB_PG_PORT" -U postgres -X -q -v ON_ERROR_STOP=1)

# 4. Rol de la aplicación: se crea si falta y su contraseña sigue a LAB_DB_PASSWORD.
"${PSQL[@]}" -d postgres -v usr="$LAB_DB_USER" -v pw="$LAB_DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'usr', :'pw')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'usr') \gexec
SELECT format('ALTER ROLE %I LOGIN PASSWORD %L', :'usr', :'pw') \gexec
SQL

# 5. Base, esquema y seed.
if [[ $RESET -eq 1 ]]; then
  echo "→ --reset: borrando la base $LAB_DB_NAME"
  "$LAB_PG_BIN/dropdb" -h "$LAB_DIR" -p "$LAB_PG_PORT" -U postgres --if-exists --force "$LAB_DB_NAME"
fi

existe="$("${PSQL[@]}" -d postgres -tA -c "SELECT 1 FROM pg_database WHERE datname = '$LAB_DB_NAME'")"
cd "$RAIZ"
if [[ -z "$existe" ]]; then
  echo "→ creando la base $LAB_DB_NAME y su esquema"
  "$LAB_PG_BIN/createdb" -h "$LAB_DIR" -p "$LAB_PG_PORT" -U postgres -O "$LAB_DB_USER" -E UTF8 "$LAB_DB_NAME"
  "$BUN" --env-file="$ENV_FILE" run src/db/migrate.ts
  for m in "${MIGRACIONES_SUELTAS[@]}"; do
    "$BUN" --env-file="$ENV_FILE" run src/db/apply-migration.ts "drizzle/$m.sql"
  done
else
  # El baseline y la 0001 de total_hours no son idempotentes: no se reaplican sobre una base viva.
  echo "→ la base $LAB_DB_NAME ya existe: no se reaplica el esquema (usa --reset para reconstruirla)"
fi

echo "→ seed sintético"
"$BUN" --env-file="$ENV_FILE" run src/db/seed/laboratorio.ts --apply

# 6. Verificación. Cada consulta devuelve 't' si se cumple.
TABLAS_ESPERADAS="$(grep -c '= pgTable(' src/db/schema/schema.ts)"
verificar() {
  local resultado
  resultado="$("${PSQL[@]}" -d "$LAB_DB_NAME" -tA -c "$2")"
  if [[ "$resultado" == "t" ]]; then
    echo "  ✓ $1"
  else
    fallar "Verificación fallida: $1"
  fi
}
echo "→ verificación"
verificar "no quedan las tablas retiradas" "SELECT coalesce(to_regclass('public.student_portal_score'), to_regclass('public.section_representative_claim'), to_regclass('public.student_record_entry'), to_regclass('public.student_academic_snapshot'), to_regclass('public.student_period_summary'), to_regclass('public.course_equivalence'), to_regclass('public.app_setting')) IS NULL"
verificar "no quedan las columnas retiradas" "SELECT count(*) = 0 FROM information_schema.columns WHERE table_schema = 'public' AND (column_name LIKE 'portal\_%' OR (table_name, column_name) IN (('enrollment', 'final_grade'), ('course', 'weekly_hours'), ('teacher', 'linkedin_link')))"
verificar "las tablas son las $TABLAS_ESPERADAS de schema.ts" "SELECT count(*) = $TABLAS_ESPERADAS FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
verificar "todas las cuentas son sintéticas" "SELECT count(*) = 0 FROM app_user WHERE (code !~ '^2099[0-9]{4}$' AND code !~ '^lab\.') OR institutional_email NOT LIKE '%@laboratorio.test'"
verificar "todos los docentes son sintéticos" "SELECT count(*) = 0 FROM teacher WHERE institutional_email IS NULL OR institutional_email NOT LIKE '%@laboratorio.test'"
verificar "hay un solo período activo" "SELECT count(*) = 1 FROM academic_period WHERE is_active"
verificar "toda matrícula tiene horas de asistencia" "SELECT count(*) > 0 AND bool_and(total_hours > 0 AND attended_hours + absent_hours <= total_hours) FROM enrollment"
verificar "toda oferta tiene total_hours" "SELECT count(*) > 0 AND bool_and(total_hours > 0) FROM course_offering"
verificar "hay delegado y subdelegado activos" "SELECT count(DISTINCT position) = 2 FROM section_representative WHERE is_active"

cat <<EOF

✓ Base de laboratorio lista en 127.0.0.1:$LAB_PG_PORT/$LAB_DB_NAME (datos en $LAB_DIR).
  Backend:  BUN=$BUN scripts/laboratorio/levantar-backend.sh
  Detener:  scripts/laboratorio/detener-bd.sh
EOF
