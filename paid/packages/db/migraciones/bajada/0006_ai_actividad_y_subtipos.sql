-- Reversion de 0006.
DROP TABLE IF EXISTS ai.actividad_coami;
DROP TABLE IF EXISTS ai.proyecto_avance;
DROP TABLE IF EXISTS ai.campana;
DROP TABLE IF EXISTS ai.proyecto_social;
DROP TABLE IF EXISTS ai.rueda_servicios;
DROP TABLE IF EXISTS ai.asistencia_humanitaria;
DROP TABLE IF EXISTS ai.jornada_apoyo;
DROP TABLE IF EXISTS ai.actividad;
DELETE FROM ref.tipo_asistencia WHERE id IN (1, 2);
DELETE FROM ref.tipo_actividad WHERE id IN (1, 2, 3, 4, 5);
