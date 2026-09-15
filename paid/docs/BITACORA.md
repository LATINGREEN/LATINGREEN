# Bitácora de la construcción de la PAID

Registro por fases, en orden cronológico inverso dentro de cada fase (lo más
reciente arriba). **Toda sesión debe escribir aquí antes de empezar una fase y
al terminarla**, con detalle suficiente para que otra sesión sin este contexto
pueda continuar (PROMPT.md · A.5).

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
