# Prompt para Claude Code — Construcción de la aplicación PAID
### Versión 2 · incluye subsistema de asistencia por IA

> **Cómo usar este archivo.** Guárdalo como `PROMPT.md` en la raíz de un repositorio vacío, junto a
> `anexo_A_ddl_paid.sql`. Abre Claude Code en esa carpeta y escribe:
>
> ```
> Lee PROMPT.md completo. Ejecuta la Parte A empezando por la Fase 0.
> No pases de fase sin superar su puerta. No empieces la Parte B sin haber cerrado la Fase 5.
> ```
>
> El documento tiene dos partes. **La Parte A es el sistema.** La **Parte B es la asistencia por IA**,
> que se construye encima y **nunca es requisito de funcionamiento** de la Parte A.

---

# MISIÓN

Construyes la **PAID (Plataforma de Acción Integral y Desarrollo)** de la Armada de Colombia: la
aplicación web donde la Jefatura de Acción Integral y Desarrollo (JACID) y las unidades tácticas
registran las actividades de acción integral, y de donde salen los consolidados que alimentan el RAO
y los tableros del Mando Naval.

No estás inventando el sistema. Existe un esquema de base de datos diseñado y auditado, y un manual
de usuario que fija las reglas. Tu trabajo es **implementarlo con fidelidad**, no reinterpretarlo.

| Archivo | Qué es | Cómo usarlo |
|---|---|---|
| `anexo_A_ddl_paid.sql` | DDL de referencia, verificado con el analizador de PostgreSQL | Punto de partida. Complétalo; no lo contradigas. |
| `PROMPT.md` | Este documento | Fuente de verdad de reglas, fases y prohibiciones. |

Si falta el `.sql`, **detente y pídelo**. No improvises el esquema.

---

# PARTE A — EL SISTEMA

## A.1 Stack fijado

Decidido. No lo cambies ni propongas alternativas.

```
Gestor          pnpm 9 + workspaces  (monorepo; el lockfile se versiona)
Base de datos   PostgreSQL 16 + PostGIS 3.4 + pg_trgm + ltree + pgvector
Backend         Node 20 LTS + TypeScript 5.x (strict) + NestJS 10
ORM             Drizzle ORM (SQL explícito, migraciones versionadas y reversibles)
Frontend        React 18 + TypeScript + Vite 5
Datos en UI     TanStack Query 5
Formularios     React Hook Form + Zod  (el MISMO esquema Zod valida en cliente y servidor)
Mapa            MapLibre GL 4 + PMTiles  ← ver A.2, punto 3
Sesiones        Redis 7 (TTL deslizante) + tabla relacional durable
Archivos        MinIO (compatible S3), desplegado dentro de la intranet
Exportación     exceljs (XLSX) y generación propia de CSV. Nada que llame a un servicio.
Observabilidad  pino + OpenTelemetry a un colector local. Sin telemetría saliente.
Pruebas         Vitest + Supertest + Testcontainers (Postgres real, nunca mocks de base)
Entorno local   Docker Compose: postgres, redis, minio, otel-collector, api, web
```

**Fija las versiones mayores en `package.json` y no uses rangos abiertos.** Una red cerrada implica
un registro npm espejado o un `node_modules` transportado: un rango abierto rompe reproducibilidad.

## A.2 Restricciones de entorno que condicionan el diseño

1. **La aplicación corre únicamente en la Intranet ARC.** No hay internet en tiempo de ejecución.
   Ninguna dependencia puede llamar a un servicio externo: ni fuentes de Google, ni CDN, ni
   telemetría, ni mapas remotos. Todo se sirve desde el propio despliegue.

2. **Navegador objetivo:** Google Chrome, que es el que el manual recomienda.

3. **El mapa necesita su propio origen de teselas.** MapLibre sin teselas no dibuja nada, y no puede
   traerlas de internet. Empaqueta un **archivo PMTiles con el extracto de Colombia** servido desde
   el propio backend, o consume el **WMS/WMTS institucional** si la ARC tiene uno.
   → Anótalo como `Q11` en `docs/PREGUNTAS-JACID.md`: preguntar si existe servicio cartográfico
   institucional antes de empaquetar teselas propias.

4. **Idioma:** español de Colombia. Fechas `dd/mm/aaaa`. Separador decimal **punto** (el manual lo
   exige expresamente en los formularios).

5. **Zona horaria:** todo instante se almacena en **UTC** (`TIMESTAMPTZ`) y se presenta en
   `America/Bogota`. La conversión ocurre en el borde, nunca en la base ni en la lógica de negocio.
   Las fechas sin hora (`fecha_inicio`, `fecha_fin`, `fecha_ejecucion`) son `DATE`, no `TIMESTAMP`:
   el formulario captura `dd/mm/aaaa` y un `TIMESTAMP` invita a un componente horario espurio que
   desplaza el día en los informes.

---

## A.3 Reglas del dominio que no se negocian

Vienen del Manual del Usuario PAID (v2, septiembre de 2022). No son preferencias: son el
comportamiento del sistema. Si alguna te parece rara, **impleméntala igual y anótala**; no la
«corrijas».

### R1 — Sesión de 10 minutos
Diez minutos de inactividad cierran la sesión. Expiración **deslizante**: cada petición autenticada
la desplaza. Se evalúa **en el servidor**. Redis lleva el TTL; `seg.sesion` conserva el registro
durable con el motivo de cierre.

### R2 — Red cerrada
La autenticación solo procede desde rangos autorizados, que viven en `seg.red_autorizada` (tipo
`CIDR`), **no en variables de entorno ni en el código**: el manual advierte que el direccionamiento
IP está «pendiente» y JACID debe poder cambiarlo sin desplegar. En desarrollo se siembra `0.0.0.0/0`
con `tipo_red = 'ADMINISTRACION'` y un aviso llamativo en el arranque.

### R3 — Captcha de un solo uso
Cada ingreso lo exige. Se guarda el **resumen** del reto, no el texto. Caduca a los 5 minutos y se
marca consumido al validarse **con independencia del resultado**.

### R4 — Mensaje de error genérico
`seg.intento_autenticacion.resultado` distingue ocho causas para el análisis forense (`EXITOSO`,
`CLAVE_INVALIDA`, `USUARIO_INEXISTENTE`, `CAPTCHA_INVALIDO`, `USUARIO_BLOQUEADO`, `USUARIO_INACTIVO`,
`RED_NO_AUTORIZADA`, `CLAVE_EXPIRADA`), pero **la pantalla siempre dice lo mismo**: «Credenciales
inválidas». La distinción vive en la base, no en la interfaz.

### R5 — Credencial de unidad
Usuarios de unidad, no de persona: `BIM23_PAID`, `COOPCM_PAID`, `FNP_PAID`, `ADMIN_PAID`,
`FUNCIONAL_PAID`. Convención `<SIGLA_UNIDAD>_PAID` en mayúsculas. `seg.usuario.id_personal` vincula
opcionalmente la credencial a un tripulante.

### R6 — Ámbito jerárquico de datos
`Fuerza → Componente → Unidad Táctica`. Una unidad ve lo suyo y lo de sus subordinadas, nunca lo de
sus pares. Se implementa con **Row Level Security** sobre `org.unidad.ruta_jerarquica` (`ltree`), no
con un `WHERE` en el servicio: si la aplicación tiene un error, la base debe seguir protegiendo.

### R7 — Contexto de sesión en el pool de conexiones ⚠️
RLS y la bitácora necesitan saber **quién** ejecuta cada sentencia. El mecanismo es
`SET LOCAL app.id_usuario / app.id_unidad / app.id_sesion` **dentro de la transacción**, leído con
`current_setting('app.id_usuario', true)`.

`SET LOCAL` (no `SET`) es obligatorio: el pool reutiliza conexiones entre peticiones, y un `SET`
normal deja el valor pegado a la conexión. La siguiente petición, de otra unidad, heredaría el
contexto de la anterior — **una fuga de datos entre usuarios, silenciosa y difícil de ver en una
revisión de código**. Toda escritura y toda lectura sujeta a RLS va dentro de una transacción que
fija el contexto en su primera sentencia. Escribe un test que lo demuestre (Puerta 2).

### R8 — Los tres maestros de precedencia
Antes de registrar cualquier actividad deben existir **Personal**, **Entidades A.I.** y
**Herramientas AID**. Se impone con claves foráneas obligatorias, y la interfaz lo explica cuando el
catálogo está vacío.

### R9 — La ARC siempre participa
`participo_arc BOOLEAN NOT NULL DEFAULT TRUE CHECK (participo_arc = TRUE)`. El manual: «siempre se
debe poner SÍ en ARC». En la interfaz aparece marcado y deshabilitado.

### R10 — Escala de avance de ocho tramos ⚠️
Los proyectos sociales avanzan por **10, 20, 30, 40, 50, 60, 70, 100**.
**NO existen 80 % ni 90 %.** El salto del 70 al 100 es deliberado: cada tramo tiene su paquete
documental y no hay paquete definido para esos dos.

> Es el error más fácil de cometer en todo el proyecto. Un diseño previo lo cometió «normalizando» la
> escala a diez tramos. **No la completes.** El `CHECK` es literalmente `IN (10,20,30,40,50,60,70,100)`.

El avance solo progresa: un tramo nuevo no puede ser menor que el último. Cada cambio queda en
`ai.proyecto_avance` con fecha, observación y usuario; el manual exige actualización **mensual**.

### R11 — Cuota de 10 MB **agregada**
La suma de **todos** los archivos de una misma actividad no puede pasar de 10 MB. No es un límite por
archivo. Disparador `BEFORE INSERT` que suma los bytes vigentes. La interfaz muestra el consumo
acumulado **antes** de que el usuario intente subir.

### R12 — Extensiones por categoría
| Categoría | Extensiones |
|---|---|
| IMAGEN | jpg, png, gif, jpeg |
| DOCUMENTO | pdf, doc, docx, xls, xlsx, ppt, pptx |
| AUDIO | mp3, wma |
| VIDEO | mp4, wmv, avi |

Se valida contra el **contenido real** (número mágico / MIME), no contra la extensión declarada. El
binario va a MinIO; en la base quedan ruta, metadatos y `hash_sha256`.

### R13 — Georreferenciación en los SEIS formularios
Jornada, asistencia, rueda, proyecto, campaña **y herramienta AID** capturan grados, minutos,
segundos y hemisferio. Se almacenan los ocho componentes GMS tal como los digita el usuario; las
decimales son **columnas generadas** (`GENERATED ALWAYS AS … STORED`), que no pueden divergir; y una
columna `geography(Point,4326)` con índice GiST sirve a ArcGIS.

### R14 — Eliminar es un trámite, no un botón
Borrado lógico vía `estado_registro`, privilegio `DELETE` revocado salvo para el rol administrador, y
`seg.solicitud_eliminacion` con solicitante, motivo obligatorio, decisor y resolución. El manual:
«para eliminar se debe elevar la solicitud a JACID explicando los motivos».

### R15 — Bitácora obligatoria
Toda inserción, modificación y eliminación en `ai`, `org` y `doc` queda en `aud.bitacora_cambio` con
imagen anterior y posterior en `JSONB`, usuario, unidad, sesión e IP. Se alimenta por **disparador**,
no desde el servicio. Es de solo inserción: nadie —ni el administrador— tiene `UPDATE` ni `DELETE`
sobre ella.

### R16 — Atribuciones centralizadas en JACID
- El **porcentaje de avance de un convenio** solo lo diligencia JACID (permiso `ALIANZA.AVANCE`).
- Las unidades hasta nivel Fuerza solo concretan **alianzas**; los **convenios** son de JACID.
- La **normatividad** solo la carga JACID; las unidades descargan.
- Las **campañas** las cargan solo las Fuerzas Navales, divididas en jornadas.

### R17 — Asistencia humanitaria directa exige plan
Si `tipo_asistencia = DIRECTA`, el plan operacional es obligatorio (Plan San Roque II, Plan Renacer).
`CHECK (id_tipo_asistencia <> DIRECTA OR id_plan_operacional IS NOT NULL)`.

### R18 — COAMI opcional
Siete COAMI de la Reserva Naval: ANTIOQUIA, BARRANQUILLA, BOGOTÁ, CALI, CARTAGENA, SAN ANDRÉS,
SUCRE. Relación cero-a-muchos. El manual: «si no hubo participación **NO** realice selección». No
marques ninguno por defecto.

### R19 — Las once pestañas son obligatorias
Tipo Operación · Archivos Adjuntos · Entidades Servicios · Servicios Prestados · Población
Beneficiada · Entidades Apoyadas · Medios Difusión · Medios Utilizados · Recursos Utilizados ·
Bienes Donados · Resumen.

La obligatoriedad no se expresa con `NOT NULL` (son tablas hijas que pueden quedar vacías): se
calcula en `ai.actividad.registro_completo`, y los consolidados del RAO filtran por él. El listado
señala visualmente los registros incompletos.

---

## A.4 Anti-patrones prohibidos

Un diseño anterior del mismo esquema fue auditado; estos son los defectos que se le encontraron.
**Cada uno es motivo de rechazo.**

**❌ P1 — Referencia polimórfica sin integridad.** Nada de `tipo_actividad VARCHAR` +
`id_referencia_actividad BIGINT` sin clave foránea: deja huérfanos silenciosos y un valor mal escrito
desvincula filas sin que nada falle.
✅ Supertipo `ai.actividad` con **clave foránea real** desde cada tabla hija. La disyunción del
subtipo se impone con clave foránea compuesta `(id_actividad, id_tipo_actividad)` y una columna de
tipo constante verificada por `CHECK`.

**❌ P2 — Documentar una tabla y no implementarla.** El diseño auditado declaraba nueve tablas hijas
y su DDL creaba cuatro; faltaba `act_poblacion_beneficiada`, la cifra que alimenta el RAO.
✅ Test de inventario contra `information_schema.tables` que falle si falta alguna (Puerta 1).

**❌ P3 — Llamar «auditoría» a cuatro columnas.** Guardan el *último* modificador; el segundo
`UPDATE` borra la huella del primero.
✅ Las cuatro columnas **más** la bitácora de R15. Ambas.

**❌ P4 — RBAC de nombre.** Un campo `id_rol` no es control de acceso basado en roles.
✅ `seg.permiso` con la tripleta módulo · submódulo · acción, `seg.rol_permiso`, `seg.usuario_rol`
con vigencia, y `seg.rol.ambito_visibilidad`.

**❌ P5 — `CHECK` de fila para una regla de agregación.** `CHECK (peso_bytes <= 10485760)` limita
cada archivo, no la suma: cuarenta archivos de 9 MB pasan.

**❌ P6 — Columnas «calculadas por trigger» sin el trigger.** Las decimales divergen de las GMS y el
punto aparece donde no es. Un punto equivocado es peor que uno ausente: parece plausible.

**❌ P7 — Testigo de sesión en claro.** Una lectura de la base equivaldría a suplantar cualquier
sesión activa. Guarda el resumen, como con la contraseña.

**❌ P8 — Prohibir el borrado físico solo en la documentación.** Sin `estado_registro`, sin
privilegios revocados y sin tabla de solicitudes, lo único que impide el `DELETE` es una frase.

**❌ P9 — Dominios cerrados como texto libre.** Como `VARCHAR` sin catálogo, «BINACIONAL» y
«Binacional» cuentan como dos categorías y el consolidado del RAO no cuadra. Todos a `ref`.

**❌ P10 — Desnormalizar geografía y jerarquía.** Nada de `nombre_departamento` repetido por
municipio ni `fuerza`/`componente` como texto por unidad.

**❌ P11 — `SET` en lugar de `SET LOCAL` para el contexto de sesión.** Ver R7. Es la fuga de datos
entre usuarios más fácil de introducir y más difícil de detectar leyendo el código.

---

## A.5 Plan de fases

Cada fase tiene una **puerta**. No pases sin superarla; no acumules deuda entre fases.

**Gestión de la sesión de trabajo.** Esto es un proyecto largo. Antes de cada fase escribe en
`docs/BITACORA.md` qué vas a hacer; al terminar, qué hiciste y qué quedó pendiente, con suficiente
detalle para que **otra sesión sin tu contexto pueda continuar**. Si el contexto se te agota a mitad
de fase, deja la bitácora en un estado consistente antes de parar.

**Cuándo detenerte y preguntar.** Si una puerta falla **tres veces seguidas** por la misma causa, no
sigas intentando variaciones: escribe en `docs/BITACORA.md` qué falla, qué probaste y qué crees que
falta, y **pregunta**. Un bucle de correcciones a ciegas destruye más de lo que arregla.

---

### FASE 0 — Preparación

1. Verifica Node 20+, pnpm 9, Docker.
2. `docker-compose.yml` con postgres+postgis+pgvector, redis, minio y otel-collector.
3. Estructura:

```
/apps/api          NestJS
/apps/web          React + Vite
/apps/ia           servicio de IA (Parte B; en la Fase 0 solo el esqueleto)
/packages/schema   esquemas Zod y tipos compartidos
/packages/db       Drizzle: esquema, migraciones, semillas
/docs              BITACORA.md · DECISIONES.md · PREGUNTAS-JACID.md · AUTOAUDITORIA.md
/e2e               pruebas de extremo a extremo
```

4. Crea `docs/PREGUNTAS-JACID.md` con las preguntas abiertas de A.7.
5. Crea `CLAUDE.md` con el contenido del anexo final.

**🚪 Puerta 0:** `docker compose up` deja los servicios sanos y `pnpm -r build` pasa.

---

### FASE 1 — Base de datos

La fase más importante. Todo lo demás descansa aquí.

1. Traduce `anexo_A_ddl_paid.sql` a migraciones de Drizzle, **completando** lo que no cubre: los 26
   catálogos de `ref`, las once tablas hijas, `doc`, `aud` y los cuatro subtipos restantes.
2. Columnas generadas para las decimales; `geography(Point,4326)` con índice GiST.
3. Disparadores: bitácora genérica (R15), cuota agregada (R11), progresión del avance (R10),
   inmutabilidad de `id_tipo_actividad`.
4. Políticas RLS sobre `ai`, `org` y `doc` (R6), con el contexto de R7.
5. Índices de la especificación, incluido el GIN con `pg_trgm` sobre el nombre normalizado de entidad.
6. Semillas: geografía DANE, 7 COAMI, grados y escalafones, tipos de actividad. Los catálogos que
   dependen de JACID (las 17 campañas, los atributos por tipo de herramienta) se siembran **vacíos
   con un TODO**, no inventados.
7. Migraciones **reversibles**: cada una con su `down` probado.

**🚪 Puerta 1 — tests con Testcontainers sobre Postgres real:**

- [ ] Inventario: ninguna tabla esperada falta en `information_schema` (P2).
- [ ] Una actividad no existe sin su subtipo, ni tiene dos subtipos distintos.
- [ ] `DELETE` sobre una actividad **falla** para un rol no administrador.
- [ ] Un `UPDATE` escribe exactamente una fila en `aud.bitacora_cambio`, con ambas imágenes correctas.
- [ ] Nadie puede `UPDATE` ni `DELETE` sobre `aud.bitacora_cambio`.
- [ ] Adjuntos de 9 MB + 2 MB en la misma actividad **fallan**; en actividades distintas, pasan (R11).
- [ ] `latitud_decimal` no admite escritura directa y coincide con la conversión de las GMS.
- [ ] `porcentaje_avance = 80` **es rechazado**; `70` y `100` son aceptados (R10).
- [ ] Un usuario de `BIM23` no ve filas de una unidad hermana ni con `SELECT *` sin `WHERE` (R6).
- [ ] `participo_arc = FALSE` es rechazado (R9).
- [ ] Asistencia `DIRECTA` sin plan operacional es rechazada (R17).
- [ ] Mismo número de documento con distinto tipo coexiste; con el mismo tipo, no.
- [ ] Cada migración aplica y revierte limpiamente.

---

### FASE 2 — Autenticación y autorización

1. Flujo: reto de captcha → validación de red → captcha → credencial → estado y vigencia → sesión.
   Cada paso escribe en `seg.intento_autenticacion`.
2. Contraseñas con **Argon2id**. Historial de las últimas 5. Bloqueo a los 5 intentos.
3. Sesión: testigo opaco, **resumen** en base (P7), TTL deslizante de 10 min en Redis, registro
   durable en `seg.sesion`, tarea programada que cierra las vencidas.
4. Guardas de NestJS: uno de permiso (`@RequierePermiso('JORNADA.EDITAR')`) y un interceptor de
   transacción que fija el contexto con `SET LOCAL` (R7).
5. Siembra los cinco roles con su matriz de permisos: `ADMINISTRADOR` (JACID), `FUNCIONAL_JACID`,
   `OPERADOR_UNIDAD`, `SUPERVISOR`, `CONSULTA`.

**🚪 Puerta 2:**

- [ ] Sesión inactiva 10 min + 1 s → rechazada. A los 9 min 30 s → válida y renovada.
- [ ] Petición desde IP fuera de `seg.red_autorizada` → rechazada, con `RED_NO_AUTORIZADA` en bitácora.
- [ ] El mismo reto de captcha no se puede usar dos veces.
- [ ] Usuario inexistente y contraseña errada devuelven **el mismo cuerpo y el mismo código HTTP**
      (R4). *No pruebes tiempos de respuesta: es una prueba inestable. Verifica en su lugar que ambos
      caminos ejecutan la verificación de contraseña, con un resumen ficticio cuando el usuario no
      existe.*
- [ ] 5 fallos bloquean la cuenta.
- [ ] `OPERADOR_UNIDAD` recibe 403 al intentar `ALIANZA.AVANCE` (R16).
- [ ] La base no contiene ningún testigo de sesión en claro.
- [ ] **Fuga de contexto:** dos peticiones consecutivas de unidades distintas sobre la **misma
      conexión del pool** devuelven cada una solo sus filas (R7/P11). Fuerza `pool.max = 1` en el
      test para garantizar la reutilización.

---

### FASE 3 — Rebanada vertical: Jornadas de Apoyo

Un módulo de punta a punta con sus once pestañas. Es el patrón que después se replica para
asistencias, ruedas, proyectos y campañas.

1. API REST de `ai.actividad` + `ai.jornada_apoyo` + las once tablas hijas + adjuntos.
2. Generación del `codigo_actividad`. **Ver `Q1`:** implementa el patrón observado
   (`<unidad>R<mes><año><sufijo de 5>`) **detrás de una interfaz sustituible** (`GeneradorCodigo`),
   con unicidad por reintento sobre la restricción `UNIQUE`, y deja el TODO. No es el algoritmo real.
3. Carga a MinIO: verificación de MIME real, `hash_sha256`, cuota agregada consultada **antes** de
   aceptar, y fase documental (1, 2, 3).
4. Exportación XLSX y CSV con registro en `aud.exportacion`.
5. Errores: respuesta uniforme `{ codigo, mensaje, detalles?, idCorrelacion }`. El `idCorrelacion`
   viaja en los logs y permite rastrear una petición de punta a punta.

**🚪 Puerta 3:** pruebas de API que crean una jornada completa con las once pestañas y tres adjuntos,
la modifican, verifican la bitácora y comprueban que `registro_completo` pasa a verdadero solo cuando
todas las pestañas exigidas tienen datos.

---

### FASE 4 — Interfaz

1. Ingreso con captcha; aviso de expiración a los 8 minutos con opción de renovar.
2. Menú fiel al manual: Inicio · Tripulantes A.I. · Cooperación Civil Militar · Asuntos Civiles ·
   Sensibilización · Normatividad A.I. Lo que no se tiene permiso de usar no se muestra.
3. Maestros: Personal, Entidades A.I. (con sugerencia de duplicados por semejanza antes de guardar),
   Herramientas AID.
4. Jornadas: listado con las columnas del manual, exportación, y formulario con las once pestañas.
5. Coordenadas en GMS con conversión visible a decimales y **botón «Ver ubicación»** sobre MapLibre,
   tal como describe el manual.
6. Accesibilidad: el manual muestra controles de contraste y tamaño de letra. Impleméntalos y cumple
   **WCAG 2.1 AA** — a una entidad pública colombiana le aplican los lineamientos de accesibilidad
   del MinTIC (Resolución 1519 de 2020).

**🚪 Puerta 4:** prueba de extremo a extremo que ingresa, crea una jornada completa con adjunto, la
exporta y cierra sesión; más una revisión de accesibilidad automatizada sin violaciones críticas.

---

### FASE 5 — Verificación de la Parte A

Audita tu propio trabajo en `docs/AUTOAUDITORIA.md`:

1. Recorre R1–R19 y señala, **para cada una, el archivo y la línea** donde se impone. Una regla sin
   ubicación concreta es una regla no implementada.
2. Recorre P1–P11 y demuestra que ninguno está presente.
3. Ejecuta la batería completa de tests y adjunta el resultado.
4. Enumera lo pendiente, sin adornarlo.

**🚪 Puerta 5:** la Parte A funciona completa **sin ningún componente de IA desplegado**. Este es el
requisito que hace honesta a la Parte B.

---

## A.6 Convenciones

- **TypeScript estricto.** `any` prohibido; si no hay alternativa, `unknown` con validación.
- **Zod compartido.** Un esquema por entidad en `/packages/schema`, consumido por el formulario y por
  el controlador. Si divergen, hay un error de diseño.
- **Nombres en español** en base de datos y API, sin tildes ni eñes, `snake_case`.
- **Commits pequeños**, en español, uno por unidad de trabajo coherente.
- **No ejecutes `git push`** ni crees ramas remotas salvo que se te pida.

## A.7 Lo que no debes inventar

Cuando llegues a cualquiera de estos puntos: **implementa un sustituto explícito, márcalo
`TODO(JACID)` y redacta la pregunta en `docs/PREGUNTAS-JACID.md`** de forma que un funcionario pueda
responderla. No los rellenes con supuestos verosímiles y sigas adelante.

| # | Punto abierto |
|---|---|
| Q1 | Algoritmo exacto del `codigo_actividad`. Ejemplos observados: `2813304R102021R6HXZ`, `6114022R22022DPKAZ`, `1111853R82022JCTLR`, `2510444R102021JVRTP`, `6102320R22022RT4HZ`, `22121854R72021MANPP`. |
| Q2 | Listado vigente de las **17 campañas institucionales** derivadas de COGFM. |
| Q3 | Campos adicionales que se activan por cada uno de los 11 tipos de herramienta AID. |
| Q4 | Formularios reales de las pestañas Tipo Operación, Entidades Servicios, Servicios Prestados, Población Beneficiada y Entidades Apoyadas. |
| Q5 | Rangos CIDR definitivos de la Intranet ARC. |
| Q6 | Perfiles de usuario configurados y su correspondencia con los cinco roles propuestos. |
| Q7 | Política institucional de retención de soportes y de bitácora. |
| Q8 | Integración con ArcGIS: ¿vista de base, servicio REST o exportación programada? |
| Q9 | Si el módulo de Acción Integral de SIGO comparte o replica estos datos. |
| Q10 | Tratamiento de datos de población civil beneficiaria (Ley 1581 de 2012). |
| Q11 | ¿Existe servicio cartográfico institucional (WMS/WMTS) o hay que empaquetar PMTiles? |
| Q12 | **Parte B:** ¿hay hardware con GPU disponible en la intranet, y qué modelos están aprobados para procesar «Información Público Clasificado»? |

---

# PARTE B — ASISTENCIA POR IA

## B.1 El problema que resuelve

Léase esta frase del manual, repetida en cada módulo:

> «Las demás pestañas también se deben diligenciar obligatoriamente en su totalidad […] teniendo en
> cuenta que **se deben completar los formularios con la misma información registrada en la
> descripción de la jornada** sin omitir ningún detalle.»

Ahí está descrito el trabajo real del usuario. Pega el **clavegrama** —un mensaje militar estructurado
en prosa— en el campo de descripción, y después **vuelve a teclear a mano** esa misma información,
repartida en once pestañas: servicios prestados, población beneficiada, entidades, medios de difusión,
medios utilizados, recursos, bienes donados. El dato ya está escrito. Lo que sigue es transcripción.

Esa transcripción es la fuente de casi todo lo que sale mal: se omite una pestaña, se cuenta dos
veces una donación, la cifra de beneficiarios del resumen no coincide con la de la pestaña. Nada de
eso lanza un error; aparece meses después, cuando el consolidado del RAO no cuadra.

**La IA aquí no es un adorno: es la eliminación de la transcripción manual.** Todo lo demás en esta
parte es secundario.

## B.2 Los cinco usos, por orden de valor

| # | Uso | Qué hace | Valor |
|---|---|---|---|
| **U1** | **Extracción estructurada del clavegrama** | Lee la descripción y propone el contenido de las once pestañas, campo por campo, con la cita del fragmento del que salió cada dato. | **Muy alto.** Elimina la transcripción. |
| **U2** | **Verificación de coherencia** | Antes de guardar, contrasta las pestañas contra la descripción: «la descripción menciona 120 raciones entregadas y no hay bienes donados registrados». | **Alto.** Ataca el fallo silencioso. |
| **U3** | **Deduplicación semántica de entidades** | Complementa el índice trigram con similitud por embeddings: detecta «Fundación El Futuro» ≈ «FUNDEFUTURO S.A.S.». | **Alto.** El manual lo pide expresamente. |
| **U4** | **Búsqueda sobre la normatividad** | Pregunta en lenguaje natural sobre directivas, manuales y clavegramas modelo, con cita del documento y la página. | **Medio.** Corpus pequeño y estático. |
| **U5** | **Borrador del resumen** | Propone el texto del Resumen JAD a partir de los datos ya estructurados. | **Medio.** El humano lo reescribe. |

Implementa en ese orden. **U1 y U3 solos ya justifican el subsistema.**

## B.3 Stack de IA

Todo se ejecuta **dentro de la Intranet ARC**. Ningún dato sale de la red. Esto no es una preferencia:
la plataforma está clasificada como «Información Público Clasificado» y no existe salida a internet.

```
Servicio        /apps/ia — FastAPI (Python 3.12), aislado del resto del monorepo
Inferencia      vLLM (con GPU) u Ollama (solo CPU, degradado)
Modelo de texto Un instruct de 7–14B con buen español.
                Candidatos: Qwen2.5-14B-Instruct, Llama-3.1-8B-Instruct.
                ⚠️ Verifica qué está disponible Y APROBADO al momento de implementar (Q12).
                No fijes el modelo en el código: va en configuración.
Salida           Decodificación restringida por gramática / JSON Schema
                (guided decoding de vLLM, u outlines). NO opcional — ver B.4, IA2.
Embeddings      multilingual-e5-base o bge-m3 (buen español, viables en CPU)
Vectores        pgvector en la MISMA base PostgreSQL. Sin infraestructura nueva.
Reranking       opcional, bge-reranker-base, solo para U4
```

**Si no hay GPU** (probable): U3 y U4 funcionan bien en CPU, porque los embeddings son baratos. U1 y
U2 en CPU con un modelo de 7–8B cuantizado son lentos pero utilizables si se ejecutan **de forma
asíncrona**: el usuario pega el clavegrama, sigue trabajando, y la propuesta aparece cuando está
lista. Diséñalo asíncrono desde el principio; así funciona igual con GPU y sin ella.

## B.4 Reglas de la IA — no negociables

### IA1 — La IA propone; la persona dispone. Siempre.
**Ningún modelo escribe jamás en `ai.*`, `org.*` ni `doc.*`.** Lo único que puede escribir es una
fila en `ia.sugerencia`. El dato entra al sistema cuando un usuario envía el formulario, igual que
hoy. La IA rellena campos en pantalla; no guarda nada.

### IA2 — Salida estructurada por construcción
La extracción usa **decodificación restringida** contra el esquema JSON de destino, derivado del
mismo Zod que valida el formulario. Un modelo que no puede emitir JSON inválido elimina una clase
entera de fallos. Después, el JSON se valida igual con Zod: la gramática garantiza la forma, no la
corrección.

### IA3 — Procedencia por campo
Cada valor propuesto viaja con: el **fragmento exacto** del clavegrama del que salió (desplazamiento
inicial y final), y una confianza. La interfaz **resalta el fragmento** cuando el usuario se posa
sobre el campo. El usuario verifica mirando, no confiando. Un campo sin fragmento que lo respalde
**no se propone**.

### IA4 — Nunca inventar cifras
Si una cifra no está en el texto, el campo se deja **vacío**, no estimado. Cero estimaciones, cero
«aproximadamente». Las cantidades de beneficiarios, donaciones y recursos alimentan el RAO y llegan a
rendiciones de cuentas. Una cifra inventada que pasa desapercibida es peor que un campo vacío que
alguien tiene que llenar.

> Precedente real: en un ciclo de reportes de la Reserva Naval, un error aritmético en
> identificadores obligó a emitir una **Fe de Erratas** después de haber presentado las cifras.
> Ese es el coste de una cifra equivocada en este contexto.

### IA5 — Registro completo de cada interacción
Tabla `ia.sugerencia`: entrada (o su resumen si es larga), salida propuesta, **modelo y versión**,
plantilla del prompt y su versión, parámetros de muestreo, latencia, y **qué hizo el humano**:
aceptó sin cambios, editó (con el valor final), o descartó. Es a la vez la auditoría que exige un
sistema clasificado y el conjunto de datos que dirá si esto funciona.

### IA6 — Degradación limpia
Si el servicio de IA no responde, la aplicación **funciona exactamente igual, a mano**. Cortacircuitos
con tiempo de espera corto, y un aviso discreto: «La asistencia no está disponible». Nunca un error
bloqueante. Nunca una pantalla que dependa del modelo para dibujarse.

### IA7 — Sin salida de datos
Ninguna petición a un servicio externo. El servicio de IA no tiene ruta a internet **por
configuración de red**, no solo por convención de código. Verifícalo en el despliegue.

### IA8 — La IA respeta el ámbito
El servicio de IA recibe solo el texto que el usuario ya tiene en pantalla. No consulta la base por
su cuenta. Para U3 y U4, las consultas vectoriales pasan por la API y quedan sujetas a las mismas
políticas RLS: un usuario no puede descubrir, vía similitud semántica, entidades o documentos que su
unidad no puede ver.

## B.5 Anti-patrones de IA

**❌ PIA1 — Autocompletar y guardar.** Que el modelo rellene y el usuario le dé a guardar sin mirar
es peor que no tener asistencia: traslada el error de la transcripción a la confianza ciega. Por eso
IA3 exige procedencia visible campo por campo.

**❌ PIA2 — Un chat genérico en una esquina.** No construyas «un asistente». Construye U1: un botón
que dice **«Extraer del clavegrama»** y rellena el formulario. La ayuda específica y encajada en la
tarea vale diez veces más que un cuadro de conversación.

**❌ PIA3 — Pedir JSON en el prompt y esperar lo mejor.** Sin decodificación restringida, un
porcentaje de las respuestas será JSON inválido o con campos inventados, y acabarás escribiendo
reparadores de JSON. Ver IA2.

**❌ PIA4 — Meter la IA en el camino crítico.** Nada síncrono, nada bloqueante, nada que impida
guardar si el modelo no responde.

**❌ PIA5 — Confundir fluidez con exactitud.** Un modelo de 8B escribe español impecable y puede
equivocarse en la cifra. La interfaz debe hacer que **verificar sea más fácil que confiar**: el
resaltado del fragmento no es un adorno, es el mecanismo de control.

**❌ PIA6 — Evaluar «a ojo».** «Se ve bien» no es una medición. Ver B.7.

## B.6 Fases de la Parte B

### FASE 6 — Infraestructura de IA y los usos baratos (U3)

1. `/apps/ia` con FastAPI: `/salud`, `/embeddings`, `/extraer`. Contrato tipado y compartido.
2. `pgvector` sobre `ai.entidad`: columna de embedding del nombre normalizado, índice HNSW, proceso
   de recálculo.
3. **U3**: al crear una entidad, combina el trigram existente con la similitud vectorial y muestra
   las candidatas antes de guardar, con su puntaje. El usuario confirma que es nueva.
4. Tabla `ia.sugerencia` y `ia.modelo` (registro de modelos y versiones en uso).

**🚪 Puerta 6:**
- [ ] Con el servicio de IA **apagado**, toda la Parte A sigue pasando sus tests (IA6).
- [ ] U3 detecta un caso construido: «FUNDACIÓN EL FUTURO» frente a «Fundacion Futuro S.A.S.».
- [ ] Un usuario de `BIM23` no obtiene, por similitud, entidades fuera de su ámbito (IA8).

### FASE 7 — Extracción del clavegrama (U1) y coherencia (U2)

1. Deriva el **JSON Schema** de destino desde los esquemas Zod de las once pestañas.
2. Plantilla de prompt **versionada en el repositorio** (`/apps/ia/prompts/extraccion.v1.md`), con
   ejemplos reales de clavegrama anonimizados. Nunca un prompt escrito en el código.
3. Decodificación restringida contra ese esquema (IA2).
4. Endpoint asíncrono: el usuario pega el clavegrama, se encola, la propuesta llega por sondeo o SSE.
5. Interfaz: botón **«Extraer del clavegrama»** → los campos se rellenan marcados como *propuestos*
   (distintos visualmente de los confirmados); al posarse sobre uno, se resalta el fragmento de
   origen; el usuario acepta, edita o descarta **campo por campo**; nada se guarda hasta que envía.
6. **U2**: al enviar, contrasta el formulario contra la descripción y muestra discrepancias como
   **advertencias, nunca bloqueos**.

**🚪 Puerta 7:**
- [ ] El modelo **no puede** emitir JSON que no valide contra el esquema (prueba con 200 ejecuciones).
- [ ] Todo campo propuesto tiene fragmento de origen; el que no lo tenga, no se propone (IA3).
- [ ] Un clavegrama **sin** cifra de beneficiarios deja ese campo vacío, no estimado (IA4).
- [ ] Con el servicio caído, el formulario se diligencia y se guarda a mano sin degradación (IA6).
- [ ] Cada extracción deja su fila en `ia.sugerencia` con modelo, versión de prompt y desenlace (IA5).

### FASE 8 — U4 y U5 (opcionales; solo si 6 y 7 están sólidas)

RAG sobre la normatividad con cita obligatoria de documento y página, y borrador del resumen. Si U1
no está funcionando bien en producción, **no empieces esta fase**: consolida lo que da valor.

## B.7 Evaluación — sin esto, no sabes si funciona

No declares «funciona» sin medirlo.

1. **Conjunto de referencia.** Toma entre 50 y 100 jornadas **ya registradas a mano** en la PAID
   actual, con su clavegrama y sus once pestañas diligenciadas. Es un conjunto de evaluación listo y
   gratuito: la respuesta correcta ya la escribió un humano.
2. **Métricas por campo**, no globales: precisión y exhaustividad de cada campo extraído.
   *Las cifras se miden aparte y con exigencia mayor*: en cantidades, un error es peor que una
   omisión. Reporta por separado «campos numéricos» y «campos de texto».
3. **Umbral de publicación.** Define antes de medir qué es aceptable. Sugerencia: exhaustividad ≥ 0,85
   en campos de texto y **precisión ≥ 0,98 en campos numéricos**, con los fallos sesgados hacia dejar
   vacío antes que hacia equivocarse.
4. **La métrica que de verdad importa** llega después: la **tasa de aceptación sin edición** de las
   sugerencias, que `ia.sugerencia` recoge sola. Si los usuarios editan la mayoría de los campos
   propuestos, la asistencia está estorbando y hay que reentrenar el prompt o cambiar de modelo.
5. **Guardia de no regresión:** el conjunto de referencia se ejecuta en CI ante cualquier cambio de
   modelo, de versión o de plantilla de prompt. Un cambio de modelo sin reevaluar es un despliegue a
   ciegas.

## B.8 Definición de terminado

1. `docker compose up` levanta el sistema y se ingresa con un usuario sembrado.
2. Las ocho puertas superadas, con sus tests en limpio.
3. `docs/AUTOAUDITORIA.md` ubica cada regla R1–R19 e IA1–IA8 en el código, y descarta P1–P11 y
   PIA1–PIA6.
4. `docs/EVALUACION-IA.md` con el conjunto de referencia, las métricas y el umbral acordado.
5. `docs/PREGUNTAS-JACID.md` con Q1–Q12, redactadas para un destinatario no técnico.
6. `README.md`: cómo levantar, sembrar, probar, y **cómo desplegar sin el subsistema de IA**.

---

**Una advertencia final.** El defecto característico de este sistema no es que falle: es que parezca
funcionar mientras acumula datos que no cuadran. Un adjunto huérfano, un COAMI duplicado, un punto en
el mapa que no corresponde a lo digitado, un consolidado que suma mal porque «Binacional» y
«BINACIONAL» son dos categorías. Nada de eso lanza un error.

La IA **multiplica ese riesgo** si se implementa mal, porque produce datos plausibles a gran
velocidad. Por eso todo lo que propone entra como propuesta con su procedencia a la vista, por eso
nunca inventa una cifra, y por eso el sistema completo debe funcionar sin ella. Las reglas viven en
la base de datos y no en la capa de aplicación, y las puertas se verifican con tests y no con una
lectura del código.

---

# ANEXO — `CLAUDE.md` para la raíz del repositorio

Créalo en la Fase 0. Son las reglas que siguen vigentes en cualquier sesión futura, cuando este
prompt ya no esté en el contexto.

```markdown
# PAID — Reglas permanentes del repositorio

## Contexto
Plataforma de Acción Integral y Desarrollo de la Armada de Colombia. Opera solo en la Intranet ARC,
sin internet. Especificación completa en PROMPT.md; DDL de referencia en anexo_A_ddl_paid.sql.

## Invariantes que nunca se tocan
- Escala de avance de proyectos: 10,20,30,40,50,60,70,100. NO existen 80 ni 90.
- Sesión: 10 minutos de inactividad, expiración deslizante evaluada en servidor.
- Adjuntos: 10 MB AGREGADOS por actividad, no por archivo.
- participo_arc siempre TRUE.
- Coordenadas: GMS almacenadas, decimales GENERATED ALWAYS, geography(Point,4326).
- Borrado solo lógico. El físico exige solicitud aprobada por JACID.
- Toda escritura en ai/org/doc pasa por la bitácora, alimentada por disparador.
- Aislamiento por unidad mediante Row Level Security, nunca solo con WHERE en el servicio.
- El contexto de sesión se fija con SET LOCAL dentro de la transacción, NUNCA con SET
  (el pool reutiliza conexiones: un SET filtra el contexto a la petición siguiente).
- Instantes en UTC (TIMESTAMPTZ); fechas sin hora en DATE. Presentación en America/Bogota.
- Dominios cerrados en tablas de catálogo de `ref`, nunca VARCHAR libre.
- Sin dependencias de tiempo de ejecución que llamen a internet.

## Reglas de IA
- La IA propone, nunca escribe en ai/org/doc. Solo en ia.sugerencia.
- Salida estructurada por decodificación restringida, no por pedirlo en el prompt.
- Todo campo propuesto lleva el fragmento de origen; sin fragmento, no se propone.
- Cifra que no esté en el texto: campo VACÍO. Nunca estimada.
- El sistema completo debe funcionar con el servicio de IA apagado.
- Los prompts viven en archivos versionados, no en el código.
- Cambio de modelo, de versión o de prompt exige reejecutar el conjunto de evaluación.

## Prohibiciones
- No referencias polimórficas sin clave foránea.
- No `any` en TypeScript.
- No documentar una tabla sin implementarla: el test de inventario debe seguir pasando.
- No rellenar con supuestos los puntos Q1–Q12 de PROMPT.md; marcar TODO(JACID) y preguntar.
- Si una puerta falla 3 veces por la misma causa: parar, documentar y preguntar.

## Comandos
pnpm dev · pnpm test · pnpm db:migrate · pnpm db:seed · pnpm eval:ia · docker compose up
```

---

# CAMBIOS RESPECTO DE LA VERSIÓN 1

| Cambio | Motivo |
|---|---|
| Teselas PMTiles o WMS institucional para el mapa | **Contradicción de la v1:** exigía MapLibre y prohibía servicios externos, sin decir de dónde salen las teselas. Sin ellas el mapa no dibuja nada. |
| Nueva regla R7 y anti-patrón P11: `SET LOCAL` | La v1 decía «variable de contexto» sin el mecanismo. Con `SET` y un pool de conexiones se filtra el contexto entre peticiones de unidades distintas: fuga de datos silenciosa. |
| Zona horaria y tipos `DATE` explícitos (A.2.5) | La v1 no lo decía; un `TIMESTAMP` en fechas de formulario desplaza días en los informes. |
| Versiones fijadas, pnpm workspaces declarado | La v1 usaba `pnpm` sin declararlo y dejaba las versiones abiertas: irreproducible en una red con registro espejado. |
| Librería de exportación, logging y correlación de errores | Huecos de la v1: «exportar a Excel» sin decir con qué, y ninguna estrategia de observabilidad. |
| Migraciones reversibles y su test | Ausente en la v1. |
| Prueba de temporización de R4 sustituida | La v1 pedía «tiempos comparables»: prueba inestable en CI. Se reemplaza por verificar que ambos caminos ejecutan la verificación de contraseña. |
| Regla de parada a los 3 intentos y bitácora para retomar | La v1 no daba salida a un bucle de correcciones ni instrucciones para continuar en otra sesión. |
| **Parte B completa: subsistema de IA** | Lo solicitado. Se apoya en la queja explícita del manual —rellenar once pestañas con información que ya está escrita en el clavegrama— y se blinda con IA1–IA8 y PIA1–PIA6 para que no corrompa el dato. |
| Nuevas preguntas Q11 y Q12 | Cartografía institucional; y hardware y modelos aprobados para datos clasificados. |
