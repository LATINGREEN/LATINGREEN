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

## Estado actual: Fases 0 a 4 cerradas

| Fase | Estado |
|---|---|
| 0 · Preparación | ✅ cerrada · Puerta 0 parcial: `docker compose up` sin verificar |
| 1 · Base de datos | ✅ cerrada · **Puerta 1 superada: 60 pruebas contra Postgres real** |
| 2 · Autenticación y autorización | ✅ cerrada · **Puerta 2 superada: 38 pruebas sobre la API real** |
| 3 · Jornadas de Apoyo | ✅ cerrada · **Puerta 3 superada: 42 pruebas de API** |
| 4 · Interfaz | ✅ cerrada · **Puerta 4 superada: camino completo por la interfaz + accesibilidad sin violaciones** |
| 5 · Verificación de la Parte A | ✅ cerrada · **Puerta 5 superada: la Parte A completa con la IA habilitada y caída** · ver `docs/AUTOAUDITORIA.md` |
| 6–8 · Asistencia por IA (Parte B) | ⬜ siguiente |

**338 pruebas, todas pasando:** 132 de los invariantes compartidos, 69 de la
Puerta 1 contra PostgreSQL 16 con PostGIS y pgvector, 124 de las Puertas 2 a 5
levantando la API completa contra Postgres y Redis reales, y 13 de
navegador sobre la aplicación en pie.

**La interfaz sigue al Manual del Usuario PAID** (septiembre de 2022) y a la
paleta del Manual de Identidad Visual ARC, con el emblema de la JACID y el
escudo de la Armada. Lo que el manual pide y la base todavía no tiene está en
[`docs/CONTRASTE-MANUAL.md`](docs/CONTRASTE-MANUAL.md); lo que falta del
material oficial, en Q17 de [`docs/PREGUNTAS-JACID.md`](docs/PREGUNTAS-JACID.md).

Lo que funciona de punta a punta, **desde la pantalla**: ingresar con captcha,
registrar los tres maestros de precedencia —con sugerencia de duplicados por
semejanza antes de guardar—, registrar una jornada con sus coordenadas GMS y
sus once pestañas, adjuntar un soporte, ver el registro pasar a completo solo
con las once, exportar el consolidado a XLSX o CSV y cerrar sesión. Con el
aislamiento por unidad, la bitácora y las cuotas impuestos por la base de
datos.

### Para verlo funcionando

```bash
cd paid
pnpm install && pnpm -r build
./scripts/mirar.sh
```

Prepara una base desechable, la migra y la siembra, levanta la API en `:3000`
y la interfaz en `:5173`, e imprime las credenciales. Entre con `BIM23_PAID`
(clave `Desarrollo2026*`), y luego con `BIM24_PAID` para comprobar que no ve
nada de la otra unidad: eso lo aplica la base de datos, no la pantalla.

Requiere PostgreSQL 16 con PostGIS y pgvector, y Redis. La API avisa **a
gritos** en su arranque de que la red autorizada sembrada es `0.0.0.0/0`, y así
debe ser (R2).

### Para recorrerla sin instalar nada

```bash
pnpm --filter @paid/web build:demo     # → apps/web/dist-demo/paid-demo.html
```

Un solo archivo HTML con la interfaz real y un servidor simulado en el
navegador: se abre con doble clic. Los datos son de ejemplo, se pierden al
recargar, y no demuestra ni el aislamiento por unidad ni la bitácora (D-37).
Para renovar los datos de partida, con `./scripts/mirar.sh` en pie:
`node scripts/instantanea-demo.mjs`.

### ⚠️ El esquema está derivado, no traducido

`PROMPT.md` fija `anexo_A_ddl_paid.sql` como punto de partida y ordena
detenerse si falta. Se detuvo y se preguntó; la respuesta fue que **el archivo
no existe**, y se autorizó expresamente derivar el esquema de las reglas
R1–R19 del propio documento.

Consecuencias que conviene tener presentes, detalladas en
[`docs/DECISIONES.md`](docs/DECISIONES.md) (D-13):

- Los nombres de columna son nuestros. Si el DDL aparece, habrá que
  reconciliar.
- `PROMPT.md` habla de «los 26 catálogos de `ref`»; aquí hay 33, los que las
  reglas exigen. Si el DDL traía catálogos que ninguna regla nombra, aquí
  faltan.
- Lo que ninguna regla menciona, no está. No se inventaron campos razonables
  para rellenar huecos.

Y una consecuencia visible en el uso: **los catálogos que dependen de JACID
están vacíos** (las 17 campañas, los campos de cinco pestañas), así que
ninguna actividad puede alcanzar `registro_completo = TRUE` hasta que se
respondan Q2 y Q4. Eso es correcto. Lo incorrecto sería dejar cerrar registros
contra categorías inventadas: entonces el RAO cuadraría y estaría mal.

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
pnpm db:migrate     # aplica las 11 migraciones
pnpm db:seed        # catálogos: geografía DANE, COAMI, grados, extensiones
```

`pnpm db:generate` está **deshabilitado a propósito**. Las migraciones se
escriben a mano porque el DSL de Drizzle no expresa RLS, disparadores,
privilegios revocados ni claves foráneas compuestas, que es justo donde viven
las reglas. Regenerarlas borraría SQL que ninguna herramienta puede
reproducir. Ver `packages/db/migraciones/README.md` y `docs/DECISIONES.md`,
D-15.

### Probar la base de datos y la API

Las 60 pruebas de la Puerta 1 necesitan un Postgres real:

```bash
cd packages/db
DATABASE_URL_PRUEBA="postgres://usuario:clave@127.0.0.1:5432/postgres" pnpm test

# Las de navegador necesitan la aplicación en pie (./scripts/mirar.sh en otra terminal)
pnpm --filter @paid/e2e test
```

Las 80 de las Puertas 2 y 3 levantan la API completa, y necesitan además Redis:

```bash
cd apps/api
PAID_ALMACEN_RAIZ=/tmp/paid-adjuntos \
PAID_SEMILLA_DESARROLLO=1 \
DATABASE_URL_PRUEBA="postgres://usuario:clave@127.0.0.1:5432/postgres" \
pnpm test
```

⚠️ **`AlmacenMinio` no está verificado.** El almacenamiento de objetos está
detrás de una interfaz con dos implementaciones: MinIO para el despliegue y el
sistema de archivos para desarrollo y pruebas. No fue posible levantar un MinIO
en el entorno de construcción, así que la implementación de MinIO está escrita
pero no ejecutada. R11 y R12 sí están verificadas: se imponen antes de que el
almacén vea un byte. Ver `docs/DECISIONES.md`, D-22.

⚠️ **`DATABASE_URL` debe apuntar a un rol `NOSUPERUSER NOBYPASSRLS`.** Un
superusuario de PostgreSQL ignora las políticas RLS por definición, así que
apuntarlo al usuario administrador anula el aislamiento por unidad (R6) sin que
nada falle. Hay dos pruebas que lo comprueban, y existen porque el defecto
ocurrió durante el desarrollo.

Si hay Docker, se puede omitir esa variable y se usa Testcontainers. El
arranque detecta cuál hay disponible (D-14). Hace falta PostgreSQL 16 con
PostGIS, pgvector, pg_trgm, ltree y unaccent.

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
