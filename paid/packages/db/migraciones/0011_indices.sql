-- ═══════════════════════════════════════════════════════════════════════════
-- 0011 — Indices
--
-- No es una coleccion de indices «por si acaso»: cada uno responde a una
-- consulta que el sistema hace de verdad, y varios son condicion para que una
-- regla sea usable y no solo correcta.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── R6 — El indice del que depende RLS ─────────────────────────────────────
--
-- Toda politica RLS de `ai` acaba comparando rutas con `<@`. Sin un indice
-- GiST sobre ltree, cada consulta de cada usuario recorre org.unidad entera.
-- Es el indice mas importante del esquema: no cambia el resultado, pero sin el
-- el aislamiento por unidad es inviable en produccion.
CREATE INDEX unidad_ruta_jerarquica_gist ON org.unidad USING gist (ruta_jerarquica);
CREATE INDEX unidad_superior_idx ON org.unidad (id_unidad_superior);
CREATE INDEX unidad_nivel_idx ON org.unidad (id_nivel_jerarquia);

-- ── Deduplicacion de entidades (base de U3) ────────────────────────────────
--
-- El indice GIN con pg_trgm sobre el nombre NORMALIZADO, que es lo que pide
-- PROMPT.md (Fase 1, punto 5). Va sobre la columna generada y no sobre
-- `nombre`, porque comparar «Fundación El Futuro» con «FUNDACION EL FUTURO»
-- tiene que dar parecido 1, no un parecido penalizado por tildes y mayusculas.
--
-- En la Fase 6, U3 combina este trigram con similitud por embeddings; el
-- trigram sigue siendo el que atrapa los errores de digitacion, y el vector,
-- los sinonimos.
CREATE INDEX entidad_nombre_normalizado_trgm
  ON ai.entidad USING gin (nombre_normalizado gin_trgm_ops);
CREATE INDEX entidad_unidad_idx ON ai.entidad (id_unidad);
CREATE INDEX entidad_tipo_idx ON ai.entidad (id_tipo_entidad);

-- ── R13 — Georreferenciacion para ArcGIS ───────────────────────────────────
CREATE INDEX actividad_ubicacion_gist ON ai.actividad USING gist (ubicacion);
CREATE INDEX herramienta_aid_ubicacion_gist ON ai.herramienta_aid USING gist (ubicacion);

-- ── ai.actividad — el listado del manual y los consolidados del RAO ────────
CREATE INDEX actividad_unidad_fecha_idx ON ai.actividad (id_unidad, fecha_inicio DESC);
CREATE INDEX actividad_tipo_idx ON ai.actividad (id_tipo_actividad);
CREATE INDEX actividad_municipio_idx ON ai.actividad (id_municipio);

-- R19: los consolidados del RAO filtran por `registro_completo`, y el listado
-- senala los incompletos. Los incompletos son la minoria esperada, asi que un
-- indice parcial sobre ellos es pequeno y sirve exactamente a esa consulta.
CREATE INDEX actividad_incompletas_idx ON ai.actividad (id_unidad, fecha_inicio DESC)
  WHERE registro_completo = FALSE;

-- Busqueda por texto del clavegrama. Es de donde parte U1, y tambien como un
-- usuario encuentra «esa jornada donde se entregaron raciones».
CREATE INDEX actividad_descripcion_trgm
  ON ai.actividad USING gin (descripcion gin_trgm_ops);

-- ── Claves foraneas de las once tablas hijas ───────────────────────────────
--
-- PostgreSQL NO indexa automaticamente el lado que apunta de una clave
-- foranea. Sin estos indices, abrir una actividad con sus once pestanas
-- recorre once tablas completas, y el `ON DELETE CASCADE` tambien.
CREATE INDEX act_tipo_operacion_actividad_idx ON ai.act_tipo_operacion (id_actividad);
CREATE INDEX act_adjunto_actividad_idx ON ai.act_adjunto (id_actividad);
CREATE INDEX act_entidad_servicio_actividad_idx ON ai.act_entidad_servicio (id_actividad);
CREATE INDEX act_servicio_prestado_actividad_idx ON ai.act_servicio_prestado (id_actividad);
CREATE INDEX act_poblacion_beneficiada_actividad_idx ON ai.act_poblacion_beneficiada (id_actividad);
CREATE INDEX act_entidad_apoyada_actividad_idx ON ai.act_entidad_apoyada (id_actividad);
CREATE INDEX act_medio_difusion_actividad_idx ON ai.act_medio_difusion (id_actividad);
CREATE INDEX act_medio_utilizado_actividad_idx ON ai.act_medio_utilizado (id_actividad);
CREATE INDEX act_recurso_utilizado_actividad_idx ON ai.act_recurso_utilizado (id_actividad);
CREATE INDEX act_bien_donado_actividad_idx ON ai.act_bien_donado (id_actividad);
CREATE INDEX actividad_coami_coami_idx ON ai.actividad_coami (id_coami);

-- R11: el disparador de cuota suma los bytes vigentes de una actividad en cada
-- insercion de adjunto. Este indice parcial es exactamente esa consulta.
CREATE INDEX act_adjunto_cuota_idx ON ai.act_adjunto (id_actividad, peso_bytes)
  WHERE id_estado_registro = 1;

-- R10: el disparador de progresion busca el ultimo tramo de un proyecto.
CREATE INDEX proyecto_avance_actividad_idx ON ai.proyecto_avance (id_actividad, porcentaje_avance DESC);

-- ── Maestros ───────────────────────────────────────────────────────────────
CREATE INDEX personal_unidad_idx ON ai.personal (id_unidad);
CREATE INDEX personal_apellidos_trgm ON ai.personal USING gin (
  ref.normalizar_texto(apellidos || ' ' || nombres) gin_trgm_ops
);
CREATE INDEX herramienta_aid_unidad_idx ON ai.herramienta_aid (id_unidad);
CREATE INDEX herramienta_aid_tipo_idx ON ai.herramienta_aid (id_tipo_herramienta_aid);
CREATE INDEX herramienta_aid_atributo_herramienta_idx
  ON ai.herramienta_aid_atributo (id_herramienta_aid);

-- ── Seguridad ──────────────────────────────────────────────────────────────

-- R1: la tarea programada que cierra las sesiones vencidas. Indice parcial
-- sobre las abiertas, que son las unicas que puede cerrar.
CREATE INDEX sesion_abiertas_expiracion_idx ON seg.sesion (expira_en)
  WHERE cerrada_en IS NULL;
CREATE INDEX sesion_usuario_idx ON seg.sesion (id_usuario, creada_en DESC);

-- R4: el bloqueo a los 5 intentos y el analisis forense. Las dos consultas
-- son «intentos recientes de esta credencial» y «intentos recientes desde
-- esta IP».
CREATE INDEX intento_credencial_idx ON seg.intento_autenticacion (credencial_intentada, instante DESC);
CREATE INDEX intento_ip_idx ON seg.intento_autenticacion (direccion_ip, instante DESC);
CREATE INDEX intento_resultado_idx ON seg.intento_autenticacion (id_resultado, instante DESC);

-- R3: la poda de captchas caducados.
CREATE INDEX captcha_expiracion_idx ON seg.captcha (expira_en) WHERE consumido_en IS NULL;

CREATE INDEX usuario_unidad_idx ON seg.usuario (id_unidad);
CREATE INDEX usuario_personal_idx ON seg.usuario (id_personal);
CREATE INDEX usuario_rol_usuario_idx ON seg.usuario_rol (id_usuario);
CREATE INDEX usuario_rol_rol_idx ON seg.usuario_rol (id_rol);
CREATE INDEX historial_clave_usuario_idx ON seg.historial_clave (id_usuario, creado_en DESC);
CREATE INDEX rol_permiso_permiso_idx ON seg.rol_permiso (id_permiso);

-- R14: la bandeja de solicitudes pendientes de JACID.
CREATE INDEX solicitud_eliminacion_pendientes_idx
  ON seg.solicitud_eliminacion (solicitado_en DESC) WHERE resuelto_en IS NULL;
CREATE INDEX solicitud_eliminacion_objetivo_idx
  ON seg.solicitud_eliminacion (esquema_objetivo, tabla_objetivo, id_registro);

-- ── Auditoria ──────────────────────────────────────────────────────────────
--
-- R15. Las dos consultas reales sobre una bitacora son «historial de ESTE
-- registro» y «que paso en tal periodo».
CREATE INDEX bitacora_registro_idx
  ON aud.bitacora_cambio (esquema, tabla, id_registro, instante DESC);
CREATE INDEX bitacora_instante_idx ON aud.bitacora_cambio (instante DESC);
CREATE INDEX bitacora_usuario_idx ON aud.bitacora_cambio (id_usuario, instante DESC);

CREATE INDEX exportacion_usuario_idx ON aud.exportacion (id_usuario, instante DESC);

-- ── Referencia ─────────────────────────────────────────────────────────────
CREATE INDEX municipio_departamento_idx ON ref.municipio (id_departamento);
CREATE INDEX municipio_nombre_trgm ON ref.municipio USING gin (nombre gin_trgm_ops);
CREATE INDEX extension_permitida_categoria_idx ON ref.extension_permitida (id_categoria_adjunto);
CREATE INDEX atributo_herramienta_tipo_idx ON ref.atributo_herramienta_aid (id_tipo_herramienta_aid);

CREATE INDEX normatividad_tipo_fecha_idx ON doc.normatividad (id_tipo_normatividad, fecha_expedicion DESC);
CREATE INDEX normatividad_titulo_trgm ON doc.normatividad USING gin (titulo gin_trgm_ops);
