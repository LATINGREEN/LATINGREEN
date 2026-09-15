-- Reversion de 0012.
DROP POLICY IF EXISTS alianza_ambito ON ai.alianza;
DROP TABLE IF EXISTS ai.alianza;
DROP FUNCTION IF EXISTS ai.verificar_avance_solo_en_convenio();
