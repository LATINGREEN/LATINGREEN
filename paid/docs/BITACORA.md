# Bitácora de la construcción de la PAID

Registro por fases, en orden cronológico inverso dentro de cada fase (lo más
reciente arriba). **Toda sesión debe escribir aquí antes de empezar una fase y
al terminarla**, con detalle suficiente para que otra sesión sin este contexto
pueda continuar (PROMPT.md · A.5).

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
