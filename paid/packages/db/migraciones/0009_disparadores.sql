-- ═══════════════════════════════════════════════════════════════════════════
-- 0009 — Disparadores: aqui viven las reglas
--
-- «Las reglas viven en la base de datos y no en la capa de aplicacion, y las
-- puertas se verifican con tests y no con una lectura del codigo.»
--
--   R15 — bitacora generica sobre `ai`, `org` y `doc`
--   R11 — cuota de 10 MB AGREGADA por actividad
--   R10 — progresion del avance (y la escala de ocho tramos, ya en el CHECK)
--   R19 — `registro_completo`
--   R16 — las campanas solo las cargan las Fuerzas Navales
--   R6  — `ruta_jerarquica` derivada de la unidad superior
--   P1  — una actividad no existe sin su subtipo
--   P3  — las cuatro columnas de auditoria de fila
--   Inmutabilidad de `id_tipo_actividad`
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Helper: el estado «vigente» ────────────────────────────────────────────
--
-- Se resuelve por codigo y no por un identificador fijo, para no clavar un
-- numero en varios disparadores. Es STABLE, asi que PostgreSQL la evalua una
-- vez por sentencia y no una vez por fila.
CREATE OR REPLACE FUNCTION ref.id_estado_activo()
RETURNS smallint
LANGUAGE sql STABLE
AS $$ SELECT id FROM ref.estado_registro WHERE codigo = 'ACTIVO' $$;

-- ═══ R6 — Ruta jerarquica derivada ═════════════════════════════════════════
--
-- `org.unidad.ruta_jerarquica` no se digita: se construye desde la unidad
-- superior. Es la columna sobre la que RLS decide la visibilidad (migracion
-- 0010), asi que si se pudiera escribir a mano, el aislamiento entre unidades
-- seria opinable.
--
-- Las etiquetas son `u<id>` y no la sigla: ltree solo admite
-- [A-Za-z0-9_] en una etiqueta, y una sigla siempre valida hoy podria dejar de
-- serlo manana. El identificador es estable y no puede contener nada raro.
CREATE OR REPLACE FUNCTION org.derivar_ruta_jerarquica()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  ruta_superior ltree;
BEGIN
  IF NEW.id_unidad_superior IS NULL THEN
    NEW.ruta_jerarquica := text2ltree('u' || NEW.id::text);
  ELSE
    SELECT ruta_jerarquica INTO ruta_superior
      FROM org.unidad WHERE id = NEW.id_unidad_superior;

    IF ruta_superior IS NULL THEN
      RAISE EXCEPTION 'La unidad superior % no existe o no tiene ruta jerarquica.',
        NEW.id_unidad_superior;
    END IF;

    -- Un ciclo se detecta aqui: si la unidad ya aparece en la ruta de su
    -- supuesta superior, colgarla de ella cerraria el grafo.
    IF ruta_superior ~ ('*.u' || NEW.id::text || '.*')::lquery
       OR ruta_superior ~ ('*.u' || NEW.id::text)::lquery THEN
      RAISE EXCEPTION
        'Colgar la unidad % de la unidad % crearia un ciclo en la jerarquia.',
        NEW.id, NEW.id_unidad_superior;
    END IF;

    NEW.ruta_jerarquica := ruta_superior || text2ltree('u' || NEW.id::text);
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER unidad_derivar_ruta
  BEFORE INSERT OR UPDATE OF id_unidad_superior ON org.unidad
  FOR EACH ROW EXECUTE FUNCTION org.derivar_ruta_jerarquica();

-- Si una unidad cambia de superior, sus descendientes tienen que seguirla. Sin
-- esto, mover una unidad deja a sus subordinadas apuntando a una ruta que ya
-- no existe, y RLS empieza a ocultar datos legitimos sin que nada falle.
CREATE OR REPLACE FUNCTION org.recolocar_descendientes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.ruta_jerarquica IS DISTINCT FROM OLD.ruta_jerarquica THEN
    UPDATE org.unidad
       SET ruta_jerarquica = NEW.ruta_jerarquica || subpath(ruta_jerarquica, nlevel(OLD.ruta_jerarquica))
     WHERE ruta_jerarquica <@ OLD.ruta_jerarquica
       AND id <> NEW.id;
  END IF;
  RETURN NULL;
END
$$;

CREATE TRIGGER unidad_recolocar_descendientes
  AFTER UPDATE OF ruta_jerarquica ON org.unidad
  FOR EACH ROW EXECUTE FUNCTION org.recolocar_descendientes();

-- ═══ Inmutabilidad de id_tipo_actividad ════════════════════════════════════
--
-- Cambiar el tipo de una actividad ya creada dejaria su fila de subtipo
-- colgando de un tipo que no le corresponde. La clave foranea compuesta de P1
-- lo detectaria, pero el mensaje seria incomprensible; y en una actividad sin
-- subtipo todavia, no lo detectaria en absoluto.
CREATE OR REPLACE FUNCTION ai.impedir_cambio_de_tipo_actividad()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id_tipo_actividad IS DISTINCT FROM OLD.id_tipo_actividad THEN
    RAISE EXCEPTION
      'El tipo de una actividad no se puede cambiar (era %, se intento %). Cree otra actividad.',
      OLD.id_tipo_actividad, NEW.id_tipo_actividad
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER actividad_tipo_inmutable
  BEFORE UPDATE OF id_tipo_actividad ON ai.actividad
  FOR EACH ROW EXECUTE FUNCTION ai.impedir_cambio_de_tipo_actividad();

-- ═══ P1 — Una actividad no existe sin su subtipo ═══════════════════════════
--
-- Una clave foranea no puede exigir la existencia del lado hijo, asi que hace
-- falta un disparador. Es DEFERRABLE INITIALLY DEFERRED: la comprobacion ocurre
-- al confirmar la transaccion, de modo que insertar la actividad y luego su
-- subtipo —el orden natural— funciona.
CREATE OR REPLACE FUNCTION ai.verificar_subtipo_presente()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  tabla_subtipo text;
  existe boolean;
BEGIN
  SELECT CASE NEW.id_tipo_actividad
           WHEN 1 THEN 'jornada_apoyo'
           WHEN 2 THEN 'asistencia_humanitaria'
           WHEN 3 THEN 'rueda_servicios'
           WHEN 4 THEN 'proyecto_social'
           WHEN 5 THEN 'campana'
         END
    INTO tabla_subtipo;

  IF tabla_subtipo IS NULL THEN
    RAISE EXCEPTION 'Tipo de actividad % sin tabla de subtipo asociada.', NEW.id_tipo_actividad;
  END IF;

  EXECUTE format('SELECT EXISTS (SELECT 1 FROM ai.%I WHERE id_actividad = $1)', tabla_subtipo)
    INTO existe USING NEW.id;

  IF NOT existe THEN
    RAISE EXCEPTION
      'La actividad % es de tipo % y no tiene su fila en ai.%. Una actividad no existe sin su subtipo (P1).',
      NEW.id, NEW.id_tipo_actividad, tabla_subtipo
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NULL;
END
$$;

CREATE CONSTRAINT TRIGGER actividad_exige_subtipo
  AFTER INSERT ON ai.actividad
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ai.verificar_subtipo_presente();

-- ═══ R16 — Las campanas solo las cargan las Fuerzas Navales ════════════════
--
-- «Las campañas las cargan solo las Fuerzas Navales, divididas en jornadas.»
-- Es una regla de datos y no solo de permisos: un permiso mal asignado en la
-- Fase 2 no debe poder crear una campana a nombre de una unidad tactica.
CREATE OR REPLACE FUNCTION ai.verificar_campana_es_de_fuerza()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  nivel text;
BEGIN
  SELECT n.codigo INTO nivel
    FROM ai.actividad a
    JOIN org.unidad u ON u.id = a.id_unidad
    JOIN ref.nivel_jerarquia n ON n.id = u.id_nivel_jerarquia
   WHERE a.id = NEW.id_actividad;

  IF nivel IS DISTINCT FROM 'FUERZA' THEN
    RAISE EXCEPTION
      'R16: las campanas las cargan solo las Fuerzas Navales. La unidad de la actividad % es de nivel %.',
      NEW.id_actividad, COALESCE(nivel, 'desconocido')
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER campana_solo_nivel_fuerza
  BEFORE INSERT OR UPDATE ON ai.campana
  FOR EACH ROW EXECUTE FUNCTION ai.verificar_campana_es_de_fuerza();

-- ═══ R11 — Cuota de 10 MB AGREGADA por actividad ═══════════════════════════
--
-- ⚠️ Esta es la respuesta al anti-patron P5. Un `CHECK (peso_bytes <=
-- 10485760)` limita CADA ARCHIVO, no la suma: cuarenta archivos de 9 MB
-- pasarian. La regla es sobre el agregado, asi que necesita ver las demas
-- filas, y eso solo lo puede hacer un disparador.
--
-- Suma los bytes VIGENTES (R14: un adjunto dado de baja libera su espacio).
CREATE OR REPLACE FUNCTION ai.verificar_cuota_adjuntos()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  cuota_bytes  constant bigint := 10485760;  -- 10 MB. Mismo valor que
                                             -- CUOTA_BYTES_POR_ACTIVIDAD en
                                             -- packages/schema.
  bytes_previos bigint;
  bytes_totales bigint;
BEGIN
  SELECT COALESCE(SUM(peso_bytes), 0) INTO bytes_previos
    FROM ai.act_adjunto
   WHERE id_actividad = NEW.id_actividad
     AND id_estado_registro = ref.id_estado_activo()
     -- En un UPDATE no se cuenta la propia fila dos veces.
     AND (TG_OP = 'INSERT' OR id <> NEW.id);

  bytes_totales := bytes_previos + NEW.peso_bytes;

  IF bytes_totales > cuota_bytes THEN
    RAISE EXCEPTION
      'R11: la actividad % ya usa % bytes de los % permitidos; el archivo de % bytes la llevaria a %. La cuota de 10 MB es AGREGADA, no por archivo.',
      NEW.id_actividad, bytes_previos, cuota_bytes, NEW.peso_bytes, bytes_totales
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER act_adjunto_verificar_cuota
  BEFORE INSERT OR UPDATE OF peso_bytes, id_estado_registro ON ai.act_adjunto
  FOR EACH ROW EXECUTE FUNCTION ai.verificar_cuota_adjuntos();

-- ═══ R10 — El avance solo progresa ═════════════════════════════════════════
--
-- La escala de ocho tramos ya la impone el CHECK de 0006. Lo que falta aqui es
-- la progresion: «un tramo nuevo no puede ser menor que el ultimo». Tampoco
-- igual: repetir un tramo no es avanzar (y eso ya lo cubre el UNIQUE).
--
-- La comparacion es por POSICION en la escala, no por valor numerico. Da el
-- mismo resultado con esta escala, pero expresa la intencion correcta: los
-- tramos son etapas ordenadas con su paquete documental, no porcentajes.
CREATE OR REPLACE FUNCTION ai.verificar_progresion_avance()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  escala constant smallint[] := ARRAY[10,20,30,40,50,60,70,100];
  ultimo smallint;
  pos_nuevo int;
  pos_ultimo int;
BEGIN
  pos_nuevo := array_position(escala, NEW.porcentaje_avance);
  IF pos_nuevo IS NULL THEN
    -- Defensa en profundidad: el CHECK ya lo rechazo. Si llegamos aqui, es que
    -- alguien toco el CHECK.
    RAISE EXCEPTION
      'R10: el tramo % no existe en la escala PAID (10,20,30,40,50,60,70,100). Los tramos 80 y 90 NO existen.',
      NEW.porcentaje_avance
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT porcentaje_avance INTO ultimo
    FROM ai.proyecto_avance
   WHERE id_actividad = NEW.id_actividad
     AND (TG_OP = 'INSERT' OR id <> NEW.id)
   ORDER BY array_position(escala, porcentaje_avance) DESC
   LIMIT 1;

  IF ultimo IS NOT NULL THEN
    pos_ultimo := array_position(escala, ultimo);
    IF pos_nuevo <= pos_ultimo THEN
      RAISE EXCEPTION
        'R10: el avance solo progresa. El proyecto % ya esta en el tramo % y se intento registrar %.',
        NEW.id_actividad, ultimo, NEW.porcentaje_avance
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- El avance vigente del proyecto se mantiene sincronizado con el historico:
  -- asi no puede haber un proyecto que diga 40 en su fila y 70 en su ultimo
  -- avance registrado.
  UPDATE ai.proyecto_social
     SET porcentaje_avance = NEW.porcentaje_avance
   WHERE id_actividad = NEW.id_actividad;

  RETURN NEW;
END
$$;

CREATE TRIGGER proyecto_avance_verificar_progresion
  BEFORE INSERT OR UPDATE OF porcentaje_avance ON ai.proyecto_avance
  FOR EACH ROW EXECUTE FUNCTION ai.verificar_progresion_avance();

-- ═══ R19 — registro_completo ═══════════════════════════════════════════════
--
-- La obligatoriedad de las once pestanas no se expresa con NOT NULL: son
-- tablas hijas que pueden quedar vacias. Se calcula aqui, y los consolidados
-- del RAO filtran por esta columna.
--
-- ⚠️ TODO(JACID): R19 dice que las once son obligatorias, y eso es lo
-- implementado. Si JACID confirma que alguna puede quedar vacia
-- legitimamente (por ejemplo, una jornada sin bienes donados), se retira de
-- esta lista y de ningun otro sitio: es el unico lugar donde se decide.
CREATE OR REPLACE FUNCTION ai.recalcular_registro_completo(p_id_actividad bigint)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  completo boolean;
BEGIN
  SELECT
        EXISTS (SELECT 1 FROM ai.act_tipo_operacion        WHERE id_actividad = p_id_actividad)
    AND EXISTS (SELECT 1 FROM ai.act_adjunto               WHERE id_actividad = p_id_actividad
                                                             AND id_estado_registro = ref.id_estado_activo())
    AND EXISTS (SELECT 1 FROM ai.act_entidad_servicio      WHERE id_actividad = p_id_actividad)
    AND EXISTS (SELECT 1 FROM ai.act_servicio_prestado     WHERE id_actividad = p_id_actividad)
    AND EXISTS (SELECT 1 FROM ai.act_poblacion_beneficiada WHERE id_actividad = p_id_actividad)
    AND EXISTS (SELECT 1 FROM ai.act_entidad_apoyada       WHERE id_actividad = p_id_actividad)
    AND EXISTS (SELECT 1 FROM ai.act_medio_difusion        WHERE id_actividad = p_id_actividad)
    AND EXISTS (SELECT 1 FROM ai.act_medio_utilizado       WHERE id_actividad = p_id_actividad)
    AND EXISTS (SELECT 1 FROM ai.act_recurso_utilizado     WHERE id_actividad = p_id_actividad)
    AND EXISTS (SELECT 1 FROM ai.act_bien_donado           WHERE id_actividad = p_id_actividad)
    AND EXISTS (SELECT 1 FROM ai.act_resumen               WHERE id_actividad = p_id_actividad)
  INTO completo;

  UPDATE ai.actividad
     SET registro_completo = completo
   WHERE id = p_id_actividad
     AND registro_completo IS DISTINCT FROM completo;
END
$$;

COMMENT ON FUNCTION ai.recalcular_registro_completo(bigint) IS
  'R19: unico lugar donde se decide que pestanas hacen falta para que un registro este completo. TODO(JACID): hoy son las once.';

CREATE OR REPLACE FUNCTION ai.actualizar_registro_completo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM ai.recalcular_registro_completo(
    COALESCE(NEW.id_actividad, OLD.id_actividad)
  );
  RETURN NULL;
END
$$;

-- Se engancha a las once tablas hijas. Si alguien anade una pestana y olvida
-- el disparador, `registro_completo` mentiria; de ahi que se declare en bucle
-- sobre la misma lista que el calculo.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'act_tipo_operacion','act_adjunto','act_entidad_servicio','act_servicio_prestado',
    'act_poblacion_beneficiada','act_entidad_apoyada','act_medio_difusion',
    'act_medio_utilizado','act_recurso_utilizado','act_bien_donado','act_resumen'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON ai.%I
         FOR EACH ROW EXECUTE FUNCTION ai.actualizar_registro_completo()',
      t || '_registro_completo', t);
  END LOOP;
END
$$;

-- ═══ P3 — Las cuatro columnas de auditoria de fila ═════════════════════════
--
-- Guardan el ULTIMO modificador. No sustituyen a la bitacora: el segundo
-- UPDATE borraria la huella del primero. Van las dos cosas.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.table_schema, c.table_name
      FROM information_schema.columns c
     WHERE c.table_schema IN ('ai', 'org', 'doc', 'ref', 'seg')
       AND c.column_name = 'modificado_en'
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON %I.%I
         FOR EACH ROW EXECUTE FUNCTION aud.fijar_columnas_auditoria()',
      r.table_name || '_auditoria_fila', r.table_schema, r.table_name);
  END LOOP;
END
$$;

-- ═══ R15 — Bitacora generica ═══════════════════════════════════════════════
--
-- Toda insercion, modificacion y eliminacion en `ai`, `org` y `doc` queda
-- registrada con imagen anterior y posterior en JSONB, usuario, unidad, sesion
-- e IP.
--
-- Se alimenta por DISPARADOR y no desde el servicio: un servicio se puede
-- saltar —por un error, por una consulta suelta, por una tarea de
-- mantenimiento— y un disparador no.
--
-- El usuario sale del contexto de R7, no de un parametro: si la aplicacion
-- olvidara fijarlo, la fila queda con usuario NULL y eso es visible en una
-- revision, en lugar de no quedar fila.
CREATE OR REPLACE FUNCTION aud.registrar_cambio()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  imagen_anterior  jsonb;
  imagen_posterior jsonb;
  id_fila          bigint;
BEGIN
  IF TG_OP = 'INSERT' THEN
    imagen_posterior := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    imagen_anterior  := to_jsonb(OLD);
    imagen_posterior := to_jsonb(NEW);
    -- Un UPDATE que no cambia nada no es un cambio. Sin esto, una
    -- recomputacion interna (por ejemplo la de `registro_completo`) ensuciaria
    -- la bitacora con filas donde las dos imagenes son iguales.
    IF imagen_anterior = imagen_posterior THEN
      RETURN NULL;
    END IF;
  ELSE
    imagen_anterior := to_jsonb(OLD);
  END IF;

  -- La clave primaria se llama `id` en casi todas las tablas y `id_actividad`
  -- en los subtipos y en act_resumen.
  id_fila := COALESCE(
    (COALESCE(imagen_posterior, imagen_anterior) ->> 'id')::bigint,
    (COALESCE(imagen_posterior, imagen_anterior) ->> 'id_actividad')::bigint
  );

  INSERT INTO aud.bitacora_cambio (
    esquema, tabla, operacion, id_registro,
    imagen_anterior, imagen_posterior,
    id_usuario, id_unidad, id_sesion, direccion_ip
  ) VALUES (
    TG_TABLE_SCHEMA, TG_TABLE_NAME, left(TG_OP, 1), id_fila,
    imagen_anterior, imagen_posterior,
    seg.id_usuario_actual(), seg.id_unidad_actual(),
    seg.id_sesion_actual(), seg.direccion_ip_actual()
  );

  RETURN NULL;
END
$$;

COMMENT ON FUNCTION aud.registrar_cambio() IS
  'R15: bitacora generica de ai, org y doc. Por disparador, no desde el servicio. El usuario sale del contexto de R7.';

-- Se engancha a TODAS las tablas de `ai`, `org` y `doc`. En bucle sobre
-- information_schema a proposito: asi una tabla nueva en esos esquemas queda
-- cubierta con solo reaplicar esta migracion, y no se puede olvidar una.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT table_schema, table_name
      FROM information_schema.tables
     WHERE table_schema IN ('ai', 'org', 'doc')
       AND table_type = 'BASE TABLE'
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %I.%I
         FOR EACH ROW EXECUTE FUNCTION aud.registrar_cambio()',
      r.table_name || '_bitacora', r.table_schema, r.table_name);
  END LOOP;
END
$$;
