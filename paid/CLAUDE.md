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

---

# Notas de estado (añadidas por la sesión que cerró la Fase 0)

Lo de arriba es el anexo de PROMPT.md, literal. Lo que sigue es el estado real
del repositorio, para que una sesión futura no tenga que deducirlo.

## Dónde está todo
La PAID vive en `paid/`, no en la raíz: el repositorio ya contenía otro proyecto
(el juego Eco-Arcade Latin Green). Ver `docs/DECISIONES.md`, D-01.

## Estado
**Fases 0 a 4 cerradas**, más una revisión de usabilidad y la interfaz rehecha
sobre el Manual del Usuario PAID (D-33, D-34). 306 pruebas pasando: 124 de
invariantes compartidos, 64 de la Puerta 1 contra Postgres real, 106 de las
Puertas 2, 3 y 4 sobre la API real con Postgres y Redis, y 12 de navegador
sobre la aplicación en pie. La siguiente es la **Fase 5** (verificación de la
Parte A).

**La interfaz sigue al manual.** Paleta ARC en `apps/web/src/estilos/tokens.css`
(el dorado `#d4af37` nunca es texto sobre blanco: 2,10 : 1), emblemas en
`apps/web/public/identidad/`. Lo que el manual pide y la base aún no tiene está
en `docs/CONTRASTE-MANUAL.md`. Falta del material oficial: Escudo de la
República y logos GOV.CO/CO (Q17). No los tomes de copias de terceros ni los
dibujes de memoria.

⛔ **La Parte B (Fases 6–8, la IA) no empieza hasta cerrar la Puerta 5.**
PROMPT.md lo ordena literalmente, y el motivo es verificable: la Puerta 5 exige
que la Parte A funcione con el servicio de IA apagado, y eso solo se puede
comprobar antes de que exista algo que lo apague por costumbre.

### Para verlo funcionando

    ./scripts/mirar.sh

Base desechable migrada y sembrada, API en `:3000`, interfaz en `:5173`,
credenciales impresas. `BIM23_PAID` tiene maestros; `BIM24_PAID` está vacía a
propósito, para ver que RLS no le muestra nada de la otra unidad.

Las 12 pruebas de navegador necesitan eso en pie:
`pnpm --filter @paid/e2e test`.

## ⚠️ El esquema está DERIVADO de PROMPT.md
`anexo_A_ddl_paid.sql` no existe. Se preguntó, como PROMPT.md ordena, y se
autorizó expresamente derivar el esquema de las reglas R1–R19. Ver
`docs/DECISIONES.md`, D-13.

Lo que eso significa para ti:
- Los nombres de columna son nuestros. Si el archivo aparece, hay que
  reconciliar, y eso en una base con datos no es gratis.
- Autorizar derivar el esquema **no** autorizó inventar el contenido de los
  catálogos. Los que dependen de JACID están vacíos y así se quedan hasta que
  respondan. No los rellenes.

## Migraciones: SQL a mano, y no se regeneran
Las quince migraciones de `packages/db/migraciones/` son SQL escrito a mano.
`pnpm db:generate` está deshabilitado a propósito: `drizzle-kit` no conoce los
disparadores ni las políticas RLS y propondría borrarlos. Ver D-15.

Cada migración corre dentro de una transacción y ninguna se da por terminada
sin su `down` en `bajada/` — el aplicador se niega a arrancar si falta.

## Antes de tocar algo, lee
1. `docs/BITACORA.md` — qué se hizo y qué quedó pendiente, por fase.
2. `docs/DECISIONES.md` — por qué las cosas son como son. Una decisión sin
   motivo escrito es una decisión que se deshace sin saberlo.
3. `docs/AUTOAUDITORIA.md` — qué reglas están impuestas de verdad y cuáles no.

## Archivo más delicado del repositorio
`packages/db/src/contexto.ts`. Implementa R7 con `set_config(clave, valor, true)`
— ese tercer argumento `true` **es** el `is_local` de `SET LOCAL`. Cambiarlo por
`false` introduce una fuga de datos entre unidades que no se ve leyendo el
código. Léelo entero antes de modificarlo.

El contexto lleva **cinco** claves, no cuatro: `app.ruta_unidad` está ahí
porque la política RLS de `org.unidad` no puede buscar esa ruta con una
subconsulta sobre `org.unidad` sin provocar recursión infinita. No la quites
para «simplificar»: se intentó y la Puerta 1 lo detectó. Ver D-16.

Deuda conocida asociada: al recolocar una unidad en la jerarquía hay que
cerrar las sesiones de su subarborescencia, porque conservarían la ruta
anterior. Es trabajo de la Fase 2.

## ⚠️ Un esquema Zod compartido se ejecuta DOS VECES

Es la trampa más cara de la Fase 4, y la que más fácil es volver a introducir.

A.6 exige un solo esquema Zod para cliente y servidor. La consecuencia que no
es obvia: el formulario valida y **envía la salida de la validación**, y el
controlador vuelve a validar esa salida con el mismo esquema. Un esquema que
**transforma** y no admite su propia salida rechaza en la segunda pasada lo que
aceptó en la primera.

Pasó con `fechaDdMmAaaa`: normalizaba `02/03/2026` a `2026-03-02`, el
formulario enviaba eso, y el controlador respondía «No se pudo registrar la
jornada». **El formulario de jornadas no podía guardar por la interfaz**, y
ninguna de las 94 pruebas de API lo veía porque todas envían `dd/mm/aaaa`
directamente, como haría `curl`.

Regla: **todo esquema que cruce la red tiene que ser idempotente**, de modo que
`parse(parse(x)) === parse(x)`. Lo fija
`packages/schema/src/idempotencia.test.ts` sobre todos ellos, las diez pestañas
incluidas. Si añades una transformación a un esquema compartido, esas pruebas
te avisarán; no las relajes, haz la transformación idempotente. Ver D-25.

## Dos trampas de la interfaz que cuestan una tarde

1. **El testigo de sesión vive en MEMORIA, no en `localStorage`** (deliberado:
   en un equipo compartido, un testigo que sobrevive al cierre de la pestaña es
   una sesión que nadie cerró). Por tanto **recargar la página cierra la
   sesión**, y `page.goto()` en una prueba de navegador es una recarga. Las
   pruebas navegan pulsando, con `irA()`. Una versión anterior usaba
   `page.goto()` y **pasaba en falso**: aterrizaba en la pantalla de ingreso,
   cuyo `<h1>` también dice «PAID». Ver D-29.

2. **`isPending` no significa «cargando»** en TanStack Query. Con
   `enabled: false` —el caso del municipio mientras no hay departamento— la
   consulta queda en `isPending` para siempre porque nunca ha salido, y el
   desplegable decía «Cargando…» indefinidamente. Lo que quieres es
   `isLoading`, que es `isPending && isFetching`.

## Ningún valor por omisión plausible en un dato del consolidado

Las coordenadas arrancaban en 10° N 75° W (cerca de Cartagena) y la fase
documental en «Fase 1». Quien no las cambiaba guardaba un dato que nadie eligió
y que parece correcto: el punto pasa el control de «dentro de Colombia». Es P6.

Regla: un campo que alimenta un consolidado arranca **vacío** y se exige. Solo
se admite un valor por omisión cuando no es una suposición (la longitud en W:
Colombia entera está al oeste de Greenwich). Ver D-30.

Consecuencia: `CoordenadasGms` trabaja con cadenas (`BorradorGms`), porque
`Number('')` vale 0 y borra la diferencia entre «vacío» y «cero».

## El tipo de un campo lo decide su esquema, no su nombre

`cantidad` es un entero en la pestaña «Servicios Prestados» (`cantidadEntera`)
y un decimal en «Recursos Utilizados» (`decimalDigitado`): mismo nombre, dos
tipos. `apps/web/src/paginas/campos-pestana.ts` lo resuelve preguntándole al
esquema del campo, con `clasificarCampo()` y `aValorDeEnvio()`.

Y el orden de las comprobaciones importa: hay que descartar **primero** que sea
texto, porque un `z.string()` acepta `'7.5'` y una versión anterior marcó
«Observaciones» como decimal, poniéndole debajo «admite decimales, el separador
es el punto» a una casilla de texto libre. Ver D-26.

## Dos cosas que no son obvias
- **`packages/schema` compila a CommonJS** (lo consume NestJS), y por eso
  `apps/web` lo resuelve a su código fuente vía alias de Vite. No lo «arregles»
  con una compilación doble: ver D-09.
- **`docker compose up` no levanta el servicio `ia`.** Es deliberado (D-04): la
  Puerta 5 exige que la Parte A funcione sin ningún componente de IA, y la única
  forma honesta de comprobarlo es que la IA no arranque por omisión. Para
  levantarla: `docker compose --profile ia up`.

## Dos trampas de `apps/api` que cuestan una tarde
NestJS inyecta leyendo la metadata `design:paramtypes`, que es una **referencia
al valor** de cada clase del constructor. De ahí dos cosas que NO hay que
«arreglar»:

1. **`consistent-type-imports` está desactivado en `apps/api`** (D-19). Su
   autocorrección convierte los imports en `import type`, TypeScript los
   elimina del JavaScript emitido y la inyección falla en ejecución. La regla
   marca exactamente los archivos donde aplicarla rompe la aplicación.
2. **Las pruebas de `apps/api` usan SWC, no esbuild** (D-18). esbuild no emite
   esa metadata, y las pruebas arrancaban la API con todos los constructores
   vacíos: cada peticioń devolvía 500. `tsc` sí la emite, así que el despliegue
   nunca estuvo afectado — era solo el camino de las pruebas.

## El rol de base de datos de la API no puede ser superusuario
`DATABASE_URL` debe apuntar a un rol `NOSUPERUSER NOBYPASSRLS`. Un superusuario
ignora RLS por definición, así que apuntarlo al usuario administrador **anula
R6 entero** y ninguna prueba de negocio lo nota. Hay dos pruebas en la Puerta 2
que lo comprueban explícitamente, y existen porque el defecto ocurrió.

## Zod: `.partial()` conserva los valores por omisión
Costó una pérdida de datos silenciosa. `crearJornada` pone `.default([])` en
`coami` —correcto al crear, R18 dice que no se marque ninguno— y
`crearJornada.partial()` **mantiene ese `default`**, así que un `PATCH` que solo
cambiaba el lugar llegaba con `coami: []` y borraba todas las participaciones
de COAMI. Sin error y sin que nadie lo pidiera.

Regla: en un esquema de modificación, «ausente» y «lista vacía» tienen que ser
distinguibles. Vuelve a declarar el campo como `optional()` sin `default`.

## Convenciones que ya están en vigor
- Versiones **exactas** en todos los `package.json` y en `pyproject.toml`: sin
  `^`, sin `~`. `.npmrc` tiene `save-exact=true`. Motivo en D-08.
- Nombres de dominio en español sin tildes ni eñes, `snake_case` en base de
  datos y API, `camelCase` en TypeScript.
- Comentarios en español. Explican **por qué**, no qué hace la línea siguiente.
- Commits pequeños, en español, uno por unidad de trabajo coherente.
