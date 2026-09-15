-- ═══════════════════════════════════════════════════════════════════════════
-- Semillas de roles y permisos (PROMPT.md Fase 2, punto 5)
--
-- Los CINCO roles con su matriz de permisos. Idempotente.
--
-- ⚠️ TODO(JACID) Q6: estos cinco son los que PROMPT.md propone. Que perfiles
-- existen HOY de verdad en la PAID, y a cual de estos corresponde cada uno, es
-- la pregunta Q6. Un perfil de mas significa gente con permisos que no le
-- corresponden; uno de menos, gente que no puede trabajar.
--
-- R16 gobierna el reparto: el porcentaje de avance de un convenio, los
-- convenios, la normatividad y las campanas son atribuciones de JACID.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Permisos ───────────────────────────────────────────────────────────────
--
-- Tripleta modulo / submodulo / accion. El codigo se DERIVA de ella (columna
-- generada), asi que `ALIANZA.AVANCE` no puede existir con dos escrituras.
INSERT INTO seg.permiso (modulo, submodulo, accion, descripcion) VALUES
  -- Maestros de precedencia (R8)
  ('PERSONAL',     NULL, 'CONSULTAR', 'Consultar el maestro de personal.'),
  ('PERSONAL',     NULL, 'CREAR',     'Registrar un tripulante.'),
  ('PERSONAL',     NULL, 'EDITAR',    'Modificar un tripulante.'),
  ('ENTIDAD',      NULL, 'CONSULTAR', 'Consultar el maestro de entidades A.I.'),
  ('ENTIDAD',      NULL, 'CREAR',     'Registrar una entidad A.I.'),
  ('ENTIDAD',      NULL, 'EDITAR',    'Modificar una entidad A.I.'),
  ('HERRAMIENTA',  NULL, 'CONSULTAR', 'Consultar el maestro de herramientas AID.'),
  ('HERRAMIENTA',  NULL, 'CREAR',     'Registrar una herramienta AID.'),
  ('HERRAMIENTA',  NULL, 'EDITAR',    'Modificar una herramienta AID.'),

  -- Actividades
  ('JORNADA',      NULL, 'CONSULTAR', 'Consultar jornadas de apoyo al desarrollo.'),
  ('JORNADA',      NULL, 'CREAR',     'Registrar una jornada.'),
  ('JORNADA',      NULL, 'EDITAR',    'Modificar una jornada.'),
  ('ASISTENCIA',   NULL, 'CONSULTAR', 'Consultar asistencias humanitarias.'),
  ('ASISTENCIA',   NULL, 'CREAR',     'Registrar una asistencia humanitaria.'),
  ('ASISTENCIA',   NULL, 'EDITAR',    'Modificar una asistencia humanitaria.'),
  ('RUEDA',        NULL, 'CONSULTAR', 'Consultar ruedas de servicios.'),
  ('RUEDA',        NULL, 'CREAR',     'Registrar una rueda de servicios.'),
  ('RUEDA',        NULL, 'EDITAR',    'Modificar una rueda de servicios.'),
  ('PROYECTO',     NULL, 'CONSULTAR', 'Consultar proyectos sociales.'),
  ('PROYECTO',     NULL, 'CREAR',     'Registrar un proyecto social.'),
  ('PROYECTO',     NULL, 'EDITAR',    'Modificar un proyecto social.'),
  ('PROYECTO',     'AVANCE', 'REGISTRAR', 'R10: registrar un tramo de avance mensual.'),

  -- R16: las campanas las cargan solo las Fuerzas Navales.
  ('CAMPANA',      NULL, 'CONSULTAR', 'Consultar campanas institucionales.'),
  ('CAMPANA',      NULL, 'CREAR',     'R16: cargar una campana. Solo Fuerzas Navales.'),
  ('CAMPANA',      NULL, 'EDITAR',    'R16: modificar una campana. Solo Fuerzas Navales.'),

  -- R16: alianzas para las unidades; convenios y su avance, solo JACID.
  ('ALIANZA',      NULL, 'CONSULTAR', 'Consultar alianzas y convenios.'),
  ('ALIANZA',      NULL, 'CREAR',     'R16: concretar una alianza. Hasta nivel Fuerza.'),
  ('ALIANZA',      NULL, 'AVANCE',    'R16: diligenciar el porcentaje de avance de un convenio. SOLO JACID.'),
  ('CONVENIO',     NULL, 'CREAR',     'R16: crear un convenio. SOLO JACID.'),
  ('CONVENIO',     NULL, 'EDITAR',    'R16: modificar un convenio. SOLO JACID.'),

  -- R16: la normatividad la carga JACID; las unidades descargan.
  ('NORMATIVIDAD', NULL, 'CONSULTAR', 'Descargar normatividad A.I.'),
  ('NORMATIVIDAD', NULL, 'CARGAR',    'R16: cargar normatividad. SOLO JACID.'),

  -- Adjuntos y exportacion
  ('ADJUNTO',      NULL, 'CONSULTAR', 'Descargar soportes de una actividad.'),
  ('ADJUNTO',      NULL, 'CARGAR',    'Adjuntar soportes a una actividad (R11, R12).'),
  ('EXPORTACION',  NULL, 'GENERAR',   'Exportar a XLSX o CSV. Queda en aud.exportacion.'),

  -- R14: eliminar es un tramite.
  ('ELIMINACION',  NULL, 'SOLICITAR', 'R14: elevar a JACID una solicitud de eliminacion.'),
  ('ELIMINACION',  NULL, 'RESOLVER',  'R14: aprobar o rechazar una solicitud. SOLO JACID.'),

  -- Administracion
  ('USUARIO',      NULL, 'CONSULTAR', 'Consultar credenciales de unidad.'),
  ('USUARIO',      NULL, 'ADMINISTRAR','Crear, bloquear y asignar roles. SOLO JACID.'),
  ('RED',          NULL, 'ADMINISTRAR','R2: administrar los rangos autorizados. SOLO JACID.'),
  ('AUDITORIA',    NULL, 'CONSULTAR', 'R15: consultar la bitacora de cambios.'),
  ('UNIDAD',       NULL, 'CONSULTAR', 'Consultar la estructura organizacional.'),
  ('UNIDAD',       NULL, 'ADMINISTRAR','Crear y recolocar unidades. SOLO JACID.')
ON CONFLICT (modulo, submodulo, accion) DO NOTHING;

-- ── Los cinco roles ────────────────────────────────────────────────────────
INSERT INTO seg.rol (codigo, nombre, descripcion, id_ambito_visibilidad)
SELECT v.codigo, v.nombre, v.descripcion,
       (SELECT id FROM ref.ambito_visibilidad WHERE codigo = v.ambito)
FROM (VALUES
  ('ADMINISTRADOR',   'Administrador (JACID)',
   'Atribuciones centralizadas de R16. Unico que resuelve solicitudes de eliminacion.',
   'TODAS'),
  ('FUNCIONAL_JACID', 'Funcional JACID',
   'Operacion de JACID: convenios, normatividad, avance de convenios. Sin administracion de usuarios.',
   'TODAS'),
  ('OPERADOR_UNIDAD', 'Operador de unidad',
   'Registra las actividades de su unidad. NO tiene ALIANZA.AVANCE (R16).',
   'PROPIA_Y_SUBORDINADAS'),
  ('SUPERVISOR',      'Supervisor',
   'Consulta y exporta lo de su unidad y subordinadas; no registra.',
   'PROPIA_Y_SUBORDINADAS'),
  ('CONSULTA',        'Consulta',
   'Solo lectura de su propia unidad.',
   'PROPIA')
) AS v(codigo, nombre, descripcion, ambito)
ON CONFLICT (codigo) DO NOTHING;

-- ── Matriz de permisos ─────────────────────────────────────────────────────
--
-- Se declara como una lista de (rol, codigo de permiso) para que la matriz se
-- pueda LEER. El codigo de permiso es la columna generada, asi que si aqui se
-- escribe uno que no existe, el INSERT simplemente no encuentra la fila —y la
-- prueba de la Puerta 2 comprueba que cada rol recibio los permisos esperados,
-- de modo que un dedazo no pasa inadvertido.
INSERT INTO seg.rol_permiso (id_rol, id_permiso)
SELECT r.id, p.id
FROM (VALUES
  -- ADMINISTRADOR (JACID): todo.
  ('ADMINISTRADOR', '*'),

  -- FUNCIONAL_JACID: la operacion de JACID, sin administrar usuarios ni redes.
  ('FUNCIONAL_JACID', 'PERSONAL.CONSULTAR'),
  ('FUNCIONAL_JACID', 'PERSONAL.CREAR'),
  ('FUNCIONAL_JACID', 'PERSONAL.EDITAR'),
  ('FUNCIONAL_JACID', 'ENTIDAD.CONSULTAR'),
  ('FUNCIONAL_JACID', 'ENTIDAD.CREAR'),
  ('FUNCIONAL_JACID', 'ENTIDAD.EDITAR'),
  ('FUNCIONAL_JACID', 'HERRAMIENTA.CONSULTAR'),
  ('FUNCIONAL_JACID', 'HERRAMIENTA.CREAR'),
  ('FUNCIONAL_JACID', 'HERRAMIENTA.EDITAR'),
  ('FUNCIONAL_JACID', 'JORNADA.CONSULTAR'),
  ('FUNCIONAL_JACID', 'JORNADA.CREAR'),
  ('FUNCIONAL_JACID', 'JORNADA.EDITAR'),
  ('FUNCIONAL_JACID', 'ASISTENCIA.CONSULTAR'),
  ('FUNCIONAL_JACID', 'ASISTENCIA.CREAR'),
  ('FUNCIONAL_JACID', 'ASISTENCIA.EDITAR'),
  ('FUNCIONAL_JACID', 'RUEDA.CONSULTAR'),
  ('FUNCIONAL_JACID', 'RUEDA.CREAR'),
  ('FUNCIONAL_JACID', 'RUEDA.EDITAR'),
  ('FUNCIONAL_JACID', 'PROYECTO.CONSULTAR'),
  ('FUNCIONAL_JACID', 'PROYECTO.CREAR'),
  ('FUNCIONAL_JACID', 'PROYECTO.EDITAR'),
  ('FUNCIONAL_JACID', 'PROYECTO.AVANCE.REGISTRAR'),
  ('FUNCIONAL_JACID', 'CAMPANA.CONSULTAR'),
  ('FUNCIONAL_JACID', 'ALIANZA.CONSULTAR'),
  ('FUNCIONAL_JACID', 'ALIANZA.CREAR'),
  ('FUNCIONAL_JACID', 'ALIANZA.AVANCE'),
  ('FUNCIONAL_JACID', 'CONVENIO.CREAR'),
  ('FUNCIONAL_JACID', 'CONVENIO.EDITAR'),
  ('FUNCIONAL_JACID', 'NORMATIVIDAD.CONSULTAR'),
  ('FUNCIONAL_JACID', 'NORMATIVIDAD.CARGAR'),
  ('FUNCIONAL_JACID', 'ADJUNTO.CONSULTAR'),
  ('FUNCIONAL_JACID', 'ADJUNTO.CARGAR'),
  ('FUNCIONAL_JACID', 'EXPORTACION.GENERAR'),
  ('FUNCIONAL_JACID', 'ELIMINACION.SOLICITAR'),
  ('FUNCIONAL_JACID', 'ELIMINACION.RESOLVER'),
  ('FUNCIONAL_JACID', 'AUDITORIA.CONSULTAR'),
  ('FUNCIONAL_JACID', 'UNIDAD.CONSULTAR'),

  -- OPERADOR_UNIDAD: registra lo suyo. SIN ALIANZA.AVANCE, SIN convenios, SIN
  -- cargar normatividad, SIN resolver eliminaciones. Es lo que R16 centraliza
  -- en JACID, y lo que la Puerta 2 comprueba con un 403.
  ('OPERADOR_UNIDAD', 'PERSONAL.CONSULTAR'),
  ('OPERADOR_UNIDAD', 'PERSONAL.CREAR'),
  ('OPERADOR_UNIDAD', 'PERSONAL.EDITAR'),
  ('OPERADOR_UNIDAD', 'ENTIDAD.CONSULTAR'),
  ('OPERADOR_UNIDAD', 'ENTIDAD.CREAR'),
  ('OPERADOR_UNIDAD', 'ENTIDAD.EDITAR'),
  ('OPERADOR_UNIDAD', 'HERRAMIENTA.CONSULTAR'),
  ('OPERADOR_UNIDAD', 'HERRAMIENTA.CREAR'),
  ('OPERADOR_UNIDAD', 'HERRAMIENTA.EDITAR'),
  ('OPERADOR_UNIDAD', 'JORNADA.CONSULTAR'),
  ('OPERADOR_UNIDAD', 'JORNADA.CREAR'),
  ('OPERADOR_UNIDAD', 'JORNADA.EDITAR'),
  ('OPERADOR_UNIDAD', 'ASISTENCIA.CONSULTAR'),
  ('OPERADOR_UNIDAD', 'ASISTENCIA.CREAR'),
  ('OPERADOR_UNIDAD', 'ASISTENCIA.EDITAR'),
  ('OPERADOR_UNIDAD', 'RUEDA.CONSULTAR'),
  ('OPERADOR_UNIDAD', 'RUEDA.CREAR'),
  ('OPERADOR_UNIDAD', 'RUEDA.EDITAR'),
  ('OPERADOR_UNIDAD', 'PROYECTO.CONSULTAR'),
  ('OPERADOR_UNIDAD', 'PROYECTO.CREAR'),
  ('OPERADOR_UNIDAD', 'PROYECTO.EDITAR'),
  ('OPERADOR_UNIDAD', 'PROYECTO.AVANCE.REGISTRAR'),
  ('OPERADOR_UNIDAD', 'CAMPANA.CONSULTAR'),
  ('OPERADOR_UNIDAD', 'ALIANZA.CONSULTAR'),
  ('OPERADOR_UNIDAD', 'ALIANZA.CREAR'),
  ('OPERADOR_UNIDAD', 'NORMATIVIDAD.CONSULTAR'),
  ('OPERADOR_UNIDAD', 'ADJUNTO.CONSULTAR'),
  ('OPERADOR_UNIDAD', 'ADJUNTO.CARGAR'),
  ('OPERADOR_UNIDAD', 'EXPORTACION.GENERAR'),
  ('OPERADOR_UNIDAD', 'ELIMINACION.SOLICITAR'),
  ('OPERADOR_UNIDAD', 'UNIDAD.CONSULTAR'),

  -- SUPERVISOR: consulta y exporta; no registra.
  ('SUPERVISOR', 'PERSONAL.CONSULTAR'),
  ('SUPERVISOR', 'ENTIDAD.CONSULTAR'),
  ('SUPERVISOR', 'HERRAMIENTA.CONSULTAR'),
  ('SUPERVISOR', 'JORNADA.CONSULTAR'),
  ('SUPERVISOR', 'ASISTENCIA.CONSULTAR'),
  ('SUPERVISOR', 'RUEDA.CONSULTAR'),
  ('SUPERVISOR', 'PROYECTO.CONSULTAR'),
  ('SUPERVISOR', 'CAMPANA.CONSULTAR'),
  ('SUPERVISOR', 'ALIANZA.CONSULTAR'),
  ('SUPERVISOR', 'NORMATIVIDAD.CONSULTAR'),
  ('SUPERVISOR', 'ADJUNTO.CONSULTAR'),
  ('SUPERVISOR', 'EXPORTACION.GENERAR'),
  ('SUPERVISOR', 'AUDITORIA.CONSULTAR'),
  ('SUPERVISOR', 'UNIDAD.CONSULTAR'),

  -- CONSULTA: solo lectura, y solo de su propia unidad (ambito PROPIA).
  ('CONSULTA', 'PERSONAL.CONSULTAR'),
  ('CONSULTA', 'ENTIDAD.CONSULTAR'),
  ('CONSULTA', 'HERRAMIENTA.CONSULTAR'),
  ('CONSULTA', 'JORNADA.CONSULTAR'),
  ('CONSULTA', 'ASISTENCIA.CONSULTAR'),
  ('CONSULTA', 'RUEDA.CONSULTAR'),
  ('CONSULTA', 'PROYECTO.CONSULTAR'),
  ('CONSULTA', 'CAMPANA.CONSULTAR'),
  ('CONSULTA', 'NORMATIVIDAD.CONSULTAR'),
  ('CONSULTA', 'ADJUNTO.CONSULTAR')
) AS m(rol, permiso)
JOIN seg.rol r ON r.codigo = m.rol
JOIN seg.permiso p ON (m.permiso = '*' OR p.codigo = m.permiso)
ON CONFLICT (id_rol, id_permiso) DO NOTHING;
