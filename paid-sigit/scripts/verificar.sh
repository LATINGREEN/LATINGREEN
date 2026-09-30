#!/usr/bin/env bash
# Batería de verificación de PAID SIGIT: lo que el área de tecnología de la
# Armada pide antes de aceptar un desarrollo (reunión del 30/09/2026):
# análisis estático, pruebas unitarias, escaneo de seguridad, dependencias
# sin vulnerabilidades conocidas y licencias que no comprometan a la Armada.
#
#   ./scripts/verificar.sh          # todo
#   SIN_RED=1 ./scripts/verificar.sh  # omite pip-audit (necesita salir a PyPI/OSV)
set -euo pipefail
cd "$(dirname "$0")/.."
PY=.venv/bin/python
paso() { printf '\n\033[1;34m▶ %s\033[0m\n' "$1"; }

paso "Estilo y análisis estático (ruff)"
.venv/bin/ruff check sigit config pruebas
.venv/bin/ruff format --check sigit config pruebas

paso "Escaneo de seguridad del código (bandit)"
.venv/bin/bandit -q -r sigit config -c pyproject.toml

paso "Migraciones al día con los modelos"
SIGIT_DEBUG=1 $PY manage.py makemigrations --check --dry-run

paso "Diccionario de datos al día con los modelos"
SIGIT_DEBUG=1 $PY manage.py diccionario_datos | diff -q - docs/DICCIONARIO-DATOS.md >/dev/null \
  || { echo "docs/DICCIONARIO-DATOS.md está desactualizado: python manage.py diccionario_datos > docs/DICCIONARIO-DATOS.md" >&2; exit 1; }

paso "Configuración de despliegue (check --deploy con valores de producción)"
SIGIT_CLAVE_SECRETA="$($PY -c 'import secrets; print(secrets.token_urlsafe(64))')" \
DATABASE_URL="postgres://x:y@127.0.0.1:5432/z" SIGIT_HOSTS="paid.ejemplo" \
  $PY manage.py check --deploy --fail-level WARNING

paso "Pruebas unitarias y de integración (pytest + cobertura)"
.venv/bin/pytest --create-db --cov=sigit --cov-report=term:skip-covered --cov-fail-under=80

if [ "${SIN_RED:-0}" != "1" ]; then
  paso "Dependencias sin vulnerabilidades conocidas (pip-audit)"
  .venv/bin/pip-audit --strict --progress-spinner off
fi

paso "Licencias: ninguna copyleft fuerte (GPL/AGPL) en las dependencias"
.venv/bin/pip-licenses --from=mixed --format=csv > /tmp/sigit-licencias.csv
if grep -Ei '"[^"]*(^|[^L])(A?GPL)[^"]*"' /tmp/sigit-licencias.csv | grep -vi 'LGPL' ; then
  echo "Hay dependencias con licencia GPL/AGPL: revíselas antes de entregar." >&2
  exit 1
fi
echo "Licencias permisivas (MIT, BSD, Apache, PSF, MPL) y LGPL de biblioteca (psycopg): ver docs/LICENCIAS.md"

printf '\n\033[1;32m✔ Verificación completa.\033[0m\n'
