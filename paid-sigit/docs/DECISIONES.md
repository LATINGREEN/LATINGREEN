# Decisiones — PAID SIGIT Versión 2026

Cada decisión con su motivo. Una decisión sin motivo escrito es una decisión
que alguien deshace sin saberlo.

## D-S01 · Python + Django + PostgreSQL · 2026-09-30

**Contexto.** La PAID anterior de este repositorio (`paid/`) está en TypeScript
(NestJS + React). En la reunión del 30/09/2026 el área de tecnología dijo que
trabaja en Python + Django + PostgreSQL, y el usuario pidió expresamente:
«REALÍZALO EN Python Django + PostgreSQL».

**Decisión.** PAID SIGIT es un proyecto nuevo, en `paid-sigit/`, en Django 5.2
(LTS, soporte hasta abril de 2028). No se tocó `paid/`: queda como referencia.
Se trajeron sus reglas y sus lecciones (RLS con contexto local, sin valores por
omisión en datos del consolidado, IP real tras proxy, soportes validados por
contenido), no su código.

## D-S02 · El nombre: «PAID SIGIT Versión 2026» · 2026-09-30

El pedido traía dos formas, «PAID SIGIT» y «PyCHIT»; la segunda es el dictado
de «Pay-SIGIT». El usuario confirmó «PAID SIGIT Versión 2026».

## D-S03 · El contexto de RLS se fija por transacción, en un middleware

**Problema.** Django reutiliza conexiones. Un `SET` normal dejaría la unidad de
una petición pegada a la conexión y la siguiente petición, de otra unidad, la
heredaría: fuga de datos sin ningún error.

**Decisión.** `ContextoBaseDatosMiddleware` envuelve cada petición en una
transacción y fija `app.ruta_unidad` y `app.id_usuario` con
`set_config(…, true)`, que dura lo que la transacción. Va después de la
autenticación. Las peticiones sin usuario fijan un contexto **vacío** a
propósito. La API con testigo fija el suyo en la clase de autenticación, dentro
de la misma transacción. Los errores 5xx revierten la transacción a mano,
porque Django convierte la excepción en respuesta antes de que el `atomic` la
vea. Prueba: `test_el_contexto_no_sobrevive_a_la_transaccion`.

## D-S04 · RLS forzada, que falla cerrada, y dos roles

- `FORCE ROW LEVEL SECURITY`: las políticas aplican también al dueño. Así las
  pruebas (que corren como dueño) ejercitan las mismas políticas que producción.
- Sin contexto, las políticas no dejan ver nada. Las órdenes de administración
  piden explícitamente `contexto_de_sistema()`.
- Migraciones con el rol dueño; la aplicación con `sigit_app`, `NOSUPERUSER
  NOBYPASSRLS`, sin `DELETE` en tablas de borrado lógico ni escritura en la
  bitácora. Aunque alguien lograra ejecutar SQL por la aplicación, no podría
  desactivar RLS.

## D-S05 · Las entidades son un maestro compartido

Personal, herramientas y jornadas se ven por unidad. Las **entidades** se leen
desde cualquier unidad (se escriben solo en la propia): una alcaldía es la
misma para todos, y si cada unidad solo viera las suyas registraría la misma
alcaldía otra vez. Es la duplicidad que la plataforma tiene que evitar.

## D-S06 · Nada de SIGIT entra sin revisión de JACID

El Capitán Ramos fue explícito: hay actividades que no caben en la categoría
con que se proponen. Por eso la integración deposita en una **bandeja**, y la
aprobación —que puede reclasificar y reasignar— es la que crea la jornada. La
base impone que un rechazo tenga motivo y una aprobación tenga jornada. La
recepción es idempotente por `(sistema, id_externo)`: SIGIT puede reenviar cada
hora sin duplicar.

## D-S07 · Posibles duplicados: avisar y pedir confirmación, no bloquear

Dos jornadas legítimas pueden coincidir en municipio y fecha. Bloquearlas
obligaría a inventar diferencias. Lo que no puede pasar es guardar una
repetición **sin verla**: la plataforma muestra las parecidas (mismo municipio,
±3 días, lugar semejante por trigramas) y exige marcar una confirmación. Donde
sí hay unicidad natural (documento de una persona, NIT, mismo soporte, mismo
elemento en una pestaña, mismo id externo) la impone la base.

## D-S08 · Plantillas del servidor + htmx, no una SPA

Menos piezas que mantener, un solo lenguaje de servidor (lo que pide el área
de tecnología), y cada pantalla sigue siendo HTML del servidor. htmx (0BSD)
cubre lo que necesita la interacción moderna: pestañas sin recargar, selects
dependientes, avisos en vivo, filtros que se aplican solos.

## D-S09 · CSP estricta: sin scripts ni estilos en línea

`script-src 'self'` y `style-src 'self'`, sin `unsafe-inline`. Consecuencias
aceptadas: los datos de las gráficas viajan en `<script type="application/json">`
(no se ejecuta); los anchos de barras y el mapa de calor usan clases
discretas; las ayudas emergentes de ECharts se dibujan en el lienzo
(`renderMode: 'richText'`), porque su HTML trae estilos en línea.

## D-S10 · Indicadores de impacto: estructura sí, indicadores no

La mesa de expertos está definiéndolos. Se construyó el modelo completo
(fórmula, línea base, meta, periodicidad, fuente, mediciones) y su
visualización, y el catálogo arranca **vacío**. Inventar indicadores
«plausibles» sería peor que no tenerlos: parecerían aprobados.

## D-S11 · Catálogos: solo lo que tiene fuente

Se siembra lo que enumera el Manual del Usuario (tipos de jornada, tipos y
estados de herramienta AID), el DANE (departamentos) y lo que la PAID ya traía
con su marca TODO(JACID). Los catálogos de las pestañas quedan vacíos hasta que
JACID los entregue; la demostración usa ejemplos marcados «EJEMPLO» con una
orden aparte que se niega a correr en producción.

## D-S12 · Sin archivo de licencia del código

Quién es dueño del código (cesión de derechos patrimoniales a la Armada) es
una decisión jurídica entre la reserva y la institución. No se presume con un
archivo de licencia. Las licencias de terceros sí están inventariadas y
comprobadas (`LICENCIAS.md`).

## D-S13 · Demostración en línea en Render · 2026-09-30

**Contexto.** El usuario pidió verla en línea en un dominio provisional. El
alojamiento compartido de Hostinger no ejecuta Python ni PostgreSQL; Render
tiene plan gratuito para ambos, sin tarjeta.

**Decisión.** `render.yaml` + dos guiones en `scripts/`. La demostración se
marca con `SIGIT_DEMOSTRACION`, no con `SIGIT_DEBUG`: el modo depuración
mostraría trazas a cualquiera en internet. Render da un solo rol de base de
datos; la RLS forzada lo somete igual, y `comprobar_rol_bd` impide arrancar si
el rol fuera superusuario o tuviera `BYPASSRLS`. El nombre de host se toma de
`RENDER_EXTERNAL_HOSTNAME` en vez de admitir todo `*.onrender.com`. La sonda
`/salud/` queda exenta de la redirección a HTTPS, porque los orquestadores la
consultan por http interno.
