# Decisiones

Registro de decisiones de diseño y de los desvíos respecto de `PROMPT.md`, con
su motivo. Una decisión sin motivo escrito es una decisión que la siguiente
sesión va a deshacer sin saberlo.

Formato: `D-nn · título · estado · fecha`.

---

## D-01 · La PAID vive en `paid/`, no en la raíz del repositorio · Aceptada · 2026-09-15

**Contexto.** `PROMPT.md` dice: «Guárdalo como `PROMPT.md` en la raíz de un
repositorio vacío». El repositorio `latingreen/latingreen` **no estaba vacío**:
contenía el juego Eco-Arcade Latin Green (`index.html`, `assets/`,
`build-single-file.mjs`, su propio `README.md` y su `.gitignore`).

**Decisión.** Todo el monorepo de la PAID se creó bajo `paid/`. No se movió, ni
se renombró, ni se borró nada del juego.

**Motivo.** Poner la PAID en la raíz habría exigido sobrescribir `README.md` y
`.gitignore` y habría dejado el `index.html` del juego en medio de un monorepo
pnpm. Borrar el trabajo de otra persona para cumplir una precondición del
documento no es una decisión que corresponda tomar sin preguntar.

**Reversible.** Mover la PAID a la raíz es un `git mv` de una sola vez, y la
estructura interna (`apps/`, `packages/`, `docs/`, `CLAUDE.md`) ya es la que
`PROMPT.md` describe. Si JACID prefiere un repositorio dedicado, `paid/` se
extrae tal cual.

---

## D-02 · Zod 4, no Zod 3 · Aceptada · 2026-09-15

**Contexto.** `PROMPT.md` fija «React Hook Form + Zod» sin precisar versión
mayor.

**Decisión.** Zod `4.6.5`.

**Motivo.** Zod 4 trae `z.toJSONSchema()` en el núcleo. La regla **IA2** exige
decodificación restringida «contra el esquema JSON de destino, **derivado del
mismo Zod** que valida el formulario». Con Zod 3 eso obliga a una dependencia
adicional (`zod-to-json-schema`) que puede derivar un esquema que no coincida
exactamente con el que valida. Con Zod 4 la derivación es de la propia
biblioteca, así que el esquema que restringe al modelo y el que valida el
formulario no pueden divergir.

`@hookform/resolvers` 5.x soporta Zod 4, así que no hay coste en el formulario.

---

## D-03 · `apps/ia` fuera del workspace de pnpm · Aceptada · 2026-09-15

`PROMPT.md` B.3 pide el servicio de IA «aislado del resto del monorepo». Es
Python, así que no figura en `pnpm-workspace.yaml`: `pnpm -r build` no lo toca y
`pnpm install` no lo necesita. Se construye y se prueba con sus propias
herramientas (`pip`, `pytest`, `ruff`, `mypy`).

**Consecuencia buscada:** no hay forma de que la Parte A dependa por accidente
de que la Parte B esté instalada.

---

## D-04 · El servicio `ia` de docker compose va bajo perfil · Aceptada · 2026-09-15

`docker compose up` levanta seis servicios y **no** levanta `ia`. Para la IA hay
que pedirla: `docker compose --profile ia up`.

**Motivo.** La Puerta 5 exige que la Parte A funcione completa «sin ningún
componente de IA desplegado». Si la IA arrancara por omisión, esa puerta se
verificaría con la IA encendida y no probaría nada. Que el camino por omisión
sea el camino sin IA convierte la regla en el comportamiento por defecto en vez
de en una nota en un documento.

Además, la red `sin-salida` del servicio `ia` es `internal: true`: **IA7 (sin
salida de datos) queda impuesta por configuración de red, no por convención de
código**, que es exactamente lo que la regla pide («Verifícalo en el
despliegue»).

---

## D-05 · Postgres se construye, no se toma de una imagen pública · Aceptada · 2026-09-15

`A.1` exige PostgreSQL 16 + PostGIS 3.4 + pg_trgm + ltree + pgvector. Ninguna
imagen pública trae PostGIS y pgvector a la vez: `postgis/postgis` no lleva
pgvector y `pgvector/pgvector` no lleva PostGIS. De ahí
`docker/postgres/Dockerfile`, que parte de `postgis/postgis:16-3.4` e instala
`postgresql-16-pgvector` del repositorio PGDG que la imagen base ya tiene
configurado. pg_trgm y ltree vienen en contrib.

---

## D-06 · Usuario de aplicación distinto del superusuario · Aceptada · 2026-09-15

`docker/postgres/initdb/01-usuario-aplicacion.sh` crea `paid_app` con
`NOSUPERUSER NOBYPASSRLS`.

**Motivo.** Sin esto, dos reglas se vuelven inverificables:

- **R6** (aislamiento por unidad con RLS): un superusuario ignora las políticas
  RLS por definición. Si la aplicación se conectara como superusuario, el test
  «un usuario de BIM23 no ve filas de una unidad hermana» **pasaría en falso**.
- **R14** (borrado solo lógico): el privilegio `DELETE` se revoca salvo para el
  rol administrador. Con un solo superusuario no hay nada que revocar.

---

## D-07 · `docker compose up` no verificado en la sesión de la Fase 0 · Abierta · 2026-09-15

La sesión que construyó la Fase 0 corría detrás de un proxy de egreso que
**bloquea con 403 el CDN de blobs de Docker Hub**
(`production.cloudfront.docker.com`). El manifiesto se resuelve pero ninguna capa
se descarga, y no había imágenes en caché local.

`docker compose config` valida los seis servicios, así que el archivo es
correcto; lo que no se pudo comprobar es que los contenedores lleguen a
`healthy`. Queda pendiente y es lo primero que debe hacer la siguiente sesión
con acceso a un registro. Ver `docs/BITACORA.md`, Puerta 0.

**Nota para el despliegue real:** el escenario de producción es el mismo
problema con otra causa. La Intranet ARC no tiene salida a internet, así que las
imágenes tendrán que venir de un registro espejado interno o transportadas como
`docker save`/`docker load`. Conviene resolverlo pronto, porque condiciona el
procedimiento de despliegue completo.

---

## D-08 · Versiones exactas, y por qué algunas no son las últimas · Aceptada · 2026-09-15

`A.1` ordena fijar las versiones mayores y no usar rangos abiertos. Se fue más
allá: **ninguna dependencia lleva `^` ni `~`**, y `.npmrc` tiene
`save-exact=true` para que no vuelvan a aparecer.

Varias quedan deliberadamente por detrás de la última publicada, porque
`PROMPT.md` fija la mayor:

| Paquete | Fijado | Última | Motivo |
|---|---|---|---|
| `typescript` | 5.9.3 | 7.0.2 | A.1 dice «TypeScript 5.x» |
| `@nestjs/*` | 10.4.22 | 12.0.2 | A.1 dice «NestJS 10» |
| `react`, `react-dom` | 18.3.1 | 19.3.0 | A.1 dice «React 18» |
| `vite` | 5.4.21 | 8.3.0 | A.1 dice «Vite 5» |
| `maplibre-gl` | 4.7.1 | 6.9.1 | A.1 dice «MapLibre GL 4» |

**`nestjs-pino` 4.6.1 y no 5.2.0:** la 5.x exige NestJS 11 o 12 como peer. Con
NestJS 10 fijado por A.1, la 4.6.1 es la última compatible. Es un desvío de
«usa la última» que viene impuesto por el stack fijado, no una preferencia.

**Desvíos del entorno, no del código:** la sesión tenía Node 22.22 y pnpm 10.33,
mientras `A.1` dice Node 20 LTS y pnpm 9. Las imágenes de Docker usan
`node:20-bookworm-slim`, que es lo que llega al despliegue. En `package.json`,
`engines` admite `node >=20` y `pnpm >=9` en lugar de clavar una mayor, para no
romper la instalación en máquinas de desarrollo que ya tienen versiones más
nuevas. Si JACID quiere clavarlo, se añade `packageManager` con la versión
exacta y se activa Corepack.

---

## D-09 · `apps/web` consume `@paid/schema` desde el código fuente · Aceptada · 2026-09-15

`@paid/schema` compila a CommonJS porque `apps/api` (NestJS) lo consume así.
Rollup no puede leer los nombres exportados a través del `export *` que
TypeScript emite en CommonJS, de modo que `vite build` fallaba con
«"TRAMOS_AVANCE" is not exported».

**Decisión.** `vite.config.ts` resuelve `@paid/schema` a
`packages/schema/src/index.ts` y lo compila Vite en la misma pasada.

**Alternativa descartada:** compilación doble (CJS + ESM) del paquete. Habría
duplicado la salida y con ella el riesgo de que las dos versiones divergieran,
que es precisamente lo que A.6 quiere evitar («Si divergen, hay un error de
diseño»). El alias apunta al mismo archivo del que `tsc` saca los tipos, así que
la interfaz y el servidor validan con el mismo código, no con dos copias.

---

## D-10 · `esbuild` es la única dependencia con script de instalación habilitado · Aceptada · 2026-09-15

pnpm 10 no ejecuta scripts de instalación salvo declaración expresa.
`pnpm-workspace.yaml` habilita **solo** `esbuild`, cuyo script coloca el binario
nativo de la plataforma (sin él `vite build` no arranca). Es una dependencia de
compilación: no llega al despliegue.

**No** se habilitó `@nestjs/core`, cuyo `postinstall` solo imprime un mensaje de
patrocinio y hace una petición de red que en la Intranet ARC fallaría.

---

## D-11 · La normalización de texto se define una vez, en TypeScript · Aceptada · 2026-09-15

`normalizarTexto()` en `packages/schema/src/primitivos.ts` es la definición
canónica (sin tildes, espacios colapsados, mayúsculas).

**Deuda declarada.** La Fase 1 necesita una función SQL equivalente para el
índice GIN con `pg_trgm` sobre el nombre de entidad. Las dos **tienen que
producir exactamente el mismo resultado**: si divergen, el índice y la
comparación del cliente discrepan y aparecen duplicados que la interfaz dijo que
no existían. Está anotado en el propio archivo y debe cubrirse con una prueba en
la Puerta 1 que compare ambas salidas sobre el mismo conjunto de cadenas.

---

## D-12 · La caja de Colombia avisa, no bloquea · Aceptada · 2026-09-15

`estaEnColombia()` comprueba si un punto cae en la caja envolvente del
territorio nacional, pero `coordenadaGms` **no** la impone.

**Motivo.** Una coordenada fuera de Colombia puede ser legítima (comisión en el
exterior, ejercicio binacional) y bloquearla impediría registrar una actividad
real. Pero un dedazo en los grados tampoco debe pasar inadvertido, y P6 advierte
que «un punto equivocado es peor que uno ausente: parece plausible». De ahí el
aviso en la interfaz sin rechazo en la validación.

---

## D-13 · Esquema derivado de PROMPT.md ante la ausencia del DDL · **Desvío autorizado** · 2026-09-15

**Contexto.** `anexo_A_ddl_paid.sql` no existe. Se detuvo la Fase 1 y se
preguntó, como `PROMPT.md` ordena. La respuesta fue que **el archivo no existe**
y que se autoriza expresamente derivar el esquema de `PROMPT.md`.

**Decisión.** La Fase 1 construye el esquema a partir de las reglas R1–R19 y de
los anti-patrones P1–P11, que es la única fuente disponible. **Cada objeto queda
marcado como derivado**, no como verificado.

**Lo que este desvío cambia, y conviene tener presente:**

1. **`PROMPT.md` habla de «los 26 catálogos de `ref`».** Ese número sale del DDL
   ausente. Los catálogos implementados son los que las reglas exigen; el
   recuento puede no coincidir, y el test de inventario comprueba los que
   declaramos, no los 26 del documento original. Es una diferencia real, no un
   detalle de redacción: si el DDL traía catálogos que ninguna regla nombra,
   aquí faltan.
2. **Los nombres de columna son los nuestros.** Cuando aparezca el DDL habrá que
   reconciliar, y un renombrado en una base con datos no es gratis.
3. **Lo que ninguna regla menciona, no está.** No se inventaron campos
   «razonables» para rellenar huecos.

**Marcado.** Todo objeto derivado lleva un comentario `TODO(JACID)` en la
migración y un `COMMENT ON` en la base, de forma que
`SELECT obj_description(...)` liste lo que está pendiente de confirmar sin
abrir el repositorio.

**Consecuencia para las Q abiertas.** Los catálogos que dependen de JACID
—las 17 campañas (Q2), los atributos por tipo de herramienta (Q3), los campos de
las cinco pestañas (Q4)— se siembran **vacíos**. Autorizar derivar el esquema no
autoriza inventar sus contenidos: una tabla vacía se llena; diecisiete nombres
inventados de campaña contaminan el consolidado del RAO y nadie sabrá qué fila
era real.

---

## D-14 · Puerta 1 contra Postgres local, no Testcontainers · Aceptada · 2026-09-15

`PROMPT.md` pide Testcontainers con «Postgres real, nunca mocks de base». El
proxy de egreso de la sesión bloquea el CDN de imágenes de Docker Hub (D-07),
así que Testcontainers no puede arrancar nada.

**Decisión.** El arranque de las pruebas (`packages/db/src/pruebas/entorno.ts`)
usa Testcontainers **si puede**, y si no, se conecta a un Postgres externo por
`DATABASE_URL_PRUEBA`. En esta sesión se instaló PostgreSQL 16.13 con PostGIS
3.4.2, pgvector 0.6.0, pg_trgm, ltree y unaccent — el stack exacto de A.1 — y
las pruebas corren contra él.

**Por qué es equivalente en lo que importa.** La exigencia de fondo es «Postgres
real, nunca mocks de base», y se cumple: las políticas RLS, los disparadores,
las columnas generadas y los privilegios revocados se ejercitan contra un motor
de verdad. Lo que se pierde es el aislamiento por prueba que da un contenedor
desechable, y se compensa recreando la base en cada ejecución.

**Cuando haya registro de imágenes**, el mismo código usa Testcontainers sin
cambios: por eso la detección es en tiempo de ejecución y no una bifurcación
que alguien tenga que recordar deshacer.

---

## D-15 · Migraciones en SQL escrito a mano, no generadas por Drizzle · Aceptada · 2026-09-15

**Contexto.** `PROMPT.md` (Fase 1, punto 1) dice «traduce
`anexo_A_ddl_paid.sql` a migraciones de Drizzle», y A.1 fija Drizzle como ORM.

**Decisión.** Las once migraciones son SQL escrito a mano en
`packages/db/migraciones/`, con su reversión en `bajada/`. Drizzle se mantiene
como ORM para la capa de consulta de la Fase 3.

**Motivo.** Las reglas de la PAID no se pueden expresar en el DSL de Drizzle:

| Regla | ¿Se expresa en el DSL? |
|---|---|
| R6 — políticas RLS sobre `ltree` | no |
| R15 — bitácora por disparador | no |
| R11 — cuota agregada por disparador | no |
| R10 — progresión del avance por disparador | no |
| R14 — `REVOKE DELETE` por rol | no |
| R13 — `GENERATED ALWAYS` con `geography` | parcialmente |
| P1 — clave foránea compuesta + `CONSTRAINT TRIGGER DEFERRABLE` | parcialmente |

Generar el 60 % del esquema con `drizzle-kit` y añadir el 40 % restante en SQL
suelto deja **dos fuentes de verdad que se desincronizan**: la próxima
ejecución de `drizzle-kit generate` no conoce los disparadores ni las
políticas, y propone borrarlos. Una sola fuente, en el idioma en el que las
reglas se escriben enteras, es más segura.

**Salvaguarda.** `pnpm db:generate` está deshabilitado a propósito y falla con
un mensaje que remite aquí, para que nadie regenere por costumbre SQL que
ninguna herramienta puede reproducir. `drizzle.config.ts` se conserva para
`introspect` y comparación, que sí son útiles.

**Pendiente reconocido.** El esquema Drizzle en TypeScript para la capa de
consulta **no está**. Es la primera tarea de la Fase 3. Se dejó fuera en lugar
de escribir la mitad: un mapeo parcial es exactamente el defecto que P2
describe.

---

## D-16 · La ruta jerárquica de la unidad viaja en el contexto de sesión · Aceptada · 2026-09-15

**Contexto.** La política RLS de `org.unidad` necesita la `ruta_jerarquica` de
la unidad de la sesión para comparar con `<@`. La primera versión la buscaba
con una subconsulta sobre `org.unidad`.

**Lo que pasó.** PostgreSQL abortó con `infinite recursion detected in policy
for relation "unidad"`: la subconsulta vuelve a evaluar la misma política. Lo
detectó la Puerta 1 — ocho pruebas en rojo —, no una lectura del código.

**Decisión.** El contexto de R7 lleva una clave más, `app.ruta_unidad`, y la
política compara contra `seg.ruta_unidad_actual()`, que la lee del contexto.

**Alternativas descartadas:**

1. **Función `SECURITY DEFINER` que salte RLS.** Funciona, pero solo si su
   dueño es superusuario: con `FORCE ROW LEVEL SECURITY` activo, el dueño de la
   tabla también queda sujeto a las políticas. Ataría la corrección del
   aislamiento entre unidades a *quién ejecutó las migraciones*, que es una
   dependencia implícita y frágil.
2. **Desnormalizar la ruta en cada tabla.** Es P10.

**Riesgo asumido y su mitigación.** `app.id_unidad` y `app.ruta_unidad` tienen
que ser coherentes. Las dos salen de la misma fila de `seg.sesion` al abrirla,
así que no hay dos caminos por los que puedan discrepar. Si una unidad se mueve
en la jerarquía, las sesiones abiertas conservan la ruta anterior hasta
renovarse: la Fase 2 debe cerrar las sesiones de la subarborescencia afectada
al recolocar una unidad. Queda anotado aquí porque es fácil de olvidar.

**No añade superficie de ataque.** Quien pudiera falsificar esta clave podría
falsificar igualmente `app.id_unidad`. El contexto lo fija el servidor con
`SET LOCAL` a partir de `seg.sesion`, nunca el cliente.

---

## D-17 · La reversión de 0001 no elimina los roles de PostgreSQL · Aceptada · 2026-09-15

Un rol de PostgreSQL es un objeto del **clúster**; una migración es por **base
de datos**. La primera versión de `bajada/0001` hacía `DROP ROLE`, y la Puerta
1 falló con `role "paid_administracion" cannot be dropped because some objects
depend on it` — porque otra base del mismo clúster les había concedido
privilegios.

Eliminar los roles desde aquí rompería esa otra base. La reversión hace
`DROP OWNED BY` (que solo alcanza la base en curso) y deja los roles en pie.
Es la semántica correcta: la migración limpia lo que le corresponde.

---

## D-18 · Las pruebas de `apps/api` se transforman con SWC, no con esbuild · Aceptada · 2026-09-15

**Contexto.** Al escribir la Puerta 2, todas las peticiones devolvían 500 con
`Cannot read properties of undefined (reading 'getAllAndOverride')`.

**Causa.** NestJS resuelve sus dependencias leyendo `design:paramtypes`, la
metadata que TypeScript emite con `emitDecoratorMetadata`. **esbuild —el
transformador que Vitest usa por omisión— no la emite.** La aplicación
arrancaba con todos los constructores vacíos.

`tsc` sí la emite, así que la compilación y el despliegue nunca estuvieron
afectados: era exclusivamente el camino de las pruebas. Eso lo hace peor, no
mejor: un fallo que solo aparece en pruebas invita a «arreglar la prueba».

**Decisión.** `apps/api/vitest.config.ts` usa `unplugin-swc`, que sí emite la
metadata y es el transformador que la documentación de NestJS recomienda para
Vitest.

---

## D-19 · `consistent-type-imports` desactivado en `apps/api` · Aceptada · 2026-09-15

La regla marca diez archivos de `apps/api`, y **aplicar su autocorrección
rompería la aplicación en ejecución.**

La metadata `design:paramtypes` es una referencia al **valor** de la clase. Si
el import se convierte en `import type`, TypeScript lo elimina del JavaScript
emitido, la metadata queda apuntando a `undefined` y la inyección falla.

La regla no puede distinguir «este tipo solo se usa como tipo» de «este tipo se
usa como tipo y NestJS necesita su valor», así que marca precisamente los
archivos donde aplicarla rompe todo. Con `--fix`, los rompe los diez de una
vez, y el síntoma aparece lejos del cambio.

Se desactiva solo para `apps/api`, con el motivo escrito en
`eslint.config.mjs`. El resto del monorepo la conserva.

---

## D-20 · `seg.unidad_para_ingreso`, la única lectura sin contexto · Aceptada · 2026-09-15

**El problema.** El ingreso necesita la `ruta_jerarquica` de la unidad del
usuario para poder fijar el contexto de R7. Esa ruta está en `org.unidad`, que
tiene RLS forzada comparando contra… el contexto. Que aún no existe, porque se
está construyendo. El ingreso fallaba con «la unidad no existe»: RLS devolvía
cero filas, correctamente.

**Decisión.** Una función `SECURITY DEFINER` que devuelve **una** unidad por su
identificador y **solo tres campos**: sigla, nombre y ruta.

**Por qué aquí sí y en las políticas de 0010 no** (donde se rechazó el mismo
mecanismo, D-16):

1. **Expone lo mínimo.** Tres campos de una fila que el usuario que está
   entrando tiene derecho a conocer: es su propia unidad.
2. **Falla hacia el lado seguro.** Si el dueño de la función no tuviera
   privilegio suficiente, el ingreso falla de forma visible. En 0010 el mismo
   mecanismo habría fallado hacia «se ve todo», que es silencioso.
3. `search_path` se fija en la propia función, así que no se puede secuestrar
   creando objetos homónimos en otro esquema.
4. `REVOKE ALL ... FROM PUBLIC` y `GRANT EXECUTE` solo a los tres roles de la
   aplicación.

**Regla que acompaña la decisión:** esta función **no debe crecer**. Si alguien
necesita consultar `org.unidad` de otra forma, es que su consulta va dentro de
una transacción con contexto, y entonces RLS ya le responde.

Alternativas descartadas: una política que abra todo cuando no hay contexto
(convierte un olvido en fuga total), guardar la ruta en `seg.usuario`
(desnormaliza la jerarquía, P10, y queda obsoleta al recolocar), y conectar la
API con un rol que salte RLS (anula R6, y es el defecto que la Puerta 2
detectó).

---

## D-21 · `ai.alianza` — hueco de la Fase 1 cerrado en la Fase 2 · Aceptada · 2026-09-15

R16 dice que «el porcentaje de avance de un convenio solo lo diligencia JACID»
y que «las unidades hasta nivel Fuerza solo concretan alianzas; los convenios
son de JACID». La Fase 1 no creó ninguna tabla donde eso viviera: el permiso
`ALIANZA.AVANCE` no tenía sobre qué actuar, y R16 quedaba a medias.

La migración 0012 añade `ai.alianza`. No es una actividad —no cuelga de
`ai.actividad` ni tiene las once pestañas—: es un acuerdo con una entidad.

R16 se impone en **tres capas**: el permiso, un disparador que exige que el
avance solo exista en un `CONVENIO`, y la prohibición de que retroceda. Tres
para una regla que el manual expresa en una línea, porque es la clase de dato
que acaba en una rendición de cuentas.

**Pregunta abierta nueva: Q13.** No se sabe si el avance de un convenio sigue
la escala de ocho tramos de R10 o es un porcentaje libre. R10 habla
expresamente de «proyectos sociales», así que aplicarle la escala sería una
suposición. Se admite 0–100 y se pregunta: si resulta que sigue la escala, el
`CHECK` se aprieta, que es una migración trivial. Al contrario —haber apretado
y tener que abrir— habría rechazado datos legítimos durante meses.

---

## D-22 · El almacén de objetos es una interfaz con dos implementaciones · Aceptada · 2026-09-15

**Contexto.** A.1 fija MinIO, desplegado dentro de la intranet. `dl.min.io` y
el registro de imágenes de Docker están bloqueados por la política de egreso de
esta sesión, así que no fue posible levantar un MinIO contra el que probar.

**Decisión.** `AlmacenObjetos` es una interfaz con dos implementaciones:
`AlmacenMinio` (despliegue) y `AlmacenSistemaArchivos` (desarrollo y pruebas).
`PAID_ALMACEN` elige; el valor por omisión es el sistema de archivos.

**Por qué no relaja ninguna regla.** Las reglas de los adjuntos —la cuota
AGREGADA de 10 MB (R11) y la validación del MIME real (R12)— se imponen en
`AdjuntosService` y en el disparador de la base, **antes de que el almacén vea
un solo byte**. El almacén solo guarda y devuelve. De modo que R11 y R12 se
verifican igual con cualquiera de las dos, y eso es justo lo que permite
probarlas de verdad sin un MinIO a mano.

**Lo que sí queda sin verificar:** que `AlmacenMinio` funcione. El código está
escrito y compila; no se ha ejecutado. Es la misma clase de pendiente que
`docker compose up` (D-07), y está marcada como tal en el propio archivo.
Primera comprobación en un entorno con acceso:

```bash
docker compose up -d minio
PAID_ALMACEN=minio pnpm --filter @paid/api test
```

**Salvaguarda añadida:** en `NODE_ENV=production` con el almacén de archivos se
avisa de forma llamativa. Los soportes de una actividad son parte del
expediente, y un almacén sin replicación ni retención no es dónde deben estar.

---

## D-23 · Las once pestañas se resuelven con un mapa, no con once servicios · Aceptada · 2026-09-15

`MAPA_PESTANAS` asocia cada pestaña con su tabla y sus columnas, y una sola
ruta (`POST /jornadas/:id/pestanas/:pestana`) las atiende todas.

**Motivo.** Las once tablas hijas son estructuralmente iguales: cuelgan de una
actividad, referencian un catálogo, y alguna lleva cantidades. Y sobre todo:
**Q4 sigue sin responder** para cinco de ellas. Cuando JACID entregue los
formularios reales, cambiar un mapa es cambiar una declaración; cambiar once
controladores es cambiar once archivos, y alguno se queda atrás. Es el mismo
argumento por el que `registro_completo` se calcula en un solo sitio.

**Lo que no se hizo, a propósito:** derivar el nombre de la columna del nombre
del campo con una conversión automática `camelCase` → `snake_case`. La
correspondencia se escribe a mano porque una conversión automática esconde un
error de nombre hasta que alguien mira los datos.

**Seguridad.** El SQL se compone desde el mapa —valores del código— y los
valores del usuario viajan siempre como parámetros vinculados. Un nombre de
pestaña que no esté en el mapa se rechaza antes de tocar la base.

---

## D-24 · `DELETE` sobre las filas de las once pestañas, sí; sobre los registros, no · Aceptada · 2026-09-15

**El problema de interpretación.** R14 revoca `DELETE` salvo para el
administrador, y exige una solicitud aprobada por JACID. Aplicado literalmente
a las once tablas hijas, un operador que añade por error una fila a «Bienes
Donados» tendría que elevar una solicitud a JACID para quitarla.

**La lectura que se adopta.** R14 protege **registros**: la actividad, el
personal, las entidades, las herramientas, las alianzas, las unidades, la
normatividad. Las filas de las pestañas son el **contenido de un formulario que
se está diligenciando**; quitar una fila recién añadida es editar, no eliminar
un registro. Además esas tablas no tienen `estado_registro`, así que no admiten
borrado lógico: o se pueden quitar, o el formulario no se puede corregir.

**Por qué es seguro.** R15 lo hace reversible: el disparador de bitácora guarda
la imagen anterior de cada fila borrada, con usuario, unidad, sesión e IP. No se
pierde nada y queda el rastro.

**Lo que sigue revocado**, donde R14 se aplica entera: `ai.actividad`, los cinco
subtipos, `ai.personal`, `ai.entidad`, `ai.herramienta_aid`, `ai.alianza`,
`org.unidad` y `doc.normatividad`. `ai.act_adjunto` tampoco entra: sí tiene
`estado_registro`, así que su camino es la baja lógica, que además libera cuota
sin destruir el binario.

**Queda como Q14.** Si JACID confirma que también las filas de pestaña exigen
solicitud, se revierte la migración 0014 y la interfaz debe ofrecer «solicitar
eliminación» en cada fila.

---

## D-25 · Un esquema Zod compartido tiene que ser idempotente · Aceptada · 2026-09-15

**El defecto.** El formulario de jornadas **no podía guardar por la interfaz**.
Se pulsaba «Guardar y continuar» y respondía «No se pudo registrar la jornada»,
sin decir qué campo.

`fechaDdMmAaaa` valida `dd/mm/aaaa` y **transforma** a `aaaa-mm-dd`. El
formulario validaba con ese esquema y enviaba el resultado de la validación, que
es lo normal. El controlador volvía a validar ese resultado con el **mismo**
esquema, y `2026-03-02` no es `dd/mm/aaaa`: rechazado.

**La regla que faltaba.** A.6 exige un solo esquema Zod para cliente y
servidor. La consecuencia que no es obvia: **ese esquema se ejecuta dos veces
sobre el mismo dato**. Un esquema que transforma y no admite su propia salida no
puede cumplir A.6 — la segunda pasada rechaza lo que la primera aceptó.

**La corrección.** `fechaDdMmAaaa` admite ahora las dos formas y normaliza a
`aaaa-mm-dd`, de modo que `parse(parse(x)) === parse(x)`.

No debilita A.2.4. Lo que A.2.4 evita es que una fecha **digitada** se lea al
revés: `03/05/2026` es el 3 de mayo o el 5 de marzo según el país. `2026-03-05`
no tiene esa ambigüedad —el año va delante— y `3/5/2026` sigue rechazado. La
interfaz sigue pidiendo y mostrando `dd/mm/aaaa`; lo que cambió es qué admite el
esquema por el cable.

**Lo que la fija.** `packages/schema/src/idempotencia.test.ts` comprueba la
propiedad sobre TODOS los esquemas que cruzan la red, incluidas las diez
pestañas recorridas desde `ESQUEMA_POR_PESTANA`. Quien añada una transformación
a un esquema compartido las verá fallar.

**Por qué ninguna prueba anterior lo vio.** Las 80 de las Puertas 2 y 3 hablan
con la API y envían `dd/mm/aaaa` directamente, como lo haría `curl`. El defecto
vivía exactamente en la costura entre el formulario y el controlador, que es lo
único que la Puerta 4 recorre. Dos pruebas existentes AFIRMABAN el
comportamiento incorrecto (`primitivos.test.ts` y `puerta3.test.ts`); las dos se
cambiaron con el motivo escrito al lado.

---

## D-26 · Las pestañas piden opciones, no identificadores · Aceptada · 2026-09-15

**El defecto.** Los paneles de las diez pestañas de datos se construyen a partir
del esquema Zod de cada una, y dibujaban **todos** los campos como entrada de
texto. El resultado era «Id tipo operacion: ____».

Imposible de diligenciar: ese identificador no aparece en ninguna pantalla. Y un
número inventado llega al servidor como violación de clave foránea.

**La corrección.** `CATALOGO_DE_CAMPO` dice qué catálogo de `ref` hay detrás de
cada `id*`, y `CAMPOS_DE_ENTIDAD` cuáles apuntan al maestro `ai.entidad`. Los
primeros se dibujan con `CampoSelector` y los segundos con `CampoEntidad`, que
además explica R8 cuando el maestro está vacío: «regístrela primero en Entidades
A.I.».

**El tipo lo decide el esquema, no el nombre del campo.** `cantidad` es un
entero en «Servicios Prestados» (`cantidadEntera`) y un decimal en «Recursos
Utilizados» (`decimalDigitado`): mismo nombre, dos tipos. `clasificarCampo()`
pregunta al esquema del campo probando valores, y `aValorDeEnvio()` manda cadena
o número según cuál acepte —`decimalDigitado` quiere la cadena, porque valida
que el separador sea el punto y un `Number()` previo se saltaría esa
validación; `cantidadEntera` quiere el número.

Una primera versión de `clasificarCampo` probaba `'7.5'` para detectar
decimales, y marcó «Observaciones» como decimal: un `z.string()` acepta «7.5».
La pantalla ponía «admite decimales, el separador es el punto» debajo de una
casilla de texto libre. Se descarta primero el texto —un esquema de texto acepta
cualquier cadena; uno numérico no—, y luego se distingue decimal de entero.

**Sigue siendo correcto cuando Q4 se responda.** Los campos salen del esquema,
así que aparecerán solos; lo único que hay que añadir es su catálogo, y un `id*`
que falte en el mapa se dibuja como número y se ve venir.

---

## D-27 · Al completar la undécima pestaña hay que invalidar el listado · Aceptada · 2026-09-15

**El defecto.** Se diligenciaba la última pestaña, la Rosa pasaba a «Registro
completo», y el listado de jornadas seguía diciendo «Faltan 11» durante los 30
segundos de `staleTime`.

**Por qué no es un detalle.** El listado es la pantalla por la que se decide
qué entra en el consolidado del RAO. Una jornada completa anunciada como
incompleta es, literalmente, el defecto que PROMPT.md describe al cerrar: no
falla, parece funcionar, y el dato que muestra no es el que hay.

**La corrección.** `refrescarJornada()` invalida `['jornada-pestanas']`,
`['jornada-cuota']` y **`['jornadas']`**, y se llama en los tres sitios donde
algo de la jornada cambia. La creación también invalida el listado.

---

## D-28 · Dos defectos de accesibilidad que solo una máquina encuentra · Aceptada · 2026-09-15

La revisión con axe de la Puerta 4 encontró dos cosas que la lectura del código
no daba:

**`scrollable-region-focusable`.** `overflow-x: auto` en la envoltura de las
tablas crea una región desplazable, y una región desplazable a la que no se
llega con el teclado deja su contenido inalcanzable para quien no usa ratón
(WCAG 2.1.1). Se resolvió con el componente `TablaEnvoltura`, que añade
`tabIndex={0}` y `role="region"` con nombre — en un componente y no repetido en
cinco pantallas, porque lo que se arregla en cinco sitios se rompe en el sexto.

**Contraste 4,41:1 en la escala de avance.** Los huecos de 80 % y 90 % —los
tramos que R10 dice que no existen— llevaban `opacity: 0.75` sobre el rojo de
babor, y eso baja de 4,5:1. **La opacidad es la forma más fácil de romper un
contraste que se calculó bien**, porque no se ve en el token: el color es
correcto y el resultado no. Se quitó; lo «apagado» lo dan el borde discontinuo y
el tachado, que además no dependen del color.

**Y un falso positivo que era un defecto de la prueba, no del código.** axe
reportaba cuatro violaciones de contraste con razones de 1,57:1 en textos cuyo
token da 7:1. Era la animación de entrada escalonada: arranca en `opacity: 0`, y
axe calcula el contraste con el color compuesto. La revisión ahora espera a
`document.getAnimations()` antes de medir — no un tiempo fijo, que vuelve a
medir a medias en cuanto alguien alarga una duración.

---

## D-29 · Las pruebas de navegador no usan `page.goto()` tras ingresar · Aceptada · 2026-09-15

El testigo de sesión vive en memoria y no en `localStorage` (deliberado: en un
equipo compartido, un testigo que sobrevive al cierre de la pestaña es una sesión
que nadie cerró). La consecuencia es que **recargar la página cierra la sesión**,
y `page.goto()` es una recarga.

Una primera versión de la revisión de accesibilidad usaba `page.goto()` entre
rutas y **pasaba en falso**: aterrizaba en la pantalla de ingreso, y como el
`<h1>` de esa pantalla también dice «PAID», la espera se cumplía y axe revisaba
siete veces la misma pantalla de ingreso, informando cero violaciones de páginas
que nunca vio.

Las pruebas navegan pulsando, con `irA()`, que además comprueba que el menú
sigue en pie antes de dar la navegación por buena. Una prueba que puede pasar
sin ejecutar lo que dice ejecutar es peor que no tenerla.

---

## D-30 · Ningún valor por omisión plausible en un dato que va al consolidado · Aceptada · 2026-09-23

**El defecto.** Las coordenadas de la jornada arrancaban en 10° N, 75° W —un
punto cerca de Cartagena— y la fase documental de cada adjunto en «Fase 1».

Las dos cosas tienen el mismo problema: si la persona no las cambia, el sistema
guarda un dato que nadie eligió y que **parece correcto**. El punto pasa el
control de «dentro de Colombia» y llega a ArcGIS; la fase se reparte igual en
todos los soportes. Es el anti-patrón P6 al pie de la letra: «un punto
equivocado es peor que uno ausente, porque parece plausible».

**La regla.** Un campo que alimenta un consolidado arranca **vacío** y se exige.
Se hace una excepción solo cuando el valor por omisión no es una suposición:

- El hemisferio de la **longitud** arranca en W, porque Colombia entera está al
  oeste de Greenwich: E es siempre un error.
- El de la **latitud** NO: Leticia está a 4° S, y un 4° N con la misma longitud
  cae dentro de Colombia, en el Vichada.

**Consecuencia técnica.** `CoordenadasGms` trabaja con un `BorradorGms` de
cadenas y no con números, porque `Number('')` vale 0 y borra la diferencia
entre «vacío» y «cero». `completarGms()` convierte y dice qué falta.

---

## D-31 · El flujo de las once pestañas se recorre, no se busca · Aceptada · 2026-09-23

Revisión de usabilidad recorriendo el registro como lo haría una unidad. Lo que
decidió cada cambio:

- **El clavegrama a la vista.** Las once pestañas son su transcripción; tenerlo
  en otra pantalla obligaba a ir y volver.
- **Lo registrado se ve y se corrige.** Sin la lista de filas, un error de
  digitación en una pestaña no tenía cómo detectarse ni cómo quitarse desde la
  pantalla, aunque el servidor admitía el borrado desde la Fase 3.
- **«Añadir y seguir» va a la siguiente PENDIENTE**, y la jornada abre en la
  primera pendiente. El orden del manual sigue siendo el de la lista; lo que
  cambia es que no hay que mirar la rosa para saber adónde ir.
- **«Faltan N» es un enlace para continuar**, en el listado.

**Lo que NO se hizo, a propósito:** guardar un borrador en el navegador para
recuperarlo tras un cierre accidental. Son datos clasificados en un equipo que
se comparte en la unidad; por la misma razón el testigo de sesión vive en
memoria. En su lugar, el navegador avisa antes de cerrar o recargar con
cambios sin guardar.

**Tres lecturas nuevas en la API** lo sostienen: el detalle de la jornada, las
filas de cada pestaña con el nombre de lo registrado (`REFERENCIA_DE_COLUMNA`,
declarado a mano como `columnas`) y la lista de adjuntos.

---

## D-32 · La identidad institucional se deja, no se programa · Reemplazada por D-33 · 2026-09-23

> Reemplazada el mismo día: llegaron el manual, la paleta y los emblemas, y la
> interfaz se rehízo sobre ellos (D-33). Ya no hay `escudo.svg` ni `marca.css`
> opcionales; se conserva el texto porque explica por qué no se usaron copias de
> terceros.

**Lo pedido.** Que la interfaz sea igual a la del Manual del Usuario PAID,
colores incluidos, con los íconos y logos de la institución.

**Lo que se pudo y lo que no.**

- El **Manual del Usuario PAID (v2, septiembre de 2022)** —el que PROMPT.md cita
  como fuente de las reglas— no está en el repositorio ni publicado en ninguna
  parte alcanzable. Sin él no hay forma de reproducir sus pantallas; inventarlas
  y llamarlas «iguales al manual» sería exactamente lo que A.7 prohíbe. Queda
  como **Q16**.
- El **Manual de Identidad Visual de la ARC** sí es público
  (`armada.mil.co`), pero la red de la sesión bloquea ese dominio, además de
  `funcionpublica.gov.co` y Wikimedia. Queda como **Q17**.
- No se usaron reproducciones de terceros del emblema ni se dibujó de memoria:
  un símbolo institucional mal trazado en un sistema institucional es peor que
  ninguno.

**Lo que se hizo.** `apps/web/public/identidad/` es el único sitio donde la
interfaz busca el logotipo (`escudo.svg`) y la paleta (`marca.css`). Con los
archivos oficiales ahí, se aplican en toda la interfaz sin tocar código; sin
ellos, vuelve la paleta por omisión y el ancla. La paleta de marca **no** entra
en el modo de alto contraste: ese modo es accesibilidad, no identidad.

**Ley 2345 de 2023.** Aplica a las Fuerzas Militares: logotipo = Escudo de la
República + nombre de la entidad, con la excepción del artículo 4, literal g. Por
eso la barra dice ahora «Armada de Colombia». Qué emblema exactamente lo decide
el manual de la ARC, no esta interfaz.

## D-33 · La interfaz sigue al Manual del Usuario y a la paleta ARC · Aceptada · 2026-09-23

**Qué llegó.** El PDF del Manual del Usuario PAID (septiembre de 2022), la
tabla de códigos de color del Manual de Identidad Visual ARC, el emblema de la
JACID y el escudo de la Armada. Con eso, Q16 queda resuelta y Q17 casi.

**Qué se hizo.**

- **Marco de las láminas 10–12**: barra GOV.CO con la sesión a la derecha,
  cabecera azul con «Ministerio de Defensa Nacional», PAID con el emblema JACID
  y el logotipo de la Armada, menú horizontal con los desplegables del manual,
  filete dorado, barra de pantalla flotante y pie azul GOV.CO transcrito.
- **Paleta ARC en `tokens.css`**, no en un archivo opcional: azul `#00205b`,
  dorado `#d4af37`, rojo `#c8102e`, gris `#97999b`, y el `#3366cc` de GOV.CO.
  Tipografías Oswald (título PAID), Montserrat (menú y rótulos), Atkinson
  Hyperlegible (texto) e IBM Plex Mono (datos), todas locales (A.2.1).
- **Dos modos de contraste**, institucional y alto, en lugar de tres. El
  manual tiene un único botón de contraste. El modo oscuro de la primera versión
  se retiró: no está en el manual y era una tercera paleta que sostener y
  revisar con axe.
- **Pantallas**: ingreso de la lámina 10, lámina «A.I.» en Inicio, franja de
  datos de color y pestañas en fila en la jornada, adjuntos agrupados por tipo,
  recuadro amarillo de exportación con Excel, CSV y Copiar.

**Reglas que salieron de medir, no de gustos.**

- El dorado **nunca** es color de texto sobre blanco (2,10 : 1) ni el gris ARC
  (2,86 : 1). Se usan como filete, ícono o fondo; el azul sobre dorado da
  7,36 : 1.
- El verde de «diligenciado» no está en la paleta ARC. Es funcional, como en el
  manual, y se eligió `#1e7b4a` para llegar a 4,5 : 1.
- «Copiar» no copia la tabla de la pantalla: pide la misma exportación CSV del
  servidor, que queda en la bitácora (R17). Copiar lo que se ve sería una
  exportación sin auditoría.
- El menú es un **disclosure** de WAI-ARIA (botón con `aria-expanded`, Escape
  cierra y devuelve el foco), no un `role="menu"`: son enlaces de navegación, y
  un menú de aplicación cambia cómo lo anuncian los lectores de pantalla.
- Las pestañas son pestañas de WAI-ARIA con tabulación itinerante: una sola
  parada de Tab para las once. Hay prueba de navegador que lo comprueba.

**Lo que no coincide todavía** —campos que el manual pide y la base no tiene—
está en `docs/CONTRASTE-MANUAL.md`. Todo exige migración y no se hizo por
suposición.

## D-34 · Tipo de jornada, EJC, FAC y población afecta: del manual a la base · Aceptada · 2026-09-23

**Lo que pide el manual** (láminas 20 y 21): el tipo de jornada (binacional,
conjunta o estratégica), si participaron el EJC y la FAC —«siempre se debe
poner SÍ en ARC»— y si la población es afecta o no a la tropa. El listado
(lámina 19) los muestra como columnas.

**Lo que se hizo.** Migración 0015: `ref.tipo_jornada` y cuatro columnas en
`ai.jornada_apoyo`. Esquema, API, exportación (con «Participó ARC» siempre
«SÍ»), formulario en el orden del manual, detalle y listado.

**Decisiones que no son obvias.**

- **En el subtipo, no en `ai.actividad`.** EJC y FAC los pide el manual en
  jornadas y asistencias; «población afecta», en jornadas, asistencias y
  proyectos; el tipo, solo en jornadas. Ninguno es de los cinco subtipos.
- **NULL en la base, obligatorios en la entrada.** Las jornadas anteriores no
  tienen el dato y ponerles «No» sería inventarlo (D-30). NULL se muestra como
  «Sin registrar», con un aviso para completarlo, y la exportación deja la
  celda vacía en vez de escribir «NO». Toda jornada nueva, y toda corrección,
  los exige.
- **Se siembran los tres tipos.** La regla es no inventar catálogos; estos no
  se inventan: el manual —fuente de JACID— los enumera literalmente.
- **Desplegables «Seleccione… / Sí / No», no casillas.** Una casilla
  desmarcada ya afirma «no»; el manual usa desplegables por la misma razón.
  Tampoco `z.coerce.boolean()`: convierte la cadena `'false'` en verdadero.
- **Un tipo inexistente o retirado es un 400 con el campo señalado.** La clave
  foránea lo impedía, pero como error interno (500); y no impedía elegir un
  tipo dado de baja (`activo = FALSE`).
- **`CONSERVAR=1 ./scripts/mirar.sh` aplica ahora las migraciones
  pendientes.** Antes reutilizaba la base tal cual, y tras esta migración la
  API habría arrancado contra columnas que no existían.

## D-35 · Herramientas AID: tipos, estado, potenciación y responsable del manual · Aceptada · 2026-09-24

**Lo que pide el manual** (láminas 45 y 46): el tipo entre once que nombra, el
estado (activa o inactiva, y si está inactiva, el motivo en las
observaciones), la fecha de potenciación o de adquisición, y un responsable
«que a su vez debe estar inscrito en el módulo de personal».

**Lo que se hizo.** Migración 0016: `ref.estado_herramienta_aid`, tres
columnas en `ai.herramienta_aid` y un disparador para la regla del motivo;
semilla de los once tipos y los dos estados. Esquema, API, formulario en el
orden del manual y listado con las columnas de la lámina 45.

**Decisiones que no son obvias.**

- **Los once tipos se siembran.** PROMPT.md decía «son once» sin nombrarlos y
  el catálogo quedó vacío a propósito. El manual sí los nombra, literalmente.
  Las siglas (COPAI, GEOS, VEMAI) se dejan sin desplegar: desplegarlas sin la
  fuente sería suponerlas.
- **Estado como catálogo, no como booleano.** El manual ya menciona «pendiente
  por baja» como gestión posible; un dominio que puede crecer no se congela.
- **Inactiva sin motivo se impide en tres sitios.** El disparador (la base es
  la última palabra), el servidor (para responder 400 con el campo y no un
  500) y el formulario (para decirlo antes de enviar). El esquema compartido
  no puede: no sabe qué `id` tiene INACTIVA, y el `id` es de la base.
- **El responsable se comprueba con RLS.** La clave foránea se evalúa sin RLS:
  sin la consulta del servicio, una unidad podía nombrar responsable a alguien
  de otra unidad que no puede ver. Una prueba de API lo fija.
- **La fecha de registro deja de digitarse.** Era una derivación propia que el
  manual no pide; la pone la base con la fecha del día en Bogotá. La fecha que
  el manual pide es la de potenciación, y no puede ser futura.
  `hoyEnBogota()` existe porque `toISOString()` da la fecha en UTC, que desde
  las 19:00 de Bogotá ya es «mañana».
- **Código y nombre se conservan** aunque el manual no los pida.
- **Una jornada de ejemplo en `datos-para-mirar.sql`.** Tres pruebas de
  accesibilidad abrían «la primera jornada» y solo pasaban si la prueba de
  extremo a extremo había creado una antes. Con una base recién preparada
  fallaban. La dependencia del orden estaba oculta porque la base se
  reutilizaba.

## D-36 · La auditoría de la Fase 5 se genera y se comprueba · Aceptada · 2026-09-24

**El problema.** PROMPT.md pide, para cada regla, «el archivo y la línea donde
se impone». Una línea escrita a mano caduca con la siguiente edición, y una
auditoría con líneas equivocadas es peor que una sin líneas: parece
verificada.

**Lo que se hizo.** `scripts/autoauditoria.mjs` declara cada ubicación por un
**ancla** —el nombre de la restricción, la función o el disparador que impone
la regla— y calcula la línea. Escribe la tabla en `docs/AUTOAUDITORIA.md`
entre dos marcadores, y con `--comprobar` falla si un ancla desaparece o si la
tabla no está al día. `pnpm test` lo ejecuta al final.

La consecuencia buscada: renombrar `actividad_participo_arc_siempre_verdadero`
sin actualizar la auditoría rompe la batería, y alguien tiene que mirar si R9
se sigue imponiendo.

**La Puerta 5 también es una prueba, no una afirmación.**
`apps/api/src/pruebas/puerta5.test.ts` recorre la Parte A con la IA
*habilitada* y apuntando a un puerto sin nada escuchando, y comprueba que
ningún código de la Parte A nombra el servicio de IA y que en
`docker-compose.yml` nadie depende de él. Cuando la Parte B añada una llamada
desde la Parte A, esa prueba falla hasta que se declare cómo degrada.


## D-37 · Una demostración sin servidor, separada del producto · Aceptada · 2026-09-25

**El problema.** Ver la PAID funcionando exige PostgreSQL con PostGIS, Redis,
Node y `./scripts/mirar.sh`. Quien solo quiere recorrerla —desde un teléfono,
sin terminal— no puede. Las capturas de pantalla no bastan: no se puede hacer
clic en ellas.

**Lo que se hizo.** `pnpm --filter @paid/web build:demo` compila la interfaz
**real** con `--mode demo` y la empaqueta en un único
`apps/web/dist-demo/paid-demo.html` (≈1,6 MB, fuentes y emblemas dentro). En
ese modo, `api/cliente.ts` no llama a `fetch`: llama a
`apps/web/src/demo/servidor.ts`, que responde a las mismas rutas en el
navegador con los mismos esquemas Zod compartidos, los mismos códigos de error
y el mismo formato `{codigo, mensaje, detalles, idCorrelacion}`. Arranca de
`src/demo/instantanea.json`, que `scripts/instantanea-demo.mjs` toma de la API
real para que la demostración no invente formas.

**Lo que la separa del producto.**

- `import.meta.env.MODE === 'demo'` protege la importación dinámica, y Vite
  elimina esa rama en la compilación normal: se comprobó que ningún `.js` de
  `apps/web/dist` contiene el servidor simulado ni el aviso.
- La demostración muestra siempre un aviso que no se cierra: «No es la
  plataforma oficial», los datos son de ejemplo y se pierden al recargar.
  Lleva `noindex, nofollow`.
- Usa `MemoryRouter` para abrirse desde el disco (`file://`) o desde cualquier
  carpeta de un alojamiento estático sin reescritura de rutas.

**Lo que NO demuestra, y no debe presentarse como si lo hiciera:** el
aislamiento por unidad (RLS), la red autorizada (R2), la bitácora, el bloqueo
por intentos contra Redis y la cuota impuesta por la base. El servidor
simulado imita las respuestas, no las garantías: esas solo las da la base de
datos. La demostración no sustituye a ninguna prueba.

## D-38 · La PAID ya no está atada a la Intranet ARC · Aceptada · 2026-09-25

**El pedido.** El propietario del proyecto pidió eliminar la restricción de la
Intranet: poder desplegar la PAID en internet (un VPS, por ejemplo).
PROMPT.md A.2.1 decía «corre únicamente en la Intranet ARC». Se modificó ahí
mismo, con la fecha y esta referencia, y en el anexo de `CLAUDE.md`.

**Lo que cambió.**

- **R2 deja de ser «red cerrada» y pasa a ser «red autorizada».** La tabla
  `seg.red_autorizada` y la comprobación con `>>=` siguen iguales. Lo que
  cambia es el valor por omisión: `semillas/0004_red_abierta.sql` siembra
  `0.0.0.0/0` y `::/0` en todo entorno, no solo en desarrollo. Para cerrar la
  red se registran rangos y se desactivan esos dos, sin desplegar.
- **La API ya no se niega a arrancar en producción con la red abierta.** En
  internet esa es la configuración normal. El arranque dice en una línea
  cuál está en vigor, y avisa si no hay ningún rango (nadie podría entrar).
- **Textos de pantalla.** Fuera «Intranet ARC» del ingreso, del pie y del
  aviso de Inicio; el mensaje de «sin conexión» ya no nombra la Intranet. La
  clasificación «Información Público Clasificado» se queda: es de los
  datos, no de la red.

**Lo que se endureció, porque en internet deja de ser teórico.**

- **La IP de origen.** Se tomaba la PRIMERA entrada de `X-Forwarded-For`, que
  escribe el cliente. Con un rango cerrado, cualquiera desde internet lo
  saltaba mandando `X-Forwarded-For: 10.0.0.1`, y la bitácora guardaba esa IP
  falsa. Ahora `seguridad/ip-origen.ts` toma la entrada que añadió el proxy
  de confianza más externo; `PROXIES_DE_CONFIANZA` (1 por omisión: el nginx
  de `web`) dice cuántos hay. Dos pruebas nuevas en la Puerta 2.
- **Puertos.** `docker-compose.yml` publicaba PostgreSQL, Redis (sin clave),
  MinIO y la API en todas las interfaces. Ahora solo en `127.0.0.1`; la única
  puerta pública es `web`. Docker salta el cortafuegos del anfitrión, así que
  esto no se puede dejar al cortafuegos.

**Lo que NO cambió, a propósito.**

- **La aplicación se sirve a sí misma** (fuentes, emblemas, teselas) y la CSP
  sigue en `default-src 'self'`. No estorba en internet —al contrario, es la
  primera defensa contra un script inyectado— y es lo que permite seguir
  desplegándola en la Intranet.
- **Ningún dato sale hacia un tercero**: ni telemetría a un servicio externo
  ni, en la Parte B, un modelo de IA en la nube (IA7). Eso responde a la
  clasificación de los datos, no a dónde corre la plataforma. Si se quiere
  cambiar, es otra decisión y hay que tomarla expresamente.

**Pendiente.** `PROXIES_DE_CONFIANZA` no se añadió a `docker-compose.yml` ni a
`.env.example`: la sesión no tuvo permiso para ese cambio. Con el despliegue
por omisión (nginx delante) no hace falta; con un segundo proxy delante para
el TLS hay que pasarlo a la API con valor 2.
