# PostgreSQL 16 + PostGIS 3.4 + pgvector (A.1).
#
# Se construye en lugar de usar una imagen publica porque ninguna trae las dos
# extensiones a la vez: `postgis/postgis` no lleva pgvector y
# `pgvector/pgvector` no lleva PostGIS. pg_trgm y ltree ya vienen en contrib.
FROM postgis/postgis:16-3.4

# pgvector desde el repositorio PGDG, que la imagen base ya tiene configurado.
RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-16-pgvector \
 && rm -rf /var/lib/apt/lists/*

# A.2.5 — todo instante se almacena en UTC.
ENV TZ=UTC
ENV PGTZ=UTC
