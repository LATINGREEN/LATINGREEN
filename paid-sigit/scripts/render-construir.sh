#!/bin/sh
# Construcción en Render (servicio web Python). Ver render.yaml en la raíz del
# repositorio y docs/MANUAL-TECNICO.md §4.1.
set -eu
pip install --quiet uv==0.8.17
# Versiones exactas de uv.lock; sin las herramientas de desarrollo. Render ya
# impone el Python del sistema (UV_NO_MANAGED_PYTHON): no se repite aquí.
uv sync --frozen --no-dev
. ./scripts/render-clave.sh
.venv/bin/python manage.py collectstatic --noinput
