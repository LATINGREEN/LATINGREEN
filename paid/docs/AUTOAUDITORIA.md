# Autoauditoría

**Cómo se llena este documento.** La Fase 5 exige recorrer R1–R19 y señalar,
**para cada regla, el archivo y la línea** donde se impone; y recorrer P1–P11
demostrando que ninguno está presente. `PROMPT.md` es explícito: *«Una regla sin
ubicación concreta es una regla no implementada.»*

Por eso las columnas de ubicación que aparecen abajo son **solo** las que ya
existen de verdad. No se escribe una ubicación prevista: si la regla todavía no
está impuesta, la columna dice «sin implementar» y nombra la fase que la debe
cubrir. Rellenar esas casillas por adelantado convertiría este documento en lo
contrario de lo que es.

**Estado (2026-09-24): Fases 0 a 5 cerradas. Puertas 1 a 5 superadas; la
Puerta 0 sigue parcial porque `docker compose up` no se ha podido ejecutar
(D-07). La Parte B puede empezar.**

⚠️ El esquema está **derivado de PROMPT.md**, no traducido de
`anexo_A_ddl_paid.sql`, que no existe. Se preguntó y se autorizó el desvío.
Ver `docs/DECISIONES.md`, D-13, para lo que eso implica.

---

## Reglas del dominio (R1–R19)

Ubicaciones relativas a `paid/`. «Verificada» significa que hay una prueba que
falla si la regla se rompe, no que el código parezca correcto.

| # | Regla | Dónde se impone | Prueba | Estado |
|---|---|---|---|---|
| R1 | Sesión de 10 min, deslizante, en servidor | `0004_seg_seguridad.sql` (disparador `sesion_fijar_expiracion`) · `apps/api/src/seguridad/sesion.service.ts` (TTL deslizante en Redis) · `sesion.guard.ts` · `tareas/tareas.service.ts` | 7 pruebas: 9 min 30 s renueva, 10 min + 1 s rechaza, la tabla queda con su motivo | ✅ **Verificada de punta a punta** |
| R2 | Red autorizada; rangos en tabla, no en entorno (abierta por omisión, D-38) | `0004` (`seg.red_autorizada`, tipo `cidr`) · `apps/api/src/seguridad/red.service.ts` (compara con `>>=` de `inet`) · `seguridad/ip-origen.ts` · `comun/aviso-arranque.ts` | 7 pruebas: dentro pasa, fuera no, una `X-Forwarded-For` falsificada por el cliente no pasa, queda `RED_NO_AUTORIZADA`, y responde lo mismo que credenciales inválidas | ✅ **Verificada.** El arranque dice qué rangos están en vigor |
| R3 | Captcha de un solo uso, se guarda el resumen | `0004` (`seg.captcha`) · `apps/api/src/seguridad/captcha.service.ts` (`UPDATE ... RETURNING` que resuelve la carrera) | 3 pruebas: no se reutiliza, se consume aunque falle, un id inventado no rompe | ✅ **Verificada** |
| R4 | Ocho causas en base, un mensaje en pantalla | semilla de `ref.resultado_intento_autenticacion` · `0004` (`seg.intento_autenticacion`) · `seguridad/autenticacion.service.ts` · `seguridad/clave.service.ts` (`RESUMEN_FICTICIO`) · `comun/filtro-excepciones.ts` | 4 pruebas: mismo cuerpo y código, **ambos caminos verifican la clave** (espía, no tiempos), la base sí distingue, el mensaje no nombra ninguna causa | ✅ **Verificada** |
| R5 | Credencial de unidad `<SIGLA>_PAID` | `0004` (`CHECK usuario_credencial_formato`) · `packages/schema/src/dominios.ts` | 4 pruebas en base + «responde 401 y no 400», para no revelar el formato | ✅ **Verificada** |
| R6 | Ámbito jerárquico con RLS sobre `ltree` | `0003` (`ruta_jerarquica`) · `0009` (derivación y recolocación) · `0010` (19 políticas) · `0011` (GiST) · `0013` (la única lectura sin contexto) | 7 en la Puerta 1 + 3 en la Puerta 2, incluidas **«el rol de la API no es superusuario ni tiene BYPASSRLS»** y «RLS activa **y forzada** en todas las tablas» | ✅ **Verificada** |
| R7 | Contexto con `SET LOCAL` en la transacción | `packages/db/src/contexto.ts` · `cliente.ts` · `apps/api/src/seguridad/transaccion.interceptor.ts` · `basedatos/basedatos.service.ts` (`AsyncLocalStorage`) | «el contexto no sobrevive a la transaccion» (Puerta 1) + **la fuga de contexto con `pool.max = 1`** (Puerta 2) | ✅ **Verificada en la API real** |
| R8 | Tres maestros de precedencia | `0005_ai_maestros.sql` · claves foráneas obligatorias desde `0007` | Inventario | ✅ |
| R9 | `participo_arc` siempre TRUE | `0006_ai_actividad_y_subtipos.sql` (`CHECK actividad_participo_arc_siempre_verdadero`) · `packages/schema/src/dominios.ts` | 2 pruebas: `INSERT` y `UPDATE` | ✅ **Verificada** |
| R10 | Escala de ocho tramos; no existen 80 ni 90 | `0006` (`CHECK ... IN (10,20,30,40,50,60,70,100)` en `proyecto_social` y en `proyecto_avance`) · `0009` (disparador de progresión) · `packages/schema/src/avance.ts` | 7 pruebas en base + 21 en `avance.test.ts` | ✅ **Verificada en base y en cliente** |
| R11 | Cuota de 10 MB **agregada** | `0009_disparadores.sql` (`ai.verificar_cuota_adjuntos`) · `packages/schema/src/adjunto.ts` | 6 pruebas: 9+2 falla, distintas pasan, 40×9 MB falla, 9+1 cabe, dar de baja libera | ✅ **Verificada** |
| R12 | Extensiones por categoría, contra el contenido real | `0002` (`ref.extension_permitida` con `mimes_esperados`) · `0007` (`mime_detectado`) · `apps/api/src/adjuntos/adjuntos.service.ts` (`file-type` sobre el contenido) · `packages/schema/src/adjunto.ts` | 19 en `adjunto.test.ts` + 6 por la API: ejecutable renombrado a `.jpg`, zip renombrado a `.pdf`, extensión fuera del catálogo, archivo vacío — y **ninguno dejó fila** | ✅ **Verificada. Se lee el contenido real** |
| R13 | Georreferenciación en los SEIS formularios | `0006` (bloque GMS en el supertipo) · `0005` (en `herramienta_aid`) · columnas `GENERATED ALWAYS`, incluida `geography` · `0011` (GiST) | 4 pruebas, entre ellas la comparación con `aDecimal()` en 6 coordenadas | ✅ **Verificada. Sin disparadores: todo derivado** |
| R14 | Eliminar es un trámite | `0003`/`0005`/`0006`/`0007` (`GRANT DELETE` solo a `paid_administracion`) · `0004` (`seg.solicitud_eliminacion`) | 5 pruebas: operación no puede, administración sí, motivo obligatorio, nadie se aprueba a sí mismo | ✅ **Verificada** |
| R15 | Bitácora obligatoria, por disparador | `0008_doc_y_aud.sql` (`aud.bitacora_cambio` + inmutabilidad doble) · `0009` (`aud.registrar_cambio` sobre `ai`, `org`, `doc`) | 5 pruebas, incluidas `UPDATE`/`DELETE`/`TRUNCATE` **como superusuario** | ✅ **Verificada** |
| R16 | Atribuciones centralizadas en JACID | `0009` (`ai.verificar_campana_es_de_fuerza`) · `0012` (`ai.alianza` + `ai.verificar_avance_solo_en_convenio`) · `0008` (privilegios de `doc.normatividad`) · `0004` (`REVOKE` a operación) · `semillas/0002_roles_y_permisos.sql` (la matriz) · `seguridad/permiso.guard.ts` | 2 de campaña (Puerta 1) + 5 de `ALIANZA.AVANCE` (Puerta 2): 403 a `OPERADOR_UNIDAD`, 200 a `FUNCIONAL_JACID`, el avance no retrocede, y la matriz solo lo da a JACID | ✅ **Verificada** |
| R17 | Asistencia DIRECTA exige plan | `0006` (`CHECK asistencia_directa_exige_plan_operacional`) · `packages/schema/src/dominios.ts` | 3 pruebas | ✅ **Verificada** |
| R18 | Siete COAMI, ninguno por defecto | `0006` (`ai.actividad_coami`, cero-a-muchos) · semilla de los 7 | `dominios.test.ts` (5 pruebas) | ✅ |
| R19 | Las once pestañas | `0007_ai_tablas_hijas.sql` (las once) · `0009` (`ai.recalcular_registro_completo`) · `packages/schema/src/pestanas.ts` | «es FALSE al crear, TRUE con las once, FALSE al retirar una» + 8 en `pestanas.test.ts` | ✅ **Verificada** |

**Recuento: las 19 reglas verificadas con pruebas.** Tras la Fase 3, R12 deja
de ser parcial: el MIME se lee del contenido real con `file-type` y hay seis
pruebas de API que lo comprueban.

Tres reglas se implementaron **más allá** de lo que su casilla pedía, porque el
defecto que evitan es silencioso:

- **R2** toma la IP que escribió el proxy de confianza, no la que manda el
  cliente: una `X-Forwarded-For` falsificada no abre la red.
- **R6** se comprueba también sobre el **rol de conexión** de la API, no solo
  sobre las políticas — un superusuario las ignora y ninguna prueba de negocio
  lo notaría.
- **R11** se comprueba *antes* de escribir en el almacén, no solo en la base,
  para no dejar binarios huérfanos que la base rechazó. Y hay una prueba que
  cuenta las filas tras cuatro rechazos para confirmarlo.

Lo que **no** está: los otros cuatro subtipos de actividad (asistencias,
ruedas, proyectos, campañas). Las reglas que los gobiernan están impuestas en la
base y verificadas en la Puerta 1; lo que falta es su API, que es replicar el
patrón de jornadas.

---

## Anti-patrones (P1–P11)

| # | Anti-patrón | ¿Presente? | Cómo se descarta |
|---|---|---|---|
| P1 | Referencia polimórfica sin integridad | **No** | `0006`: supertipo `ai.actividad` con clave foránea **real** desde cada hija; disyunción por clave foránea compuesta `(id_actividad, id_tipo_actividad)` y columna constante con `CHECK`. Verificado: una actividad sin subtipo falla al confirmar, y un segundo subtipo es rechazado por la clave foránea |
| P2 | Documentar una tabla y no implementarla | **No** | Test de inventario contra `information_schema` con 37 tablas citadas **por su nombre**, más una comprobación de que las tablas `ai.act_*` son exactamente **once**, más una que nombra `act_poblacion_beneficiada` en solitario, porque es la que se perdió |
| P3 | Llamar «auditoría» a cuatro columnas | **No** | Las cuatro columnas (`aud.fijar_columnas_auditoria` en `0001`, enganchada en `0009`) **más** `aud.bitacora_cambio`. Verificado que un `UPDATE` deja una fila con ambas imágenes |
| P4 | RBAC de nombre | **No** | `0004`: `seg.permiso` con la tripleta y el código derivado, `seg.rol_permiso`, `seg.usuario_rol` **con vigencia** e índice único sobre la asignación abierta, `seg.rol.id_ambito_visibilidad` |
| P5 | `CHECK` de fila para una regla de agregación | **No** | `0007` lleva un comentario explícito de que **no** hay `CHECK (peso_bytes <= 10485760)` como límite agregado, y `0009` pone la regla en un disparador que suma los bytes vigentes. Verificado con el caso de los 40 archivos de 9 MB, y con una prueba que comprueba que el disparador existe |
| P6 | Columnas «calculadas por trigger» sin el trigger | **No** | **No hay disparador que calcular**: las decimales *y* el punto `geography` son `GENERATED ALWAYS ... STORED`. Verificado que `latitud_decimal` rechaza escritura directa, que coincide con `aDecimal()` en 6 coordenadas y que el punto se deriva de las mismas GMS |
| P7 | Testigo de sesión en claro | **No** | `0004`: `hash_testigo char(64)` con `CHECK` de formato sha256 hex, y `sesion.service.ts` solo guarda el resumen. Verificado desde los dos lados: que un testigo en claro no cabe en la columna, y que **el testigo realmente entregado a un cliente no aparece en la representación JSON de ninguna fila** de `seg.sesion`, `aud.bitacora_cambio` ni `seg.intento_autenticacion` |
| P8 | Prohibir el borrado físico solo en la documentación | **No** | Tres roles de privilegio en `0001`, `GRANT DELETE` solo a `paid_administracion`, `seg.solicitud_eliminacion` con motivo obligatorio. Verificado que el rol de operación recibe `permission denied` |
| P9 | Dominios cerrados como texto libre | **No** | 33 catálogos en `ref`, todos con `CHECK` de formato en el código. `ref.normalizar_texto` hace comparables «BINACIONAL» y «Binacional», y se verifica que **da lo mismo que la función de TypeScript** sobre 6 cadenas |
| P10 | Desnormalizar geografía y jerarquía | **No** | `org.unidad` es una sola tabla con referencia a sí misma; el nivel sale de `ref.nivel_jerarquia`. `ref.municipio` no repite el nombre del departamento: apunta con clave foránea, y la coherencia del código DANE se impone con una columna **derivada** y una clave foránea sobre ella. Verificado que un municipio en el departamento equivocado no entra |
| P11 | `SET` en lugar de `SET LOCAL` | **No** | `packages/db/src/contexto.ts` usa `set_config(clave, valor, **true**)`, y `TransaccionInterceptor` es el único sitio que abre transacciones autenticadas. Verificado dos veces: en la Puerta 1 con `max = 1`, y en la Puerta 2 con la **API real** y `DATABASE_POOL_MAX = 1`, alternando tres peticiones de dos unidades hermanas sobre la misma conexión |
| P4 (bis) | Autorización por nombre de rol en lugar de por permiso | **No** | `permiso.guard.ts` exige el PERMISO, no el rol: si comprobara «¿es OPERADOR_UNIDAD?», cambiar la matriz obligaría a tocar código y R16 dejaría de ser configurable |

---

## Ubicación exacta: archivo y línea

PROMPT.md pide, para cada regla, «el archivo y la línea». Las tablas de arriba
dicen **qué** impone cada regla y con qué prueba; esta dice **dónde**, línea a
línea. La genera `scripts/autoauditoria.mjs` a partir de un ancla por
ubicación —el nombre de la restricción, la función o el disparador—, porque
una línea escrita a mano caduca con la siguiente edición y entonces la
auditoría miente. `pnpm test` la comprueba: si un ancla desaparece o una línea
se mueve, falla.

<!-- ubicaciones:inicio (generado por scripts/autoauditoria.mjs; no editar a mano) -->

| # | Regla | Archivo:línea | Ancla |
|---|---|---|---|
| R1 | Sesión de 10 min, deslizante, evaluada en servidor | `packages/db/migraciones/0004_seg_seguridad.sql:279` | `CREATE TRIGGER sesion_fijar_expiracion` |
|  |  | `apps/api/src/seguridad/sesion.service.ts:53` | `configuracion.get<number>('SESION_TTL_SEGUNDOS')` |
|  |  | `apps/api/src/tareas/tareas.service.ts:26` | `@Cron(CronExpression.EVERY_MINUTE)` |
| R2 | Red autorizada; rangos en tabla | `packages/db/migraciones/0004_seg_seguridad.sql:24` | `CREATE TABLE seg.red_autorizada` |
|  |  | `apps/api/src/seguridad/red.service.ts:24` | `AND rango >>= $1::inet` |
| R3 | Captcha de un solo uso | `packages/db/migraciones/0004_seg_seguridad.sql:157` | `CREATE TABLE seg.captcha` |
|  |  | `apps/api/src/seguridad/captcha.service.ts:98` | `WHERE id = $1 AND consumido_en IS NULL` |
| R4 | Ocho causas en base, un mensaje en pantalla | `packages/db/migraciones/0004_seg_seguridad.sql:181` | `CREATE TABLE seg.intento_autenticacion` |
|  |  | `apps/api/src/seguridad/clave.service.ts:36` | `const RESUMEN_FICTICIO =` |
| R5 | Credencial `<SIGLA>_PAID` | `packages/db/migraciones/0004_seg_seguridad.sql:115` | `CONSTRAINT usuario_credencial_formato` |
| R6 | Ámbito jerárquico con RLS sobre `ltree` | `packages/db/migraciones/0010_rls_politicas.sql:36` | `CREATE OR REPLACE FUNCTION seg.unidad_en_ambito` |
|  |  | `packages/db/migraciones/0010_rls_politicas.sql:53` | `ALTER TABLE org.unidad FORCE ROW LEVEL SECURITY` |
| R7 | Contexto con `SET LOCAL` dentro de la transacción | `packages/db/src/contexto.ts:90` | `set_config($1, $2, true)` |
|  |  | `apps/api/src/basedatos/basedatos.service.ts:3` | `import { AsyncLocalStorage } from 'node:async_hooks'` |
| R8 | Tres maestros de precedencia | `packages/db/migraciones/0007_ai_tablas_hijas.sql:105` | `id_entidad     bigint NOT NULL REFERENCES ai.entidad(id)` |
|  |  | `packages/db/migraciones/0016_herramienta_campos_manual.sql:59` | `ADD COLUMN id_personal_responsable bigint REFERENCES ai.personal(id)` |
|  |  | `apps/api/src/maestros/herramientas.controller.ts:248` | `CODIGOS_ERROR.MAESTRO_REQUERIDO` |
| R9 | `participo_arc` siempre TRUE | `packages/db/migraciones/0006_ai_actividad_y_subtipos.sql:128` | `CONSTRAINT actividad_participo_arc_siempre_verdadero` |
|  |  | `packages/schema/src/dominios.ts:50` | `export const participoArc = z.literal(true` |
| R10 | Ocho tramos; no existen 80 ni 90 | `packages/db/migraciones/0006_ai_actividad_y_subtipos.sql:307` | `porcentaje_avance IN (10,20,30,40,50,60,70,100)` |
|  |  | `packages/schema/src/avance.ts:18` | `export const TRAMOS_AVANCE = [10, 20, 30, 40, 50, 60, 70, 100]` |
| R11 | 10 MB agregados por actividad | `packages/db/migraciones/0009_disparadores.sql:207` | `CREATE OR REPLACE FUNCTION ai.verificar_cuota_adjuntos()` |
|  |  | `packages/schema/src/adjunto.ts:15` | `export const CUOTA_BYTES_POR_ACTIVIDAD` |
| R12 | Extensión por categoría contra el contenido real | `packages/db/migraciones/0002_ref_catalogos.sql:572` | `CREATE TABLE ref.extension_permitida` |
|  |  | `apps/api/src/adjuntos/adjuntos.service.ts:10` | `import { fromBuffer } from 'file-type'` |
|  |  | `packages/schema/src/adjunto.ts:80` | `export function mimeCoincideConExtension` |
| R13 | GMS en los seis formularios; decimales generadas | `packages/db/migraciones/0006_ai_actividad_y_subtipos.sql:96` | `latitud_decimal     numeric(9,6) GENERATED ALWAYS AS` |
|  |  | `packages/db/migraciones/0005_ai_maestros.sql:123` | `latitud_decimal     numeric(9,6) GENERATED ALWAYS AS` |
|  |  | `packages/schema/src/coordenadas.ts:70` | `export function aDecimal(` |
| R14 | Borrado lógico; el físico, con solicitud a JACID | `packages/db/migraciones/0006_ai_actividad_y_subtipos.sql:360` | `GRANT DELETE ON ai.actividad` |
|  |  | `packages/db/migraciones/0004_seg_seguridad.sql:284` | `CREATE TABLE seg.solicitud_eliminacion` |
| R15 | Bitácora obligatoria, por disparador | `packages/db/migraciones/0008_doc_y_aud.sql:51` | `CREATE TABLE aud.bitacora_cambio` |
|  |  | `packages/db/migraciones/0008_doc_y_aud.sql:166` | `REVOKE UPDATE, DELETE, TRUNCATE ON aud.bitacora_cambio` |
|  |  | `packages/db/migraciones/0009_disparadores.sql:410` | `CREATE OR REPLACE FUNCTION aud.registrar_cambio()` |
| R16 | Atribuciones centralizadas en JACID | `packages/db/migraciones/0009_disparadores.sql:172` | `CREATE OR REPLACE FUNCTION ai.verificar_campana_es_de_fuerza()` |
|  |  | `packages/db/migraciones/0012_ai_alianzas.sql:78` | `CREATE OR REPLACE FUNCTION ai.verificar_avance_solo_en_convenio()` |
|  |  | `apps/api/src/seguridad/permiso.guard.ts:17` | `export class PermisoGuard` |
| R17 | Asistencia DIRECTA exige plan operacional | `packages/db/migraciones/0006_ai_actividad_y_subtipos.sql:290` | `ADD CONSTRAINT asistencia_directa_exige_plan_operacional` |
| R18 | Siete COAMI, ninguno por defecto | `packages/db/migraciones/0006_ai_actividad_y_subtipos.sql:339` | `CREATE TABLE ai.actividad_coami` |
|  |  | `packages/db/semillas/0001_catalogos.sql:129` | `INSERT INTO ref.coami` |
|  |  | `packages/schema/src/dominios.ts:15` | `export const COAMI = [` |
| R19 | Las once pestañas; `registro_completo` | `packages/db/migraciones/0007_ai_tablas_hijas.sql:146` | `CREATE TABLE ai.act_poblacion_beneficiada` |
|  |  | `packages/db/migraciones/0009_disparadores.sql:312` | `CREATE OR REPLACE FUNCTION ai.recalcular_registro_completo` |
|  |  | `packages/schema/src/pestanas.ts:10` | `export const PESTANAS_ACTIVIDAD = [` |

| # | Anti-patrón descartado por | Archivo:línea | Ancla |
|---|---|---|---|
| P1 | Referencia polimórfica sin integridad | `packages/db/migraciones/0006_ai_actividad_y_subtipos.sql:166` | `CONSTRAINT jornada_apoyo_disyuncion_subtipo` |
|  |  | `packages/db/migraciones/0009_disparadores.sql:128` | `CREATE OR REPLACE FUNCTION ai.verificar_subtipo_presente()` |
| P2 | Tabla documentada y no implementada | `packages/db/src/pruebas/puerta1.test.ts:210` | `describe('Inventario: ninguna tabla esperada falta (P2)'` |
| P3 | «Auditoría» de cuatro columnas | `packages/db/migraciones/0009_disparadores.sql:391` | `aud.fijar_columnas_auditoria()` |
|  |  | `packages/db/migraciones/0009_disparadores.sql:410` | `CREATE OR REPLACE FUNCTION aud.registrar_cambio()` |
| P4 | RBAC de nombre | `packages/db/migraciones/0004_seg_seguridad.sql:125` | `CREATE TABLE seg.usuario_rol` |
|  |  | `apps/api/src/seguridad/permiso.guard.ts:17` | `export class PermisoGuard` |
| P5 | `CHECK` de fila para una regla agregada | `packages/db/migraciones/0009_disparadores.sql:207` | `CREATE OR REPLACE FUNCTION ai.verificar_cuota_adjuntos()` |
| P6 | Columnas «calculadas por disparador» sin disparador | `packages/db/migraciones/0006_ai_actividad_y_subtipos.sql:104` | `ubicacion           geography(Point,4326) GENERATED ALWAYS AS` |
| P7 | Testigo de sesión en claro | `packages/db/migraciones/0004_seg_seguridad.sql:204` | `hash_testigo` |
| P8 | Borrado físico prohibido solo en la documentación | `packages/db/migraciones/0006_ai_actividad_y_subtipos.sql:360` | `GRANT DELETE ON ai.actividad` |
| P9 | Dominios cerrados como texto libre | `packages/db/migraciones/0002_ref_catalogos.sql:29` | `CREATE TABLE ref.tipo_actividad` |
|  |  | `packages/db/migraciones/0001_extensiones_esquemas_y_roles.sql:112` | `ref.normalizar_texto` |
| P10 | Geografía y jerarquía desnormalizadas | `packages/db/migraciones/0003_org_unidades.sql:16` | `CREATE TABLE org.unidad` |
|  |  | `packages/db/migraciones/0002_ref_catalogos.sql:542` | `CREATE TABLE ref.municipio` |
| P11 | `SET` en lugar de `SET LOCAL` | `packages/db/src/contexto.ts:90` | `set_config($1, $2, true)` |
|  |  | `apps/api/src/seguridad/transaccion.interceptor.ts:27` | `export class TransaccionInterceptor` |

<!-- ubicaciones:fin -->

---

## Reglas de IA (IA1–IA8)

| # | Regla | Dónde | Estado |
|---|---|---|---|
| IA1 | La IA propone; la persona dispone | `apps/ia/src/paid_ia/principal.py` (descripción del servicio) | ⛔ **Fase 6/7**. Hoy el servicio no tiene con qué escribir: no hay cliente de base de datos en `apps/ia` |
| IA2 | Salida estructurada por construcción | — | ⛔ **Fase 7**. Preparada por D-02 (Zod 4 y `z.toJSONSchema`) |
| IA3 | Procedencia por campo | `apps/ia/src/paid_ia/principal.py` (TODO de `/extraer`) | ⛔ **Fase 7** |
| IA4 | Nunca inventar cifras | `apps/ia/src/paid_ia/principal.py` (TODO de `/extraer`) | ⛔ **Fase 7** |
| IA5 | Registro completo de cada interacción | — | ⛔ **Fase 6** (`ia.sugerencia`, `ia.modelo`) |
| IA6 | Degradación limpia | `apps/api/src/configuracion.ts` (`IA_HABILITADA=false`, `IA_TIMEOUT_MS`) · `packages/schema/src/errores.ts` · `apps/ia/.../principal.py` (responde «degradado», no error) · `apps/api/src/pruebas/puerta5.test.ts` | ✅ **Verificado por la Puerta 5**: la Parte A se recorre entera con la IA *habilitada* y sin nada escuchando en su dirección; ningún código de la Parte A la nombra; `docker compose up` no la levanta |
| IA7 | Sin salida de datos | `docker-compose.yml` (red `sin-salida` con `internal: true`) · `docker/otel-collector/config.yaml` (sin exportador externo) · `docker/web/nginx.conf` (CSP `default-src 'self'`) | ✅ Impuesto por configuración, no por convención |
| IA8 | La IA respeta el ámbito | `apps/ia/src/paid_ia/principal.py` (sin cliente de base de datos, por diseño) | ⚠️ Parcial: hoy es cierto porque el servicio no puede consultar nada. La prueba de la **Puerta 6** es la que lo confirmará |

## Anti-patrones de IA (PIA1–PIA6)

| # | Anti-patrón | ¿Presente? | Nota |
|---|---|---|---|
| PIA1 | Autocompletar y guardar | **No** | No hay autocompletado todavía. IA3 es su antídoto y es requisito de la Fase 7 |
| PIA2 | Un chat genérico en una esquina | **No** | No hay ningún componente de conversación, y el TODO de `/extraer` describe un botón «Extraer del clavegrama», no un asistente |
| PIA3 | Pedir JSON en el prompt y esperar lo mejor | **No** | El TODO de `/extraer` exige decodificación restringida de forma explícita |
| PIA4 | Meter la IA en el camino crítico | **No** | `/extraer` está especificado como asíncrono desde el principio, y `IA_HABILITADA` está en `false` |
| PIA5 | Confundir fluidez con exactitud | **No** | Sin modelo configurado no hay fluidez que confundir. El resaltado del fragmento (IA3) es requisito de la Fase 7 |
| PIA6 | Evaluar «a ojo» | **No** | `docs/EVALUACION-IA.md` no existe todavía y B.8 lo exige para dar por terminado. La Fase 8 no empieza sin él |

---

## 🚪 Puerta 5 — la Parte A sin ningún componente de IA

La exigencia literal: «la Parte A funciona completa **sin ningún componente de
IA desplegado**». Se acredita con `apps/api/src/pruebas/puerta5.test.ts`, que
corre en cada `pnpm test`:

1. **La peor configuración.** La API arranca con `IA_HABILITADA=true` y
   `IA_URL` apuntando a un puerto donde no escucha nada (se comprueba que no
   escucha, antes y después). Con eso se recorre la Parte A: ingreso con
   captcha, los tres maestros —personal, entidad y herramienta con su
   responsable—, jornada con los datos de las láminas 20–21, una pestaña,
   un adjunto, listado, detalle, exportación CSV, bitácora y cierre de
   sesión. Todo responde como sin IA.
2. **Ningún código de la Parte A llama a la IA.** Se recorren `apps/api`,
   `apps/web`, `packages/schema` y `packages/db` buscando `IA_URL`,
   `IA_HABILITADA`, el puerto `:8000` o rutas `/ia/`. La única mención
   admitida es la declaración de la configuración. Se comprobó que la prueba
   falla si se planta una referencia (`apps/web/src/main.tsx`), y se retiró.
3. **Despliegue.** En `docker-compose.yml`, `ia` lleva `profiles: ['ia']`,
   ningún otro servicio depende de él, ninguno de la Parte A necesita un
   perfil para arrancar, e `IA_HABILITADA` vale `false` por omisión en la API
   y en el despliegue.

Además, **toda la batería** —338 pruebas— corre sin el servicio de IA: ninguna
lo levanta.

**Lo que la Puerta 5 no dice.** Que la Parte A funcione sin IA no significa que
esté completa como sistema: le faltan los módulos de la lista de abajo. Lo que
acredita es que nada de lo que existe depende de la IA, y que cuando la Parte B
llegue, cualquier llamada nueva desde la Parte A hará fallar esta prueba hasta
que se declare dónde y cómo degrada.

---

## Resultado de la batería de pruebas

Al cerrar la Fase 5 (2026-09-24), con la aplicación en pie (`./scripts/mirar.sh`)
y **sin el servicio de IA**:

```
$ pnpm lint
(sin hallazgos)

$ pnpm -r build
packages/schema · packages/db · apps/api · apps/web: Done

$ DATABASE_URL_PRUEBA=... pnpm test
packages/schema: 9 archivos,  132 pruebas, 132 pasan
packages/db:     1 archivo,    69 pruebas,  69 pasan  ← Puerta 1, Postgres real
apps/api:        4 archivos,  124 pruebas, 124 pasan  ← Puertas 2, 3, 4 y 5,
                                                        API + Postgres + Redis
e2e:             2 archivos,   13 pruebas,  13 pasan  ← Puerta 4, Chromium real
                 ──────────────────────────────────
                 TOTAL          338 pruebas, 338 pasan
Autoauditoría al día: todas las anclas existen y las líneas coinciden.
```

La batería de navegador se ejecutó también sobre una **base recién creada**,
para descartar pruebas que solo pasan por el orden en que corren (se encontró
una y se corrigió: D-35).

### Historial

Ejecutado al cerrar la Fase 4:

```
$ pnpm -r build
packages/schema build: Done
packages/db     build: Done
apps/api        build: Done
apps/web        build: Done   (vite: 213 módulos)

$ DATABASE_URL_PRUEBA=... pnpm test
packages/schema: 7 archivos, 116 pruebas, 116 pasan
packages/db:     1 archivo,   60 pruebas,  60 pasan  ← Puerta 1, Postgres real
apps/api:        3 archivos,  94 pruebas,  94 pasan  ← Puertas 2, 3 y 4,
                                                       API + Postgres + Redis
                 ─────────────────────────────────
                                270 pruebas, 270 pasan

$ pnpm --filter @paid/e2e test        # con ./scripts/mirar.sh en pie
e2e: 2 archivos, 11 pruebas, 11 pasan ← Puerta 4, navegador real
                 ─────────────────────────────────
                 TOTAL           281 pruebas, 281 pasan

$ pnpm lint
(sin hallazgos)
```

**La revisión de accesibilidad de la Puerta 4: cero violaciones críticas o
serias** (axe con `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) sobre siete rutas
en los tres modos de contraste, los formularios desplegados y el tamaño de
letra mayor.

⚠️ Y hay que decirlo con precisión, porque es la clase de cifra que se cita mal:
axe detecta entre un 30 % y un 40 % de los problemas reales de accesibilidad.
**Esto no acredita que la aplicación sea accesible.** Acredita que no tiene los
defectos que una máquina puede encontrar. Lo que ninguna máquina comprueba —que
el orden de tabulación tenga sentido, que un rótulo describa de verdad su
campo, que un aviso llegue cuando hace falta— se decidió a mano en cada
componente y está anotado ahí; una revisión con personas usuarias de lector de
pantalla sigue pendiente y no la sustituye ninguna prueba de este repositorio.

### Lo que la Puerta 4 encontró y estaba roto

Cinco defectos, cuatro de código y uno de una prueba propia. Se anotan aquí
porque su valor no es que se corrigieran: es que **las 94 pruebas de API no
podían verlos**, y eso dice dónde están los huecos de la batería.

| # | Defecto | Por qué no se veía antes |
|---|---|---|
| D-25 | El formulario de jornadas **no podía guardar**: el esquema Zod compartido transformaba la fecha y no admitía su propia salida | Las pruebas de API envían `dd/mm/aaaa` directamente, como `curl`. El defecto vivía en la costura formulario↔controlador |
| D-26 | Las pestañas pedían el **identificador numérico** del catálogo en un campo de texto | Las pruebas de API envían el id correcto porque lo consultan antes |
| D-27 | El listado seguía diciendo «Faltan 11» 30 s después de completarse | No hay caché en una prueba de API |
| D-28 | Región desplazable sin acceso por teclado; contraste 4,41:1 por una `opacity` | Ninguna prueba mira la pantalla |
| D-29 | Una prueba de accesibilidad **pasaba en falso**, revisando siete veces la pantalla de ingreso | La encontró leer su propia salida con desconfianza |

### Resultado de la Fase 3 (se conserva)

Ejecutado al cerrar la Fase 3:

```
$ pnpm -r build
packages/schema build: Done
packages/db     build: Done
apps/api        build: Done
apps/web        build: Done   (vite: 179 módulos, 275.45 kB)
e2e             build: Done

$ pnpm -r test
packages/schema: 6 archivos,  97 pruebas, 97 pasan
packages/db:     1 archivo,   60 pruebas, 60 pasan   ← Puerta 1, Postgres real
apps/api:        2 archivos,  80 pruebas, 80 pasan   ← Puertas 2 y 3,
                                                       API + Postgres + Redis
apps/web: sin pruebas todavía (Fase 4)
e2e: pendiente hasta la Puerta 4
                 ─────────────────────────────────
                 TOTAL           237 pruebas, 237 pasan

$ pnpm lint
(sin hallazgos)

$ cd apps/ia && ruff check . && mypy src && pytest tests
All checks passed! · Success: no issues found in 3 source files · 3 passed
```

Las 60 pruebas de la Puerta 1 corren contra **PostgreSQL 16.13 con PostGIS
3.4.2, pgvector 0.6.0, pg_trgm, ltree y unaccent** — el stack exacto de A.1 —
y se conectan con roles `NOSUPERUSER NOBYPASSRLS`, porque un superusuario
ignora RLS y las pruebas de ámbito pasarían en falso.

Comprobaciones manuales:

- `GET /api/salud` → `200 {"estado":"sano",...}`
- `GET /api/no-existe` → `404 {"codigo":"REG_NO_ENCONTRADO",...,"idCorrelacion":"..."}`
- Arranque con `SESION_AVISO_SEGUNDOS > SESION_TTL_SEGUNDOS` → **aborta**, citando R1
- `GET /salud` del servicio de IA → `200 {"estado":"degradado",...}`
- `docker compose config` → los seis servicios válidos
- `pnpm db:migrate` sobre base vacía → 14 migraciones aplicadas
- reversión completa → **0 tablas**; reaplicación → 72 tablas
- arranque con red `0.0.0.0/0` → una línea en el registro: «R2 — Red abierta» (hasta el
  2026-09-25 el proceso no levantaba en producción; D-38)

## Lo pendiente, sin adornarlo

Verificado contra el código el 2026-09-24, no copiado de la versión anterior.

**Módulos de la Parte A que no existen**

1. **Asistencias humanitarias, ruedas de emprendimiento, proyectos sociales y
   campañas de sensibilización.** Tablas y reglas están en la base y
   verificadas por la Puerta 1 (R10, R16, R17); falta su API y su pantalla.
   El menú lleva a una pantalla que dice qué falta, no a un enlace muerto.
   Esperan Q4.
2. **Alianzas y convenios:** la API solo permite diligenciar el avance
   (`PATCH /alianzas/:id/avance`); no hay forma de **crear** una alianza ni
   pantalla.
3. **Normatividad:** se lista, pero no hay forma de **cargar** un documento
   (R16 dice que lo hace JACID).
4. **Cambio de clave:** `ClaveService` tiene el historial de cinco y la
   comprobación de reutilización, pero ningún endpoint lo usa, y un ingreso con
   `CLAVE_EXPIRADA` se rechaza sin ofrecer el cambio.
5. **Diferencias de campos con el manual** que quedaron sin hacer por decisión
   del usuario: género del personal; sector, subsector y país de las
   entidades; recuadro de exportación en los tres maestros. Ver
   `docs/CONTRASTE-MANUAL.md`.

**Desvíos del stack de A.1**

6. **Drizzle ORM** está como dependencia de `packages/db` pero la API consulta
   con SQL parametrizado sobre `pg`. Las migraciones son SQL a mano por D-15;
   la capa de consulta tipada nunca se escribió.
7. **React Hook Form** está como dependencia de `apps/web` pero ningún
   formulario lo usa: los formularios llevan estado propio y validan con el
   **mismo esquema Zod** que el servidor, que es la parte de A.1 que importa.
8. **OpenTelemetry:** el colector está en `docker-compose.yml`, pero la API no
   le envía nada. Hay registro con `pino` e `idCorrelacion` en cada error.
9. **Testcontainers** no se usa: las pruebas corren contra un Postgres local
   (D-14).

**Sin verificar en este entorno**

10. **`docker compose up`** (D-07): las imágenes no se pueden descargar desde
    la red de la sesión.
11. **`AlmacenMinio`** está escrito y no se ha ejecutado nunca (D-22). Por
    omisión se usa el almacén en sistema de archivos. R11 y R12 están
    verificadas porque se imponen antes del almacén.
12. **El mapa no tiene teselas** (`apps/web/public/teselas/` solo trae su
    `LEEME.md`): «Ver ubicación» avisa que la cartografía no está disponible.
    Espera Q11.

**Dependencias de JACID**

13. **Catálogos vacíos** (Q2, Q4): tipos de operación, servicios prestados,
    grupos poblacionales, medios, recursos, bienes donados, campañas. En un
    despliegue real **ninguna actividad puede llegar a `registro_completo`**
    hasta que se entreguen. Es lo correcto —el RAO cuadraría con categorías
    inventadas—, pero significa que el sistema todavía no es utilizable de
    punta a punta por un motivo ajeno al código.
14. **DIVIPOLA sin cargar:** `ref.municipio` está vacío fuera de los datos de
    demostración.
15. **El esquema está derivado, no reconciliado** con `anexo_A_ddl_paid.sql`,
    que no existe (D-13).
16. **Campos propios de cada tipo de herramienta AID** (Q3) y **Escudo de la
    República y logos GOV.CO/CO** (Q17).

**Deuda técnica**

17. **La exportación tiene un tope de 500 filas.** Deliberado —recortar en
    silencio sería peor que fallar—, pero un consolidado anual lo supera.
18. **Al recolocar una unidad** en la jerarquía hay que cerrar las sesiones de
    su subárbol, porque el contexto lleva la ruta (D-16). No produce un error:
    produce un ámbito equivocado.
19. **Una clave foránea inexistente responde 500** en los formularios que no
    se revisaron en esta fase (por ejemplo, un municipio inexistente en la
    jornada). En tipo de jornada y en la herramienta ya responde 400 con el
    campo; el resto sigue pendiente.
20. **El captcha es aritmético**, no de imagen como en el manual. Sustituto
    explícito y accesible; si JACID exige el del manual, se reemplaza el
    generador sin tocar el flujo.
21. **Revisión con personas usuarias de lector de pantalla:** pendiente. axe
    encuentra entre el 30 % y el 40 % de los problemas reales.
22. **`docs/EVALUACION-IA.md`** no existe; B.8 lo exige antes de dar la Parte B
    por terminada.
