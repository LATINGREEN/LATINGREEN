-- Reversion de 0001.
DROP FUNCTION IF EXISTS aud.fijar_columnas_auditoria();
DROP FUNCTION IF EXISTS ref.normalizar_texto(text);
DROP FUNCTION IF EXISTS seg.direccion_ip_actual();
DROP FUNCTION IF EXISTS seg.ruta_unidad_actual();
DROP FUNCTION IF EXISTS seg.id_sesion_actual();
DROP FUNCTION IF EXISTS seg.id_unidad_actual();
DROP FUNCTION IF EXISTS seg.id_usuario_actual();

DROP SCHEMA IF EXISTS ia CASCADE;
DROP SCHEMA IF EXISTS aud CASCADE;
DROP SCHEMA IF EXISTS doc CASCADE;
DROP SCHEMA IF EXISTS ai CASCADE;
DROP SCHEMA IF EXISTS seg CASCADE;
DROP SCHEMA IF EXISTS org CASCADE;
DROP SCHEMA IF EXISTS ref CASCADE;

-- Los roles se quedan. NO es un descuido:
--
-- Un rol de PostgreSQL es un objeto del CLUSTER, no de la base de datos. Una
-- migracion, en cambio, es por base. Si esta reversion eliminara los roles,
-- rompería cualquier OTRA base del mismo cluster que les hubiera concedido
-- privilegios — y `DROP ROLE` falla, precisamente, cuando eso ocurre
-- («role "paid_administracion" cannot be dropped because some objects depend
-- on it»). Lo comprobamos ejecutando la reversion con dos bases presentes.
--
-- Lo que si se retira es todo lo que los roles poseen o tienen concedido EN
-- ESTA BASE, que es el alcance legitimo de la migracion.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'paid_administracion') THEN
    EXECUTE 'DROP OWNED BY paid_administracion';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'paid_operacion') THEN
    EXECUTE 'DROP OWNED BY paid_operacion';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'paid_consulta') THEN
    EXECUTE 'DROP OWNED BY paid_consulta';
  END IF;
END
$$;

-- Las extensiones NO se eliminan: pueden estar en uso por otra base del
-- mismo cluster, y volver a crearlas es barato. Revertir una migracion no
-- deberia poder romper algo ajeno a ella.
