# syntax=docker/dockerfile:1
# Servicio de asistencia por IA. Python 3.12 (B.3).
#
# IA7 — Sin salida de datos. En `docker-compose.yml` este servicio va en una
# red **interna** (`internal: true`), sin ruta a internet. Que no llame a
# ningun servicio externo no se deja a la convencion del codigo: se impone en
# la configuracion de red.
FROM python:3.12-slim-bookworm

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV TZ=UTC

WORKDIR /servicio
COPY apps/ia/pyproject.toml ./
COPY apps/ia/src ./src
COPY apps/ia/prompts ./prompts

# Sin extras de inferencia: la imagen base del entorno local no necesita GPU ni
# modelos. Se instalan donde haya hardware aprobado (Q12).
RUN pip install --no-cache-dir -e .

RUN useradd --create-home --uid 10001 servicio && chown -R servicio /servicio
USER servicio

EXPOSE 8000
CMD ["uvicorn", "paid_ia.principal:app", "--host", "0.0.0.0", "--port", "8000"]
