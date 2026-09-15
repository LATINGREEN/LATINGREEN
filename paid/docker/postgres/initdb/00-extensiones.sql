-- Extensiones de la PAID (PROMPT.md A.1).
--
-- Se ejecuta una sola vez, al inicializar el volumen de datos. Las migraciones
-- de la Fase 1 NO deben depender de que esto haya corrido: cada migracion que
-- necesite una extension debe llevar su propio `CREATE EXTENSION IF NOT EXISTS`.
-- Este archivo es una comodidad para el entorno local, no la fuente de verdad.

CREATE EXTENSION IF NOT EXISTS postgis;      -- geography(Point,4326) + GiST (R13)
CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- indice GIN sobre nombre de entidad
CREATE EXTENSION IF NOT EXISTS ltree;        -- org.unidad.ruta_jerarquica (R6)
CREATE EXTENSION IF NOT EXISTS vector;       -- pgvector, para U3 y U4 (Parte B)
CREATE EXTENSION IF NOT EXISTS unaccent;     -- normalizacion para deduplicacion
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- identificadores de sesion

-- A.2.5 — la base habla UTC. La conversion a America/Bogota ocurre en el
-- borde, nunca aqui ni en la logica de negocio.
--
-- La zona horaria del servidor se fija en `docker-compose.yml` con
-- `-c timezone=UTC`, no aqui: un `ALTER DATABASE` en este archivo no puede
-- nombrar la base (el entrypoint no define variables de psql) y un valor
-- codificado se desincronizaria del nombre real de la base.
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'UTC');
END
$$;
