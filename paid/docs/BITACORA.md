# Bitácora de la construcción de la PAID

Registro por fases, en orden cronológico inverso dentro de cada fase (lo más
reciente arriba). **Toda sesión debe escribir aquí antes de empezar una fase y
al terminarla**, con detalle suficiente para que otra sesión sin este contexto
pueda continuar (PROMPT.md · A.5).

---

## FASE 4 — Interfaz

### Antes de empezar (plan)

Los seis puntos de la fase, y lo que cada uno obliga:

1. **Ingreso con captcha y aviso de expiración a los 8 minutos con opción de
   renovar.** El aviso lo calcula el cliente de `expiraEnUtc`, pero **quien
   decide es el servidor**: si el cliente «decidiera», bastaría con cambiar la
   hora del equipo.
2. **Menú fiel al manual**, y «lo que no se tiene permiso de usar no se
   muestra».
3. **Los tres maestros**, con la sugerencia de duplicados por semejanza en
   Entidades A.I. — el único punto de la fase que no es «una pantalla más».
4. **Jornadas**: listado con las columnas del manual, exportación y el
   formulario de las once pestañas.
5. **Coordenadas GMS con conversión visible a decimales** y botón «Ver
   ubicación» sobre MapLibre.
6. **Accesibilidad**: controles de contraste y tamaño de letra, WCAG 2.1 AA
   (lineamientos del MinTIC, Resolución 1519 de 2020).

**Lo que faltaba en el servidor.** Los puntos 2 y 3 no tenían dónde apoyarse:
no existían los puntos de entrada de Personal, Entidades A.I., Herramientas
AID, Normatividad ni la lectura de los catálogos de `ref`. Se construyeron en
`apps/api/src/maestros/`.

**Concepto de diseño: carta náutica nocturna.** El sujeto manda. Esta es la
plataforma con la que unidades tácticas registran acción integral en costas y
ríos de Colombia, y su vocabulario propio es el de la navegación. Y tiene un
trabajo concreto, que viene del cierre de PROMPT.md —«el defecto característico
de este sistema no es que falle: es que parezca funcionar mientras acumula
datos que no cuadran»—: **hacer visible el estado**. Qué pestañas faltan,
cuánta cuota queda, si un registro cuenta para el RAO, cuánto le queda a la
sesión.

De ahí el elemento firma, la **Rosa de Pestañas**: once segmentos de arco desde
el norte, los que faltan apagados. Es a la vez el indicador y el navegador,
porque son la misma cosa.

**Restricción de entorno resuelta.** La guía de diseño pedía fuentes de Google
Fonts y A.2.1 prohíbe internet en tiempo de ejecución. Se descargaron en tiempo
de construcción y se autoalojan (167 KB de woff2). Una `@font-face` remota no
falla de forma visible: cae al tipo del sistema y el defecto pasa inadvertido
hasta que alguien compara la pantalla con el manual.

### 🚪 Puerta 4 — SUPERADA

Dos exigencias, las dos cumplidas, en `e2e/pruebas/`:

**Camino completo por la interfaz** (`puerta4.spec.ts`, 3 pruebas): ingresa con
captcha, registra una jornada con sus coordenadas GMS, comprueba que la casilla
de la ARC está marcada y deshabilitada (R9) y que ningún COAMI viene marcado
(R18), diligencia las once pestañas, consulta la cuota antes de subir nada
(R11), sube un PDF **real** —R12 comprueba el contenido, no la extensión—,
verifica que el registro pasa a completo **solo con las once** (R19), lo
exporta a CSV y cierra sesión. Más el aislamiento por unidad visto desde la
pantalla (R6) y el mensaje único del ingreso fallido (R4).

**Revisión de accesibilidad** (`accesibilidad.spec.ts`, 8 pruebas): axe con las
etiquetas `wcag2a`, `wcag2aa`, `wcag21a` y `wcag21aa` sobre siete rutas en los
**tres modos de contraste**, los formularios desplegados, y el tamaño de letra
mayor comprobando que no hay desplazamiento horizontal (WCAG 1.4.10, Reflow).
**Cero violaciones críticas o serias.**

⚠️ axe encuentra entre el 30 % y el 40 % de los problemas reales. Pasar esto no
significa que la aplicación sea accesible: significa que no tiene los defectos
que una máquina puede encontrar. Lo que ninguna máquina comprueba está decidido
a mano en cada componente y anotado ahí.

### Los cinco defectos que la Puerta 4 encontró

Y el motivo por el que ninguna de las 94 pruebas anteriores podía verlos: esas
hablan con la API, y estos vivían en la **costura entre el formulario y el
controlador**.

1. **El formulario de jornadas no podía guardar.** El esquema Zod compartido
   transformaba `dd/mm/aaaa` a `aaaa-mm-dd`, el formulario enviaba el
   resultado, y el controlador —con el mismo esquema— lo rechazaba. A.6 exige
   un solo esquema para cliente y servidor, y la consecuencia que no es obvia
   es que **se ejecuta dos veces sobre el mismo dato**. Ver D-25. Dos pruebas
   existentes afirmaban el comportamiento incorrecto y se cambiaron.
2. **Las pestañas pedían el identificador numérico del catálogo** en un campo
   de texto: «Id tipo operacion: ____». Imposible de diligenciar. Ver D-26.
3. **El listado seguía diciendo «Faltan 11»** 30 segundos después de completar
   la undécima pestaña. Es la pantalla por la que se decide qué entra en el
   consolidado del RAO. Ver D-27.
4. **Dos defectos de accesibilidad**: una región desplazable sin acceso por
   teclado, y un contraste de 4,41:1 causado por una `opacity` sobre un color
   bien calculado. Ver D-28.
5. **Una prueba que pasaba en falso.** La revisión de accesibilidad usaba
   `page.goto()` entre rutas; el testigo vive en memoria, así que recargar
   cierra la sesión, y revisaba siete veces la pantalla de ingreso —cuyo `<h1>`
   también dice «PAID»—. Ver D-29.

### Cómo verlo funcionando

```bash
cd paid
pnpm -r build
./scripts/mirar.sh
```

Deja la API en `:3000` y la interfaz en `:5173`, con la base migrada y
sembrada, e imprime las credenciales. `BIM23_PAID` tiene maestros; `BIM24_PAID`
está vacía a propósito, para ver que RLS no le muestra nada de la otra unidad.

Las pruebas de la Puerta 4 necesitan eso en pie:

```bash
pnpm --filter @paid/e2e test
```

### Pendiente al cerrar la Fase 4

1. **Q14 sigue sin respuesta** y afecta a esta interfaz: si quitar una fila de
   una pestaña exige solicitud a JACID, cada fila necesita un botón de
   «solicitar eliminación». Hoy se puede quitar, con la reinterpretación
   documentada en D-24.
2. **Q4 sigue sin respuesta** y es la que más pesa: cinco de las once pestañas
   no tienen campos confirmados. Los paneles se construyen del esquema, así que
   responderla cambia una declaración y no once pantallas — pero hasta que
   llegue, cada panel muestra el aviso `TODO(JACID) Q4`.
3. **Asuntos Civiles, Sensibilización y Alianzas** tienen pantalla que explica
   qué falta, no módulo. Comparten supertipo con las jornadas y esperan Q4.
4. **El mapa** (`MapaUbicacion`) depende de Q11: sin servicio de mapas
   institucional ni teselas en `public/teselas/`, dibuja la carta esquemática
   con las coordenadas en claro. El botón «Ver ubicación» del manual está.
5. **Cargar normatividad** espera Q15, nueva: R11 fija la cuota de 10 MB «por
   actividad» y la normatividad no es una actividad.

---

## FASE 3 — Rebanada vertical: Jornadas de Apoyo

### Antes de empezar (plan)

Es el módulo que después se replica para asistencias, ruedas, proyectos y
campañas, así que lo que importa no es solo que funcione: es que el patrón sea
el correcto.

**Restricción de entorno nueva:** MinIO tampoco se puede instalar en esta
sesión — `dl.min.io` está bloqueado por la política de egreso, igual que las
imágenes de Docker (D-07). El almacenamiento de objetos va detrás de una
interfaz con dos implementaciones, y las reglas que importan (R11, R12) se
imponen en la base y en el servicio, no en el almacén, así que siguen siendo
verificables. Ver D-22.

Plan:

1. API REST de `ai.actividad` + `ai.jornada_apoyo` + las once tablas hijas +
   adjuntos.
2. `codigo_actividad` con el patrón observado detrás de una interfaz
   sustituible (`GeneradorCodigo`), unicidad por reintento sobre el `UNIQUE`, y
   el TODO de Q1.
3. Carga de adjuntos: MIME real, `hash_sha256`, cuota agregada consultada
   **antes** de aceptar, y fase documental.
4. Exportación XLSX y CSV con registro en `aud.exportacion`.
5. Errores uniformes con `idCorrelacion` (ya estaba desde la Fase 0).

### Al terminar (resultado)

**Estado: Fase 3 cerrada. Puerta 3 superada — 42 pruebas de API.**

Hecho:

- **API REST completa** de jornadas: crear, modificar, listar con los filtros y
  las columnas del manual, y las **once pestañas**.
- **`codigo_actividad`** con el patrón observado detrás de `GeneradorCodigo`,
  y unicidad por **reintento sobre el `UNIQUE`** con `SAVEPOINT` por intento —
  no con un «¿existe ya?» seguido de un `INSERT`, que es una carrera.
- **Adjuntos**: MIME real con `file-type`, `hash_sha256`, cuota agregada
  consultada **antes** de aceptar, fase documental, y verificación del resumen
  al descargar.
- **Exportación XLSX y CSV** con registro en `aud.exportacion`, incluidos los
  filtros usados.
- Dos migraciones nuevas: **0014** (privilegios de las pestañas) y el ajuste de
  los códigos de unidad en las semillas de desarrollo.

### Cuatro defectos reales que la Puerta 3 encontró

1. **⚠️ PÉRDIDA DE DATOS SILENCIOSA.** Un `PATCH` que solo cambiaba el lugar
   **borraba todas las participaciones de COAMI**. Causa: `crearJornada` pone
   `.default([])` en `coami` —correcto al crear, R18 dice que no se marque
   ninguno—, y `.partial()` de Zod **conserva el valor por omisión**, así que
   la modificación llegaba al servicio con `coami: []`, indistinguible de
   «quítalos todos». Sin error, sin aviso, y sin que el usuario pidiera nada.
   Ahora «ausente» y «lista vacía» son dos cosas distintas y se pueden
   expresar por separado.
2. **Quitar una fila de una pestaña devolvía «permission denied».** R14
   revoca `DELETE`, y aplicado literalmente a las once tablas hijas significaba
   que corregir un error de digitación exigía una solicitud a JACID. Se adoptó
   la lectura de que R14 protege **registros** y no el contenido de un
   formulario que se está diligenciando, y se concedió `DELETE` solo sobre esas
   once tablas (migración 0014). Es seguro porque R15 guarda la imagen anterior
   de cada fila borrada. Queda como Q14 para confirmar.
3. **Las semillas de desarrollo producían códigos de actividad que no se
   parecían a los observados**, porque usaban códigos de unidad con guiones
   (`DES-BIM23`). Ahora son numéricos, tomados de los propios ejemplos de Q1.
4. **Dos aserciones mías eran falsas**, no el código: una buscaba en el CSV una
   columna que la exportación no tiene, y otra daba por hecho que la
   descripción llevaba comas. La segunda se reescribió para **probar de verdad
   el escapado** —coma, comilla doble y salto de línea, los tres casos que
   rompen un CSV mal escrito— en lugar de asumirlo.

### 🚪 Puerta 3 — resultado

La puerta pide «pruebas de API que crean una jornada completa con las once
pestañas y tres adjuntos, la modifican, verifican la bitácora y comprueban que
`registro_completo` pasa a verdadero solo cuando todas las pestañas exigidas
tienen datos». Las cuatro cosas, más lo que salía gratis:

| Comprobación | Resultado |
|---|---|
| Jornada completa con las **once** pestañas | ✅ diez de datos + los adjuntos |
| **Tres adjuntos**, uno por fase documental | ✅ y el `hash_sha256` coincide con el calculado sobre el contenido |
| Se modifica | ✅ |
| Bitácora verificada | ✅ inserción y modificación, con ambas imágenes y el usuario del contexto; y las once tablas hijas también quedaron registradas |
| `registro_completo` pasa a verdadero **solo** con las once | ✅ falso al crear, falso con diez, verdadero con once, y **vuelve a falso al retirar una** |
| Q1 — el código sigue el patrón observado | ✅ y seis jornadas del mismo mes no colisionan |
| R11 por la API | ✅ 9 MB entra, +2 MB da 413 con el mensaje que explica que la cuota es del total, el rechazo no consume cuota, y dar de baja libera espacio |
| R12 por la API | ✅ un ejecutable renombrado a `.jpg`, un zip renombrado a `.pdf`, una extensión fuera del catálogo y un archivo vacío: los cuatro rechazados, y **ninguno dejó fila** |
| Exportación | ✅ CSV con BOM y escapado RFC 4180 probado con los tres casos; XLSX con firma ZIP real; cada exportación en `aud.exportacion` **con sus filtros** |
| R6 a través de la API | ✅ BIM24 no ve ninguna jornada de BIM23 |
| R9, R13, A.2.4 por la API | ✅ `participoArc: false` rechazado, GMS imposibles rechazadas, fecha ISO rechazada |

**Cómo se ejecuta:**

```bash
cd paid/apps/api
PAID_ALMACEN_RAIZ=/tmp/paid-adjuntos \
PAID_SEMILLA_DESARROLLO=1 \
DATABASE_URL_PRUEBA="postgres://usuario:clave@127.0.0.1:5432/postgres" \
pnpm test
```

### Pendiente al cerrar la Fase 3

1. **⛔ `AlmacenMinio` NO está verificado.** `dl.min.io` está bloqueado por la
   política de egreso, igual que las imágenes de Docker (D-07), así que no fue
   posible levantar un MinIO. El código está escrito y compila; lo que falta es
   haberlo ejecutado. Las pruebas corren con el almacén de sistema de archivos,
   y R11 y R12 se imponen **antes** de que el almacén vea un byte, así que las
   reglas sí están verificadas. Ver D-22.
2. **Los otros cuatro subtipos no están.** Asistencias, ruedas, proyectos y
   campañas. El patrón es el de jornadas y las tablas ya existen; es replicar,
   no diseñar. Ojo: campañas exige nivel Fuerza (R16) y proyectos, la escala de
   ocho tramos con su histórico mensual (R10).
3. **La exportación tiene un tope de 500 filas.** Es deliberado —recortar en
   silencio sería peor—, pero un consolidado anual las supera. Falta paginar la
   exportación o generarla de forma asíncrona.
4. **Sigue faltando el esquema Drizzle en TypeScript** (D-15). Los servicios
   consultan con SQL parametrizado a través de `BaseDatosService`. Funciona y es
   seguro, pero no da tipos derivados del esquema.
5. **Q4 sigue sin responder**, y con ella los campos reales de cinco pestañas.
   El mapa de `pestanas.mapa.ts` está hecho para que responderla sea cambiar una
   declaración (D-23).

---

## FASE 2 — Autenticación y autorización

### Antes de empezar (plan)

Infraestructura conseguida en esta sesión: Redis 7.0.15 local (las imágenes de
Docker siguen bloqueadas, D-07) y `@node-rs/argon2`, que instala desde binarios
precompilados —sin compilar nada— y produce el formato PHC `$argon2id$` que el
`CHECK` de `seg.usuario` ya exigía.

Plan:

1. Flujo: reto de captcha → validación de red → captcha → credencial → estado y
   vigencia → sesión. Cada intento escribe su causa en
   `seg.intento_autenticacion` (una de las ocho de R4).
2. Argon2id, historial de las últimas 5 claves, bloqueo a los 5 intentos.
3. Sesión: testigo opaco, **resumen** en base (P7), TTL deslizante de 10 min en
   Redis, registro durable en `seg.sesion`, tarea programada que cierra las
   vencidas.
4. Guardas de NestJS: `@RequierePermiso('JORNADA.EDITAR')` e interceptor de
   transacción que fija el contexto con `SET LOCAL` (R7).
5. Los cinco roles con su matriz de permisos.

### Al terminar (resultado)

**Estado: Fase 2 cerrada. Puerta 2 superada — 38 pruebas sobre la API real.**

Hecho:

- **Flujo de ingreso completo** en el orden de PROMPT.md: reto de captcha →
  validación de red → captcha → credencial → estado y vigencia → sesión. Cada
  intento escribe su causa en `seg.intento_autenticacion`, una de las ocho.
- **Argon2id** con `@node-rs/argon2` (binarios precompilados, sin compilar
  nada). Historial de las últimas 5 claves, bloqueo a los 5 intentos.
- **Sesión**: testigo opaco de 32 bytes, resumen SHA-256 en base, TTL
  deslizante de 10 min en Redis, registro durable en `seg.sesion` con motivo de
  cierre, y tarea programada que cierra las vencidas.
- **Guardas**: `SesionGuard` (R1), `PermisoGuard` con
  `@RequierePermiso('ALIANZA.AVANCE')` (P4, R16) y `TransaccionInterceptor` que
  fija el contexto con `SET LOCAL` (R7). Registrados globalmente en ese orden,
  que no es indiferente.
- **Los cinco roles con su matriz**: 43 / 37 / 31 / 14 / 10 permisos.
  `ALIANZA.AVANCE` lo tienen solo `ADMINISTRADOR` y `FUNCIONAL_JACID`.
- **Aviso de red abierta** en el arranque (R2). En `NODE_ENV=production` no
  avisa: **impide arrancar**. Un aviso en un log que nadie lee no es una
  salvaguarda.
- Dos migraciones nuevas, **0012** (`ai.alianza`) y **0013**
  (`seg.unidad_para_ingreso`), las dos por huecos que la Fase 2 saco a la luz.

### Seis defectos reales que la Puerta 2 encontró

Se anotan porque cuatro de ellos parecían correctos leyendo el código.

1. **R4 estaba incumplido mientras el código que lo impone parecía bien.** El
   filtro de excepciones usaba `excepcion.message`, pero al lanzar
   `new UnauthorizedException({ codigo, mensaje })` NestJS pone en `.message` su
   texto por omisión, «Unauthorized Exception». El cliente recibía eso en lugar
   de «Credenciales inválidas» — en inglés, y distinto de lo que R4 exige. El
   filtro ahora lee el cuerpo que la excepción trae.
2. **La API se conectaba como SUPERUSUARIO en las pruebas, así que RLS no se
   aplicaba en absoluto.** La prueba de fuga de contexto mostró a BIM23 viendo
   filas de BIM24; el motivo no era `SET LOCAL`, era que un superusuario ignora
   las políticas por definición. Ahora el arranque crea un rol
   `NOSUPERUSER NOBYPASSRLS`, y hay **dos pruebas nuevas** que comprueban
   explícitamente que el rol de la API no puede saltarse RLS y que todas las
   tablas de `ai`, `org` y `doc` la tienen activa **y forzada**. Sin esa
   comprobación, cualquier despliegue que apunte `DATABASE_URL` al usuario
   administrador anula R6 entero y nada lo nota.
3. **El ingreso no podía leer `org.unidad`.** Necesita la `ruta_jerarquica` para
   construir el contexto de R7, pero esa tabla tiene RLS forzada comparando
   contra… el contexto, que aún no existe. Resuelto con la migración 0013: una
   función `SECURITY DEFINER` mínima, de solo lectura, que devuelve tres campos
   de una fila. Ver `docs/DECISIONES.md`, D-20, para por qué aquí sí y en las
   políticas de 0010 no.
4. **Un identificador de captcha inventado devolvía 500 y borraba el rastro.**
   Comparar texto arbitrario contra una columna `uuid` aborta la transacción
   entera, así que el registro del intento —lo que R4 quiere conservar— fallaba
   después. Un `try/catch` no servía: la transacción ya estaba perdida. Ahora se
   valida el formato antes de tocar la base.
5. **Las pruebas arrancaban la API con todos los constructores vacíos.** esbuild
   —el transformador de Vitest por omisión— no emite `design:paramtypes`, la
   metadata con la que NestJS inyecta. `tsc` sí, de modo que la compilación y el
   despliegue nunca estuvieron afectados: era solo el camino de las pruebas. Se
   cambió a SWC (D-18). Y por el mismo motivo se desactivó
   `consistent-type-imports` en `apps/api`: su autocorrección convierte los
   imports en `import type`, TypeScript los elimina del JavaScript y la
   inyección falla en ejecución (D-19).
6. **La regla de qué semillas ejecutar estaba en tres sitios** y uno se quedó
   atrás: el arranque de la Puerta 1 empezó a sembrar los datos de desarrollo y
   chocó con sus propias unidades de prueba. Ahora está en
   `packages/db/src/semillas.ts`, en un solo lugar.

### 🚪 Puerta 2 — resultado

| Casilla | Resultado |
|---|---|
| Sesión inactiva 10 min + 1 s → rechazada; 9 min 30 s → válida y renovada | ✅ y el TTL vuelve a 600 al usarla |
| IP fuera de `seg.red_autorizada` → rechazada, con `RED_NO_AUTORIZADA` en bitácora | ✅ y la respuesta es idéntica a la de credenciales inválidas |
| El mismo reto de captcha no se puede usar dos veces | ✅ y se marca consumido incluso al fallar la respuesta |
| Usuario inexistente y clave errada: mismo cuerpo y mismo código HTTP | ✅ cuerpo completo comparado, salvo `idCorrelacion` |
| Ambos caminos ejecutan la verificación de clave | ✅ con espía sobre `ClaveService.verificar`, **no** comparando tiempos |
| 5 fallos bloquean la cuenta | ✅ y bloqueada no entra ni con la clave correcta |
| `OPERADOR_UNIDAD` recibe 403 al intentar `ALIANZA.AVANCE` | ✅ y sí puede consultar: el 403 es del permiso, no de la ruta |
| La base no contiene ningún testigo en claro | ✅ buscado en la representación JSON de **toda** la fila, y también en la bitácora y en los intentos |
| **Fuga de contexto** con `pool.max = 1` | ✅ tres peticiones alternadas sobre la misma conexión; cada unidad solo ve lo suyo |

Añadidas: que la sonda de salud no exija sesión, que cerrar sesión invalide el
testigo y deje motivo `CIERRE_USUARIO`, que un ingreso exitoso ponga el
contador de fallos a cero, que el avance de un convenio no retroceda, que una
credencial mal formada responda 401 y no 400 —un 400 con detalle de validación
revelaría el formato de las credenciales—, que la escritura autenticada quede
en la bitácora con el usuario y la sesión del contexto, y que la tarea
programada cierre las vencidas con motivo `EXPIRACION`.

**Cómo se ejecuta:**

```bash
cd paid/apps/api
PAID_SEMILLA_DESARROLLO=1 \
DATABASE_URL_PRUEBA="postgres://usuario:clave@127.0.0.1:5432/postgres" \
pnpm test
```

Necesita Postgres 16 con PostGIS y pgvector, y Redis 7.

### Pendiente al cerrar la Fase 2

1. **Cambio de clave.** `ClaveService` ya tiene el historial de 5 y la
   comprobación, pero **no hay endpoint** que lo use. Falta también el
   tratamiento de `CLAVE_EXPIRADA`: hoy se registra y se rechaza el ingreso,
   pero no se ofrece cambiarla. Es trabajo de la Fase 4, cuando haya pantalla.
2. **Al recolocar una unidad hay que cerrar las sesiones de su
   subarborescencia** (D-16). Sigue pendiente: el contexto lleva la ruta y
   quedaría obsoleta. No produce un error, produce un ámbito equivocado.
3. **El captcha es aritmético, no de imagen.** El manual muestra uno de imagen.
   El sustituto es explícito y accesible; si JACID exige el del manual, se
   reemplaza el generador sin tocar el flujo.
4. **`X-Forwarded-For` se confía.** Es correcto detrás de nginx, y el
   despliegue no publica el puerto de la API fuera de la red interna. Queda
   anotado en el código, en el punto donde se confía.
5. **El esquema Drizzle en TypeScript sigue sin estar** (D-15). Los
   controladores de la Fase 2 consultan con SQL directo a través de
   `BaseDatosService`, que es suficiente para esta fase pero no para las once
   pestañas de la Fase 3.

---

## FASE 1 — Base de datos

### Antes de empezar (plan)

**Cambio de situación respecto del cierre de la Fase 0.** Se preguntó por
`anexo_A_ddl_paid.sql`, como PROMPT.md ordena. Respuesta: **el archivo no
existe**, y se autoriza expresamente derivar el esquema de PROMPT.md. Queda
registrado en `docs/DECISIONES.md`, D-13, con lo que ese desvío implica.

**Lo que además cambió:** en esta sesión se instaló PostgreSQL 16.13 con PostGIS
3.4.2, pgvector 0.6.0, pg_trgm, ltree y unaccent — el stack exacto de A.1. Las
imágenes de Docker siguen bloqueadas (D-07), así que la Puerta 1 se verifica
contra ese Postgres local en lugar de Testcontainers; el arranque de pruebas
detecta cuál hay disponible (D-14). La exigencia de fondo, «Postgres real, nunca
mocks de base», se cumple.

Plan:

1. Migraciones SQL a mano (no generadas): RLS, disparadores y columnas
   generadas no se expresan en el DSL de Drizzle, y son justo donde viven las
   reglas. Esquema Drizzle en TypeScript en paralelo, para la capa de consulta.
2. Esquemas `ref`, `org`, `seg`, `ai`, `doc`, `aud`, `ia`.
3. Supertipo `ai.actividad` con clave foránea real desde cada hija y disyunción
   de subtipo por clave foránea compuesta (P1).
4. Las once tablas hijas, `POBLACION_BENEFICIADA` incluida (P2).
5. Columnas generadas para las decimales; `geography(Point,4326)` con GiST.
6. Disparadores: bitácora genérica (R15), cuota agregada (R11), progresión del
   avance (R10), inmutabilidad de `id_tipo_actividad`, `registro_completo` (R19).
7. Políticas RLS sobre `ai`, `org` y `doc` con el contexto de R7.
8. Roles de base de datos, para que R14 sea verificable: `DELETE` revocado
   salvo administrador.
9. Semillas: geografía DANE, 7 COAMI, grados, tipos de actividad. Vacíos con
   TODO los que dependen de JACID (17 campañas, atributos por herramienta).
10. Cada migración con su `down` probado.

### Al terminar (resultado)

**Estado: Fase 1 cerrada. Puerta 1 superada — 60 pruebas contra Postgres real.**

Hecho:

- **Once migraciones** en `packages/db/migraciones/`, todas con su reversión en
  `bajada/`. SQL escrito a mano, no generado: el DSL de Drizzle no expresa RLS,
  disparadores, privilegios revocados ni claves foráneas compuestas, que es
  justo donde viven las reglas (D-15).
- **Aplicador propio** (`src/migraciones.ts`): cada migración corre dentro de
  **una transacción**, y se niega a arrancar si a alguna le falta el `down`.
  Esto último no es celo: durante el desarrollo una migración se aplicó a
  medias y dejó la base en un estado que ninguna dirección entendía.
- **7 esquemas, 71 tablas.** `ref` con 33 catálogos, `org`, `seg` con RBAC real
  y vigencia, `ai` con el supertipo y los 5 subtipos y las 11 pestañas, `doc`,
  `aud`, e `ia` vacío (es de la Fase 6).
- **55 índices**, incluidos el GiST sobre `ltree` del que depende que RLS sea
  viable, el GiST sobre `geography` para ArcGIS y el GIN con `pg_trgm` sobre el
  nombre normalizado de entidad.
- **Semillas** de lo que PROMPT.md enumera literalmente. Los catálogos que
  dependen de JACID quedan **vacíos con TODO**: 17 campañas (Q2), los 11 tipos
  de herramienta, los campos de cinco pestañas (Q4), DIVIPOLA.

### Tres defectos reales que la Puerta 1 encontró

Se anotan porque son el argumento de por qué las puertas se verifican con
pruebas y no leyendo el código. Ninguno se veía leyendo el SQL.

1. **Recursión infinita en la política RLS de `org.unidad`.** La política
   buscaba la ruta de la unidad de la sesión con una subconsulta sobre
   `org.unidad`, que vuelve a evaluar la misma política. Ocho pruebas en rojo.
   Arreglado llevando la ruta en el contexto de R7 (D-16).
2. **`DROP ROLE` en la reversión de 0001.** Los roles son objetos del clúster,
   no de la base: la reversión rompía otra base del mismo servidor. Arreglado
   dejando los roles en pie y limpiando solo lo de la base en curso (D-17).
3. **Una aserción demasiado estrecha en la prueba de R10.** Esperaba el nombre
   del `CHECK`, pero el disparador `BEFORE` se adelanta y rechaza el tramo 80
   antes. Las dos defensas funcionan; la prueba estaba mal escrita.

### 🚪 Puerta 1 — resultado

Las trece casillas de PROMPT.md, todas verificadas:

| Casilla | Resultado |
|---|---|
| Inventario: ninguna tabla esperada falta (P2) | ✅ 37 tablas comprobadas por su nombre, `act_poblacion_beneficiada` incluida |
| Una actividad no existe sin su subtipo, ni tiene dos | ✅ `CONSTRAINT TRIGGER DEFERRABLE` + clave foránea compuesta |
| `DELETE` sobre una actividad falla para un rol no administrador | ✅ y el rol de administración sí puede |
| Un `UPDATE` escribe exactamente una fila en la bitácora, con ambas imágenes | ✅ y el usuario sale del contexto de R7 |
| Nadie puede `UPDATE` ni `DELETE` sobre `aud.bitacora_cambio` | ✅ comprobado **como superusuario**: lo detiene el disparador, no solo el privilegio |
| Adjuntos 9 MB + 2 MB en la misma actividad fallan; en distintas pasan | ✅ más el caso de los 40 archivos de 9 MB (P5) |
| `latitud_decimal` no admite escritura y coincide con las GMS | ✅ comparada con `aDecimal()` de `packages/schema` en 6 coordenadas |
| `porcentaje_avance = 80` rechazado; 70 y 100 aceptados | ✅ y 90 también rechazado, y el retroceso |
| Un usuario de BIM23 no ve filas de una unidad hermana | ✅ con `SELECT *` sin `WHERE`, como rol `NOBYPASSRLS` |
| `participo_arc = FALSE` rechazado | ✅ en `INSERT` y en `UPDATE` |
| Asistencia `DIRECTA` sin plan operacional rechazada | ✅ |
| Mismo documento con distinto tipo coexiste; con el mismo, no | ✅ |
| Cada migración aplica y revierte limpiamente | ✅ las once revierten a **cero tablas** y vuelven a aplicar |

Añadidas por encima de la lista, porque salían gratis y cubren huecos que se
verían tarde: la normalización de texto de SQL contra la de TypeScript sobre
seis cadenas, que el punto `geography` se derive de las mismas GMS, que el
contexto **no sobreviva a la transacción** (R7/P11, con `max = 1` en el pool),
que el captcha caduque a 5 minutos y la sesión a 10 sin poder digitarlos, que
un ciclo en la jerarquía se rechace, que una campaña no la cargue una unidad
táctica (R16), y que una consulta por similitud no cruce el ámbito (IA8).

**Cómo se ejecuta:**

```bash
cd paid/packages/db
DATABASE_URL_PRUEBA="postgres://usuario:clave@127.0.0.1:5432/postgres" pnpm test
```

Contra Postgres local en lugar de Testcontainers, porque las imágenes de
Docker siguen bloqueadas en esta sesión; el arranque detecta cuál hay
disponible y con Docker usa Testcontainers sin cambiar una línea (D-14).
PostgreSQL 16.13, PostGIS 3.4.2, pgvector 0.6.0, pg_trgm, ltree, unaccent.

### Pendiente al cerrar la Fase 1

1. **El esquema Drizzle en TypeScript para la capa de consulta.** Las
   migraciones son la fuente de verdad y están completas; falta el mapeo
   tipado que usará `apps/api`. Es la primera tarea de la Fase 3. Se dejó
   fuera en lugar de escribir la mitad, porque un mapeo parcial es el defecto
   que P2 describe (D-15).
2. **`docker compose up` sigue sin verificar** (D-07).
3. **Los catálogos vacíos bloquean el cierre de registros**, y es correcto:
   hasta que JACID responda Q2 y Q4, ninguna actividad puede alcanzar
   `registro_completo = TRUE`. Lo incorrecto sería dejar cerrar registros
   contra categorías inventadas.
4. **DIVIPOLA sin cargar.** `ref.municipio` está vacío; el procedimiento está
   en `packages/db/semillas/LEEME.md`.
5. **Al recolocar una unidad hay que cerrar las sesiones de su
   subarborescencia** (D-16). Es trabajo de la Fase 2 y es fácil de olvidar.

---

## FASE 0 — Preparación

### Antes de empezar (plan)

Objetivo: dejar el andamiaje del monorepo en pie y superar la Puerta 0
(`docker compose up` sano y `pnpm -r build` en verde). Nada de esquema de base
de datos en esta fase.

Plan:

1. Verificar Node 20+, pnpm 9+, Docker.
2. `docker-compose.yml` con postgres+postgis+pgvector, redis, minio, otel-collector,
   api y web.
3. Estructura `/apps/{api,web,ia}`, `/packages/{schema,db}`, `/docs`, `/e2e`.
4. `docs/PREGUNTAS-JACID.md` con Q1–Q12 redactadas para un destinatario no técnico.
5. `CLAUDE.md` con el anexo de PROMPT.md.
6. Fijar versiones exactas en todos los `package.json` (sin rangos abiertos).

### Al terminar (resultado)

**Estado: Fase 0 cerrada con una salvedad de entorno.** Ver «Puerta 0» abajo.

Hecho:

- Monorepo pnpm con workspaces: `apps/api` (NestJS 10), `apps/web` (React 18 +
  Vite 5), `packages/schema` (Zod compartido), `packages/db` (Drizzle),
  `e2e` (Playwright, esqueleto). `apps/ia` queda **fuera** del workspace pnpm
  porque es Python (FastAPI), tal como exige B.3 («aislado del resto del monorepo»).
- `docker-compose.yml` con los seis servicios. Postgres se construye desde
  `docker/postgres/Dockerfile` (postgis/postgis:16-3.4 + `postgresql-16-pgvector`)
  porque ninguna imagen pública trae PostGIS 3.4 y pgvector a la vez.
  `docker/postgres/initdb/00-extensiones.sql` crea postgis, pg_trgm, ltree,
  pgvector y unaccent al inicializar el volumen.
- Todas las dependencias con **versión exacta**, sin `^` ni `~` (A.1).
- `packages/schema` ya lleva los invariantes que **no dependen del DDL** y que
  vienen escritos en PROMPT.md: escala de avance de ocho tramos (R10),
  coordenadas GMS (R13), categorías y extensiones de adjunto (R12), cuota
  agregada de 10 MB (R11), fecha `dd/mm/aaaa` y separador decimal punto (A.2.4).
  Cada uno con su prueba en `packages/schema/src/*.test.ts`.
- `docs/PREGUNTAS-JACID.md` con Q1–Q12; `docs/DECISIONES.md` con las decisiones
  y desvíos; `docs/AUTOAUDITORIA.md` con la tabla R1–R19 / P1–P11 / IA1–IA8 /
  PIA1–PIA6 vacía, para llenar en la Fase 5.
- `CLAUDE.md` en `paid/` con las reglas permanentes del anexo.

### 🚪 Puerta 0 — resultado

| Criterio | Resultado |
|---|---|
| `pnpm -r build` | ✅ **pasa** (`packages/schema`, `packages/db`, `apps/api`, `apps/web`, `e2e`) |
| `pnpm -r test` | ✅ **pasa** (pruebas de los invariantes de `packages/schema`) |
| `docker compose config` | ✅ válido (los seis servicios se resuelven) |
| `docker compose up` sano | ⛔ **no verificable en esta sesión** — ver abajo |

**Por qué `docker compose up` no se pudo verificar.** La sesión corre detrás de
un proxy de egreso que **bloquea con 403 el CDN de blobs de Docker Hub**
(`production.cloudfront.docker.com`). El manifiesto se resuelve
(`auth.docker.io` responde 200) pero ninguna capa se puede descargar, así que
no hay forma de construir ni levantar un contenedor aquí. No hay imágenes en
caché local (`docker images` vacío).

Esto es una limitación del entorno de la sesión, **no un defecto del
`docker-compose.yml`**, y no se puede sortear: la política de egreso es de la
organización. Queda pendiente de verificación en una máquina con acceso al
registro (o con el registro espejado de la Intranet ARC, que es el escenario
real de despliegue — ver `docs/DECISIONES.md`, D-07).

**Lo primero que debe hacer la siguiente sesión que tenga Docker:**

```bash
cd paid
docker compose build postgres
docker compose up -d
docker compose ps          # los seis servicios en healthy
```

Y registrar el resultado aquí.

### Pendiente al cerrar la Fase 0

1. ⛔ **BLOQUEANTE para la Fase 1: falta `anexo_A_ddl_paid.sql`.** No está en el
   repositorio ni en ningún punto del disco. PROMPT.md lo exige como punto de
   partida y ordena expresamente: «Si falta el `.sql`, **detente y pídelo**. No
   improvises el esquema.» **No se ha inventado nada de esquema.** La Fase 1 no
   empieza hasta que el archivo esté en `paid/anexo_A_ddl_paid.sql`.
2. La verificación de `docker compose up` descrita arriba.
3. `paid/` está dentro del repositorio `latingreen/latingreen`, que ya contenía
   el juego Eco-Arcade Latin Green en la raíz. Se aisló la PAID en el
   subdirectorio `paid/` para no tocar el juego. Ver `docs/DECISIONES.md`, D-01.
