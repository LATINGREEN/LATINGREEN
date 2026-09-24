-- ═══════════════════════════════════════════════════════════════════════════
-- Semillas de catalogos (PROMPT.md Fase 1, punto 6)
--
-- Idempotente: se puede ejecutar cuantas veces se quiera.
--
-- ⚠️ REGLA QUE GOBIERNA ESTE ARCHIVO:
--
--   «Los catalogos que dependen de JACID se siembran VACIOS con un TODO, no
--    inventados.»
--
-- Se siembra lo que PROMPT.md enumera de forma LITERAL, y nada mas. Donde el
-- documento no dice el contenido, la tabla queda vacia y la pregunta esta en
-- docs/PREGUNTAS-JACID.md. Una tabla vacia se llena en cinco minutos; un
-- catalogo inventado contamina los consolidados del RAO y despues nadie sabe
-- que fila era real.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── R6 — Niveles de jerarquia ──────────────────────────────────────────────
INSERT INTO ref.nivel_jerarquia (codigo, nombre, orden) VALUES
  ('FUERZA',         'Fuerza',          1),
  ('COMPONENTE',     'Componente',      2),
  ('UNIDAD_TACTICA', 'Unidad Táctica',  3)
ON CONFLICT (codigo) DO NOTHING;

-- ── P4 — Ambitos de visibilidad de un rol ──────────────────────────────────
INSERT INTO ref.ambito_visibilidad (codigo, nombre, descripcion, orden) VALUES
  ('PROPIA',                'Solo su unidad',              'Ve unicamente los registros de su propia unidad.', 1),
  ('PROPIA_Y_SUBORDINADAS', 'Su unidad y subordinadas',    'R6: lo suyo y lo de sus subordinadas, nunca lo de sus pares.', 2),
  ('TODAS',                 'Todas las unidades',          'Reservado a JACID.', 3)
ON CONFLICT (codigo) DO NOTHING;

-- ── R2 — Tipos de red ──────────────────────────────────────────────────────
INSERT INTO ref.tipo_red (codigo, nombre, orden) VALUES
  ('ADMINISTRACION', 'Administración', 1),
  ('OPERACION',      'Operación',      2),
  ('CONSULTA',       'Consulta',       3)
ON CONFLICT (codigo) DO NOTHING;

-- ── R4 — Las OCHO causas de un intento de autenticacion ────────────────────
--
-- Estan aqui para el analisis forense. La pantalla siempre dice «Credenciales
-- inválidas», sea cual sea la fila que se escriba.
INSERT INTO ref.resultado_intento_autenticacion (codigo, nombre, descripcion, orden) VALUES
  ('EXITOSO',             'Exitoso',              'Ingreso concedido.', 1),
  ('CLAVE_INVALIDA',      'Clave inválida',       'La credencial existe; la clave no coincide.', 2),
  ('USUARIO_INEXISTENTE', 'Usuario inexistente',  'La credencial no existe.', 3),
  ('CAPTCHA_INVALIDO',    'Captcha inválido',     'R3: reto no resuelto, caducado o ya consumido.', 4),
  ('USUARIO_BLOQUEADO',   'Usuario bloqueado',    'Cinco intentos fallidos.', 5),
  ('USUARIO_INACTIVO',    'Usuario inactivo',     'Credencial dada de baja.', 6),
  ('RED_NO_AUTORIZADA',   'Red no autorizada',    'R2: la IP de origen no esta en seg.red_autorizada.', 7),
  ('CLAVE_EXPIRADA',      'Clave expirada',       'La clave supero su vigencia.', 8)
ON CONFLICT (codigo) DO NOTHING;

-- ── R14 — Estados de una solicitud de eliminacion ──────────────────────────
INSERT INTO ref.estado_solicitud_eliminacion (codigo, nombre, orden) VALUES
  ('PENDIENTE', 'Pendiente', 1),
  ('APROBADA',  'Aprobada',  2),
  ('RECHAZADA', 'Rechazada', 3)
ON CONFLICT (codigo) DO NOTHING;

-- ── R13 — Hemisferios ──────────────────────────────────────────────────────
INSERT INTO ref.hemisferio (codigo, nombre, descripcion, orden) VALUES
  ('N', 'Norte', 'Latitud. Signo decimal positivo.', 1),
  ('S', 'Sur',   'Latitud. Signo decimal negativo.', 2),
  ('E', 'Este',  'Longitud. Signo decimal positivo.', 3),
  ('W', 'Oeste', 'Longitud. Signo decimal negativo. Todo el territorio colombiano esta al oeste.', 4)
ON CONFLICT (codigo) DO NOTHING;

-- ── R10 — Los OCHO tramos de avance ────────────────────────────────────────
--
-- 10, 20, 30, 40, 50, 60, 70, 100. NO existen 80 ni 90.
-- Como catalogo, para que ningun desplegable de la interfaz pueda ofrecerlos.
INSERT INTO ref.tramo_avance (codigo, nombre, orden) VALUES
  ('T10',  '10 %',  1),
  ('T20',  '20 %',  2),
  ('T30',  '30 %',  3),
  ('T40',  '40 %',  4),
  ('T50',  '50 %',  5),
  ('T60',  '60 %',  6),
  ('T70',  '70 %',  7),
  ('T100', '100 %', 8)
ON CONFLICT (codigo) DO NOTHING;

-- ── R12 — Categorias y extensiones de adjunto ──────────────────────────────
INSERT INTO ref.categoria_adjunto (codigo, nombre, orden) VALUES
  ('IMAGEN',    'Imagen',    1),
  ('DOCUMENTO', 'Documento', 2),
  ('AUDIO',     'Audio',     3),
  ('VIDEO',     'Video',     4)
ON CONFLICT (codigo) DO NOTHING;

-- Extension -> MIME real esperado. Espejo de MIME_ESPERADO_POR_EXTENSION en
-- packages/schema/src/adjunto.ts. Se valida contra el CONTENIDO, no contra el
-- nombre del archivo.
INSERT INTO ref.extension_permitida (id_categoria_adjunto, extension, mimes_esperados)
SELECT c.id, v.extension, v.mimes
FROM (VALUES
  ('IMAGEN',    'jpg',  ARRAY['image/jpeg']),
  ('IMAGEN',    'jpeg', ARRAY['image/jpeg']),
  ('IMAGEN',    'png',  ARRAY['image/png']),
  ('IMAGEN',    'gif',  ARRAY['image/gif']),
  ('DOCUMENTO', 'pdf',  ARRAY['application/pdf']),
  ('DOCUMENTO', 'doc',  ARRAY['application/msword','application/x-cfb']),
  ('DOCUMENTO', 'docx', ARRAY['application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('DOCUMENTO', 'xls',  ARRAY['application/vnd.ms-excel','application/x-cfb']),
  ('DOCUMENTO', 'xlsx', ARRAY['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  ('DOCUMENTO', 'ppt',  ARRAY['application/vnd.ms-powerpoint','application/x-cfb']),
  ('DOCUMENTO', 'pptx', ARRAY['application/vnd.openxmlformats-officedocument.presentationml.presentation']),
  ('AUDIO',     'mp3',  ARRAY['audio/mpeg']),
  ('AUDIO',     'wma',  ARRAY['audio/x-ms-wma','video/x-ms-asf']),
  ('VIDEO',     'mp4',  ARRAY['video/mp4']),
  ('VIDEO',     'wmv',  ARRAY['video/x-ms-wmv','video/x-ms-asf']),
  ('VIDEO',     'avi',  ARRAY['video/x-msvideo'])
) AS v(categoria, extension, mimes)
JOIN ref.categoria_adjunto c ON c.codigo = v.categoria
ON CONFLICT (extension) DO NOTHING;

-- ── Fases documentales ─────────────────────────────────────────────────────
-- TODO(JACID) Q7: no se sabe que significa cada fase ni si hay documentos
-- obligatorios por tramo de avance. Se siembran las tres que el manual nombra,
-- con la descripcion en blanco porque no se conoce.
INSERT INTO ref.fase_documental (codigo, nombre, descripcion, orden) VALUES
  ('FASE_1', 'Fase 1', 'TODO(JACID) Q7: significado por confirmar.', 1),
  ('FASE_2', 'Fase 2', 'TODO(JACID) Q7: significado por confirmar.', 2),
  ('FASE_3', 'Fase 3', 'TODO(JACID) Q7: significado por confirmar.', 3)
ON CONFLICT (codigo) DO NOTHING;

-- ── R18 — Los SIETE COAMI de la Reserva Naval ──────────────────────────────
INSERT INTO ref.coami (codigo, nombre, orden) VALUES
  ('ANTIOQUIA',    'COAMI Antioquia',    1),
  ('BARRANQUILLA', 'COAMI Barranquilla', 2),
  ('BOGOTA',       'COAMI Bogotá',       3),
  ('CALI',         'COAMI Cali',         4),
  ('CARTAGENA',    'COAMI Cartagena',    5),
  ('SAN_ANDRES',   'COAMI San Andrés',   6),
  ('SUCRE',        'COAMI Sucre',        7)
ON CONFLICT (codigo) DO NOTHING;

-- ── R17 — Planes operacionales ─────────────────────────────────────────────
-- Solo los DOS que PROMPT.md nombra. TODO(JACID): listado vigente completo.
INSERT INTO ref.plan_operacional (codigo, nombre, descripcion, orden) VALUES
  ('PLAN_SAN_ROQUE_II', 'Plan San Roque II', 'TODO(JACID): confirmar vigencia.', 1),
  ('PLAN_RENACER',      'Plan Renacer',      'TODO(JACID): confirmar vigencia.', 2)
ON CONFLICT (codigo) DO NOTHING;

-- ── Tipos de documento de identidad ────────────────────────────────────────
INSERT INTO ref.tipo_documento_identidad (codigo, nombre, orden) VALUES
  ('CC', 'Cédula de ciudadanía',  1),
  ('CE', 'Cédula de extranjería', 2),
  ('TI', 'Tarjeta de identidad',  3),
  ('PA', 'Pasaporte',             4),
  ('PEP','Permiso Especial de Permanencia', 5),
  ('NIT','NIT',                   6)
ON CONFLICT (codigo) DO NOTHING;

-- ── Geografia DANE, nivel departamento ─────────────────────────────────────
-- Los 33 (32 departamentos y el Distrito Capital), con su codigo DIVIPOLA.
INSERT INTO ref.departamento (codigo_dane, nombre) VALUES
  ('05', 'Antioquia'),            ('08', 'Atlántico'),
  ('11', 'Bogotá D.C.'),          ('13', 'Bolívar'),
  ('15', 'Boyacá'),               ('17', 'Caldas'),
  ('18', 'Caquetá'),              ('19', 'Cauca'),
  ('20', 'Cesar'),                ('23', 'Córdoba'),
  ('25', 'Cundinamarca'),         ('27', 'Chocó'),
  ('41', 'Huila'),                ('44', 'La Guajira'),
  ('47', 'Magdalena'),            ('50', 'Meta'),
  ('52', 'Nariño'),               ('54', 'Norte de Santander'),
  ('63', 'Quindío'),              ('66', 'Risaralda'),
  ('68', 'Santander'),            ('70', 'Sucre'),
  ('73', 'Tolima'),               ('76', 'Valle del Cauca'),
  ('81', 'Arauca'),               ('85', 'Casanare'),
  ('86', 'Putumayo'),             ('88', 'Archipiélago de San Andrés, Providencia y Santa Catalina'),
  ('91', 'Amazonas'),             ('94', 'Guainía'),
  ('95', 'Guaviare'),             ('97', 'Vaupés'),
  ('99', 'Vichada')
ON CONFLICT (codigo_dane) DO NOTHING;

-- ⚠️ ref.municipio SE QUEDA VACIO.
--
-- La lista oficial (DIVIPOLA) son mas de 1100 filas y se carga del archivo del
-- DANE, no se teclea. Una lista parcial es PEOR que una vacia: parece completa
-- y en realidad falta el municipio que alguien necesita, y ese alguien elige
-- «el mas parecido».
--
-- TODO: cargar DIVIPOLA. Ver semillas/LEEME.md.

-- ── Escalafones y grados ───────────────────────────────────────────────────
--
-- PROMPT.md pide sembrarlos (Fase 1, punto 6). Se siembran los publicos y
-- estables, pero ⚠️ TODO(JACID): confirmar el listado oficial vigente y la
-- correspondencia exacta grado -> escalafon. Un grado de menos deja personal
-- que no se puede registrar; uno de mas aparece en un desplegable oficial.
INSERT INTO ref.escalafon (codigo, nombre, descripcion, orden) VALUES
  ('OFICIAL',        'Oficial',              'TODO(JACID): confirmar.', 1),
  ('SUBOFICIAL',     'Suboficial',           'TODO(JACID): confirmar.', 2),
  ('INFANTE',        'Infantería de Marina', 'TODO(JACID): confirmar.', 3),
  ('MARINERO',       'Marinería',            'TODO(JACID): confirmar.', 4),
  ('PERSONAL_CIVIL', 'Personal civil',       'TODO(JACID): confirmar.', 5),
  ('RESERVA_NAVAL',  'Reserva Naval',        'R18: los COAMI pertenecen a la Reserva Naval.', 6)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO ref.grado (codigo, nombre, descripcion, orden)
SELECT v.codigo, v.nombre, 'TODO(JACID): confirmar listado oficial vigente.', v.orden
FROM (VALUES
  ('ALMIRANTE',            'Almirante',                    1),
  ('VICEALMIRANTE',        'Vicealmirante',                2),
  ('CONTRALMIRANTE',       'Contralmirante',               3),
  ('CAPITAN_DE_NAVIO',     'Capitán de Navío',             4),
  ('CAPITAN_DE_FRAGATA',   'Capitán de Fragata',           5),
  ('CAPITAN_DE_CORBETA',   'Capitán de Corbeta',           6),
  ('TENIENTE_DE_NAVIO',    'Teniente de Navío',            7),
  ('TENIENTE_DE_FRAGATA',  'Teniente de Fragata',          8),
  ('TENIENTE_DE_CORBETA',  'Teniente de Corbeta',          9),
  ('SUBOFICIAL_JEFE_TECNICO', 'Suboficial Jefe Técnico',  10),
  ('SUBOFICIAL_JEFE',      'Suboficial Jefe',             11),
  ('SUBOFICIAL_PRIMERO',   'Suboficial Primero',          12),
  ('SUBOFICIAL_SEGUNDO',   'Suboficial Segundo',          13),
  ('SUBOFICIAL_TERCERO',   'Suboficial Tercero',          14),
  ('MARINERO_PRIMERO',     'Marinero Primero',            15),
  ('MARINERO_SEGUNDO',     'Marinero Segundo',            16),
  ('CIVIL',                'Personal civil',              17)
) AS v(codigo, nombre, orden)
ON CONFLICT (codigo) DO NOTHING;

-- ── Tipos de entidad ───────────────────────────────────────────────────────
-- TODO(JACID): confirmar. Estos son los tipos que la practica de cooperacion
-- civil militar hace evidentes, no un listado oficial.
INSERT INTO ref.tipo_entidad (codigo, nombre, descripcion, orden) VALUES
  ('PUBLICA',                  'Entidad pública',                'TODO(JACID): confirmar.', 1),
  ('PRIVADA',                  'Entidad privada',                'TODO(JACID): confirmar.', 2),
  ('ONG',                      'Organización no gubernamental',  'TODO(JACID): confirmar.', 3),
  ('COOPERACION_INTERNACIONAL','Cooperación internacional',      'TODO(JACID): confirmar.', 4),
  ('ORGANIZACION_COMUNITARIA', 'Organización comunitaria',       'Juntas de acción comunal y similares, que a menudo no tienen NIT.', 5),
  ('ACADEMICA',                'Institución académica',          'TODO(JACID): confirmar.', 6),
  ('RELIGIOSA',                'Organización religiosa',         'TODO(JACID): confirmar.', 7)
ON CONFLICT (codigo) DO NOTHING;

-- ── R16 — Tipos de alianza y de normatividad ───────────────────────────────
INSERT INTO ref.tipo_alianza (codigo, nombre, descripcion, orden) VALUES
  ('ALIANZA',  'Alianza',  'R16: las unidades hasta nivel Fuerza solo concretan alianzas.', 1),
  ('CONVENIO', 'Convenio', 'R16: los convenios son de JACID, y solo JACID diligencia su porcentaje de avance.', 2)
ON CONFLICT (codigo) DO NOTHING;

-- ── Tipos de jornada (migracion 0015) ──────────────────────────────────────
-- No estan en PROMPT.md, pero los enumera literalmente el Manual del Usuario
-- PAID, lamina 20: «el tipo de jornada (binacional, conjunta o estrategica)».
-- Es fuente de JACID, no un supuesto; por eso se siembran.
INSERT INTO ref.tipo_jornada (codigo, nombre, orden) VALUES
  ('BINACIONAL',  'Binacional',  1),
  ('CONJUNTA',    'Conjunta',    2),
  ('ESTRATEGICA', 'Estratégica', 3)
ON CONFLICT (codigo) DO NOTHING;

-- ── Tipos y estados de herramienta AID (migracion 0016) ────────────────────
-- PROMPT.md dice que son once y no los nombra; el Manual del Usuario PAID,
-- lamina 46, SI los nombra, literalmente. Las siglas se dejan como estan en el
-- manual, sin desplegarlas: desplegar una sigla sin la fuente seria
-- suponerla. Los campos propios de cada tipo siguen pendientes (Q3).
INSERT INTO ref.tipo_herramienta_aid (codigo, nombre, orden) VALUES
  ('COPAI',                   'COPAI',                                 1),
  ('GEOS',                    'GEOS',                                  2),
  ('VEMAI',                   'VEMAI',                                 3),
  ('EMISORA_INSTITUCIONAL',   'Emisoras institucionales',              4),
  ('EQUIPO_PERIFONEO',        'Equipos de perifoneo',                  5),
  ('CIRCO_INSTITUCIONAL',     'Circos institucionales',                6),
  ('IMPRESOS_PUBLICACIONES',  'Impresos y publicaciones',              7),
  ('MAQUINA_REPROGRAFICA',    'Máquinas duplicadoras o reprográficas', 8),
  ('AUDIOVISUAL',             'Audiovisuales',                         9),
  ('SIMULADOR_VUELO',         'Simulador de vuelo',                   10),
  ('GRUPO_MUSICAL',           'Grupos musicales',                     11)
ON CONFLICT (codigo) DO NOTHING;

-- Lamina 46: «activa o inactiva».
INSERT INTO ref.estado_herramienta_aid (codigo, nombre, descripcion, orden) VALUES
  ('ACTIVA',   'Activa',   NULL, 1),
  ('INACTIVA', 'Inactiva', 'Exige observaciones: por que esta inactiva y que gestion se hizo.', 2)
ON CONFLICT (codigo) DO NOTHING;

-- TODO(JACID): confirmar la tipologia documental.
INSERT INTO ref.tipo_normatividad (codigo, nombre, descripcion, orden) VALUES
  ('DIRECTIVA',   'Directiva',   'TODO(JACID): confirmar.', 1),
  ('MANUAL',      'Manual',      'TODO(JACID): confirmar.', 2),
  ('RESOLUCION',  'Resolución',  'TODO(JACID): confirmar.', 3),
  ('INSTRUCTIVO', 'Instructivo', 'TODO(JACID): confirmar.', 4),
  ('CLAVEGRAMA_MODELO', 'Clavegrama modelo', 'Corpus de U4 (Fase 8): busqueda sobre la normatividad con cita de documento y pagina.', 5)
ON CONFLICT (codigo) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- CATALOGOS QUE SE QUEDAN VACIOS A PROPOSITO
--
-- Ninguno de estos se rellena con supuestos verosimiles. Cada uno tiene su
-- pregunta redactada en docs/PREGUNTAS-JACID.md.
--
--   ref.municipio                 Cargar DIVIPOLA del DANE (mas de 1100 filas).
--   ref.campana_institucional     Q2 — las 17 campanas derivadas de COGFM.
--   ref.atributo_herramienta_aid  Q3 — campos que activa cada tipo.
--   ref.tipo_operacion            Q4 — formulario real desconocido.
--   ref.servicio_prestado         Q4 — formulario real desconocido.
--   ref.grupo_poblacional         Q4/Q10 — desglose de la cifra del RAO, y si
--                                 incluye datos personales (Ley 1581 de 2012).
--   ref.medio_difusion            No enumerado en PROMPT.md.
--   ref.medio_utilizado           No enumerado en PROMPT.md.
--   ref.tipo_recurso              No enumerado en PROMPT.md.
--   ref.tipo_bien_donado          No enumerado en PROMPT.md.
--
-- CONSECUENCIA VISIBLE Y BUSCADA: hasta que JACID responda, una actividad no
-- puede alcanzar `registro_completo = TRUE`, porque varias de las once
-- pestanas no tienen catalogo con el que llenarse. Eso es correcto. Lo
-- incorrecto seria que el sistema dejara cerrar registros contra categorias
-- inventadas: entonces el RAO cuadraria y estaria mal.
-- ═══════════════════════════════════════════════════════════════════════════
