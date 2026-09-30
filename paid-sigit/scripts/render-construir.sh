#!/bin/sh
# Construcción en Render (servicio web Python). Ver render.yaml en la raíz del
# repositorio y docs/MANUAL-TECNICO.md §4.1.
set -eu
pip install --quiet uv==0.8.17
# Versiones exactas de uv.lock; sin las herramientas de desarrollo.
uv sync --frozen --no-dev --python-preference only-system
. ./scripts/render-clave.sh
.venv/bin/python manage.py collectstatic --noinput
