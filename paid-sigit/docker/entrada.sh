#!/bin/sh
# Las migraciones corren con el rol DUEÑO de las tablas; la aplicación, con un
# rol sin privilegios de dueño ni BYPASSRLS. Así, aunque alguien lograra
# ejecutar SQL a través de la aplicación, no podría desactivar RLS.
set -eu
if [ "${SIGIT_MIGRAR:-0}" = "1" ]; then
  DATABASE_URL="$DATABASE_URL_MIGRACIONES" python manage.py migrate --noinput
  DATABASE_URL="$DATABASE_URL_MIGRACIONES" python manage.py sembrar
fi
exec "$@"
