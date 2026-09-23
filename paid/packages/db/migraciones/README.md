# Migraciones

**SQL escrito a mano, no generado.** Quince migraciones, cada una con su
reversión en `bajada/` con el mismo nombre de archivo.

## Por qué SQL a mano y no el DSL de Drizzle

`PROMPT.md` dice «traduce `anexo_A_ddl_paid.sql` a migraciones de Drizzle».
Aquí el esquema está en SQL directo, y el motivo es que **las reglas de la PAID
no se pueden expresar en el DSL de Drizzle**:

| Lo que exige una regla | ¿Drizzle lo expresa? |
|---|---|
| Políticas RLS sobre `ltree` (R6) | no |
| Disparadores: bitácora, cuota agregada, progresión de avance (R15, R11, R10) | no |
| Columnas `GENERATED ALWAYS ... STORED`, incluida `geography` (R13) | parcialmente |
| `REVOKE DELETE` por rol (R14) | no |
| Clave foránea compuesta para la disyunción de subtipo (P1) | parcialmente |
| `CONSTRAINT TRIGGER ... DEFERRABLE` (P1) | no |

Generar el 60 % del esquema y añadir el 40 % restante en SQL suelto deja dos
fuentes de verdad que se desincronizan. Una sola, en el idioma en el que las
reglas se pueden escribir enteras, es más segura. Ver `docs/DECISIONES.md`,
D-15.

## Aplicar y revertir

```bash
pnpm db:migrate      # aplica las pendientes
pnpm db:seed         # catálogos
```

Cada migración corre **dentro de una transacción**: si el SQL falla a mitad, no
queda ni una tabla. PostgreSQL admite DDL transaccional, así que esto funciona
de verdad. (Se aprendió por las malas: una migración aplicada a medias deja la
base en un estado que ninguna de las dos direcciones entiende.)

El aplicador está en `src/migraciones.ts` y **se niega a arrancar si una
migración no tiene su `down`**: A.1 exige migraciones reversibles, y sin la
reversión la migración no está terminada.

## Las quince

| # | Archivo | Qué trae |
|---|---|---|
| 0001 | `extensiones_esquemas_y_roles` | PostGIS, pgvector, pg_trgm, ltree, unaccent · los 7 esquemas · los 3 roles de privilegio · funciones de contexto (R7) · `ref.normalizar_texto` |
| 0002 | `ref_catalogos` | 33 catálogos de dominio cerrado (P9) · `ref.estado_registro` con identificadores fijos, porque los disparadores lo citan por código |
| 0003 | `org_unidades` | `org.unidad` con `ruta_jerarquica ltree` (R6, P10) |
| 0004 | `seg_seguridad` | R2, R3, R4, R5, R14 · RBAC real con vigencia (P4) · sesión con resumen del testigo (P7) |
| 0005 | `ai_maestros` | R8: personal, entidad, herramienta AID · `nombre_normalizado` generado |
| 0006 | `ai_actividad_y_subtipos` | **P1**: supertipo + 5 subtipos con clave foránea compuesta · R9, R10, R13, R17, R18 |
| 0007 | `ai_tablas_hijas` | **P2**: las ONCE pestañas de R19, `act_poblacion_beneficiada` incluida |
| 0008 | `doc_y_aud` | `doc.normatividad` (R16) · `aud.bitacora_cambio` inmutable (R15) · `aud.exportacion` |
| 0009 | `disparadores` | R15, R11, R10, R19, R16, R6 · P1 · P3 |
| 0010 | `rls_politicas` | R6 sobre `ai`, `org` y `doc`, con el contexto de R7 |
| 0011 | `indices` | 55 índices: GiST sobre `ltree` y sobre `geography`, GIN con `pg_trgm`, parciales |
| 0012 | `ai_alianzas` | R16: alianzas y convenios, con el avance que solo diligencia JACID |
| 0013 | `unidad_para_ingreso` | La unidad legible antes de tener sesión, para el ingreso |
| 0014 | `privilegios_pestanas` | `DELETE` sobre las filas de las once pestañas (Q14) |
| 0015 | `jornada_campos_manual` | Manual, láminas 20–21: `ref.tipo_jornada`, participación de EJC y FAC, población afecta a la tropa |

## Lo que todavía no hay

**El esquema Drizzle en TypeScript para la capa de consulta.** Las migraciones
son la fuente de verdad del esquema y están completas; lo que falta es el
mapeo tipado que `apps/api` usará para consultar. Es la primera tarea de la
Fase 3, no una omisión de la Fase 1: se dejó fuera en lugar de escribir la
mitad, porque un mapeo parcial es exactamente el defecto que P2 describe.
