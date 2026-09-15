-- Reversion de 0009. Al eliminar las funciones con CASCADE caen sus
-- disparadores, que es exactamente lo que se quiere.
DROP FUNCTION IF EXISTS aud.registrar_cambio() CASCADE;
DROP FUNCTION IF EXISTS ai.actualizar_registro_completo() CASCADE;
DROP FUNCTION IF EXISTS ai.recalcular_registro_completo(bigint);
DROP FUNCTION IF EXISTS ai.verificar_progresion_avance() CASCADE;
DROP FUNCTION IF EXISTS ai.verificar_cuota_adjuntos() CASCADE;
DROP FUNCTION IF EXISTS ai.verificar_campana_es_de_fuerza() CASCADE;
DROP FUNCTION IF EXISTS ai.verificar_subtipo_presente() CASCADE;
DROP FUNCTION IF EXISTS ai.impedir_cambio_de_tipo_actividad() CASCADE;
DROP FUNCTION IF EXISTS org.recolocar_descendientes() CASCADE;
DROP FUNCTION IF EXISTS org.derivar_ruta_jerarquica() CASCADE;
DROP FUNCTION IF EXISTS ref.id_estado_activo() CASCADE;

-- Los disparadores de columnas de auditoria de fila comparten funcion con
-- 0001, que no se elimina aqui. Se retiran uno a uno.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS esquema, c.relname AS tabla, t.tgname AS disparador
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE NOT t.tgisinternal
       AND t.tgname LIKE '%\_auditoria\_fila'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I', r.disparador, r.esquema, r.tabla);
  END LOOP;
END
$$;
