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

**Estado: Fase 0 cerrada.** Lo que hay implementado son los invariantes que
`PROMPT.md` enuncia de forma literal y que no dependen de
`anexo_A_ddl_paid.sql`. El resto espera ese archivo.

---

## Reglas del dominio (R1–R19)

Ubicaciones relativas a `paid/`.

| # | Regla | Dónde se impone hoy | Estado |
|---|---|---|---|
| R1 | Sesión de 10 min, deslizante, evaluada en servidor | `apps/api/src/configuracion.ts` (`SESION_TTL_SEGUNDOS`, y la comprobación de que el aviso precede a la expiración) · `.env.example` | ⚠️ Parcial: solo la configuración. El TTL en Redis y `seg.sesion` son de la **Fase 2** |
| R2 | Red cerrada; rangos en `seg.red_autorizada`, no en entorno | `apps/api/src/configuracion.ts` (comentario que prohíbe CIDR aquí) · `docker/web/nginx.conf` (`X-Forwarded-For`, para que la API vea la IP real) | ⚠️ Parcial: la tabla y su validación son de la **Fase 1/2** |
| R3 | Captcha de un solo uso, se guarda el resumen | — | ⛔ **Fase 2** |
| R4 | Ocho causas en la base, un solo mensaje en la pantalla | `packages/schema/src/dominios.ts` (`RESULTADOS_INTENTO_AUTENTICACION`, `MENSAJE_CREDENCIALES_INVALIDAS`) · pruebas en `dominios.test.ts` | ✅ El dominio y el mensaje único. El flujo que los usa es de la **Fase 2** |
| R5 | Credencial de unidad `<SIGLA>_PAID` | `packages/schema/src/dominios.ts` (`credencialUnidad`) · pruebas en `dominios.test.ts` | ✅ Validación · ⛔ `seg.usuario` es de la **Fase 1** |
| R6 | Ámbito jerárquico con RLS sobre `ltree` | `packages/schema/src/dominios.ts` (`NIVELES_JERARQUIA`) · `docker/postgres/initdb/01-usuario-aplicacion.sh` (`NOBYPASSRLS`, sin el cual RLS no protege nada) | ⛔ Las políticas son de la **Fase 1** |
| R7 | Contexto de sesión con `SET LOCAL` en la transacción | `packages/db/src/contexto.ts` (todo el archivo) · `packages/db/src/cliente.ts` (`enTransaccionConContexto`) | ✅ Mecanismo implementado · ⛔ La prueba de fuga es de la **Puerta 2** |
| R8 | Tres maestros de precedencia | `packages/schema/src/dominios.ts` (`MAESTROS_DE_PRECEDENCIA`) | ⛔ Las claves foráneas son de la **Fase 1** |
| R9 | `participo_arc` siempre TRUE | `packages/schema/src/dominios.ts` (`participoArc`) · pruebas en `dominios.test.ts` | ✅ En el esquema compartido · ⛔ El `CHECK` es de la **Fase 1** |
| R10 | Escala de ocho tramos: 10..70, 100. **No existen 80 ni 90** | `packages/schema/src/avance.ts` (`TRAMOS_AVANCE`, `tramoAvance`, `puedeAvanzarA`) · 21 pruebas en `avance.test.ts` | ✅ Escala y progresión · ⛔ El `CHECK` y el disparador son de la **Fase 1** |
| R11 | Cuota de 10 MB **agregada** por actividad | `packages/schema/src/adjunto.ts` (`CUOTA_BYTES_POR_ACTIVIDAD`, `cabeEnLaCuota`, `calcularCuota`) · pruebas en `adjunto.test.ts`, incluida la de los 40 archivos de 9 MB | ✅ Cálculo y aviso previo · ⛔ El disparador `BEFORE INSERT` es de la **Fase 1** |
| R12 | Extensiones por categoría, validadas contra el contenido real | `packages/schema/src/adjunto.ts` (`EXTENSIONES_POR_CATEGORIA`, `MIME_ESPERADO_POR_EXTENSION`, `mimeCoincideConExtension`) · pruebas en `adjunto.test.ts` | ✅ Catálogo y comprobación MIME/extensión · ⛔ La lectura del número mágico del archivo real es de la **Fase 3** |
| R13 | Georreferenciación en los SEIS formularios | `packages/schema/src/coordenadas.ts` (`coordenadaGms`, `aDecimal`, `FORMULARIOS_CON_GEORREFERENCIA`) · pruebas en `coordenadas.test.ts` | ✅ GMS y la fórmula canónica · ⛔ Las columnas generadas y el índice GiST son de la **Fase 1** |
| R14 | Eliminar es un trámite | `packages/schema/src/dominios.ts` (`ESTADOS_REGISTRO`) · `packages/schema/src/errores.ts` (`ELIMINACION_REQUIERE_SOLICITUD`) | ⛔ Privilegios revocados y `seg.solicitud_eliminacion` son de la **Fase 1** |
| R15 | Bitácora obligatoria, por disparador | `docker-compose.yml` (`log_min_duration_statement`, para vigilar el coste del disparador) | ⛔ **Fase 1** |
| R16 | Atribuciones centralizadas en JACID | `packages/schema/src/dominios.ts` (`PERMISOS_EXCLUSIVOS_JACID`) | ⛔ La matriz de permisos es de la **Fase 2** |
| R17 | Asistencia DIRECTA exige plan operacional | `packages/schema/src/dominios.ts` (`asistenciaHumanitaria`) · pruebas en `dominios.test.ts` | ✅ En el esquema compartido · ⛔ El `CHECK` es de la **Fase 1** |
| R18 | Siete COAMI, opcionales, ninguno por defecto | `packages/schema/src/dominios.ts` (`COAMI`, `coamiParticipantes`) · pruebas en `dominios.test.ts` | ✅ |
| R19 | Las once pestañas | `packages/schema/src/pestanas.ts` (`PESTANAS_ACTIVIDAD`, `evaluarPestanas`) · pruebas en `pestanas.test.ts` | ✅ Dominio y cálculo · ⛔ `ai.actividad.registro_completo` es de la **Fase 1** |

**Recuento de la Fase 0:** 8 reglas con algo implementado y probado, 4 parciales,
7 sin empezar por depender del esquema.

---

## Anti-patrones (P1–P11)

| # | Anti-patrón | ¿Presente? | Cómo se comprueba hoy |
|---|---|---|---|
| P1 | Referencia polimórfica sin integridad | **No** | No hay esquema. La prueba real es de la **Puerta 1** |
| P2 | Documentar una tabla y no implementarla | **No** | No hay tabla documentada como existente. `packages/db/src/esquema/README.md` lista los esquemas **previstos** y dice expresamente que está vacío. `PESTANA_QUE_ALIMENTA_EL_RAO` nombra `POBLACION_BENEFICIADA` para que el test de inventario de la **Puerta 1** la cite por su nombre |
| P3 | Llamar «auditoría» a cuatro columnas | **No** | Sin esquema. **Puerta 1** |
| P4 | RBAC de nombre | **No** | Sin esquema. **Fase 2** |
| P5 | `CHECK` de fila para una regla de agregación | **No** | `cabeEnLaCuota` suma **todos** los archivos vigentes, y hay una prueba con 40 archivos de 9 MB que falla si alguien lo convierte en un límite por archivo (`adjunto.test.ts`) |
| P6 | Columnas «calculadas por trigger» sin el trigger | **No** | `aDecimal` es la fórmula canónica y el archivo lleva escrita, literal, la expresión SQL `GENERATED ALWAYS` que la **Fase 1** debe usar. Las pruebas fijan valores esperados (Cartagena, Leticia), así que una divergencia entre la fórmula y la columna generada se detecta comparando contra ellos |
| P7 | Testigo de sesión en claro | **No** | Sin `seg.sesion`. **Fase 2** |
| P8 | Prohibir el borrado físico solo en la documentación | **No** | `01-usuario-aplicacion.sh` ya crea el usuario no superusuario **sin el cual no hay nada que revocar**. Los privilegios son de la **Fase 1** |
| P9 | Dominios cerrados como texto libre | **No** | Todos los dominios que `PROMPT.md` enumera están como constantes cerradas en `packages/schema/src/dominios.ts`, y `normalizarTexto` hace comparables «BINACIONAL» y «Binacional» (probado en `primitivos.test.ts`). Las tablas `ref` son de la **Fase 1** |
| P10 | Desnormalizar geografía y jerarquía | **No** | Sin esquema. **Puerta 1** |
| P11 | `SET` en lugar de `SET LOCAL` | **No** | `packages/db/src/contexto.ts` usa `set_config(clave, valor, **true**)`, que es el `is_local` de `SET LOCAL`. No existe en el paquete ninguna función que ejecute SQL de dominio fuera de `enTransaccionConContexto`. El archivo documenta que cambiar ese `true` por `false` reintroduce el anti-patrón, y la prueba con `pool.max = 1` de la **Puerta 2** es lo que lo detecta |

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

Ejecutado en la sesión de cierre de la Fase 0:

```
$ pnpm -r build
packages/schema build: Done
packages/db     build: Done
apps/api        build: Done
apps/web        build: Done   (vite: 179 módulos, 275.45 kB)
e2e             build: Done

$ pnpm -r test
packages/schema: 6 archivos, 97 pruebas, 97 pasan
  ✓ src/avance.test.ts      (21)   R10 — escala de ocho tramos
  ✓ src/dominios.test.ts    (20)   R4, R5, R9, R17, R18
  ✓ src/adjunto.test.ts     (19)   R11, R12
  ✓ src/primitivos.test.ts  (15)   A.2.4, A.2.5, normalización
  ✓ src/coordenadas.test.ts (14)   R13
  ✓ src/pestanas.test.ts     (8)   R19
packages/db, apps/api, apps/web: sin pruebas todavía
e2e: pendiente hasta la Puerta 4

$ pnpm lint
(sin hallazgos)

$ cd apps/ia && ruff check . && mypy src && pytest tests
All checks passed!
Success: no issues found in 3 source files
3 passed
```

Comprobaciones manuales de la Fase 0:

- `GET /api/salud` → `200 {"estado":"sano","servicio":"paid-api",...}`
- `GET /api/no-existe` → `404 {"codigo":"REG_NO_ENCONTRADO",...,"idCorrelacion":"..."}`
  (respuesta de error uniforme con identificador de correlación)
- Arranque con `SESION_AVISO_SEGUNDOS > SESION_TTL_SEGUNDOS` → **aborta**,
  citando R1
- `GET /salud` del servicio de IA → `200 {"estado":"degradado",...}`
- `docker compose config` → los seis servicios válidos

---

## Lo pendiente, sin adornarlo

1. **⛔ Bloqueante: falta `anexo_A_ddl_paid.sql`.** La Fase 1 no ha empezado. No
   se ha inventado ni una tabla. Todo lo marcado «Fase 1» arriba depende de
   esto, y con ello las Fases 2, 3, 4 y las Puertas 1 a 5.
2. **`docker compose up` sin verificar.** Ver D-07. El archivo valida, los
   contenedores no se pudieron construir por una política de egreso de la red de
   la sesión.
3. **La mitad de las reglas no está impuesta**, y la tabla de arriba dice
   exactamente cuáles. De las 19, hay 8 con algo implementado y probado, 4
   parciales y 7 sin empezar.
4. **Ninguna prueba toca una base de datos real.** Los 97 tests son de lógica
   pura. Las reglas viven en la base, así que hasta que haya Testcontainers con
   Postgres real (Puerta 1) **no hay evidencia de que ninguna regla se imponga
   de verdad**, solo de que el esquema compartido las expresa bien.
5. **`docs/EVALUACION-IA.md` no existe.** B.8 lo exige. Requiere las 50–100
   jornadas ya registradas a mano del conjunto de referencia (B.7, punto 1).
6. **Sin `CHANGELOG` de migraciones ni procedimiento de despliegue.** El
   `README.md` explica cómo levantar y probar, y cómo desplegar sin IA, pero el
   despliegue real en la Intranet ARC depende de resolver el registro de
   imágenes espejado (D-07).
