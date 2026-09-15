# PAID — Plataforma de Acción Integral y Desarrollo

Aplicación web de la Armada de Colombia donde la Jefatura de Acción Integral y
Desarrollo (JACID) y las unidades tácticas registran las actividades de acción
integral, y de donde salen los consolidados que alimentan el RAO y los tableros
del Mando Naval.

Opera **únicamente en la Intranet ARC**: no hay internet en tiempo de ejecución.
Ninguna dependencia puede llamar a un servicio externo.

Especificación completa en [`PROMPT.md`](PROMPT.md). Reglas permanentes en
[`CLAUDE.md`](CLAUDE.md).

---

## ⛔ Estado actual: Fase 0 cerrada. Fase 1 bloqueada.

**Falta el archivo `anexo_A_ddl_paid.sql`**, el DDL de referencia ya verificado
y auditado. `PROMPT.md` lo fija como punto de partida de la Fase 1 y ordena:
«Si falta el `.sql`, detente y pídelo. No improvises el esquema.»

Por eso **no hay base de datos**: no se ha inventado ni una tabla. Colocar ese
archivo en `paid/anexo_A_ddl_paid.sql` desbloquea la Fase 1.

| Fase | Estado |
|---|---|
| 0 · Preparación | ✅ cerrada (con una salvedad: ver «Verificación pendiente») |
| 1 · Base de datos | ⛔ **bloqueada**, falta el DDL |
| 2 · Autenticación y autorización | ⛔ depende de la 1 |
| 3 · Jornadas de Apoyo | ⛔ depende de la 1 |
| 4 · Interfaz | ⛔ depende de la 2 y la 3 |
| 5 · Verificación de la Parte A | ⛔ |
| 6–8 · Asistencia por IA (Parte B) | ⛔ no empieza hasta cerrar la Puerta 5 |

Detalle por fase en [`docs/BITACORA.md`](docs/BITACORA.md). Qué reglas están
impuestas de verdad y cuáles no, en
[`docs/AUTOAUDITORIA.md`](docs/AUTOAUDITORIA.md).

---

## Requisitos

| Herramienta | Versión |
|---|---|
| Node | 20 LTS o superior |
| pnpm | 9 o superior |
| Docker + Docker Compose | cualquiera reciente |
| Python | 3.12 (solo para `apps/ia`, que es opcional) |

## Levantar

```bash
cd paid
cp .env.example .env          # y ajustar las contraseñas
pnpm install
docker compose up -d          # postgres, redis, minio, otel-collector, api, web
docker compose ps             # los seis en healthy
```

La interfaz queda en <http://localhost:5173> y la API en
<http://localhost:3000/api/salud>.

**`docker compose up` no levanta el servicio de IA**, y es deliberado: ver
«Desplegar sin el subsistema de IA» más abajo.

### Desarrollo sin contenedores para la aplicación

```bash
docker compose up -d postgres redis minio otel-collector
pnpm dev            # api y web en paralelo, con recarga
```

## Probar

```bash
pnpm -r build       # compila los cinco paquetes del workspace
pnpm -r test        # pruebas de todos los paquetes
pnpm lint           # eslint; `any` está prohibido y es error
pnpm typecheck
```

El servicio de IA se prueba aparte, con sus propias herramientas:

```bash
cd apps/ia
python3.12 -m venv .venv && . .venv/bin/activate
pip install -e '.[dev]'
ruff check . && mypy src && pytest tests
```

## Sembrar y migrar

```bash
pnpm db:generate    # genera la migración desde el esquema Drizzle
pnpm db:migrate     # aplica
pnpm db:seed        # geografía DANE, COAMI, grados, tipos de actividad
```

⚠️ **Hoy estos tres comandos no tienen nada que hacer**: el esquema está vacío
a la espera del DDL de referencia.

---

## Estructura

```
paid/
├── apps/
│   ├── api/          NestJS 10 — API REST
│   ├── web/          React 18 + Vite 5 — interfaz
│   └── ia/           FastAPI (Python) — asistencia por IA, Parte B, OPCIONAL
├── packages/
│   ├── schema/       esquemas Zod compartidos: los MISMOS en cliente y servidor
│   └── db/           Drizzle: esquema, migraciones, semillas
├── docker/           Dockerfiles y configuración de los servicios
├── docs/             BITACORA · DECISIONES · PREGUNTAS-JACID · AUTOAUDITORIA
├── e2e/              pruebas de extremo a extremo
├── CLAUDE.md         reglas permanentes del repositorio
└── PROMPT.md         especificación completa
```

`apps/ia` **no** está en el workspace de pnpm: es Python y `PROMPT.md` lo exige
aislado del resto del monorepo.

---

## Desplegar sin el subsistema de IA

Es el modo normal, no un modo degradado.

```bash
docker compose up -d          # esto YA es el despliegue sin IA
```

El servicio `ia` está bajo un perfil de Compose, así que no arranca salvo que se
pida expresamente:

```bash
docker compose --profile ia up -d     # solo si hay hardware y modelo aprobados
```

Y en la API, `IA_HABILITADA=false` por omisión.

**Por qué así.** La Puerta 5 de `PROMPT.md` exige que la Parte A funcione
completa «sin ningún componente de IA desplegado». Si la IA arrancara por
omisión, esa comprobación se haría con la IA encendida y no probaría nada.

Si el servicio de IA está apagado o no responde, la aplicación funciona
exactamente igual, a mano, con un aviso discreto («La asistencia no está
disponible»). Nunca un error bloqueante, nunca una pantalla que dependa del
modelo para dibujarse.

**Además, cuando sí se despliega:** el servicio `ia` corre en una red de Docker
marcada `internal: true`, es decir **sin ruta a internet**. Que no saque datos
de la red cerrada no depende de lo que haga el código: lo impone la
configuración de red.

---

## Verificación pendiente

`docker compose config` valida los seis servicios, pero **`docker compose up`
no se ha podido ejecutar todavía**: la sesión que construyó la Fase 0 estaba
detrás de un proxy que bloquea el CDN de imágenes de Docker Hub, así que no fue
posible construir ningún contenedor. Ver `docs/DECISIONES.md`, D-07.

Es lo primero que conviene comprobar en una máquina con acceso a un registro de
imágenes:

```bash
docker compose build postgres
docker compose up -d
docker compose ps        # se esperan seis servicios en healthy
```

Para el despliegue real en la Intranet ARC hace falta resolver de dónde salen
las imágenes: registro espejado interno, o transporte con
`docker save` / `docker load`.

---

## Antes de contribuir

1. Lee [`CLAUDE.md`](CLAUDE.md). Son invariantes, no preferencias.
2. Lee [`docs/DECISIONES.md`](docs/DECISIONES.md) antes de «arreglar» algo que
   parece raro. Puede que ya esté explicado por qué es así.
3. Escribe en [`docs/BITACORA.md`](docs/BITACORA.md) antes y después de cada
   fase, con detalle suficiente para que otra persona sin tu contexto pueda
   continuar.
4. No rellenes los puntos Q1–Q12 con supuestos. Márcalos `TODO(JACID)` y añade
   la pregunta a [`docs/PREGUNTAS-JACID.md`](docs/PREGUNTAS-JACID.md).

**El defecto característico de este sistema no es que falle: es que parezca
funcionar mientras acumula datos que no cuadran.** Un adjunto huérfano, un COAMI
duplicado, un punto en el mapa que no corresponde a lo digitado, un consolidado
que suma mal porque «Binacional» y «BINACIONAL» son dos categorías. Nada de eso
lanza un error. De ahí que las reglas vivan en la base de datos y no en la capa
de aplicación, y que las puertas se verifiquen con pruebas y no con una lectura
del código.
