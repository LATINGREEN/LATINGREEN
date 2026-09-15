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

**Estado: Fases 0 y 1 cerradas. Puerta 0 parcial (ver abajo), Puerta 1 superada.**

⚠️ El esquema está **derivado de PROMPT.md**, no traducido de
`anexo_A_ddl_paid.sql`, que no existe. Se preguntó y se autorizó el desvío.
Ver `docs/DECISIONES.md`, D-13, para lo que eso implica.

---

## Reglas del dominio (R1–R19)

Ubicaciones relativas a `paid/`. «Verificada» significa que hay una prueba que
falla si la regla se rompe, no que el código parezca correcto.

| # | Regla | Dónde se impone | Prueba | Estado |
|---|---|---|---|---|
| R1 | Sesión de 10 min, deslizante, en servidor | `packages/db/migraciones/0004_seg_seguridad.sql` (`seg.sesion`, disparador `sesion_fijar_expiracion`) · `apps/api/src/configuracion.ts` | «expira_en se deriva de la ultima actividad, no se digita» | ⚠️ La base ya impone los 10 min y los hace indigitables. El TTL en Redis y la tarea de cierre son de la **Fase 2** |
| R2 | Red cerrada; rangos en tabla, no en entorno | `0004_seg_seguridad.sql` (`seg.red_autorizada`, tipo `cidr`) · `apps/api/src/configuracion.ts` (comentario que prohíbe CIDR ahí) | — | ⚠️ Tabla lista. La validación en el flujo de ingreso es de la **Fase 2** |
| R3 | Captcha de un solo uso, se guarda el resumen | `0004_seg_seguridad.sql` (`seg.captcha`, `CHECK` sha256 hex, disparador de 5 min) | «el captcha caduca a los 5 minutos, tampoco negociable» | ✅ En base · flujo en **Fase 2** |
| R4 | Ocho causas en base, un mensaje en pantalla | `0002_ref_catalogos.sql` + semilla de `ref.resultado_intento_autenticacion` · `0004` (`seg.intento_autenticacion`) · `packages/schema/src/dominios.ts` | `dominios.test.ts` (3 pruebas) | ✅ Dominio y mensaje único · flujo en **Fase 2** |
| R5 | Credencial de unidad `<SIGLA>_PAID` | `0004_seg_seguridad.sql` (`CHECK usuario_credencial_formato`) · `packages/schema/src/dominios.ts` | «la credencial sigue el patron», 3 credenciales inválidas | ✅ **Verificada en base y en cliente** |
| R6 | Ámbito jerárquico con RLS sobre `ltree` | `0003_org_unidades.sql` (`ruta_jerarquica`) · `0009_disparadores.sql` (derivación y recolocación) · `0010_rls_politicas.sql` (18 políticas) · `0011_indices.sql` (GiST) | 7 pruebas, incluidas «BIM23 no ve BIM24», «sin contexto no se ve nada» | ✅ **Verificada como rol `NOBYPASSRLS`** |
| R7 | Contexto con `SET LOCAL` en la transacción | `packages/db/src/contexto.ts` · `packages/db/src/cliente.ts` (`enTransaccionConContexto`) · `0001` (funciones `seg.*_actual()`) | «el contexto no sobrevive a la transaccion», con `max = 1` en el pool | ✅ **Verificada** |
| R8 | Tres maestros de precedencia | `0005_ai_maestros.sql` · claves foráneas obligatorias desde `0007` | Inventario | ✅ |
| R9 | `participo_arc` siempre TRUE | `0006_ai_actividad_y_subtipos.sql` (`CHECK actividad_participo_arc_siempre_verdadero`) · `packages/schema/src/dominios.ts` | 2 pruebas: `INSERT` y `UPDATE` | ✅ **Verificada** |
| R10 | Escala de ocho tramos; no existen 80 ni 90 | `0006` (`CHECK ... IN (10,20,30,40,50,60,70,100)` en `proyecto_social` y en `proyecto_avance`) · `0009` (disparador de progresión) · `packages/schema/src/avance.ts` | 7 pruebas en base + 21 en `avance.test.ts` | ✅ **Verificada en base y en cliente** |
| R11 | Cuota de 10 MB **agregada** | `0009_disparadores.sql` (`ai.verificar_cuota_adjuntos`) · `packages/schema/src/adjunto.ts` | 6 pruebas: 9+2 falla, distintas pasan, 40×9 MB falla, 9+1 cabe, dar de baja libera | ✅ **Verificada** |
| R12 | Extensiones por categoría, contra el contenido real | `0002` (`ref.extension_permitida` con `mimes_esperados`) · semilla con las 16 extensiones · `0007` (`mime_detectado`) · `packages/schema/src/adjunto.ts` | `adjunto.test.ts` (19 pruebas) | ⚠️ Catálogo y contraste listos. La lectura del número mágico del archivo es de la **Fase 3** |
| R13 | Georreferenciación en los SEIS formularios | `0006` (bloque GMS en el supertipo) · `0005` (en `herramienta_aid`) · columnas `GENERATED ALWAYS`, incluida `geography` · `0011` (GiST) | 4 pruebas, entre ellas la comparación con `aDecimal()` en 6 coordenadas | ✅ **Verificada. Sin disparadores: todo derivado** |
| R14 | Eliminar es un trámite | `0003`/`0005`/`0006`/`0007` (`GRANT DELETE` solo a `paid_administracion`) · `0004` (`seg.solicitud_eliminacion`) | 5 pruebas: operación no puede, administración sí, motivo obligatorio, nadie se aprueba a sí mismo | ✅ **Verificada** |
| R15 | Bitácora obligatoria, por disparador | `0008_doc_y_aud.sql` (`aud.bitacora_cambio` + inmutabilidad doble) · `0009` (`aud.registrar_cambio` sobre `ai`, `org`, `doc`) | 5 pruebas, incluidas `UPDATE`/`DELETE`/`TRUNCATE` **como superusuario** | ✅ **Verificada** |
| R16 | Atribuciones centralizadas en JACID | `0009` (`ai.verificar_campana_es_de_fuerza`) · `0008` (privilegios de `doc.normatividad`) · `0004` (`REVOKE` a operación sobre roles y permisos) · `packages/schema/src/dominios.ts` | 2 pruebas de campaña | ⚠️ La parte de datos está verificada. La matriz de permisos y `ALIANZA.AVANCE` son de la **Fase 2** |
| R17 | Asistencia DIRECTA exige plan | `0006` (`CHECK asistencia_directa_exige_plan_operacional`) · `packages/schema/src/dominios.ts` | 3 pruebas | ✅ **Verificada** |
| R18 | Siete COAMI, ninguno por defecto | `0006` (`ai.actividad_coami`, cero-a-muchos) · semilla de los 7 | `dominios.test.ts` (5 pruebas) | ✅ |
| R19 | Las once pestañas | `0007_ai_tablas_hijas.sql` (las once) · `0009` (`ai.recalcular_registro_completo`) · `packages/schema/src/pestanas.ts` | «es FALSE al crear, TRUE con las once, FALSE al retirar una» + 8 en `pestanas.test.ts` | ✅ **Verificada** |

**Recuento:** 13 reglas verificadas con prueba en base, 6 parciales cuyo resto
depende de las Fases 2 y 3. Ninguna sin empezar.

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
| P7 | Testigo de sesión en claro | **No** | `0004`: `hash_testigo char(64)` con `CHECK` de formato sha256 hex. Verificado que un testigo en claro no cabe |
| P8 | Prohibir el borrado físico solo en la documentación | **No** | Tres roles de privilegio en `0001`, `GRANT DELETE` solo a `paid_administracion`, `seg.solicitud_eliminacion` con motivo obligatorio. Verificado que el rol de operación recibe `permission denied` |
| P9 | Dominios cerrados como texto libre | **No** | 33 catálogos en `ref`, todos con `CHECK` de formato en el código. `ref.normalizar_texto` hace comparables «BINACIONAL» y «Binacional», y se verifica que **da lo mismo que la función de TypeScript** sobre 6 cadenas |
| P10 | Desnormalizar geografía y jerarquía | **No** | `org.unidad` es una sola tabla con referencia a sí misma; el nivel sale de `ref.nivel_jerarquia`. `ref.municipio` no repite el nombre del departamento: apunta con clave foránea, y la coherencia del código DANE se impone con una columna **derivada** y una clave foránea sobre ella. Verificado que un municipio en el departamento equivocado no entra |
| P11 | `SET` en lugar de `SET LOCAL` | **No** | `packages/db/src/contexto.ts` usa `set_config(clave, valor, **true**)`. Verificado con `max = 1` en el pool: tras una transacción con contexto, la siguiente sobre **la misma conexión** no ve nada del anterior |

---

## Reglas de IA (IA1–IA8)

| # | Regla | Dónde | Estado |
|---|---|---|---|
| IA1 | La IA propone; la persona dispone | `apps/ia/src/paid_ia/principal.py` (descripción del servicio) | ⛔ **Fase 6/7**. Hoy el servicio no tiene con qué escribir: no hay cliente de base de datos en `apps/ia` |
| IA2 | Salida estructurada por construcción | — | ⛔ **Fase 7**. Preparada por D-02 (Zod 4 y `z.toJSONSchema`) |
| IA3 | Procedencia por campo | `apps/ia/src/paid_ia/principal.py` (TODO de `/extraer`) | ⛔ **Fase 7** |
| IA4 | Nunca inventar cifras | `apps/ia/src/paid_ia/principal.py` (TODO de `/extraer`) | ⛔ **Fase 7** |
| IA5 | Registro completo de cada interacción | — | ⛔ **Fase 6** (`ia.sugerencia`, `ia.modelo`) |
| IA6 | Degradación limpia | `apps/api/src/configuracion.ts` (`IA_HABILITADA=false`, `IA_TIMEOUT_MS`) · `packages/schema/src/errores.ts` (`IA_NO_DISPONIBLE`, `MENSAJE_IA_NO_DISPONIBLE`) · `apps/ia/.../principal.py` (responde «degradado», no error) · `apps/web/src/App.tsx` (la pantalla se dibuja con la API caída) | ✅ **Verificado**: `docker compose up` no levanta `ia` (D-04), la interfaz se dibuja sin API, y los 97 tests de la Parte A pasan sin que el servicio de IA exista |
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

## Resultado de la batería de pruebas

Ejecutado al cerrar la Fase 1:

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
apps/api, apps/web: sin pruebas todavía (Fases 2 y 3)
e2e: pendiente hasta la Puerta 4
                 ─────────────────────────────────
                 TOTAL           157 pruebas, 157 pasan

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
- `pnpm db:migrate` sobre base vacía → 11 migraciones aplicadas
- reversión completa → **0 tablas**; reaplicación → 71 tablas

## Lo pendiente, sin adornarlo

1. **El esquema Drizzle en TypeScript para la capa de consulta no está.** Las
   migraciones son la fuente de verdad del esquema y están completas y
   verificadas; lo que falta es el mapeo tipado que usará `apps/api`. Es la
   primera tarea de la Fase 3. Se dejó fuera en lugar de escribir la mitad
   (D-15).
2. **`docker compose up` sigue sin verificarse** (D-07). El archivo valida, los
   contenedores no se pueden construir por la política de egreso de la red de
   la sesión.
3. **Nada de las Fases 2, 3, 4 está empezado.** Autenticación, API REST de
   jornadas, interfaz. Seis de las diecinueve reglas están a medias por eso, y
   la tabla de arriba dice cuáles.
4. **El esquema está derivado, no verificado contra el DDL de referencia**
   (D-13). Cuando aparezca `anexo_A_ddl_paid.sql` habrá que reconciliar
   nombres de columna, y eso en una base con datos no es gratis.
5. **Los catálogos que dependen de JACID están vacíos**, y en consecuencia
   ninguna actividad puede alcanzar `registro_completo = TRUE` hasta que se
   respondan Q2 y Q4. Es el comportamiento correcto, pero significa que el
   sistema **no es utilizable de punta a punta** todavía por un motivo ajeno al
   código.
6. **DIVIPOLA sin cargar:** `ref.municipio` está vacío.
7. **`docs/EVALUACION-IA.md` no existe.** B.8 lo exige. Requiere las 50–100
   jornadas ya registradas a mano del conjunto de referencia (B.7, punto 1).
8. **Deuda anotada de la Fase 2:** al recolocar una unidad en la jerarquía hay
   que cerrar las sesiones de su subarborescencia, porque el contexto lleva la
   ruta (D-16). Es fácil de olvidar y produciría un ámbito obsoleto, no un
   error visible.
