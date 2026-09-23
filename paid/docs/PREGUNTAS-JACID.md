# Preguntas para JACID

**Para qué sirve este documento.** Hay doce puntos del sistema que no se pueden
decidir desde la programación: dependen de información que solo tiene la
Jefatura. En cada uno de ellos se dejó **un sustituto explícito que funciona**,
marcado en el código como `TODO(JACID)`, para no detener la construcción. Pero
un sustituto no es la respuesta: si se despliega así, el sistema funcionará y
dará resultados equivocados sin avisar.

**Cómo responder.** Cada pregunta está redactada para que la pueda contestar un
funcionario sin conocimientos técnicos. No hace falta responder todas de una
vez ni en orden: cada respuesta se puede incorporar por separado. Si la
respuesta es «no existe» o «no se ha definido», **eso también es una respuesta
útil** y cambia lo que se construye.

**Prioridad.** Las marcadas 🔴 bloquean o condicionan trabajo que ya está en
curso. Las 🟡 se pueden responder más adelante sin frenar nada.

---

## ✅ Q0 — El archivo `anexo_A_ddl_paid.sql` · **resuelta: no existe**

La especificación nombraba un archivo, `anexo_A_ddl_paid.sql`, como punto de
partida obligatorio para la base de datos. **No existe.** Se confirmó y se
autorizó construir el esquema a partir de las reglas escritas en la propia
especificación.

**Eso ya está hecho:** la base de datos está construida y verificada con 60
pruebas automáticas contra un PostgreSQL real. Las reglas que importan —que el
avance de un proyecto no pueda ser del 80 %, que los adjuntos de una actividad
no pasen de 10 MB *entre todos*, que una unidad no vea los datos de otra, que
nadie pueda alterar el registro de auditoría— están impuestas por la base de
datos y comprobadas una por una.

**Lo que conviene saber, porque tiene consecuencias:**

1. **Los nombres de las columnas son los que elegimos nosotros.** Si algún día
   aparece el diseño original, habrá que reconciliar los dos, y renombrar
   columnas en una base que ya tiene datos no es una operación gratuita.
2. **Puede faltar algo que ninguna regla menciona.** La especificación hablaba
   de «26 catálogos»; se implementaron 33, los que las reglas exigen. Si el
   diseño original tenía catálogos que el documento no describe, aquí no están.
3. **No se inventó ningún contenido de catálogo.** Autorizar construir el
   esquema no autorizó rellenarlo. Por eso las preguntas Q2 y Q4 siguen siendo
   las que más bloquean: sin las 17 campañas y sin los campos de cinco
   pestañas, **una actividad no se puede dar por completa en el sistema**. Eso
   es deliberado: es mejor que el sistema no deje cerrar un registro que dejarlo
   cerrar contra una categoría inventada, porque en ese caso el consolidado del
   RAO cuadraría y estaría mal.

---

## 🔴 Q1 — Cómo se construye el código de una actividad

**Qué se observó.** En los registros existentes, el código de cada actividad
tiene esta forma:

| Ejemplo | Lectura tentativa |
|---|---|
| `2813304R102021R6HXZ` | unidad `2813304`, `R`, mes `10`, año `2021`, sufijo `R6HXZ` |
| `6114022R22022DPKAZ` | unidad `6114022`, `R`, mes `2`, año `2022`, sufijo `DPKAZ` |
| `1111853R82022JCTLR` | unidad `1111853`, `R`, mes `8`, año `2022`, sufijo `JCTLR` |
| `2510444R102021JVRTP` | unidad `2510444`, `R`, mes `10`, año `2021`, sufijo `JVRTP` |
| `6102320R22022RT4HZ` | unidad `6102320`, `R`, mes `2`, año `2022`, sufijo `RT4HZ` |
| `22121854R72021MANPP` | unidad `22121854`, `R`, mes `7`, año `2021`, sufijo `MANPP` |

**Lo que no se sabe:**

1. ¿El primer bloque de números es el código de la unidad? ¿De qué catálogo
   sale? (En un ejemplo tiene 8 dígitos y en los demás 7.)
2. ¿Qué significa la letra `R`?
3. Los cinco caracteres finales, ¿son aleatorios, o codifican algo (tipo de
   actividad, consecutivo, iniciales del responsable)? Si codifican algo, **hay
   información en el código que el sistema debe poder leer**, y eso cambia el
   diseño.
4. ¿El código lo genera el sistema o lo digita el usuario?

**Lo que se hizo mientras tanto.** Se implementará el patrón observado detrás de
una pieza sustituible, de forma que reemplazarlo cuando llegue la respuesta sea
cambiar una sola pieza y no rehacer el módulo.

**Por qué importa:** si los cinco caracteres finales significan algo y el
sistema los genera al azar, esa información se pierde para siempre en cada
actividad nueva.

---

## 🔴 Q2 — Las 17 campañas institucionales

El manual indica que las campañas institucionales derivadas del COGFM son
diecisiete, y que las cargan únicamente las Fuerzas Navales, divididas en
jornadas. **No consta el listado.**

**Lo que se necesita:** el nombre oficial de cada una de las 17 campañas
vigentes, y si alguna dejó de estar vigente o se renombró.

**Lo que se hizo mientras tanto:** el catálogo de campañas queda **vacío**, con
una nota de pendiente. No se inventaron diecisiete nombres verosímiles. La
consecuencia visible es que el módulo de campañas no podrá usarse hasta tener la
lista.

**Por qué importa:** si alguien tuviera que escribir el nombre de la campaña a
mano, en seis meses habría «Campaña de Sensibilización», «CAMPAÑA
SENSIBILIZACION» y «Sensibilización» como tres campañas distintas, y el
consolidado del RAO no cuadraría.

---

## 🔴 Q4 — Los formularios reales de cinco pestañas

Cada actividad se registra con once pestañas obligatorias. De cinco de ellas
**no se conocen los campos que contienen**:

- Tipo Operación
- Entidades Servicios
- Servicios Prestados
- Población Beneficiada
- Entidades Apoyadas

**Lo que se necesita:** una captura de pantalla, un formulario impreso, o la
lista de campos de cada una de esas cinco pestañas, indicando cuáles son
obligatorios y cuáles son listas cerradas (de selección) frente a texto libre.

**Por qué importa especialmente «Población Beneficiada»:** es la pestaña de la
que sale la cifra de beneficiarios que alimenta el RAO. Es también la que un
diseño anterior de este mismo sistema documentó y **nunca implementó**. Sin
saber cómo se desglosa esa cifra (¿por sexo? ¿por edad? ¿por grupo étnico? ¿por
tipo de servicio recibido?) el sistema puede guardar un número total y ser
incapaz de producir el desglose que la rendición de cuentas exija.

---

## 🔴 Q5 — Los rangos de direcciones de la Intranet ARC

El sistema solo debe permitir el ingreso desde direcciones de red autorizadas.
El manual advierte que el direccionamiento IP está «pendiente».

**Lo que se necesita:** los rangos de direcciones IP desde los que se debe poder
entrar a la PAID (por ejemplo: la red de JACID, las redes de las unidades
tácticas, la red de administración).

**Lo que se hizo mientras tanto:** los rangos **no** están escritos en el
código ni en la configuración del servidor: viven en una tabla de la base de
datos, precisamente para que JACID pueda cambiarlos sin necesidad de un
despliegue nuevo. En el entorno de desarrollo se sembró un rango que permite
todo (`0.0.0.0/0`), acompañado de un aviso muy visible en el arranque para que
nadie lo lleve a producción por descuido.

**Por qué importa:** si ese rango abierto llega a producción, cualquiera con
acceso a la red podría intentar entrar.

---

## 🟡 Q3 — Campos propios de cada tipo de herramienta AID

Hay once tipos de herramienta de Acción Integral y Desarrollo. Es de esperar
que cada tipo pida datos distintos (una jornada de salud no describe lo mismo
que una obra de infraestructura).

**Lo que se necesita:** para cada uno de los once tipos, qué campos adicionales
se activan al elegirlo.

**Lo que se hizo mientras tanto:** el catálogo de atributos por tipo queda
vacío, con una nota de pendiente. Las herramientas se podrán registrar con sus
datos comunes.

---

## 🟡 Q6 — Los perfiles de usuario reales

Se proponen cinco perfiles: `ADMINISTRADOR` (JACID), `FUNCIONAL_JACID`,
`OPERADOR_UNIDAD`, `SUPERVISOR` y `CONSULTA`.

**Lo que se necesita:** qué perfiles existen hoy de verdad en la PAID, y a cuál
de estos cinco corresponde cada uno. Si hay un perfil que no encaja en ninguno,
cuál es y qué puede hacer.

**Por qué importa:** el sistema decide quién ve y quién edita a partir de estos
perfiles. Un perfil de más significa gente con permisos que no le corresponden;
uno de menos, gente que no puede trabajar.

---

## 🟡 Q7 — Cuánto tiempo se conservan los soportes y la bitácora

**Lo que se necesita:**

1. ¿Cuánto tiempo deben conservarse los archivos adjuntos (fotografías,
   informes, actas) de una actividad?
2. ¿Y el registro de auditoría — quién cambió qué y cuándo?
3. ¿Hay una tabla de retención documental institucional que aplique?

✅ **Resuelto por el Manual del Usuario (lámina 22): qué es cada fase
documental** de una jornada. Fase 1: acta de reunión y planilla de asistencia
de la comunidad (diagnóstico). Fase 2: oficios a las entidades y acta de reunión
con ellas. Fase 3: ReTHUS o tarjeta profesional, evidencias de donaciones,
formatos SVE, encuesta de satisfacción, informe final JAD, fotografías, videos
y formato de impacto COGFM. Está en `SOPORTES_POR_FASE_JORNADA` y la pantalla
lo muestra al elegir la fase. Las asistencias (lámina 27) y los proyectos
(lámina 42) tienen sus propios soportes. **Sigue abierta la retención.**

**Por qué importa:** el registro de auditoría es de solo escritura — nadie, ni
el administrador, puede modificarlo ni borrarlo. Eso es deliberado, pero
significa que crece sin parar. Si la política dice «diez años», hay que prever
el espacio y el archivado desde ahora.

---

## 🟡 Q8 — Cómo se conecta con ArcGIS

Las coordenadas se guardan en un formato que ArcGIS puede leer directamente.

**Lo que se necesita:** ¿cómo debe consumir ArcGIS estos datos?

1. Conectándose directamente a la base de datos (solo lectura),
2. a través de un servicio que publique la PAID, o
3. mediante una exportación programada (por ejemplo, un archivo diario).

**Por qué importa:** la opción 1 es la más simple pero da acceso directo a la
base; la 3 es la más controlada pero los datos van con retraso. Es una decisión
de seguridad, no técnica.

---

## 🟡 Q9 — Relación con el módulo de Acción Integral de SIGO

**Lo que se necesita:** ¿el módulo de Acción Integral de SIGO guarda esta misma
información? Si la guarda, ¿cuál de los dos sistemas es el que manda?

**Por qué importa:** si los dos sistemas registran lo mismo por separado, las
cifras van a discrepar y alguien tendrá que conciliarlas a mano cada mes.

---

## 🟡 Q10 — Datos de la población civil beneficiaria

La pestaña Población Beneficiada registra información sobre civiles. La Ley 1581
de 2012 regula el tratamiento de datos personales.

**Lo que se necesita:**

1. ¿Se registran datos que identifiquen a personas concretas (nombre, documento,
   dirección), o solo cifras agregadas?
2. Si se registran datos identificables: ¿hay autorización de tratamiento? ¿Cómo
   se recoge?
3. ¿Se registran datos sensibles (salud, pertenencia étnica, condición de
   víctima)? Esos tienen protección reforzada.

**Por qué importa:** si hay datos personales identificables, el sistema necesita
controles adicionales que hoy no están previstos, y su ausencia es un riesgo
legal, no solo técnico.

---

## 🟡 Q11 — ¿Hay servicio cartográfico institucional?

El sistema muestra un mapa para ver la ubicación de las actividades. Como no hay
internet en la Intranet, el mapa no puede traer la cartografía de fuera: hay que
servirla desde dentro.

**Lo que se necesita:** ¿la ARC tiene un servicio de mapas propio (lo que en
términos técnicos se llama WMS o WMTS) al que la PAID pueda conectarse?

- **Si existe:** hace falta su dirección y las credenciales, si las pide. Es el
  camino preferible: nada que empaquetar ni mantener.
- **Si no existe:** se empaqueta un archivo de cartografía de Colombia dentro
  del propio despliegue. Funciona igual, pero es un archivo grande que hay que
  transportar y actualizar a mano.

**Mientras se responde:** el botón «Ver ubicación» mostrará las coordenadas y un
aviso claro de que la cartografía no está disponible en este despliegue. Un mapa
en blanco sin explicación es peor que no tener mapa.

---

## 🟡 Q12 — Hardware e inteligencia artificial aprobada

El sistema puede incluir una ayuda que lea el clavegrama de una actividad y
proponga el contenido de las once pestañas, para que el usuario no tenga que
volver a teclear a mano información que ya escribió. **Esa ayuda es opcional: el
sistema completo funciona sin ella**, y así se va a construir y a verificar.

**Lo que se necesita:**

1. ¿Hay servidores con tarjeta gráfica (GPU) disponibles en la Intranet? (Sin
   GPU la ayuda funciona igual, solo más despacio.)
2. ¿Qué modelos de inteligencia artificial están **aprobados** para procesar
   información clasificada como «Información Público Clasificado»? Todo se
   ejecutaría dentro de la Intranet, sin que ningún dato salga de la red, pero
   la aprobación del modelo concreto no es una decisión técnica.

**Lo que se hizo mientras tanto:** el modelo **no** está fijado en el código; se
lee de la configuración, y está vacío. El servicio de IA arranca y responde
«degradado», que es lo correcto: presente, pero sin modelo con el que trabajar.

**Por qué importa:** elegir un modelo sin aprobación sería decidir por JACID
sobre el tratamiento de información clasificada.

---

## 🟡 Q13 — ¿Cómo se mide el avance de un convenio?

**De dónde sale esta pregunta.** No estaba en el pliego original: apareció al
construir el módulo de alianzas y convenios.

El manual dice que el **porcentaje de avance de un convenio** lo diligencia
únicamente JACID. Eso ya está implementado. Lo que no se sabe es **con qué
escala**.

Hay dos posibilidades y son incompatibles:

1. **Sigue la escala de los proyectos sociales:** 10, 20, 30, 40, 50, 60, 70 y
   100 — ocho tramos, sin 80 ni 90, cada uno con su paquete documental.
2. **Es un porcentaje libre** de 0 a 100.

**Lo que se hizo mientras tanto:** se admite cualquier entero de 0 a 100, que
es la opción que **no rechaza datos legítimos**. Si la respuesta es que sigue la
escala de ocho tramos, restringirlo es un cambio de cinco minutos. Al contrario
—haber restringido y tener que abrir— el sistema habría estado rechazando
avances válidos durante meses, y nadie sabría cuántos se dejaron de registrar.

**Por qué importa:** si un convenio puede estar «al 85 %» y el sistema lo
rechaza, el usuario pondrá 80 o 90 y la cifra queda falseada. Si no puede
estarlo y el sistema lo acepta, el consolidado mezcla dos escalas distintas.

---

## 🟡 Q14 — ¿Quitar una fila de una pestaña exige solicitud a JACID?

**De dónde sale esta pregunta.** Tampoco estaba en el pliego: apareció al
construir el formulario de las once pestañas.

El manual es claro en que **eliminar un registro** es un trámite: hay que elevar
la solicitud a JACID explicando los motivos. Eso está implementado y no se
toca: eliminar una jornada, una entidad, un tripulante o un convenio exige
solicitud aprobada.

**Lo que no está claro** es si esa misma regla aplica a las **filas dentro de
una pestaña**. Ejemplo concreto: un operador registra por error «120 raciones»
en Bienes Donados cuando eran 12. ¿Puede quitar la fila y volver a ponerla, o
tiene que elevar una solicitud a JACID para corregir un dedazo?

**Lo que se hizo mientras tanto:** se permite quitar filas de las pestañas, y
**no** se permite eliminar registros. El razonamiento es que las filas de una
pestaña son el contenido de un formulario que se está llenando, no un registro
del sistema.

**Por qué es seguro de todos modos:** cada fila que se quita queda en el
registro de auditoría con todos sus datos, quién la quitó y cuándo. No se pierde
información; se puede reconstruir exactamente qué decía.

**Si la respuesta es que sí exige solicitud,** el cambio es reversible y
pequeño en la base, pero la pantalla cambia bastante: cada fila necesitaría un
botón de «solicitar eliminación» y el usuario no podría corregir un error
inmediatamente. Conviene decidirlo antes de construir la pantalla (Fase 4).

**Lo que dice el manual (lámina 23)** acerca la respuesta pero no la cierra:
«cualquier actualización y/o eliminación será evidenciado y visualizado en la
plataforma por sus unidades superiores y para realizar algún tipo de cambio
deberá informarse y autorizarse únicamente por JACID». Leído a la letra,
**toda** corrección —no solo quitar filas— pasa por JACID. Leído como práctica
de 2022, describe un sistema sin bitácora, donde la autorización previa era la
única forma de saber qué cambió. Hace falta que JACID diga cuál de las dos.

---

## Q15 · ¿La normatividad tiene cuota de almacenamiento, y cuál? 🟡

**Qué dice el documento.** R11 fija «10 MB **agregados por actividad**» para
los soportes.

**El hueco.** La normatividad A.I. no es una actividad. Un manual institucional
en PDF pasa fácilmente de 10 MB, y no hay nada escrito sobre si comparte esa
cuota, tiene la suya o no tiene ninguna.

**Lo que se hizo.** La pantalla de Normatividad A.I. es de **solo lectura**. La
carga (`NORMATIVIDAD.CARGAR`, permiso que R16 reserva a JACID) no está
habilitada, y la pantalla lo dice a quien tiene el permiso, en lugar de ofrecer
un botón que rechazaría archivos sin explicar por qué.

**Por qué no se supuso.** Aplicar los 10 MB por analogía dejaría fuera
documentos normativos legítimos, y el usuario vería «cuota agotada» sobre un
límite que nadie fijó para ese caso.

---

## Q16 · El Manual del Usuario PAID (v2, 2022), con sus pantallas ✅

**Resuelta.** Se entregó el PDF (septiembre de 2022, 56 láminas) y la interfaz
se rehízo sobre él (D-33). Lo que el manual pide y la base todavía no tiene
—tipo de jornada, participación de EJC y FAC, sector y país de las entidades,
estado y responsable de las herramientas, entre otros— está en
`docs/CONTRASTE-MANUAL.md`.

---

## Q17 · El logotipo y la paleta del Manual de Identidad Visual de la ARC 🟡

**Recibido:** la tabla de códigos de color, el emblema de la JACID y el escudo
de la Armada. Aplicados (D-33).

✅ **El dorado es `#d4af37`** (confirmado el 2026-09-23). La tabla también
nombraba Pantone 123 C, que es un amarillo; queda descartado.

**Falta:**

1. El **Escudo de la República** y los logotipos **GOV.CO** y **CO** en
   vector. Hoy se muestran como texto.
2. **Ley 2345 de 2023.** Pide el Escudo de la República con el nombre de la
   entidad; el artículo 4, literal g, admite excepciones. ¿Usa la PAID el Escudo
   de la República o el emblema de la Armada, como en el manual de 2022?

---

## Resumen para llevar a una reunión

| # | Pregunta en una línea | Prioridad |
|---|---|---|
| Q0 | El archivo `anexo_A_ddl_paid.sql` no existe. Base de datos construida desde las reglas del documento. | ✅ Resuelta |
| Q1 | ¿Cómo se construye el código de actividad? ¿Significan algo los 5 caracteres finales? | 🔴 |
| Q2 | ¿Cuáles son las 17 campañas institucionales? | 🔴 |
| Q4 | ¿Qué campos tienen 5 de las 11 pestañas, sobre todo Población Beneficiada? | 🔴 |
| Q5 | ¿Cuáles son los rangos de IP de la Intranet ARC? | 🔴 |
| Q3 | ¿Qué campos pide cada uno de los 11 tipos de herramienta AID? | 🟡 |
| Q6 | ¿Qué perfiles de usuario existen hoy? | 🟡 |
| Q7 | ¿Cuánto se conservan soportes y auditoría? (Las fases documentales ya las define el manual.) | 🟡 |
| Q8 | ¿Cómo debe consumir ArcGIS los datos? | 🟡 |
| Q9 | ¿SIGO guarda lo mismo? ¿Cuál manda? | 🟡 |
| Q10 | ¿Se registran datos personales de civiles? (Ley 1581 de 2012) | 🟡 |
| Q11 | ¿Hay servicio de mapas institucional? | 🟡 |
| Q12 | ¿Hay GPU? ¿Qué modelos de IA están aprobados para datos clasificados? | 🟡 |
| Q13 | ¿El avance de un convenio usa la escala de ocho tramos o un porcentaje libre? | 🟡 |
| Q14 | ¿Quitar una fila de una pestaña exige solicitud a JACID, o es una corrección normal? | 🟡 la interfaz ya está construida: si la respuesta es «sí», cada fila necesita un botón de solicitud |
| Q15 | ¿La normatividad tiene cuota de almacenamiento, y cuál? R11 la fija «por actividad» y esto no es una actividad. | 🟡 |
| Q16 | El Manual del Usuario PAID (v2, 2022) con sus pantallas. | ✅ Resuelta |
| Q17 | Faltan Escudo de la República y logos GOV.CO/CO; ¿Escudo de la República o emblema de la Armada (Ley 2345 de 2023)? (El dorado, `#d4af37`, ya está confirmado.) | 🟡 |
