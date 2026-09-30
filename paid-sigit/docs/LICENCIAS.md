# Licencias de terceros — PAID SIGIT Versión 2026

El área de tecnología pidió que «la Armada Nacional no tenga ningún problema
legal en el futuro de poder utilizar este software» (reunión del 30/09/2026).
Todo lo que usa la plataforma tiene licencia permisiva o LGPL de biblioteca;
ninguna copyleft fuerte (GPL/AGPL). `scripts/verificar.sh` lo comprueba en cada
ejecución con `pip-licenses`.

## Dependencias de ejecución (Python)

| Paquete | Versión | Licencia |
|---|---|---|
| Django | 5.2.17 | BSD-3-Clause |
| djangorestframework | 3.18.1 | BSD-3-Clause |
| drf-spectacular | 0.30.0 | BSD-3-Clause |
| psycopg / psycopg-binary | 3.3.6 | **LGPL-3.0** — ver nota |
| argon2-cffi | 25.1.0 | MIT |
| openpyxl | 3.1.5 | MIT |
| gunicorn | 26.2.0 | MIT |
| whitenoise | 6.12.0 | MIT |
| (transitivas) asgiref, sqlparse, PyYAML, jsonschema, uritemplate, inflection, et_xmlfile, cffi, pycparser, typing_extensions | — | BSD, MIT, MIT-0, PSF |

**Nota sobre psycopg (LGPL-3.0).** Es el controlador de PostgreSQL estándar de
Django. La LGPL permite usarlo como biblioteca en software de cualquier
licencia, incluso cerrado, siempre que no se modifique psycopg mismo (no se
modifica) y que se pueda sustituir por otra versión (es un paquete aparte). No
impone condiciones sobre el código de PAID SIGIT.

## Recursos servidos al navegador

| Recurso | Versión | Licencia | Archivo |
|---|---|---|---|
| Apache ECharts | 6.1.0 | Apache-2.0 | `static/vendor/LICENSE-echarts.txt` |
| htmx | 2.0.11 | 0BSD | `static/vendor/LICENSE-htmx.txt` |
| Montserrat, Oswald, Atkinson Hyperlegible, IBM Plex Mono | — | SIL Open Font License 1.1 | `static/fuentes/` |

## Solo para desarrollo y verificación (no se despliegan)

pytest, pytest-django, pytest-cov, ruff, bandit, pip-audit, pip-licenses y sus
dependencias: MIT, Apache-2.0, BSD. `certifi` (MPL-2.0) llega con `requests`
dentro de `pip-audit`; tampoco se despliega.

## Identidad institucional

Los emblemas de la Armada y de JACID en `static/identidad/` los entregó el
usuario del proyecto; son de la institución y su uso lo regula ella.

## Derechos sobre el código de PAID SIGIT

**Pendiente de decisión jurídica.** El repositorio no incluye un archivo de
licencia a propósito: la cesión de los derechos patrimoniales a la Armada (o el
régimen que se acuerde entre la reserva y la institución) se debe fijar por
escrito antes de la entrega formal.
