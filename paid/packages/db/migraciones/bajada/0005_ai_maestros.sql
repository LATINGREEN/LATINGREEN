-- Reversion de 0005.
ALTER TABLE seg.usuario DROP CONSTRAINT IF EXISTS usuario_personal_fk;
DROP TABLE IF EXISTS ai.herramienta_aid_atributo;
DROP TABLE IF EXISTS ai.herramienta_aid;
DROP TABLE IF EXISTS ai.entidad;
DROP TABLE IF EXISTS ai.personal;
