# Requisitos de la reunión con el área de tecnología — trazabilidad

**Reunión:** «Reunión Señor CPORA», 30/09/2026, 31 minutos.
**Participantes:** CN (RA) Carlos Lindemeyer, TN Juan David Vélez (sistemas de
información, área de tecnología), S1 Huver Ramos (JACID), TC (RA) William
Velásquez (profesionales oficiales de la reserva).

Este documento toma cada cosa que se pidió o se advirtió en la reunión y dice
**dónde se atiende en PAID SIGIT Versión 2026** o **qué falta y de quién
depende**. Las citas son de la transcripción (Tactiq), que tiene errores de
dictado; se corrigen solo cuando el sentido es inequívoco (p. ej., «Dyango» →
Django, «postres» → Postgres, «la Pay» → la PAID).

---

## 1. Lo que se pidió construir

| # | Requisito (quién, minuto) | Cómo se atiende | Dónde |
|---|---|---|---|
| R1 | **Python + Django + PostgreSQL**, el stack del área de tecnología: «Nosotros también estamos actualmente en python Django y base de datos Postgres» (Vélez, 16:10). | Toda la plataforma está en Django 5.2 LTS sobre PostgreSQL 16. Sin otro lenguaje de servidor. | `pyproject.toml`, `config/`, `sigit/` |
| R2 | **Evitar el doble proceso**: «evitar el doble proceso… que a la final no es sino una fuente de error» (Lindemeyer, 26:43). Hoy la reserva reporta y JACID vuelve a digitar. | Lo que reporta SIGIT llega por API o archivo plano **una sola vez** y se convierte en jornada con un clic de aprobación: nadie lo vuelve a teclear. | `sigit/integracion/`, bandeja en `/integracion/bandeja/` |
| R3 | **JACID supervisa**: «debe haber una supervisión… hay actividades que no pueden ser consideradas de la categoría que las proponen» (Ramos, 28:20). | Nada de SIGIT entra solo. Bandeja de revisión: el revisor aprueba, **reclasifica** el tipo de jornada, reasigna la unidad o rechaza con motivo (obligatorio, lo impone la base). | `integracion/servicios.py` (`aprobar`, `rechazar`), restricciones `rechazo_exige_motivo` y `aprobado_exige_jornada` |
| R4 | **API o archivo plano, periódico**: «remitir un archivo plano para que ustedes puedan alimentar la base» (Velásquez, 22:17); «que abran una API… cada dos horas, cada hora» (Vélez, 22:40 y 24:08). | Las dos vías, con la misma validación: `POST /api/v1/integracion/actividades/` (hasta 500 por llamada) y carga de CSV con plantilla. Idempotente por `id_externo`: se puede reenviar cada hora sin duplicar. SIGIT consulta después el estado (aprobada, rechazada y por qué). | `api/vistas.py`, `integracion/esquema.py`, `/integracion/archivo/` |
| R5 | **Gobernanza del dato e interoperabilidad**: «38 sistemas de información… que no sean temas aislados… abrimos una API para poder compartir esos datos… el dato maestro, el diccionario de datos» (Vélez, 18:37). Integración futura con SIGO. | API de lectura de datos maestros (catálogos, unidades, municipios DANE, resumen de jornadas) con testigo por sistema y alcance LECTURA; contrato **OpenAPI 3**; **diccionario de datos generado** desde los modelos y comprobado en cada verificación. | `/api/v1/esquema/`, `/api/v1/documentacion/`, `docs/DICCIONARIO-DATOS.md` |
| R6 | **Indicadores de impacto de largo plazo** (metodología SIGIT): «indicadores que puedan ser medidos… a largo plazo para medir el impacto… dentro de la comunidad» (Velásquez, 06:58; Ramos, 10:07). | Estructura completa: indicador con objetivo, fórmula, unidad de medida, periodicidad, sentido, línea base, meta y fuente; mediciones por periodo, unidad y municipio; gráfica de evolución contra base y meta. **El catálogo arranca vacío**: los indicadores los define la mesa de expertos. | `sigit/analitica/models.py`, `/analitica/indicadores/` |
| R7 | **Subregistro de actividades de la reserva** (Velásquez, 28:12; Lindemeyer, 27:31). | Al bajar el costo de reportar (R2) y dejar la decisión en JACID (R3), lo que hace la reserva llega y queda trazado: cada jornada aprobada guarda de qué sistema y con qué identificador vino. | `Jornada.origen = SIGIT`, `RegistroExterno.jornada` |

## 2. Lo que exige el área de tecnología para aceptar el desarrollo

| # | Exigencia (Vélez) | Cómo se atiende | Dónde |
|---|---|---|---|
| T1 | **Análisis de código estático** (20:18). | `ruff` con reglas de seguridad (`S`, familia bandit), Django y estilo; `bandit` sin hallazgos abiertos (los tres descartados están justificados en el código). | `scripts/verificar.sh` |
| T2 | **Pruebas unitarias** (16:20). | 68 pruebas con PostgreSQL real y RLS activa; cobertura mínima exigida 80 % (hoy 83 %). Incluyen las pruebas que demuestran el aislamiento por unidad. | `pruebas/` |
| T3 | **Escaneo de seguridad** con sus servicios y un agente de IA (16:20, 20:18). | La plataforma está preparada para el escaneo: cabeceras de seguridad, CSP estricta sin scripts en línea, cookies `Secure`/`HttpOnly`/`SameSite=Strict`, HSTS, `check --deploy` sin advertencias. **El escaneo lo hace la Armada**; se entrega lo necesario para que corra. | `docs/SEGURIDAD.md` |
| T4 | **Revisar el código generado con IA**: «quedan muchos temas de seguridad… siempre es recomendable revisar cada uno de los códigos» (17:17). | Desarrollo híbrido con revisión: cada regla de seguridad tiene una prueba que la hace fallar si se rompe; las decisiones están escritas con su motivo (`docs/DECISIONES.md`). **Recomendado:** revisión por pares del área de tecnología antes de producción. | `docs/DECISIONES.md` |
| T5 | **Derechos de autor**: «que la Armada Nacional no tenga ningún problema legal en el futuro de poder utilizar este software» (17:52). | Inventario de licencias de todas las dependencias, comprobado automáticamente: ninguna GPL/AGPL. Fuentes con licencia OFL, librerías del navegador Apache-2.0 y 0BSD, servidas desde el propio despliegue. **Pendiente de decisión:** la cesión de derechos patrimoniales del código a la Armada (ver §4). | `docs/LICENCIAS.md` |
| T6 | **Gobernanza del código en el repositorio de la Armada** (17:52). | El proyecto es autocontenido en `paid-sigit/`, con versiones exactas y `uv.lock` con resúmenes: se puede trasladar tal cual a la forja de la Armada. | `pyproject.toml`, `uv.lock` |
| T7 | **Contenedores Docker** para el despliegue automático (17:52). | Imagen de dos etapas, usuario sin privilegios, sonda de salud; `compose.yml` con PostgreSQL, aplicación y nginx; solo nginx queda publicado. | `docker/`, `compose.yml` |
| T8 | **Documentación**: manuales de usuario y técnicos, «por si en el futuro se quiere hacer algún cambio, se quiere escalar» (18:37). | Manual de usuario, manual técnico, arquitectura, seguridad, diccionario de datos, decisiones. | `docs/` |
| T9 | **Lineamientos de arquitectura**: «monolítica… o hexagonal desacoplada, todas son válidas, mientras estén soportadas» (18:37). | **Monolito modular**, documentado: módulos con fronteras explícitas (núcleo, maestros, jornadas, integración, analítica, API), reglas de negocio en servicios y no en vistas, y las garantías de seguridad en la base de datos. | `docs/ARQUITECTURA.md` |

## 3. Lo que quedó abierto en la reunión y no decide el desarrollo

| # | Tema | Estado en PAID SIGIT | Quién decide |
|---|---|---|---|
| A1 | **Intranet o internet**: «obedece a políticas de seguridad… lo hablo con el área de seguridad» (Vélez, 14:52 y 20:18). | La plataforma funciona en ambos: se sirve a sí misma (sin CDN, sin fuentes externas, sin telemetría) y admite una lista de redes autorizadas si se decide cerrarla. | Área de seguridad de la Armada |
| A2 | **Lineamientos de seguridad y de desarrollo de la Armada** («yo le puedo enviar los de desarrollo», 20:07). | No se han recibido. Cuando lleguen, se contrastan con `docs/SEGURIDAD.md` y se cierran las diferencias. | TN Vélez → equipo de la reserva |
| A3 | **Indicadores de impacto** de la mesa de expertos. | La estructura está; los indicadores no se inventan. | Mesa de expertos SIGIT + JACID |
| A4 | **Catálogos de las pestañas** (servicios, grupos poblacionales, medios, recursos, bienes) y el algoritmo del código de actividad. | Vacíos en producción; la demostración usa ejemplos marcados «EJEMPLO». Heredado de la PAID (Q1, Q2, Q4). | JACID |
| A5 | **Integración con SIGO** (nueva versión) y con los demás sistemas. | API y OpenAPI listos para que otro sistema consuma; faltan los acuerdos de qué dato maestro manda en cada caso. | Área de tecnología |
| A6 | **Cesión de derechos** del software a la Armada. | No se incluyó un archivo de licencia: esa decisión es jurídica, entre la reserva y la Armada. | Reserva + Armada (asesoría jurídica) |

## 4. Recomendaciones para la siguiente reunión con el área de tecnología

1. Pedir los **lineamientos de desarrollo seguro** prometidos y el nombre de la
   herramienta de escaneo, para correrla sobre este código antes de la entrega.
2. Acordar la **vía de integración** (API cada hora o archivo diario) y quién
   emite y custodia el testigo de SIGIT.
3. Definir la **cesión de derechos patrimoniales** del código a la Armada por
   escrito, antes de la entrega formal.
4. Validar con JACID los **catálogos** y la lista de **indicadores** para
   reemplazar los de ejemplo.
5. Decidir **intranet o internet** con el área de seguridad; el despliegue ya
   admite las dos.
