-- ═══════════════════════════════════════════════════════════════════════════
-- 0010 — Row Level Security (R6 + R7)
--
-- «Una unidad ve lo suyo y lo de sus subordinadas, nunca lo de sus pares. Se
-- implementa con Row Level Security sobre `org.unidad.ruta_jerarquica`
-- (`ltree`), **no con un `WHERE` en el servicio**: si la aplicacion tiene un
-- error, la base debe seguir protegiendo.»
--
-- El contexto lo fija la aplicacion con `SET LOCAL` dentro de la transaccion
-- (R7). Las funciones `seg.id_unidad_actual()` y compania lo leen.
--
-- ⚠️ DECISION IMPORTANTE: si no hay contexto, no se ve NADA.
-- `seg.id_unidad_actual()` devuelve NULL, y todas las politicas de abajo
-- comparan contra esa unidad, asi que una consulta sin contexto devuelve cero
-- filas. La alternativa —que sin contexto se vea todo— convertiria un olvido
-- de la aplicacion en una fuga total. Fallar hacia «no veo nada» se detecta en
-- la primera prueba; fallar hacia «lo veo todo» no se detecta nunca.
--
-- ⚠️ `FORCE ROW LEVEL SECURITY` en todas: sin el, el DUENO de la tabla ignora
-- las politicas. Las migraciones corren como administrador y por tanto son
-- duenas de estas tablas; sin FORCE, una consulta de mantenimiento desde esa
-- conexion veria todo y nadie lo notaria.
-- Un superusuario sigue ignorando RLS por definicion: por eso la aplicacion se
-- conecta con un rol `NOSUPERUSER NOBYPASSRLS`, y por eso las pruebas de la
-- Puerta 1 se conectan con ese mismo tipo de rol y no como postgres.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Predicado de ambito ────────────────────────────────────────────────────
--
-- ¿La unidad `p_id_unidad` esta dentro del ambito de la unidad de la sesion?
-- Dentro significa: ella misma o alguna de sus subordinadas. El operador `<@`
-- de ltree es «es descendiente o igual».
--
-- Una sola funcion para que las diecisiete politicas de abajo no puedan
-- discrepar entre si.
CREATE OR REPLACE FUNCTION seg.unidad_en_ambito(p_id_unidad bigint)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM org.unidad objetivo
     WHERE objetivo.id = p_id_unidad
       AND objetivo.ruta_jerarquica <@ seg.ruta_unidad_actual()
  )
$$;

COMMENT ON FUNCTION seg.unidad_en_ambito(bigint) IS
  'R6: TRUE si la unidad indicada es la de la sesion o una subordinada suya. Compara contra la ruta del contexto (seg.ruta_unidad_actual), no contra una subconsulta sobre org.unidad, que provocaria recursion en la politica. Devuelve FALSE sin contexto: un olvido produce cero filas, no una fuga.';

-- ── org.unidad ─────────────────────────────────────────────────────────────
ALTER TABLE org.unidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE org.unidad FORCE ROW LEVEL SECURITY;

-- Una unidad se ve a si misma y a sus subordinadas.
--
-- ⚠️ El predicado usa `seg.ruta_unidad_actual()`, que lee la ruta del
-- CONTEXTO, y NO una subconsulta sobre org.unidad. Una subconsulta aqui
-- vuelve a evaluar esta misma politica y PostgreSQL aborta con «infinite
-- recursion detected in policy for relation "unidad"». No es una precaucion
-- teorica: se escribio asi primero y la Puerta 1 lo detecto.
--
-- Ver packages/db/src/contexto.ts para las tres salidas posibles y por que se
-- eligio traer la ruta en el contexto.
CREATE POLICY unidad_ambito_lectura ON org.unidad
  FOR SELECT
  USING (ruta_jerarquica <@ seg.ruta_unidad_actual());

-- Crear o mover unidades es administracion, y solo dentro del propio ambito.
CREATE POLICY unidad_ambito_escritura ON org.unidad
  FOR ALL
  USING (ruta_jerarquica <@ seg.ruta_unidad_actual())
  WITH CHECK (ruta_jerarquica <@ seg.ruta_unidad_actual());

-- ── ai.actividad — la politica raiz ────────────────────────────────────────
ALTER TABLE ai.actividad ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai.actividad FORCE ROW LEVEL SECURITY;

CREATE POLICY actividad_ambito ON ai.actividad
  FOR ALL
  USING (seg.unidad_en_ambito(id_unidad))
  -- Una unidad no registra actividades a nombre de otra. El WITH CHECK es lo
  -- que lo impide en la escritura; sin el, se podria insertar una fila que
  -- despues no se puede ni leer.
  WITH CHECK (seg.unidad_en_ambito(id_unidad));

COMMENT ON POLICY actividad_ambito ON ai.actividad IS
  'R6: la unidad de la actividad debe estar en el ambito de la sesion. De esta politica cuelgan las de los subtipos y las once tablas hijas.';

-- ── Subtipos y tablas hijas ────────────────────────────────────────────────
--
-- Su visibilidad es exactamente la de su actividad. No se repite el predicado
-- de ambito: se exige que la actividad padre sea visible, y de eso ya se
-- encarga la politica de arriba. PostgreSQL aplica RLS tambien dentro de esta
-- subconsulta, asi que la regla no se puede sortear por aqui.
--
-- La ventaja de encadenarlas asi es que hay UN solo sitio donde se define el
-- ambito. Repetir el predicado en dieciseis tablas seria repetir dieciseis
-- oportunidades de que una quedara mal.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    -- Subtipos
    'jornada_apoyo','asistencia_humanitaria','rueda_servicios','proyecto_social','campana',
    -- Las once pestanas
    'act_tipo_operacion','act_adjunto','act_entidad_servicio','act_servicio_prestado',
    'act_poblacion_beneficiada','act_entidad_apoyada','act_medio_difusion',
    'act_medio_utilizado','act_recurso_utilizado','act_bien_donado','act_resumen',
    -- Relacionadas
    'proyecto_avance','actividad_coami'
  ] LOOP
    EXECUTE format('ALTER TABLE ai.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE ai.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($politica$
      CREATE POLICY %I ON ai.%I
        FOR ALL
        USING (EXISTS (SELECT 1 FROM ai.actividad a WHERE a.id = %I.id_actividad))
        WITH CHECK (EXISTS (SELECT 1 FROM ai.actividad a WHERE a.id = %I.id_actividad))
    $politica$, t || '_ambito_por_actividad', t, t, t);
  END LOOP;
END
$$;

-- ── Maestros con unidad propia ─────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['personal', 'entidad', 'herramienta_aid'] LOOP
    EXECUTE format('ALTER TABLE ai.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE ai.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($politica$
      CREATE POLICY %I ON ai.%I
        FOR ALL
        USING (seg.unidad_en_ambito(id_unidad))
        WITH CHECK (seg.unidad_en_ambito(id_unidad))
    $politica$, t || '_ambito', t);
  END LOOP;
END
$$;

COMMENT ON POLICY entidad_ambito ON ai.entidad IS
  'R6 y IA8: una consulta por similitud semantica (U3) no puede devolver entidades fuera del ambito, porque RLS filtra antes de que el parecido importe.';

-- Los atributos de una herramienta siguen a su herramienta.
ALTER TABLE ai.herramienta_aid_atributo ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai.herramienta_aid_atributo FORCE ROW LEVEL SECURITY;
CREATE POLICY herramienta_aid_atributo_ambito ON ai.herramienta_aid_atributo
  FOR ALL
  USING (EXISTS (SELECT 1 FROM ai.herramienta_aid h WHERE h.id = id_herramienta_aid))
  WITH CHECK (EXISTS (SELECT 1 FROM ai.herramienta_aid h WHERE h.id = id_herramienta_aid));

-- ── doc.normatividad ───────────────────────────────────────────────────────
--
-- R16: «La normatividad solo la carga JACID; las unidades descargan.» El
-- ambito NO es jerarquico aqui: una directiva es para todos. Lo que se acota
-- es quien escribe, y eso ya lo hacen los privilegios de 0008.
--
-- Se activa RLS igualmente, con una politica de lectura para cualquier sesion
-- con contexto. Sin contexto no se ve nada, como en el resto: una consulta que
-- olvido fijar el contexto no debe funcionar «solo para normatividad», porque
-- entonces el olvido pasa inadvertido.
ALTER TABLE doc.normatividad ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc.normatividad FORCE ROW LEVEL SECURITY;

CREATE POLICY normatividad_lectura_general ON doc.normatividad
  FOR SELECT
  USING (seg.id_unidad_actual() IS NOT NULL);

CREATE POLICY normatividad_escritura_jacid ON doc.normatividad
  FOR ALL
  USING (seg.id_unidad_actual() IS NOT NULL)
  WITH CHECK (seg.id_unidad_actual() IS NOT NULL);

COMMENT ON POLICY normatividad_lectura_general ON doc.normatividad IS
  'R16: todas las unidades descargan normatividad, asi que el ambito no es jerarquico. Quien puede cargarla lo deciden los privilegios (0008) y el permiso NORMATIVIDAD.CARGAR (Fase 2).';
