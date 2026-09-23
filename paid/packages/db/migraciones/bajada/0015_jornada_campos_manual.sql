-- Reversion de 0015.
DROP INDEX IF EXISTS ai.jornada_apoyo_tipo_idx;
ALTER TABLE ai.jornada_apoyo
  DROP COLUMN IF EXISTS poblacion_afecta_tropa,
  DROP COLUMN IF EXISTS participo_fac,
  DROP COLUMN IF EXISTS participo_ejc,
  DROP COLUMN IF EXISTS id_tipo_jornada;
DROP TABLE IF EXISTS ref.tipo_jornada;
