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
**Fases 0 y 1 cerradas.** 157 pruebas pasando, 60 de ellas contra Postgres real
(Puerta 1). La siguiente es la Fase 2 (autenticación y autorización).

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
Las once migraciones de `packages/db/migraciones/` son SQL escrito a mano.
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

## Dos cosas que no son obvias
- **`packages/schema` compila a CommonJS** (lo consume NestJS), y por eso
  `apps/web` lo resuelve a su código fuente vía alias de Vite. No lo «arregles»
  con una compilación doble: ver D-09.
- **`docker compose up` no levanta el servicio `ia`.** Es deliberado (D-04): la
  Puerta 5 exige que la Parte A funcione sin ningún componente de IA, y la única
  forma honesta de comprobarlo es que la IA no arranque por omisión. Para
  levantarla: `docker compose --profile ia up`.

## Convenciones que ya están en vigor
- Versiones **exactas** en todos los `package.json` y en `pyproject.toml`: sin
  `^`, sin `~`. `.npmrc` tiene `save-exact=true`. Motivo en D-08.
- Nombres de dominio en español sin tildes ni eñes, `snake_case` en base de
  datos y API, `camelCase` en TypeScript.
- Comentarios en español. Explican **por qué**, no qué hace la línea siguiente.
- Commits pequeños, en español, uno por unidad de trabajo coherente.
