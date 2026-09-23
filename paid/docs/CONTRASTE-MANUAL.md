# La interfaz frente al Manual del Usuario PAID

Cotejo de la interfaz con el **Manual del Usuario PAID, actualizado a
septiembre de 2022** (el PDF entregado, 56 láminas) y con la tabla de
códigos de color del **Manual de Identidad Visual ARC**. Las láminas se citan
por su número en el PDF.

Sirve para dos cosas: saber qué se reprodujo y de dónde sale, y tener a mano la
lista de lo que **no** coincide todavía, con lo que costaría cerrarlo.

---

## 1. Lo que ya coincide

| Elemento | Manual | Interfaz |
|---|---|---|
| Barra GOV.CO | Franja superior con el logotipo GOV.CO y, a la derecha, la sesión: ícono verde, usuario, X roja para salir (lámina 11) | `Marco.tsx`: igual, más el reloj de la sesión (R5), que el manual no tiene pero la seguridad exige |
| Cabecera | Azul institucional: recuadro «Ministerio de Defensa Nacional», «PAID · Plataforma de Acción Integral y Desarrollo» con el emblema JACID, logotipo de la Armada a la derecha (láminas 10–11) | Igual. Emblema JACID y escudo de la Armada con los archivos entregados |
| Menú | Horizontal, con desplegables: Inicio · Tripulantes A.I. · Cooperación Civil Militar · Asuntos Civiles · Sensibilización · Normatividad A.I. (láminas 11 y 14–15) | Igual, con los submódulos del manual. Los que no existen todavía (asistencias, ruedas, alianzas, proyectos, campañas) llevan a una pantalla que dice por qué no están |
| Línea dorada | Filete dorado bajo la cabecera y sobre el pie | Igual (`--arc-dorado`) |
| Barra de pantalla | Flotante a la derecha: contraste, reducir letra, aumentar letra, contacto (lámina 12) | Igual. El contraste alterna entre institucional y alto contraste |
| Ingreso | Panel azul a la izquierda con usuario, contraseña, captcha y «Ingresar»; a la derecha, la lámina con el emblema y el lema (lámina 10) | Igual. Íconos dorados en los campos. El captcha es aritmético en texto (WCAG 2.1 AA) |
| Inicio | Lámina institucional «A.I. · Acción Integral» | Igual, seguida del parte de estado de la unidad |
| Listados | Tabla en el centro y, abajo a la izquierda, **recuadro amarillo** con Excel, CSV y Copiar (láminas 16, 19, 37 y 45) | Jornadas: igual. «Copiar» usa la misma exportación auditada que el CSV (R17), no copia lo que hay en pantalla |
| Datos de la jornada | Cajas de color con el código, la unidad y las fechas (láminas 20–22) | `.franja-datos`: azul, verde, gris y amarilla, más una quinta con el avance de las once pestañas |
| Pestañas | Fila horizontal de pestañas; cada una marcada como diligenciada o pendiente (lámina 22) | Pestañas WAI-ARIA con marca verde (con datos) o anillo rojo (pendiente) |
| Adjuntos | Soportes agrupados en Imágenes · Documentos · Audios · Videos, cada grupo con «No hay archivos cargados previamente» cuando está vacío; máximo 10 MB por jornada (lámina 22) | Igual. La fase documental muestra lo que va en cada una (Q7, resuelta) |
| Pie | Azul GOV.CO: copyright de la División de Informática, datos de la Jefatura, horario, redes, contacto (lámina 11) | Transcrito. Las redes van como texto: la aplicación corre en la Intranet sin salida a Internet (A.2.1) |

### Colores

Tomados de la tabla del Manual de Identidad Visual ARC (`tokens.css`):

| Token | Valor | Uso |
|---|---|---|
| `--arc-azul` | `#00205b` | Cabecera, botones primarios, títulos |
| `--arc-dorado` | `#d4af37` | Filetes, íconos del ingreso, pestaña activa. **Nunca como texto sobre blanco** (2,10 : 1) |
| `--arc-rojo` | `#c8102e` | Salir, errores, pestañas pendientes |
| `--arc-gris` | `#97999b` | Solo decorativo (2,86 : 1 sobre blanco) |
| `--govco-azul` | `#3366cc` | Barra y pie GOV.CO (blanco encima: 5,37 : 1) |

El verde de «diligenciado» (`#1e7b4a`) **no** está en la paleta ARC: es un
color funcional, como en el manual, donde las pestañas completas se marcan en
verde. Se eligió el tono que da 4,5 : 1 sobre blanco.

**Pendiente de confirmar:** la tabla indica Pantone 123 C para el dorado, que
es un amarillo (≈ `#ffc72c`), mientras el hexadecimal de la misma tabla es
`#d4af37`. Se usó el hexadecimal. Ver Q17.

---

## 2. Lo que todavía no coincide

Cada diferencia de esta sección **cambia la base de datos**: no se resuelve con
estilos. Ninguna se implementó por suposición (A.7); todas están descritas en
el manual con suficiente detalle para hacerlas, así que no son preguntas
abiertas sino trabajo pendiente.

### 2.1 Jornadas de apoyo (láminas 20–21 y 23)

| El manual pide | Hoy | Costo |
|---|---|---|
| **Tipo de jornada**: binacional, conjunta o estratégica | No existe | Columna + dominio + formulario |
| **Participación de EJC y FAC** (sí/no; «en ARC siempre SÍ») | No existe | Dos columnas booleanas |
| **Población afecta o no a la tropa** | No existe | Columna booleana |
| **Unidad seleccionable** al registrar | Se toma de la sesión | Cambia R7: una unidad superior registrando por una subordinada. Decidir con JACID |
| Fechas de **inicio y término**; no menciona lugar ni fecha de ejecución | Inicio, ejecución (obligatorias), fin (opcional) y lugar | Revisar con JACID si «ejecución» y «lugar» sobran o si «fin» debe ser obligatoria |
| Observaciones al inicio y en «Resumen JAD» | La pestaña se llama «Resumen» | Solo el rótulo |

### 2.2 Personal (lámina 17)

| El manual pide | Hoy |
|---|---|
| Unidad a la que pertenece | Se toma de la sesión |
| Grado, apellidos y nombres | ✅ |
| Tipo y número de documento | ✅ |
| Teléfono y correo institucional | ✅ |
| **Género** | No existe |

### 2.3 Entidades A.I. (lámina 38)

| El manual pide | Hoy |
|---|---|
| **Sector** (E. públicas, E. privadas, Cooperación internacional, organizaciones sociales, JAC, JAL, fundaciones, ONG) | Tipo de entidad, con otra lista |
| **Subsector** (los sectores administrativos del Estado) | No existe |
| **País de origen** | No existe |
| Nombre completo con la sigla al final entre paréntesis | Nombre libre; la regla de la sigla no se valida |

### 2.4 Herramientas AID (lámina 46)

| El manual pide | Hoy |
|---|---|
| Tipo: COPAI, GEOS, VEMAI, emisoras, perifoneo, circos, impresos, reprográficas, audiovisuales, simulador de vuelo, grupos musicales | Lista de tipos; los campos propios de cada tipo siguen en Q3 |
| **Fecha de potenciación** (o de adquisición) | No existe |
| **Estado**: activa o inactiva | No existe |
| **Responsable** (inscrito en Personal) | No existe |
| Municipio + coordenadas GMS | ✅ |

### 2.5 Pantallas

- **Pestañas «Listado | Agregar»** en los maestros: hoy el formulario se abre
  sobre el listado con un botón. Es solo interfaz.
- **Recuadro amarillo de exportación en los maestros**: el manual lo muestra en
  Personal, Entidades y Herramientas. Necesita un punto de exportación
  **auditado** por maestro en la API (R17), como el de jornadas.
- **Carrusel de fotografías** en Inicio (lámina 12): no se entregaron las
  fotografías.
- **Escudo de la República, logotipos GOV.CO y CO**: se muestran como texto
  hasta tener los archivos oficiales (ver `apps/web/public/identidad/LEEME.md`).

---

## 3. Lo que se apartó del manual a propósito

- **El reloj de la sesión** en la barra GOV.CO: R5 exige cierre por inactividad
  y avisar antes. El manual no lo tiene.
- **Alto contraste** en lugar de los tres modos de color anteriores: el manual
  tiene un único botón de contraste; se conservó uno que alterna entre la
  paleta institucional y alto contraste (negro, blanco y amarillo).
- **Se retiró el modo oscuro** de la primera versión: no está en el manual y
  obligaba a sostener una tercera paleta.
- **Enlaces a redes sociales como texto**, no como vínculos: la Intranet no
  tiene salida a Internet (A.2.1).
