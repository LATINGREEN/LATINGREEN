# Arquitectura — PAID SIGIT Versión 2026

## Estilo: monolito modular

Una sola aplicación Django, dividida en módulos con fronteras claras. Es uno
de los estilos que el área de tecnología de la Armada acepta («monolítica o
hexagonal desacoplada, todas son válidas mientras estén soportadas», reunión
del 30/09/2026) y el más sencillo de operar para el tamaño del problema: un
proceso, una base de datos, un despliegue.

```
                    ┌───────────── navegador ─────────────┐
                    │ plantillas Django + htmx + ECharts   │
                    └──────────────────┬───────────────────┘
                                       │ HTTPS
   SIGIT / otros sistemas ──API──►  nginx  (única puerta publicada)
                                       │
                               gunicorn + Django
      ┌────────────┬─────────────┬─────┴───────┬──────────────┬───────────┐
      │  núcleo    │  maestros   │  jornadas   │ integración  │ analítica │
      │ ingreso,   │ personal,   │ 11 pestañas,│ SIGIT, API,  │ tablero,  │
      │ unidades,  │ entidades,  │ soportes,   │ bandeja de   │ tablas    │
      │ catálogos, │ herramientas│ duplicados  │ revisión     │ dinámicas,│
      │ seguridad  │ AID         │             │              │ impacto   │
      └────────────┴─────────────┴──────┬──────┴──────────────┴───────────┘
                                        │ una transacción por petición,
                                        │ contexto fijado con SET LOCAL
                                 PostgreSQL 16
                  RLS por unidad · disparadores de bitácora y auditoría ·
                  columnas generadas · restricciones de dominio · pg_trgm
```

## Módulos

| Módulo | Responsabilidad | Depende de |
|---|---|---|
| `sigit.nucleo` | Catálogos, unidades y su jerarquía, usuarios y roles, ingreso (captcha, bloqueo), contexto de base de datos, cabeceras de seguridad, bitácora, georreferenciación. | — |
| `sigit.maestros` | Personal, entidades (maestro compartido), herramientas AID. | núcleo |
| `sigit.jornadas` | Jornada, sus once pestañas, soportes, detección de duplicados, completitud. | núcleo, maestros |
| `sigit.integracion` | Sistemas externos y testigos, lotes, registros externos, revisión de JACID. | núcleo, jornadas |
| `sigit.analitica` | Tablero, motor de tablas dinámicas, exportación, informes guardados, indicadores de impacto. | núcleo, jornadas |
| `sigit.api` | API REST v1 (DRF), permisos por alcance, límite por sistema, contrato OpenAPI. | todos (solo lectura), integración |
| `sigit.proteccion` | Solo migraciones: RLS, bitácora, auditoría y privilegios del rol de la aplicación. | todos |

Regla de dependencias: los módulos de la izquierda no importan a los de la
derecha. Las reglas de negocio viven en `servicios.py` de cada módulo, no en
las vistas: la API y la interfaz llaman a las mismas funciones (por ejemplo,
`integracion.servicios.recibir_lote` atiende la API **y** el archivo plano).

## Dónde se imponen las garantías

La regla de la casa, heredada de la PAID: **lo que no puede fallar lo impone la
base de datos**, no la vista. Una vista olvidada no puede romperlo.

| Garantía | Cómo | Archivo |
|---|---|---|
| Cada unidad ve lo suyo y lo de sus subordinadas | Row Level Security **forzada** sobre jornadas, pestañas, maestros, mediciones y registros externos; política que falla cerrada sin contexto | `proteccion/migrations/0001_…` |
| El contexto no se filtra entre peticiones | `set_config(…, true)` (= `SET LOCAL`) dentro de una transacción por petición | `nucleo/contexto_bd.py`, `nucleo/middleware.py` |
| La jerarquía no se falsea | Ruta materializada calculada por disparador; ciclos rechazados | `nucleo/migrations/0002_…` |
| Todo cambio queda registrado | Disparador de bitácora `SECURITY DEFINER`; el rol de la aplicación no puede escribir en ella | ídem |
| La ARC participa siempre; fechas coherentes | Restricciones `CHECK` | `jornadas/models.py` |
| Decimales coherentes con los GMS | Columnas `GENERATED ALWAYS … STORED` | `nucleo/geo.py` |
| Un rechazo tiene motivo; una aprobación, jornada | Restricciones `CHECK` | `integracion/models.py` |
| El mismo soporte no entra dos veces | `UNIQUE (jornada, resumen_sha256)` | `jornadas/models.py` |

## Decisiones de interfaz

- **Plantillas del servidor + htmx**, no una SPA: menos piezas, sin un segundo
  proyecto que mantener, y cada pantalla funciona también sin JavaScript en lo
  esencial. htmx (licencia 0BSD) se usa para las pestañas, los selects
  dependientes y los avisos en vivo.
- **ECharts** (Apache-2.0) para las gráficas, servido desde el propio
  despliegue. Los datos viajan en `<script type="application/json">`, que no se
  ejecuta: la CSP no necesita `unsafe-inline`.
- Sin estilos en línea en ninguna plantilla (la CSP tampoco los admite): los
  anchos de barras y el mapa de calor usan clases discretas.

## Cómo crecer sin romperlo

- **Nueva pestaña o nuevo subtipo de actividad:** modelo en `jornadas/models.py`,
  entrada en `PESTANAS`, campos en `formularios.CAMPOS_PESTANA`, y su tabla en
  la lista `PESTANAS` de una **nueva** migración de `proteccion` (RLS +
  bitácora). La prueba `test_las_pestanas_heredan_el_ambito_de_su_jornada` es
  el modelo a copiar.
- **Nueva medida o dimensión de tabla dinámica:** una línea en `MEDIDAS` o
  `DIMENSIONES` de `analitica/consultas.py`.
- **Nuevo sistema que se integra:** se registra en *Gestión → Sistemas
  externos*; no requiere código.
- **Escalar:** la aplicación no guarda estado en el proceso (la sesión está en
  la base); se pueden correr varias réplicas detrás de nginx. Los soportes van
  a un volumen compartido; para varias máquinas, sustituir
  `jornadas/adjuntos.py` por un almacén de objetos interno.
