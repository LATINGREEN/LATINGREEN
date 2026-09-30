# Diccionario de datos — PAID SIGIT Versión 2026

> Generado con `python manage.py diccionario_datos`. No lo edite a mano.

Convenciones: nombres en español sin tildes, `snake_case`; instantes en UTC
(`timestamp with time zone`); fechas sin hora en `date`; dominios cerrados en
tablas de catálogo. **RLS** indica las tablas con Row Level Security; las
pestañas de la jornada heredan el ámbito de su jornada.

## Núcleo

### `nucleo_tipojornada` — tipo de jornada

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `codigo` | varchar(60) | sí | codigo |
| `nombre` | varchar(200) | sí | nombre |
| `descripcion` | text | no | descripcion |
| `orden` | smallint | sí | orden |
| `activo` | boolean | sí | activo |

### `nucleo_tipoherramientaaid` — tipo de herramienta AID

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `codigo` | varchar(60) | sí | codigo |
| `nombre` | varchar(200) | sí | nombre |
| `descripcion` | text | no | descripcion |
| `orden` | smallint | sí | orden |
| `activo` | boolean | sí | activo |

### `nucleo_estadoherramientaaid` — estado de herramienta AID

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `codigo` | varchar(60) | sí | codigo |
| `nombre` | varchar(200) | sí | nombre |
| `descripcion` | text | no | descripcion |
| `orden` | smallint | sí | orden |
| `activo` | boolean | sí | activo |
| `exige_observacion` | boolean | sí | exige observacion |

### `nucleo_tipooperacion` — tipo de operación

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `codigo` | varchar(60) | sí | codigo |
| `nombre` | varchar(200) | sí | nombre |
| `descripcion` | text | no | descripcion |
| `orden` | smallint | sí | orden |
| `activo` | boolean | sí | activo |

### `nucleo_servicioprestado` — servicio prestado

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `codigo` | varchar(60) | sí | codigo |
| `nombre` | varchar(200) | sí | nombre |
| `descripcion` | text | no | descripcion |
| `orden` | smallint | sí | orden |
| `activo` | boolean | sí | activo |

### `nucleo_grupopoblacional` — grupo poblacional

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `codigo` | varchar(60) | sí | codigo |
| `nombre` | varchar(200) | sí | nombre |
| `descripcion` | text | no | descripcion |
| `orden` | smallint | sí | orden |
| `activo` | boolean | sí | activo |

### `nucleo_mediodifusion` — medio de difusión

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `codigo` | varchar(60) | sí | codigo |
| `nombre` | varchar(200) | sí | nombre |
| `descripcion` | text | no | descripcion |
| `orden` | smallint | sí | orden |
| `activo` | boolean | sí | activo |

### `nucleo_medioutilizado` — medio utilizado

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `codigo` | varchar(60) | sí | codigo |
| `nombre` | varchar(200) | sí | nombre |
| `descripcion` | text | no | descripcion |
| `orden` | smallint | sí | orden |
| `activo` | boolean | sí | activo |

### `nucleo_tiporecurso` — tipo de recurso

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `codigo` | varchar(60) | sí | codigo |
| `nombre` | varchar(200) | sí | nombre |
| `descripcion` | text | no | descripcion |
| `orden` | smallint | sí | orden |
| `activo` | boolean | sí | activo |

### `nucleo_tipobiendonado` — tipo de bien donado

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `codigo` | varchar(60) | sí | codigo |
| `nombre` | varchar(200) | sí | nombre |
| `descripcion` | text | no | descripcion |
| `orden` | smallint | sí | orden |
| `activo` | boolean | sí | activo |

### `nucleo_tipodocumentoidentidad` — tipo de documento de identidad

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `codigo` | varchar(60) | sí | codigo |
| `nombre` | varchar(200) | sí | nombre |
| `descripcion` | text | no | descripcion |
| `orden` | smallint | sí | orden |
| `activo` | boolean | sí | activo |

### `nucleo_escalafon` — escalafón

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `codigo` | varchar(60) | sí | codigo |
| `nombre` | varchar(200) | sí | nombre |
| `descripcion` | text | no | descripcion |
| `orden` | smallint | sí | orden |
| `activo` | boolean | sí | activo |

### `nucleo_grado` — grado

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `codigo` | varchar(60) | sí | codigo |
| `nombre` | varchar(200) | sí | nombre |
| `descripcion` | text | no | descripcion |
| `orden` | smallint | sí | orden |
| `activo` | boolean | sí | activo |

### `nucleo_tipoentidad` — tipo de entidad

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `codigo` | varchar(60) | sí | codigo |
| `nombre` | varchar(200) | sí | nombre |
| `descripcion` | text | no | descripcion |
| `orden` | smallint | sí | orden |
| `activo` | boolean | sí | activo |

### `nucleo_categoriaadjunto` — categoría de soporte

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `codigo` | varchar(60) | sí | codigo |
| `nombre` | varchar(200) | sí | nombre |
| `descripcion` | text | no | descripcion |
| `orden` | smallint | sí | orden |
| `activo` | boolean | sí | activo |

### `nucleo_extensionpermitida` — extensión permitida

Extensión → tipos MIME reales. Se valida contra el CONTENIDO del archivo.

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `extension` | varchar(10) | sí | extension |
| `categoria_id` | → nucleo_categoriaadjunto | sí | categoria |
| `mimes_esperados` | jsonb | sí | mimes esperados |

Restricciones: `extension_en_minuscula`

### `nucleo_niveljerarquia` — nivel de jerarquía

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `codigo` | varchar(60) | sí | codigo |
| `nombre` | varchar(200) | sí | nombre |
| `descripcion` | text | no | descripcion |
| `orden` | smallint | sí | orden |
| `activo` | boolean | sí | activo |

### `nucleo_periodicidad` — periodicidad

Para los indicadores de impacto de la metodología SIGIT.

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `codigo` | varchar(60) | sí | codigo |
| `nombre` | varchar(200) | sí | nombre |
| `descripcion` | text | no | descripcion |
| `orden` | smallint | sí | orden |
| `activo` | boolean | sí | activo |
| `meses` | smallint | sí | meses |

### `nucleo_departamento` — departamento

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `codigo_dane` | varchar(2) | sí | codigo dane |
| `nombre` | varchar(120) | sí | nombre |

### `nucleo_municipio` — municipio

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `departamento_id` | → nucleo_departamento | sí | departamento |
| `codigo_dane` | varchar(5) | sí | codigo dane |
| `nombre` | varchar(120) | sí | nombre |

Restricciones: `municipio_dane_5_digitos`

### `nucleo_unidad` — unidad

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `creado_en` | timestamp with time zone | del sistema | creado en |
| `creado_por_id` | → nucleo_usuario | del sistema | creado por |
| `modificado_en` | timestamp with time zone | del sistema | modificado en |
| `modificado_por_id` | → nucleo_usuario | del sistema | modificado por |
| `codigo` | varchar(30) | sí | codigo |
| `sigla` | varchar(20) | sí | sigla |
| `nombre` | varchar(250) | sí | nombre |
| `nivel_id` | → nucleo_niveljerarquia | sí | nivel |
| `superior_id` | → nucleo_unidad | no | superior |
| `ruta` | varchar(500) | del sistema | ruta |
| `municipio_id` | → nucleo_municipio | no | municipio |
| `activa` | boolean | sí | activa |

Restricciones: `unidad_no_es_su_propia_superior`

### `nucleo_usuario` — usuario

La credencial es de unidad, con la forma SIGLA_PAID, como en la PAID. La persona responsable queda en `nombre_responsable` y en la bitácora.

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `password` | varchar(128) | sí | contraseña |
| `last_login` | timestamp with time zone | no | último inicio de sesión |
| `is_superuser` | boolean | sí | Indica que este usuario tiene todos los permisos sin asignárselos explícitamente. |
| `credencial` | varchar(40) | sí | credencial |
| `nombre_responsable` | varchar(200) | sí | nombre responsable |
| `correo` | varchar(254) | no | correo |
| `unidad_id` | → nucleo_unidad | sí | unidad |
| `is_active` | boolean | sí | activo |
| `is_staff` | boolean | sí | acceso a la gestión |
| `intentos_fallidos` | smallint | del sistema | intentos fallidos |
| `bloqueado_hasta` | timestamp with time zone | del sistema | bloqueado hasta |
| `creado_en` | timestamp with time zone | del sistema | creado en |

### `nucleo_intentoingreso` — intento de ingreso

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `credencial_intentada` | varchar(60) | sí | credencial intentada |
| `usuario_id` | → nucleo_usuario | no | usuario |
| `resultado` | varchar(30) | sí | resultado · valores: EXITOSO, CREDENCIAL_INEXISTENTE, CLAVE_ERRADA, CAPTCHA_ERRADO, USUARIO_BLOQUEADO, USUARIO_INACTIVO, UNIDAD_INACTIVA |
| `direccion_ip` | inet | no | direccion ip |
| `agente` | varchar(300) | no | agente |
| `instante` | timestamp with time zone | del sistema | instante |

### `nucleo_captcha` — captcha

Se guarda el RESUMEN de la respuesta, no la respuesta. Un solo uso.

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `resumen_respuesta` | varchar(64) | sí | resumen respuesta |
| `creado_en` | timestamp with time zone | del sistema | creado en |
| `consumido_en` | timestamp with time zone | no | consumido en |

### `nucleo_bitacora` — cambio en bitácora

Registro de cambios. La alimenta un disparador sobre cada tabla del dominio: no depende de que la vista se acuerde. Solo se inserta; el rol de la aplicación no tiene UPDATE ni DELETE sobre ella.

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `tabla` | varchar(80) | sí | tabla |
| `operacion` | varchar(10) | sí | operacion |
| `id_registro` | bigint | no | id registro |
| `datos_antes` | jsonb | no | datos antes |
| `datos_despues` | jsonb | no | datos despues |
| `id_usuario` | bigint | no | id usuario |
| `instante` | timestamp with time zone | del sistema | instante |

## Maestros

### `maestros_personal` — personal

**RLS:** por unidad.

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `creado_en` | timestamp with time zone | del sistema | creado en |
| `creado_por_id` | → nucleo_usuario | del sistema | creado por |
| `modificado_en` | timestamp with time zone | del sistema | modificado en |
| `modificado_por_id` | → nucleo_usuario | del sistema | modificado por |
| `eliminado_en` | timestamp with time zone | del sistema | eliminado en |
| `tipo_documento_id` | → nucleo_tipodocumentoidentidad | sí | tipo documento |
| `numero_documento` | varchar(30) | sí | numero documento |
| `nombres` | varchar(150) | sí | nombres |
| `apellidos` | varchar(150) | sí | apellidos |
| `grado_id` | → nucleo_grado | no | grado |
| `escalafon_id` | → nucleo_escalafon | no | escalafon |
| `unidad_id` | → nucleo_unidad | sí | unidad |
| `correo` | varchar(254) | no | correo |
| `telefono` | varchar(30) | no | telefono |

Restricciones: `personal_documento_unico`

### `maestros_entidad` — entidad

**RLS:** lectura para todos; escritura por unidad.

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `creado_en` | timestamp with time zone | del sistema | creado en |
| `creado_por_id` | → nucleo_usuario | del sistema | creado por |
| `modificado_en` | timestamp with time zone | del sistema | modificado en |
| `modificado_por_id` | → nucleo_usuario | del sistema | modificado por |
| `eliminado_en` | timestamp with time zone | del sistema | eliminado en |
| `tipo_id` | → nucleo_tipoentidad | sí | tipo |
| `nit` | varchar(20) | no | nit |
| `nombre` | varchar(250) | sí | nombre |
| `nombre_normalizado` | varchar(250) | del sistema | nombre normalizado |
| `unidad_id` | → nucleo_unidad | sí | unidad |
| `municipio_id` | → nucleo_municipio | no | municipio |
| `direccion` | varchar(250) | no | direccion |
| `telefono` | varchar(30) | no | telefono |
| `correo` | varchar(254) | no | correo |
| `contacto` | varchar(150) | no | contacto |

Restricciones: `entidad_nit_unico`, `entidad_nombre_municipio_unico`

### `maestros_herramientaaid` — herramienta AID

**RLS:** por unidad.

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `creado_en` | timestamp with time zone | del sistema | creado en |
| `creado_por_id` | → nucleo_usuario | del sistema | creado por |
| `modificado_en` | timestamp with time zone | del sistema | modificado en |
| `modificado_por_id` | → nucleo_usuario | del sistema | modificado por |
| `latitud_grados` | smallint | sí | latitud grados |
| `latitud_minutos` | smallint | sí | latitud minutos |
| `latitud_segundos` | numeric(8, 5) | sí | latitud segundos |
| `latitud_hemisferio` | varchar(1) | sí | latitud hemisferio · valores: N, S |
| `longitud_grados` | smallint | sí | longitud grados |
| `longitud_minutos` | smallint | sí | longitud minutos |
| `longitud_segundos` | numeric(8, 5) | sí | longitud segundos |
| `longitud_hemisferio` | varchar(1) | sí | longitud hemisferio · valores: W, E |
| `latitud_decimal` | generada (numeric(12, 6)) | calculada | latitud decimal |
| `longitud_decimal` | generada (numeric(12, 6)) | calculada | longitud decimal |
| `eliminado_en` | timestamp with time zone | del sistema | eliminado en |
| `tipo_id` | → nucleo_tipoherramientaaid | sí | tipo |
| `estado_id` | → nucleo_estadoherramientaaid | sí | estado |
| `codigo` | varchar(40) | sí | codigo |
| `nombre` | varchar(250) | sí | nombre |
| `descripcion` | text | no | descripcion |
| `unidad_id` | → nucleo_unidad | sí | unidad |
| `municipio_id` | → nucleo_municipio | sí | municipio |
| `fecha_registro` | date | sí | fecha registro |
| `fecha_potenciacion` | date | no | fecha potenciacion |
| `responsable_id` | → maestros_personal | sí | responsable |
| `observaciones` | text | no | observaciones |

## Jornadas

### `jornadas_jornada` — jornada

**RLS:** por unidad.

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `creado_en` | timestamp with time zone | del sistema | creado en |
| `creado_por_id` | → nucleo_usuario | del sistema | creado por |
| `modificado_en` | timestamp with time zone | del sistema | modificado en |
| `modificado_por_id` | → nucleo_usuario | del sistema | modificado por |
| `latitud_grados` | smallint | sí | latitud grados |
| `latitud_minutos` | smallint | sí | latitud minutos |
| `latitud_segundos` | numeric(8, 5) | sí | latitud segundos |
| `latitud_hemisferio` | varchar(1) | sí | latitud hemisferio · valores: N, S |
| `longitud_grados` | smallint | sí | longitud grados |
| `longitud_minutos` | smallint | sí | longitud minutos |
| `longitud_segundos` | numeric(8, 5) | sí | longitud segundos |
| `longitud_hemisferio` | varchar(1) | sí | longitud hemisferio · valores: W, E |
| `latitud_decimal` | generada (numeric(12, 6)) | calculada | latitud decimal |
| `longitud_decimal` | generada (numeric(12, 6)) | calculada | longitud decimal |
| `eliminado_en` | timestamp with time zone | del sistema | eliminado en |
| `codigo` | varchar(40) | del sistema | codigo |
| `unidad_id` | → nucleo_unidad | sí | unidad |
| `tipo_jornada_id` | → nucleo_tipojornada | sí | tipo jornada |
| `descripcion` | text | sí | descripción (clavegrama) |
| `fecha_inicio` | date | sí | fecha inicio |
| `fecha_fin` | date | no | fecha fin |
| `fecha_ejecucion` | date | sí | fecha de ejecución |
| `lugar` | varchar(250) | sí | lugar |
| `municipio_id` | → nucleo_municipio | sí | municipio |
| `participo_arc` | boolean | del sistema | participó ARC |
| `participo_ejc` | boolean | sí | participó Ejército |
| `participo_fac` | boolean | sí | participó Fuerza Aérea |
| `poblacion_afecta_tropa` | boolean | no | poblacion afecta tropa |
| `observaciones` | text | no | observaciones |
| `registro_completo` | boolean | del sistema | registro completo |
| `origen` | varchar(10) | del sistema | origen · valores: MANUAL, SIGIT |

Restricciones: `jornada_participo_arc_siempre`, `jornada_fechas_coherentes`, `jornada_ejecucion_no_antes_del_inicio`

### `jornadas_jornadatipooperacion` — tipo de operación

**RLS:** por jornada.

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `jornada_id` | → jornadas_jornada | sí | jornada |
| `creado_en` | timestamp with time zone | del sistema | creado en |
| `tipo_operacion_id` | → nucleo_tipooperacion | sí | tipo de operación |
| `observacion` | text | no | observación |

Restricciones: `jto_unico`

### `jornadas_jornadaentidadservicio` — entidad que prestó servicios

**RLS:** por jornada.

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `jornada_id` | → jornadas_jornada | sí | jornada |
| `creado_en` | timestamp with time zone | del sistema | creado en |
| `entidad_id` | → maestros_entidad | sí | entidad |
| `observacion` | text | no | observación |

Restricciones: `jes_unica`

### `jornadas_jornadaservicioprestado` — servicio prestado

**RLS:** por jornada.

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `jornada_id` | → jornadas_jornada | sí | jornada |
| `creado_en` | timestamp with time zone | del sistema | creado en |
| `servicio_id` | → nucleo_servicioprestado | sí | servicio |
| `cantidad` | integer | sí | cantidad |
| `observacion` | text | no | observación |

Restricciones: `jsp_unico`, `jsp_cantidad_positiva`

### `jornadas_jornadapoblacion` — población beneficiada

**RLS:** por jornada.

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `jornada_id` | → jornadas_jornada | sí | jornada |
| `creado_en` | timestamp with time zone | del sistema | creado en |
| `grupo_id` | → nucleo_grupopoblacional | sí | grupo |
| `cantidad_personas` | integer | sí | personas |
| `observacion` | text | no | observación |

Restricciones: `jpb_unica_por_grupo`, `jpb_cantidad_positiva`

### `jornadas_jornadaentidadapoyada` — entidad apoyada

**RLS:** por jornada.

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `jornada_id` | → jornadas_jornada | sí | jornada |
| `creado_en` | timestamp with time zone | del sistema | creado en |
| `entidad_id` | → maestros_entidad | sí | entidad |
| `observacion` | text | no | observación |

Restricciones: `jea_unica`

### `jornadas_jornadamediodifusion` — medio de difusión

**RLS:** por jornada.

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `jornada_id` | → jornadas_jornada | sí | jornada |
| `creado_en` | timestamp with time zone | del sistema | creado en |
| `medio_id` | → nucleo_mediodifusion | sí | medio |
| `detalle` | varchar(500) | no | detalle |

Restricciones: `jmd_unico`

### `jornadas_jornadamedioutilizado` — medio utilizado

**RLS:** por jornada.

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `jornada_id` | → jornadas_jornada | sí | jornada |
| `creado_en` | timestamp with time zone | del sistema | creado en |
| `medio_id` | → nucleo_medioutilizado | sí | medio |
| `cantidad` | integer | sí | cantidad |
| `detalle` | varchar(500) | no | detalle |

Restricciones: `jmu_unico`, `jmu_cantidad_positiva`

### `jornadas_jornadarecurso` — recurso utilizado

**RLS:** por jornada.

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `jornada_id` | → jornadas_jornada | sí | jornada |
| `creado_en` | timestamp with time zone | del sistema | creado en |
| `tipo_recurso_id` | → nucleo_tiporecurso | sí | tipo de recurso |
| `cantidad` | numeric(18, 2) | sí | cantidad |
| `unidad_medida` | varchar(40) | no | unidad de medida |
| `valor` | numeric(18, 2) | no | valor (COP) |
| `detalle` | varchar(500) | no | detalle |

Restricciones: `jru_unico`, `jru_cantidad_positiva`, `jru_valor_no_negativo`

### `jornadas_jornadabiendonado` — bien donado

**RLS:** por jornada.

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `jornada_id` | → jornadas_jornada | sí | jornada |
| `creado_en` | timestamp with time zone | del sistema | creado en |
| `tipo_bien_id` | → nucleo_tipobiendonado | sí | tipo de bien |
| `descripcion` | varchar(500) | sí | descripción |
| `cantidad` | numeric(18, 2) | sí | cantidad |
| `unidad_medida` | varchar(40) | no | unidad de medida |
| `valor_estimado` | numeric(18, 2) | no | valor estimado (COP) |
| `entidad_donante_id` | → maestros_entidad | no | entidad donante |

Restricciones: `jbd_cantidad_positiva`, `jbd_valor_no_negativo`

### `jornadas_jornadaresumen` — resumen

**RLS:** por jornada.

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `creado_en` | timestamp with time zone | del sistema | creado en |
| `jornada_id` | → jornadas_jornada | sí | jornada |
| `texto` | text | sí | texto |

### `jornadas_adjunto` — soporte

Soporte de la jornada. 10 MB AGREGADOS por jornada, no por archivo. El tipo se comprueba contra el CONTENIDO del archivo, no contra su nombre, y el mismo archivo no entra dos veces a la misma jornada (resumen SHA-256).

**RLS:** por jornada.

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `jornada_id` | → jornadas_jornada | sí | jornada |
| `creado_en` | timestamp with time zone | del sistema | creado en |
| `nombre_archivo` | varchar(255) | sí | nombre archivo |
| `extension` | varchar(10) | sí | extension |
| `categoria_id` | → nucleo_categoriaadjunto | sí | categoria |
| `mime_detectado` | varchar(120) | sí | mime detectado |
| `peso_bytes` | bigint | sí | peso bytes |
| `resumen_sha256` | varchar(64) | sí | resumen sha256 |
| `ruta_almacen` | varchar(300) | del sistema | ruta almacen |

Restricciones: `adjunto_sin_duplicado_por_contenido`, `adjunto_peso_valido`, `adjunto_resumen_hex`

## Integración SIGIT

### `integracion_sistemaexterno` — sistema externo

Un sistema que habla con PAID SIGIT por la API (SIGIT de la reserva, u otro de los sistemas de información de la Armada). Del testigo de acceso solo se guarda el RESUMEN SHA-256: si alguien copia la base, no se lleva testigos utilizables. El testigo en claro se muestra una sola vez, al emitirlo.

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `codigo` | varchar(40) | sí | codigo |
| `nombre` | varchar(200) | sí | nombre |
| `alcance` | varchar(10) | sí | alcance · valores: ENTREGA, LECTURA |
| `unidad_id` | → nucleo_unidad | sí | unidad |
| `resumen_testigo` | varchar(64) | del sistema | resumen testigo |
| `prefijo_testigo` | varchar(8) | del sistema | prefijo testigo |
| `activo` | boolean | sí | activo |
| `ultimo_uso` | timestamp with time zone | del sistema | ultimo uso |
| `creado_en` | timestamp with time zone | del sistema | creado en |

### `integracion_loteimportacion` — lote de importación

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `sistema_id` | → integracion_sistemaexterno | sí | sistema |
| `via` | varchar(10) | sí | via · valores: API, ARCHIVO |
| `nombre_archivo` | varchar(255) | no | nombre archivo |
| `recibido_en` | timestamp with time zone | del sistema | recibido en |
| `recibido_por_id` | → nucleo_usuario | no | recibido por |
| `total` | integer | sí | total |
| `aceptados` | integer | sí | aceptados |
| `repetidos` | integer | sí | repetidos |
| `rechazados` | integer | sí | rechazados |
| `errores` | jsonb | sí | errores |

### `integracion_registroexterno` — registro externo

Una actividad propuesta por un sistema externo, tal como llegó, más el resultado de la revisión de JACID.

**RLS:** por unidad propuesta.

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `sistema_id` | → integracion_sistemaexterno | sí | sistema |
| `lote_id` | → integracion_loteimportacion | sí | lote |
| `id_externo` | varchar(80) | sí | id externo |
| `datos` | jsonb | sí | datos |
| `resumen_contenido` | varchar(64) | sí | resumen contenido |
| `unidad_propuesta_id` | → nucleo_unidad | sí | unidad propuesta |
| `estado` | varchar(10) | sí | estado · valores: PENDIENTE, APROBADO, RECHAZADO |
| `posibles_duplicados` | jsonb | sí | posibles duplicados |
| `motivo_rechazo` | text | no | motivo rechazo |
| `revisado_por_id` | → nucleo_usuario | no | revisado por |
| `revisado_en` | timestamp with time zone | no | revisado en |
| `jornada_id` | → jornadas_jornada | no | jornada |
| `recibido_en` | timestamp with time zone | del sistema | recibido en |
| `actualizado_en` | timestamp with time zone | del sistema | actualizado en |

Restricciones: `registro_externo_unico`, `rechazo_exige_motivo`, `aprobado_exige_jornada`

## Analítica

### `analitica_informeguardado` — informe guardado

Configuración de una tabla dinámica que alguien quiere volver a ver.

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `nombre` | varchar(150) | sí | nombre |
| `configuracion` | jsonb | sí | configuracion |
| `propietario_id` | → nucleo_usuario | sí | propietario |
| `compartido` | boolean | sí | Visible para todos los usuarios de la plataforma. |
| `creado_en` | timestamp with time zone | del sistema | creado en |

### `analitica_indicadorimpacto` — indicador de impacto

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `codigo` | varchar(40) | sí | codigo |
| `nombre` | varchar(200) | sí | nombre |
| `objetivo` | text | sí | Qué impacto de largo plazo mide. |
| `formula` | text | sí | Cómo se calcula, en palabras. |
| `unidad_medida` | varchar(60) | sí | unidad medida |
| `periodicidad_id` | → nucleo_periodicidad | sí | periodicidad |
| `sentido` | varchar(12) | sí | sentido · valores: ASCENDENTE, DESCENDENTE |
| `linea_base` | numeric(18, 4) | no | linea base |
| `meta` | numeric(18, 4) | no | meta |
| `fuente` | varchar(250) | sí | De dónde sale el dato. |
| `activo` | boolean | sí | activo |

### `analitica_medicionindicador` — medición de indicador

**RLS:** por unidad.

| Columna | Tipo | Obligatoria | Descripción |
|---|---|---|---|
| `id` | bigint | calculada | ID |
| `indicador_id` | → analitica_indicadorimpacto | sí | indicador |
| `unidad_id` | → nucleo_unidad | sí | unidad |
| `municipio_id` | → nucleo_municipio | no | municipio |
| `periodo_inicio` | date | sí | periodo inicio |
| `periodo_fin` | date | sí | periodo fin |
| `valor` | numeric(18, 4) | sí | valor |
| `jornada_id` | → jornadas_jornada | no | jornada |
| `observaciones` | text | no | observaciones |
| `registrado_por_id` | → nucleo_usuario | sí | registrado por |
| `registrado_en` | timestamp with time zone | del sistema | registrado en |

Restricciones: `medicion_periodo_coherente`, `medicion_unica_por_periodo`
