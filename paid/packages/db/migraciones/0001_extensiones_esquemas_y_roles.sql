-- ═══════════════════════════════════════════════════════════════════════════
-- 0001 — Extensiones, esquemas, roles y funciones de contexto
--
-- ⚠️ TODO(JACID): TODO el esquema de la PAID esta DERIVADO de PROMPT.md, no
-- traducido de `anexo_A_ddl_paid.sql`, que no existe. Ver docs/DECISIONES.md,
-- D-13. Los nombres de columna son nuestros y habra que reconciliarlos si el
-- DDL de referencia aparece.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS postgis;      -- R13: geography(Point,4326) + GiST
CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- indice GIN sobre nombre de entidad
CREATE EXTENSION IF NOT EXISTS ltree;        -- R6: org.unidad.ruta_jerarquica
CREATE EXTENSION IF NOT EXISTS unaccent;     -- normalizacion para deduplicacion
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- identificadores de sesion
CREATE EXTENSION IF NOT EXISTS vector;       -- pgvector: U3 y U4 (Parte B)

-- ── Esquemas ───────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS ref;   -- catalogos de dominio cerrado (P9)
CREATE SCHEMA IF NOT EXISTS org;   -- estructura organizacional y geografia
CREATE SCHEMA IF NOT EXISTS seg;   -- seguridad: usuarios, roles, sesiones
CREATE SCHEMA IF NOT EXISTS ai;    -- accion integral: actividades y maestros
CREATE SCHEMA IF NOT EXISTS doc;   -- normatividad y soportes
CREATE SCHEMA IF NOT EXISTS aud;   -- auditoria: bitacora y exportaciones
CREATE SCHEMA IF NOT EXISTS ia;    -- sugerencias del subsistema de IA (Parte B)

COMMENT ON SCHEMA ref IS 'Catalogos de dominio cerrado. Nunca VARCHAR libre (P9). TODO(JACID): derivado de PROMPT.md.';
COMMENT ON SCHEMA aud IS 'Solo insercion. Nadie, ni el administrador, tiene UPDATE ni DELETE (R15).';

-- ── Roles ──────────────────────────────────────────────────────────────────
--
-- R14 exige que el privilegio DELETE este «revocado salvo para el rol
-- administrador». Sin roles distintos no hay nada que revocar y el requisito
-- se queda en una frase (P8). De ahi tres roles de grupo por nivel de
-- privilegio, y roles de inicio de sesion que pertenecen a ellos.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'paid_consulta') THEN
    CREATE ROLE paid_consulta NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'paid_operacion') THEN
    CREATE ROLE paid_operacion NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'paid_administracion') THEN
    CREATE ROLE paid_administracion NOLOGIN;
  END IF;
END
$$;

COMMENT ON ROLE paid_consulta IS 'Solo SELECT. Rol CONSULTA de la matriz de permisos.';
COMMENT ON ROLE paid_operacion IS 'SELECT, INSERT, UPDATE. Sin DELETE: eliminar es un tramite (R14).';
COMMENT ON ROLE paid_administracion IS 'Añade DELETE. Unico rol que puede borrar fisicamente (R14), y solo con solicitud aprobada.';

GRANT USAGE ON SCHEMA ref, org, seg, ai, doc, aud, ia
  TO paid_consulta, paid_operacion, paid_administracion;

-- ── Funciones de contexto (R7) ─────────────────────────────────────────────
--
-- El contexto lo fija la aplicacion con `set_config(clave, valor, true)`, cuyo
-- tercer argumento es el `is_local` de SET LOCAL: el valor muere con la
-- transaccion. Ver packages/db/src/contexto.ts para el porque completo.
--
-- Estas funciones son el lado SQL de ese contrato. Devuelven NULL cuando no hay
-- contexto, y las politicas RLS se escriben de forma que NULL no ve nada: si
-- alguien olvida fijar el contexto, el resultado es cero filas, no todas.

CREATE OR REPLACE FUNCTION seg.id_usuario_actual()
RETURNS bigint
LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('app.id_usuario', true), '')::bigint $$;

CREATE OR REPLACE FUNCTION seg.id_unidad_actual()
RETURNS bigint
LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('app.id_unidad', true), '')::bigint $$;

/**
 * Ruta jerarquica de la unidad de la sesion, leida del contexto.
 *
 * Existe para romper una recursion real: si la politica RLS de `org.unidad`
 * busca esta ruta con una subconsulta sobre `org.unidad`, vuelve a evaluar la
 * misma politica y PostgreSQL aborta con «infinite recursion detected in
 * policy for relation "unidad"». Ver packages/db/src/contexto.ts.
 */
CREATE OR REPLACE FUNCTION seg.ruta_unidad_actual()
RETURNS ltree
LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('app.ruta_unidad', true), '')::ltree $$;

COMMENT ON FUNCTION seg.ruta_unidad_actual() IS
  'R6/R7: ruta ltree de la unidad de la sesion, tomada del contexto para que la politica de org.unidad no se consulte a si misma. NULL sin contexto: las politicas tratan NULL como «ninguna fila».';

CREATE OR REPLACE FUNCTION seg.id_sesion_actual()
RETURNS text
LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('app.id_sesion', true), '') $$;

CREATE OR REPLACE FUNCTION seg.direccion_ip_actual()
RETURNS inet
LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('app.direccion_ip', true), '')::inet $$;

COMMENT ON FUNCTION seg.id_unidad_actual() IS
  'Unidad de la sesion en curso (R7). NULL si no hay contexto: las politicas RLS tratan NULL como «ninguna fila».';

-- ── Normalizacion de texto ─────────────────────────────────────────────────
--
-- ⚠️ Tiene que producir EXACTAMENTE el mismo resultado que
-- `normalizarTexto()` de packages/schema/src/primitivos.ts. Si divergen, el
-- indice trigram y la comparacion del cliente discrepan, y aparecen duplicados
-- que la interfaz dijo que no existian. Hay una prueba de la Puerta 1 que
-- compara ambas salidas sobre el mismo conjunto de cadenas.
CREATE OR REPLACE FUNCTION ref.normalizar_texto(entrada text)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT
AS $$
  SELECT upper(btrim(regexp_replace(unaccent('unaccent', entrada), '\s+', ' ', 'g')))
$$;

COMMENT ON FUNCTION ref.normalizar_texto(text) IS
  'Sin tildes, espacios colapsados, mayusculas. Espejo de normalizarTexto() en packages/schema. Si divergen es un defecto.';

-- ── Columnas de auditoria de fila (P3: estas CUATRO mas la bitacora) ───────
--
-- Guardan el ultimo modificador. No sustituyen a aud.bitacora_cambio: el
-- segundo UPDATE borraria la huella del primero. Van las dos cosas (P3).
CREATE OR REPLACE FUNCTION aud.fijar_columnas_auditoria()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.creado_en := now();
    NEW.creado_por := seg.id_usuario_actual();
    NEW.modificado_en := now();
    NEW.modificado_por := seg.id_usuario_actual();
  ELSE
    NEW.creado_en := OLD.creado_en;
    NEW.creado_por := OLD.creado_por;
    NEW.modificado_en := now();
    NEW.modificado_por := seg.id_usuario_actual();
  END IF;
  RETURN NEW;
END
$$;
