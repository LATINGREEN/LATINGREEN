#!/usr/bin/env bash
#
# Levanta la PAID completa en este equipo para VERLA en el navegador.
#
# Hace lo mismo que `scripts/demostracion.sh` con la base de datos —una base
# desechable, migrada y sembrada— pero en lugar de recorrer el camino con curl
# deja la API y la interfaz corriendo, y dice a qué dirección entrar y con qué
# credencial.
#
# Uso:
#   ./scripts/mirar.sh              # base nueva cada vez
#   CONSERVAR=1 ./scripts/mirar.sh  # reutiliza la base si ya existe
#
# Ctrl-C cierra las dos cosas.
#
# Requisitos: PostgreSQL 16 con PostGIS y pgvector, Redis, y `pnpm -r build`.
set -euo pipefail

BASE="${BASE_MIRAR:-paid_mirar}"
URL_ADMIN="${DATABASE_URL_ADMIN_MIRAR:-postgres://paid_migrador:clave_local@127.0.0.1:5432}"
PUERTO_API="${PUERTO_API:-3000}"
PUERTO_WEB="${PUERTO_WEB:-5173}"
RAIZ_ALMACEN="${PAID_ALMACEN_RAIZ:-/tmp/paid-mirar-adjuntos}"

raiz="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$raiz"

azul=$'\e[1;34m'; verde=$'\e[1;32m'; amar=$'\e[1;33m'; gris=$'\e[0;90m'; fin=$'\e[0m'
paso() { printf '\n%s▸ %s%s\n' "$azul" "$1" "$fin"; }
ok()   { printf '  %s✓%s %s\n' "$verde" "$fin" "$1"; }
dato() { printf '    %s%s%s\n' "$gris" "$1" "$fin"; }

limpiar() {
  [[ -n "${PID_API:-}" ]] && kill "$PID_API" 2>/dev/null || true
  [[ -n "${PID_WEB:-}" ]] && kill "$PID_WEB" 2>/dev/null || true
}
trap limpiar EXIT INT TERM

existe=$(psql "$URL_ADMIN/postgres" -tAc \
  "SELECT 1 FROM pg_database WHERE datname = '$BASE'" || true)

if [[ "${CONSERVAR:-}" == "1" && "$existe" == "1" ]]; then
  paso "Reutilizando la base $BASE"
  # Reutilizar la base no es congelarla: si llegaron migraciones nuevas, sin
  # esto la API arranca contra columnas que no existen. Aplicar las pendientes
  # y volver a sembrar es seguro porque las dos cosas son idempotentes.
  DATABASE_URL_ADMIN="$URL_ADMIN/$BASE" node packages/db/dist/migrar.js | sed 's/^/    /'
  PAID_SEMILLA_DESARROLLO=1 DATABASE_URL_ADMIN="$URL_ADMIN/$BASE" \
    node packages/db/dist/sembrar.js | sed 's/^/    /'
else
  paso "Preparando la base $BASE"
  psql "$URL_ADMIN/postgres" -qc "DROP DATABASE IF EXISTS $BASE" >/dev/null
  psql "$URL_ADMIN/postgres" -qc "CREATE DATABASE $BASE" >/dev/null
  DATABASE_URL_ADMIN="$URL_ADMIN/$BASE" node packages/db/dist/migrar.js | sed 's/^/    /'
  # PAID_SEMILLA_DESARROLLO=1 es la peticion expresa: siembra credenciales con
  # clave conocida. Es para mirar, no para servir.
  PAID_SEMILLA_DESARROLLO=1 DATABASE_URL_ADMIN="$URL_ADMIN/$BASE" \
    node packages/db/dist/sembrar.js | sed 's/^/    /'

  # Datos para MIRAR: catalogos de ejemplo y maestros de BIM23. NO son
  # semillas y no viven en packages/db/semillas/ a proposito — ver la cabecera
  # del archivo. Sin ellos, todos los desplegables salen vacios y no se puede
  # distinguir «la pantalla esta bien y falta el dato» de «la pantalla esta
  # mal».
  psql "$URL_ADMIN/$BASE" -q -f scripts/datos-para-mirar.sql
  ok "datos de demostracion aplicados (BIM24 se deja vacia a proposito)"
fi

# El rol de la API NO puede ser superusuario: un superusuario ignora RLS y el
# aislamiento por unidad de R6 no se aplicaria, sin que nada lo delate.
psql "$URL_ADMIN/$BASE" -q <<SQL >/dev/null
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='paid_mirar_app') THEN
    CREATE ROLE paid_mirar_app LOGIN PASSWORD 'mirar' NOSUPERUSER NOBYPASSRLS;
  END IF;
END \$\$;
GRANT paid_operacion TO paid_mirar_app;
SQL
ok "rol paid_mirar_app (NOSUPERUSER NOBYPASSRLS)"

paso "Arrancando la API en :$PUERTO_API"
mkdir -p "$RAIZ_ALMACEN"
DATABASE_URL="postgres://paid_mirar_app:mirar@127.0.0.1:5432/$BASE" \
DATABASE_URL_ADMIN="$URL_ADMIN/$BASE" \
API_PUERTO="$PUERTO_API" LOG_LEVEL=warn NODE_ENV=development \
PAID_ALMACEN_RAIZ="$RAIZ_ALMACEN" \
  node apps/api/dist/main.js > /tmp/paid-mirar-api.log 2>&1 &
PID_API=$!

for _ in $(seq 1 40); do
  curl -fsS "http://127.0.0.1:$PUERTO_API/api/salud" >/dev/null 2>&1 && break
  sleep 0.5
done
if ! curl -fsS "http://127.0.0.1:$PUERTO_API/api/salud" >/dev/null 2>&1; then
  printf '  la API no arrancó. Log:\n'; tail -25 /tmp/paid-mirar-api.log; exit 1
fi
ok "API sana"

paso "Arrancando la interfaz en :$PUERTO_WEB"
WEB_PUERTO="$PUERTO_WEB" VITE_API_PROXY="http://127.0.0.1:$PUERTO_API" \
  pnpm --filter @paid/web exec vite > /tmp/paid-mirar-web.log 2>&1 &
PID_WEB=$!
for _ in $(seq 1 40); do
  curl -fsS "http://127.0.0.1:$PUERTO_WEB/" >/dev/null 2>&1 && break
  sleep 0.5
done
ok "interfaz en pie"

cat <<FIN

  ${verde}Abra${fin}  http://127.0.0.1:$PUERTO_WEB

  ${azul}Credenciales sembradas${fin} (clave única: Desarrollo2026*)
    BIM23_PAID       Operador de unidad — BIM23. Es la que hay que usar para
                     ver el registro de jornadas de punta a punta.
    BIM24_PAID       Operador de otra unidad. Entre con ella para comprobar
                     que NO ve nada de BIM23: eso lo aplica la base, no la
                     pantalla.
    FUNCIONAL_PAID   JACID. Es la única que puede diligenciar el avance de un
                     convenio y cargar normatividad.
    ADMIN_PAID       Administrador.

  ${amar}Lo que va a ver está sembrado para desarrollo${fin}: las claves son
  conocidas. La red está abierta (0.0.0.0/0 y ::/0, D-38); el arranque de la
  API lo dice en ${gris}/tmp/paid-mirar-api.log${fin}.

  Ctrl-C para cerrar las dos cosas.

FIN

wait "$PID_API" "$PID_WEB"
