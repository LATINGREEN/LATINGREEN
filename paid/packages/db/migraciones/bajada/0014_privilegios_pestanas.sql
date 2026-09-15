-- Reversion de 0014.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'act_tipo_operacion','act_entidad_servicio','act_servicio_prestado',
    'act_poblacion_beneficiada','act_entidad_apoyada','act_medio_difusion',
    'act_medio_utilizado','act_recurso_utilizado','act_bien_donado','act_resumen',
    'actividad_coami'
  ] LOOP
    EXECUTE format('REVOKE DELETE ON ai.%I FROM paid_operacion', t);
  END LOOP;
END
$$;
