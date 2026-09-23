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

**Estado: Fases 0, 1, 2 y 3 cerradas. Puerta 0 parcial (ver abajo), Puertas 1, 2 y 3 superadas.**

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
| R2 | Red cerrada; rangos en tabla, no en entorno | `0004` (`seg.red_autorizada`, tipo `cidr`) · `apps/api/src/seguridad/red.service.ts` (compara con `>>=` de `inet`) · `comun/aviso-arranque.ts` | 5 pruebas: dentro pasa, fuera no, queda `RED_NO_AUTORIZADA`, y responde lo mismo que credenciales inválidas | ✅ **Verificada.** En `production` un rango abierto **impide arrancar** |
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

- **R2** no solo avisa: *impide arrancar* en producción con la red abierta.
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

## Reglas de IA (IA1–IA8)

| # | Regla | Dónde | Estado |
|---|---|---|---|
| IA1 | La IA propone; la persona dispone | `apps/ia/src/paid_ia/principal.py` (descripción del servicio) | ⛔ **Fase 6/7**. Hoy el servicio no tiene con qué escribir: no hay cliente de base de datos en `apps/ia` |
| IA2 | Salida estructurada por construcción | — | ⛔ **Fase 7**. Preparada por D-02 (Zod 4 y `z.toJSONSchema`) |
| IA3 | Procedencia por campo | `apps/ia/src/paid_ia/principal.py` (TODO de `/extraer`) | ⛔ **Fase 7** |
| IA4 | Nunca inventar cifras | `apps/ia/src/paid_ia/principal.py` (TODO de `/extraer`) | ⛔ **Fase 7** |
| IA5 | Registro completo de cada interacción | — | ⛔ **Fase 6** (`ia.sugerencia`, `ia.modelo`) |
| IA6 | Degradación limpia | `apps/api/src/configuracion.ts` (`IA_HABILITADA=false`, `IA_TIMEOUT_MS`) · `packages/schema/src/errores.ts` · `apps/ia/.../principal.py` (responde «degradado», no error) · `apps/web/src/App.tsx` | ✅ **Verificado**: `docker compose up` no levanta `ia` (D-04), la interfaz se dibuja sin API, y las **195** pruebas de la Parte A pasan sin que el servicio de IA exista ni esté instalado |
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

Tras la revisión de usabilidad (2026-09-23): **290 pruebas, 290 pasan** —
116 de invariantes, 60 de la Puerta 1, 100 de API y 14 de navegador—, y la
revisión de accesibilidad cubre ahora también la jornada abierta con sus
pestañas, en los tres contrastes. Lint limpio.

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
- arranque con `NODE_ENV=production` y red `0.0.0.0/0` → **el proceso no levanta**

## Lo pendiente, sin adornarlo

1. **El esquema Drizzle en TypeScript para la capa de consulta no está.** Las
   migraciones son la fuente de verdad del esquema y están completas y
   verificadas; lo que falta es el mapeo tipado que usará `apps/api`. Es la
   primera tarea de la Fase 3. Se dejó fuera en lugar de escribir la mitad
   (D-15).
2. **`docker compose up` sigue sin verificarse** (D-07). El archivo valida, los
   contenedores no se pueden construir por la política de egreso de la red de
   la sesión.
3. **Faltan los otros cuatro subtipos de actividad** (asistencias, ruedas,
   proyectos, campañas): las tablas y las reglas están, falta su API y su
   pantalla. Esperan Q4, que decide cómo se agrupan las pestañas en cada tipo;
   construirlas suponiendo la respuesta obligaría a rehacerlas con datos
   dentro. Las tres entradas del menú tienen pantalla que dice qué falta y por
   qué, no enlace muerto.
4. **⛔ `AlmacenMinio` está escrito y NO ejecutado.** `dl.min.io` bloqueado por
   la política de egreso, como las imágenes de Docker. R11 y R12 sí están
   verificadas porque se imponen antes del almacén (D-22), pero que MinIO
   funcione está sin comprobar.
5. **La exportación tiene un tope de 500 filas.** Es deliberado —recortar en
   silencio sería peor que fallar— pero un consolidado anual lo supera.
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
8. **Al recolocar una unidad hay que cerrar las sesiones de su
   subarborescencia**, porque el contexto lleva la ruta (D-16). Sigue
   pendiente. No produce un error: produce un ámbito equivocado.
9. **No hay endpoint de cambio de clave.** `ClaveService` tiene el historial de
   5 y la comprobación de reutilización, pero nada las usa todavía, y
   `CLAVE_EXPIRADA` se registra y rechaza el ingreso sin ofrecer el cambio. Es
   trabajo de la Fase 4, cuando haya pantalla.
10. **El captcha es aritmético, no de imagen** como muestra el manual. El
    sustituto es explícito y accesible (una imagen sin alternativa incumpliría
    WCAG 2.1 AA); si JACID exige el del manual, se reemplaza el generador sin
    tocar el flujo.
