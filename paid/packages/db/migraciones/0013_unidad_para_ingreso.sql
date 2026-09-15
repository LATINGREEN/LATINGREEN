-- ═══════════════════════════════════════════════════════════════════════════
-- 0013 — La unidad que el ingreso necesita leer antes de haber contexto
--
-- Hueco detectado al ejecutar la Puerta 2.
--
-- EL PROBLEMA. El flujo de ingreso necesita la `ruta_jerarquica` de la unidad
-- del usuario para poder fijar el contexto de R7 (`app.ruta_unidad`). Pero esa
-- ruta esta en `org.unidad`, que tiene RLS FORZADA, y la politica compara
-- contra... el contexto. Que todavia no existe, porque se esta construyendo.
--
-- Sin esto, el ingreso falla con «La unidad N no existe»: RLS devuelve cero
-- filas, correctamente, porque no hay sesion.
--
-- LO QUE SE DESCARTO:
--
--   - Una politica que permita ver todo cuando NO hay contexto. Convertiria un
--     olvido de la aplicacion en una fuga total, que es exactamente lo que
--     0010 evita.
--   - Guardar la ruta en `seg.usuario`. Seria desnormalizar la jerarquia (P10)
--     y quedaria obsoleta al recolocar una unidad.
--   - Conectar la API con un rol que salte RLS. Anularia R6 por completo, y es
--     precisamente el defecto que la Puerta 2 detecto.
--
-- LA SOLUCION. Una funcion `SECURITY DEFINER` que devuelve UNA unidad por su
-- identificador, y solo los tres campos que el ingreso necesita.
--
-- Por que es aceptable aqui, cuando en 0010 se rechazo `SECURITY DEFINER`:
--
--   1. Expone lo minimo: tres campos de UNA fila que el usuario que esta
--      entrando tiene todo el derecho a conocer — es su propia unidad.
--   2. Si el dueno de la funcion no tuviera privilegio suficiente, el ingreso
--      FALLA de forma visible. En 0010 el mismo mecanismo habria fallado
--      hacia «se ve todo», que es silencioso.
--   3. `search_path` se fija en la propia funcion, de modo que no se puede
--      secuestrar creando objetos con el mismo nombre en otro esquema.
--
-- ⚠️ Esta funcion NO debe crecer. Si alguien necesita consultar `org.unidad`
-- de otra forma, es que su consulta va dentro de una transaccion con contexto,
-- y entonces RLS ya le responde.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION seg.unidad_para_ingreso(p_id_unidad bigint)
RETURNS TABLE (sigla varchar(30), nombre varchar(250), ruta_jerarquica ltree)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, org, public
AS $$
  SELECT u.sigla, u.nombre, u.ruta_jerarquica
    FROM org.unidad u
   WHERE u.id = p_id_unidad
$$;

COMMENT ON FUNCTION seg.unidad_para_ingreso(bigint) IS
  'Unica lectura de org.unidad permitida sin contexto de sesion, para que el ingreso pueda construir el contexto de R7. SECURITY DEFINER a proposito; ver la migracion 0013. No ampliar.';

-- Solo los roles de la aplicacion. No se concede a PUBLIC.
REVOKE ALL ON FUNCTION seg.unidad_para_ingreso(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION seg.unidad_para_ingreso(bigint)
  TO paid_consulta, paid_operacion, paid_administracion;
