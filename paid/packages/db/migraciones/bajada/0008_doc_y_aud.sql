-- Reversion de 0008.
DROP TABLE IF EXISTS aud.exportacion;
DROP TRIGGER IF EXISTS bitacora_sin_truncado ON aud.bitacora_cambio;
DROP TRIGGER IF EXISTS bitacora_solo_insercion ON aud.bitacora_cambio;
DROP FUNCTION IF EXISTS aud.impedir_truncado_bitacora();
DROP FUNCTION IF EXISTS aud.impedir_modificacion_bitacora();
DROP TABLE IF EXISTS aud.bitacora_cambio;
DROP TABLE IF EXISTS doc.normatividad;
