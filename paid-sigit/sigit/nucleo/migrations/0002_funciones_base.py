"""
Funciones de base de datos que no se pueden expresar con el ORM.

- Extensiones: pg_trgm (semejanza de textos, para evitar duplicados).
- Ruta materializada de unidades, calculada por disparador: RLS decide sobre
  ella, así que no se escribe a mano.
- Columnas de auditoría de fila, llenadas con el usuario del contexto.
- Bitácora de cambios, alimentada por disparador.
"""

from django.db import migrations

SUBIDA = r"""
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── Ruta materializada de unidades: '/1/5/23/' ───────────────────────────────
CREATE OR REPLACE FUNCTION sigit_calcular_ruta_unidad() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  ruta_superior varchar;
BEGIN
  IF NEW.superior_id IS NULL THEN
    NEW.ruta := '/' || NEW.id || '/';
  ELSE
    SELECT ruta INTO ruta_superior FROM nucleo_unidad WHERE id = NEW.superior_id;
    IF ruta_superior IS NULL THEN
      RAISE EXCEPTION 'La unidad superior % no existe', NEW.superior_id;
    END IF;
    -- Una unidad no puede colgar de sí misma ni de una de sus subordinadas.
    IF ruta_superior LIKE '%/' || NEW.id || '/%' THEN
      RAISE EXCEPTION 'Ciclo en la jerarquía: la unidad % no puede depender de %',
        NEW.id, NEW.superior_id;
    END IF;
    NEW.ruta := ruta_superior || NEW.id || '/';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER unidad_ruta
  BEFORE INSERT OR UPDATE OF superior_id, ruta ON nucleo_unidad
  FOR EACH ROW EXECUTE FUNCTION sigit_calcular_ruta_unidad();

-- Al recolocar una unidad, sus subordinadas recalculan su ruta en cascada
-- (cada UPDATE dispara el cálculo de la siguiente generación).
CREATE OR REPLACE FUNCTION sigit_propagar_ruta_unidad() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.ruta IS DISTINCT FROM OLD.ruta THEN
    UPDATE nucleo_unidad SET superior_id = superior_id WHERE superior_id = NEW.id;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER unidad_ruta_propagar
  AFTER UPDATE OF ruta ON nucleo_unidad
  FOR EACH ROW EXECUTE FUNCTION sigit_propagar_ruta_unidad();

-- ── Contexto de la transacción ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sigit_id_usuario_contexto() RETURNS bigint
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.id_usuario', true), '')::bigint
$$;

-- ¿La unidad está dentro del ámbito del contexto? FALLA CERRADA: sin contexto
-- (NULL o cadena vacía) no se ve nada.
CREATE OR REPLACE FUNCTION sigit_ve_unidad(p_unidad_id bigint) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('app.ruta_unidad', true), '') <> ''
     AND EXISTS (
       SELECT 1 FROM nucleo_unidad u
        WHERE u.id = p_unidad_id
          AND u.ruta LIKE current_setting('app.ruta_unidad', true) || '%'
     )
$$;

CREATE OR REPLACE FUNCTION sigit_hay_contexto() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('app.ruta_unidad', true), '') <> ''
$$;

-- ── Auditoría de fila ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sigit_fijar_auditoria() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.creado_en := now();
    NEW.creado_por_id := sigit_id_usuario_contexto();
  ELSE
    -- Quién creó y cuándo no cambia nunca, aunque alguien lo intente.
    NEW.creado_en := OLD.creado_en;
    NEW.creado_por_id := OLD.creado_por_id;
  END IF;
  NEW.modificado_en := now();
  NEW.modificado_por_id := sigit_id_usuario_contexto();
  RETURN NEW;
END $$;

-- ── Bitácora de cambios ──────────────────────────────────────────────────────
-- SECURITY DEFINER: escribe en la bitácora aunque el rol de la aplicación no
-- tenga INSERT directo sobre ella. Así nadie puede fabricar una entrada.
CREATE OR REPLACE FUNCTION sigit_registrar_cambio() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  antes jsonb;
  despues jsonb;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN antes := to_jsonb(OLD); END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN despues := to_jsonb(NEW); END IF;
  IF TG_OP = 'UPDATE' AND antes = despues THEN
    RETURN NULL;
  END IF;
  INSERT INTO nucleo_bitacora (tabla, operacion, id_registro, datos_antes, datos_despues,
                               id_usuario, instante)
  VALUES (TG_TABLE_NAME, TG_OP,
          COALESCE((despues ->> 'id')::bigint, (antes ->> 'id')::bigint),
          antes, despues, sigit_id_usuario_contexto(), now());
  RETURN NULL;
END $$;

CREATE TRIGGER unidad_auditoria
  BEFORE INSERT OR UPDATE ON nucleo_unidad
  FOR EACH ROW EXECUTE FUNCTION sigit_fijar_auditoria();
CREATE TRIGGER unidad_bitacora
  AFTER INSERT OR UPDATE OR DELETE ON nucleo_unidad
  FOR EACH ROW EXECUTE FUNCTION sigit_registrar_cambio();
"""

BAJADA = r"""
DROP TRIGGER IF EXISTS unidad_bitacora ON nucleo_unidad;
DROP TRIGGER IF EXISTS unidad_auditoria ON nucleo_unidad;
DROP TRIGGER IF EXISTS unidad_ruta_propagar ON nucleo_unidad;
DROP TRIGGER IF EXISTS unidad_ruta ON nucleo_unidad;
DROP FUNCTION IF EXISTS sigit_registrar_cambio();
DROP FUNCTION IF EXISTS sigit_fijar_auditoria();
DROP FUNCTION IF EXISTS sigit_hay_contexto();
DROP FUNCTION IF EXISTS sigit_ve_unidad(bigint);
DROP FUNCTION IF EXISTS sigit_id_usuario_contexto();
DROP FUNCTION IF EXISTS sigit_propagar_ruta_unidad();
DROP FUNCTION IF EXISTS sigit_calcular_ruta_unidad();
"""


class Migration(migrations.Migration):
    dependencies = [("nucleo", "0001_initial")]
    operations = [migrations.RunSQL(SUBIDA, BAJADA)]
