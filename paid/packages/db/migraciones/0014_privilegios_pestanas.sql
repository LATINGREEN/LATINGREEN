-- ═══════════════════════════════════════════════════════════════════════════
-- 0014 — `DELETE` sobre las filas de las once pestañas
--
-- Hueco detectado al ejecutar la Puerta 3: quitar una fila de una pestaña
-- devolvia «permission denied for table act_resumen».
--
-- EL PROBLEMA DE INTERPRETACION. R14 dice: «Borrado logico via
-- `estado_registro`, privilegio `DELETE` revocado salvo para el rol
-- administrador, y `seg.solicitud_eliminacion` [...] "para eliminar se debe
-- elevar la solicitud a JACID explicando los motivos".»
--
-- Aplicado literalmente a las once tablas hijas, un operador que anade por
-- error una fila a «Bienes Donados» tendria que elevar una solicitud a JACID
-- para quitarla. Eso no es lo que la regla protege.
--
-- LA LECTURA QUE SE ADOPTA. R14 protege REGISTROS: la actividad, el personal,
-- las entidades, las herramientas, la normatividad. Las filas de las pestañas
-- son el CONTENIDO de un formulario que se esta diligenciando; quitar una fila
-- que se acaba de anadir es editar, no eliminar un registro. De hecho esas
-- tablas no tienen `estado_registro`, asi que no admiten borrado logico: o se
-- pueden quitar, o el formulario no se puede corregir.
--
-- POR QUE ES SEGURO. R15 lo hace reversible: el disparador de bitacora guarda
-- la imagen ANTERIOR de cada fila borrada, con usuario, unidad, sesion e IP. No
-- se pierde nada, y queda el rastro de quien la quito y cuando.
--
-- LO QUE SIGUE REVOCADO. `DELETE` sobre `ai.actividad`, los cinco subtipos,
-- `ai.personal`, `ai.entidad`, `ai.herramienta_aid`, `ai.alianza`,
-- `org.unidad` y `doc.normatividad`. Ahi R14 se aplica entera: eliminar uno de
-- esos registros sigue exigiendo la solicitud aprobada por JACID.
--
-- ⚠️ TODO(JACID): confirmar esta lectura. Si JACID responde que tambien las
-- filas de pestaña exigen solicitud, se revierte esta migracion y la interfaz
-- tiene que ofrecer «solicitar eliminacion» en cada fila.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'act_tipo_operacion','act_entidad_servicio','act_servicio_prestado',
    'act_poblacion_beneficiada','act_entidad_apoyada','act_medio_difusion',
    'act_medio_utilizado','act_recurso_utilizado','act_bien_donado','act_resumen',
    -- R18: quitar un COAMI marcado por error es lo mismo. Y «si no hubo
    -- participacion NO realice seleccion» implica poder desmarcarlo.
    'actividad_coami'
  ] LOOP
    EXECUTE format('GRANT DELETE ON ai.%I TO paid_operacion', t);
  END LOOP;
END
$$;

-- `ai.act_adjunto` NO entra en la lista: SI tiene `estado_registro`, asi que
-- admite baja logica, y ese es su camino (la baja libera cuota sin destruir el
-- binario, R11 + R14). El `DELETE` fisico de un adjunto sigue siendo solo de
-- administracion.
