-- Reversion de 0016.
DROP TRIGGER IF EXISTS herramienta_aid_inactiva_con_motivo ON ai.herramienta_aid;
DROP FUNCTION IF EXISTS ai.verificar_herramienta_inactiva_con_motivo();
DROP INDEX IF EXISTS ai.herramienta_aid_responsable_idx;
DROP INDEX IF EXISTS ai.herramienta_aid_estado_idx;
ALTER TABLE ai.herramienta_aid ALTER COLUMN fecha_registro DROP DEFAULT;
COMMENT ON COLUMN ai.herramienta_aid.descripcion IS NULL;
ALTER TABLE ai.herramienta_aid
  DROP COLUMN IF EXISTS id_personal_responsable,
  DROP COLUMN IF EXISTS fecha_potenciacion,
  DROP COLUMN IF EXISTS id_estado_herramienta;
DROP TABLE IF EXISTS ref.estado_herramienta_aid;
