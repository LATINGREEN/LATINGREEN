-- ═══════════════════════════════════════════════════════════════════════════
-- Datos para MIRAR la aplicación. No son semillas.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ Este archivo NO está en `packages/db/semillas/` a propósito. El aplicador
-- de semillas decide qué correr por el nombre del archivo, y cualquier cosa
-- que viva ahí puede terminar en un despliegue. Esto es material de
-- demostración: lo aplica únicamente `scripts/mirar.sh`.
--
-- ⚠️ Y no contradice la prohibición de rellenar Q1–Q12 con supuestos. La
-- diferencia es dónde vive el dato: los catálogos que JACID debe entregar
-- siguen VACÍOS en las semillas del repositorio, y lo que hay aquí son filas
-- de ejemplo en una base desechable, para que las pantallas se puedan ver
-- funcionando. Nada de esto viaja a un despliegue, y ninguna de estas filas
-- dice cuál es el catálogo correcto: dicen que la pantalla dibuja bien una
-- opción.
--
-- Un catálogo vacío deja los desplegables sin opciones, y una interfaz con
-- todos los desplegables vacíos no se puede evaluar: no se distingue «la
-- pantalla está bien y falta el dato» de «la pantalla está mal».

-- ── Catálogos de ejemplo ───────────────────────────────────────────────────
INSERT INTO ref.tipo_operacion (codigo, nombre, orden) VALUES
  ('APOYO_DESARROLLO', 'Apoyo al desarrollo', 1),
  ('ACCION_INTEGRAL',  'Acción integral',     2)
ON CONFLICT DO NOTHING;

INSERT INTO ref.servicio_prestado (codigo, nombre, orden) VALUES
  ('CONSULTA_MEDICA',     'Consulta médica general', 1),
  ('CONSULTA_ODONTOLOGIA','Consulta odontológica',   2),
  ('CORTE_CABELLO',       'Corte de cabello',        3),
  ('JORNADA_VACUNACION',  'Jornada de vacunación',   4)
ON CONFLICT DO NOTHING;

INSERT INTO ref.grupo_poblacional (codigo, nombre, orden) VALUES
  ('COMUNIDAD',      'Comunidad en general',   1),
  ('NINEZ',          'Niñas, niños y adolescentes', 2),
  ('ADULTO_MAYOR',   'Adulto mayor',           3),
  ('PESCADORES',     'Pescadores artesanales', 4)
ON CONFLICT DO NOTHING;

INSERT INTO ref.medio_difusion (codigo, nombre, orden) VALUES
  ('EMISORA',       'Emisora comunitaria', 1),
  ('PERIFONEO',     'Perifoneo',           2),
  ('REDES_SOCIALES','Redes sociales institucionales', 3)
ON CONFLICT DO NOTHING;

INSERT INTO ref.medio_utilizado (codigo, nombre, orden) VALUES
  ('LANCHA',     'Lancha de apoyo',       1),
  ('BUQUE',      'Buque de superficie',   2),
  ('VEHICULO',   'Vehículo terrestre',    3)
ON CONFLICT DO NOTHING;

INSERT INTO ref.tipo_recurso (codigo, nombre, orden) VALUES
  ('COMBUSTIBLE', 'Combustible', 1),
  ('RACIONES',    'Raciones de campaña', 2),
  ('MEDICAMENTOS','Medicamentos', 3)
ON CONFLICT DO NOTHING;

INSERT INTO ref.tipo_bien_donado (codigo, nombre, orden) VALUES
  ('RACIONES_ALIMENTARIAS', 'Raciones alimentarias', 1),
  ('KIT_ASEO',              'Kit de aseo',           2),
  ('MATERIAL_ESCOLAR',      'Material escolar',      3)
ON CONFLICT DO NOTHING;

INSERT INTO ref.tipo_herramienta_aid (codigo, nombre, orden) VALUES
  ('AULA_MOVIL',        'Aula móvil',                 1),
  ('UNIDAD_MEDICA',     'Unidad médica fluvial',      2),
  ('PLANTA_POTABLE',    'Planta potabilizadora',      3)
ON CONFLICT DO NOTHING;

-- Municipios: los del Pacífico y el Caribe donde estas unidades operan. El
-- código DANE es el real; el catálogo completo lo entrega JACID.
INSERT INTO ref.municipio (id_departamento, codigo_dane, nombre)
SELECT d.id, v.dane, v.nombre
FROM (VALUES
  ('52', '52835', 'San Andrés de Tumaco'),
  ('76', '76109', 'Buenaventura'),
  ('13', '13001', 'Cartagena de Indias'),
  ('23', '23001', 'Montería'),
  ('27', '27001', 'Quibdó'),
  ('47', '47001', 'Santa Marta')
) AS v(cod_dpto, dane, nombre)
JOIN ref.departamento d ON d.codigo_dane = v.cod_dpto
ON CONFLICT DO NOTHING;

-- ── Normatividad de ejemplo ────────────────────────────────────────────────
--
-- `ruta_objeto` vacío a propósito: no hay archivo cargado, y la pantalla lo
-- dice con el distintivo «Sin archivo». Poner una ruta inventada sería un
-- enlace que promete un documento que no existe.
INSERT INTO doc.normatividad (
  id_tipo_normatividad, codigo, titulo, descripcion, fecha_expedicion,
  nombre_archivo, extension, peso_bytes, hash_sha256, ruta_objeto, id_estado_registro)
SELECT t.id, v.codigo, v.titulo, v.descripcion, v.fecha::date,
       v.codigo || '.pdf', 'pdf', 1,
       repeat('0', 64), '', (SELECT id FROM ref.estado_registro WHERE codigo = 'ACTIVO')
FROM (VALUES
  ('DIRECTIVA', 'DIR-0234-2024',
   'Lineamientos para el desarrollo de jornadas de apoyo al desarrollo',
   'Jefatura de Acción Integral y Desarrollo', '2024-03-14'),
  ('MANUAL', 'MAN-AID-2023',
   'Manual de Acción Integral y Desarrollo de la Armada Nacional',
   'Comando de la Armada Nacional', '2023-11-02'),
  ('RESOLUCION', 'RES-1519-2020',
   'Lineamientos de accesibilidad web para entidades públicas',
   'Ministerio de Tecnologías de la Información y las Comunicaciones', '2020-08-24')
) AS v(tipo, codigo, titulo, descripcion, fecha)
JOIN ref.tipo_normatividad t ON t.codigo = v.tipo
ON CONFLICT DO NOTHING;

-- ── Maestros de BIM23 ──────────────────────────────────────────────────────
--
-- Se insertan con `creado_por` nulo y sin contexto de sesión: es una carga
-- administrativa, no una operación de la aplicación. Van a BIM23 porque es la
-- credencial con la que se recorre la demostración; BIM24 se deja VACÍA a
-- propósito, para que al entrar con ella se vea que RLS no le muestra nada de
-- esto.
INSERT INTO ai.personal (
  id_tipo_documento_identidad, numero_documento, nombres, apellidos,
  id_grado, id_unidad, id_estado_registro)
SELECT (SELECT id FROM ref.tipo_documento_identidad ORDER BY orden, id LIMIT 1),
       v.documento, v.nombres, v.apellidos,
       (SELECT id FROM ref.grado ORDER BY orden, id LIMIT 1),
       (SELECT id FROM org.unidad WHERE codigo = '2813304'),
       (SELECT id FROM ref.estado_registro WHERE codigo = 'ACTIVO')
FROM (VALUES
  ('1030512345', 'Andrés Felipe',  'Mosquera Rentería'),
  ('1090223871', 'Laura Cristina', 'Barrios Peñaloza'),
  ('79542118',   'Jaime Eduardo',  'Ospina Carvajal')
) AS v(documento, nombres, apellidos)
ON CONFLICT DO NOTHING;

-- Las entidades incluyen DOS pares deliberadamente parecidos, para que la
-- sugerencia de duplicados por semejanza se pueda ver funcionando: al escribir
-- «Alcaldia de Tumaco» o «Junta de Accion Comunal La Playa» la pantalla debe
-- avisar antes de guardar.
INSERT INTO ai.entidad (
  id_tipo_entidad, nit, nombre, id_unidad, id_municipio, contacto, telefono,
  id_estado_registro)
SELECT (SELECT id FROM ref.tipo_entidad ORDER BY orden, id LIMIT 1),
       v.nit, v.nombre,
       (SELECT id FROM org.unidad WHERE codigo = '2813304'),
       (SELECT id FROM ref.municipio WHERE codigo_dane = v.dane),
       v.contacto, v.telefono,
       (SELECT id FROM ref.estado_registro WHERE codigo = 'ACTIVO')
FROM (VALUES
  ('800112233', 'Alcaldía Municipal de San Andrés de Tumaco', '52835', 'Secretaría de Gobierno', '6027271000'),
  ('800445566', 'Junta de Acción Comunal Vereda La Playa',    '52835', 'María Torres', '3155512233'),
  ('900778899', 'Hospital San Andrés de Tumaco',              '52835', 'Dirección médica', '6027272020'),
  (NULL,        'Institución Educativa Ciudadela Mixta',      '52835', 'Rectoría', '3204458899'),
  ('890332211', 'Alcaldía Distrital de Buenaventura',         '76109', 'Secretaría de Gobierno', '6022410000')
) AS v(nit, nombre, dane, contacto, telefono)
ON CONFLICT DO NOTHING;

INSERT INTO ai.herramienta_aid (
  id_tipo_herramienta_aid, codigo, nombre, descripcion, id_unidad, id_municipio,
  fecha_registro, id_estado_registro,
  latitud_grados, latitud_minutos, latitud_segundos, latitud_hemisferio,
  longitud_grados, longitud_minutos, longitud_segundos, longitud_hemisferio)
SELECT (SELECT id FROM ref.tipo_herramienta_aid WHERE codigo = v.tipo),
       v.codigo, v.nombre, v.descripcion,
       (SELECT id FROM org.unidad WHERE codigo = '2813304'),
       (SELECT id FROM ref.municipio WHERE codigo_dane = v.dane),
       v.fecha::date,
       (SELECT id FROM ref.estado_registro WHERE codigo = 'ACTIVO'),
       v.lat_g, v.lat_m, v.lat_s, v.lat_h, v.lon_g, v.lon_m, v.lon_s, v.lon_h
FROM (VALUES
  ('UNIDAD_MEDICA', 'HAID-BIM23-001', 'Unidad médica fluvial Bahía',
   'Atención en salud sobre plataforma fluvial.', '52835', '2026-02-10',
   1, 47, 30.0, 'N', 78, 48, 45.0, 'W'),
  ('AULA_MOVIL', 'HAID-BIM23-002', 'Aula móvil Litoral',
   'Aula de formación desplazable para veredas costeras.', '52835', '2026-03-05',
   1, 48, 12.5, 'N', 78, 49, 10.0, 'W')
) AS v(tipo, codigo, nombre, descripcion, dane, fecha,
       lat_g, lat_m, lat_s, lat_h, lon_g, lon_m, lon_s, lon_h)
ON CONFLICT DO NOTHING;
