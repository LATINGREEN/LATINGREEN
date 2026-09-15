-- Reversion de 0004. Orden inverso al de creacion.
DROP FUNCTION IF EXISTS seg.fijar_expiracion_sesion() CASCADE;
DROP FUNCTION IF EXISTS seg.fijar_expiracion_captcha() CASCADE;
DROP TABLE IF EXISTS seg.solicitud_eliminacion;
DROP TABLE IF EXISTS seg.sesion;
DROP TABLE IF EXISTS seg.intento_autenticacion;
DROP TABLE IF EXISTS seg.captcha;
DROP TABLE IF EXISTS seg.historial_clave;
DROP TABLE IF EXISTS seg.usuario_rol;
DROP TABLE IF EXISTS seg.usuario;
DROP TABLE IF EXISTS seg.rol_permiso;
DROP TABLE IF EXISTS seg.rol;
DROP TABLE IF EXISTS seg.permiso;
DROP TABLE IF EXISTS seg.red_autorizada;
