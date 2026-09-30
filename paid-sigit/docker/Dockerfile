# PAID SIGIT Versión 2026 — imagen de la aplicación.
# Construcción en dos etapas: las dependencias se instalan desde uv.lock
# (versiones exactas, con resúmenes verificados) y la imagen final corre sin
# privilegios de administrador.
FROM python:3.12-slim-bookworm AS construccion
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PROJECT_ENVIRONMENT=/opt/venv
RUN pip install --no-cache-dir uv==0.8.17
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY . .
# Los estáticos se recolectan en la construcción: la imagen no descarga nada al arrancar.
RUN SIGIT_CLAVE_SECRETA=solo-para-recolectar-estaticos-en-la-construccion-de-la-imagen-0123456789 \
    DATABASE_URL=postgres://x:y@localhost/z /opt/venv/bin/python manage.py collectstatic --noinput

FROM python:3.12-slim-bookworm
ENV PATH=/opt/venv/bin:$PATH PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    SIGIT_RUTA_ADJUNTOS=/datos/adjuntos
RUN groupadd --system sigit && useradd --system --gid sigit --home /app sigit \
    && mkdir -p /datos/adjuntos && chown sigit:sigit /datos/adjuntos
COPY --from=construccion /opt/venv /opt/venv
COPY --from=construccion --chown=sigit:sigit /app /app
WORKDIR /app
USER sigit
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/salud/').status==200 else 1)"
ENTRYPOINT ["/app/docker/entrada.sh"]
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--access-logfile", "-"]
