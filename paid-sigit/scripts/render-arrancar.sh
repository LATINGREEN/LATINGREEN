#!/bin/sh
# Arranque en Render. En el plan gratuito el servicio se duerme tras 15 minutos
# sin visitas y arranca de nuevo con cada despertar: todo aquí es idempotente.
set -eu
. ./scripts/render-clave.sh
PY=.venv/bin/python
$PY manage.py comprobar_rol_bd
$PY manage.py migrate --noinput
if [ "${SIGIT_DEMOSTRACION:-0}" = "1" ]; then
  $PY manage.py sembrar_demostracion
else
  $PY manage.py sembrar
fi
exec .venv/bin/gunicorn config.wsgi:application \
  --bind "0.0.0.0:${PORT:-8000}" --workers 2 --timeout 60 --access-logfile -
