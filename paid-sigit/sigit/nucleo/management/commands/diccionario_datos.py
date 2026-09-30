"""
`python manage.py diccionario_datos > docs/DICCIONARIO-DATOS.md`

Diccionario de datos generado desde los modelos: tabla, columnas, tipo,
obligatoriedad, referencias y restricciones. Se genera, no se escribe a mano,
para que no quede desactualizado (gobernanza del dato, reunión 30/09/2026).
`scripts/verificar.sh` comprueba que el archivo versionado está al día.
"""

from __future__ import annotations

from django.apps import apps
from django.core.management.base import BaseCommand
from django.db import connection, models

APPS = ["nucleo", "maestros", "jornadas", "integracion", "analitica"]
CON_RLS = {
    "maestros_personal": "por unidad",
    "maestros_herramientaaid": "por unidad",
    "maestros_entidad": "lectura para todos; escritura por unidad",
    "jornadas_jornada": "por unidad",
    "analitica_medicionindicador": "por unidad",
    "integracion_registroexterno": "por unidad propuesta",
}


def _tipo(campo: models.Field) -> str:
    if isinstance(campo, models.GeneratedField):
        return f"generada ({campo.output_field.db_type(connection)})"
    if campo.is_relation and campo.related_model is not None:
        return f"→ {campo.related_model._meta.db_table}"
    return campo.db_type(connection) or campo.get_internal_type()


def _limpio(texto: object) -> str:
    return str(texto or "").replace("|", "\\|").replace("\n", " ").strip()


class Command(BaseCommand):
    help = "Escribe el diccionario de datos en Markdown por la salida estándar."

    def handle(self, *args: object, **opciones: object) -> None:
        salida = [
            "# Diccionario de datos — PAID SIGIT Versión 2026",
            "",
            "> Generado con `python manage.py diccionario_datos`. No lo edite a mano.",
            "",
            "Convenciones: nombres en español sin tildes, `snake_case`; instantes en UTC",
            "(`timestamp with time zone`); fechas sin hora en `date`; dominios cerrados en",
            "tablas de catálogo. **RLS** indica las tablas con Row Level Security; las",
            "pestañas de la jornada heredan el ámbito de su jornada.",
            "",
        ]
        for etiqueta in APPS:
            configuracion = apps.get_app_config(etiqueta)
            salida += [f"## {configuracion.verbose_name}", ""]
            for modelo in configuracion.get_models():
                meta = modelo._meta
                tabla = meta.db_table
                rls = CON_RLS.get(tabla) or (
                    "por jornada"
                    if tabla.startswith("jornadas_") and tabla != "jornadas_jornada"
                    else ""
                )
                salida += [f"### `{tabla}` — {meta.verbose_name}", ""]
                documento = (modelo.__doc__ or "").strip()
                if documento and not documento.startswith(modelo.__name__ + "("):
                    salida += [" ".join(documento.split()), ""]
                if rls:
                    salida += [f"**RLS:** {rls}.", ""]
                salida += ["| Columna | Tipo | Obligatoria | Descripción |", "|---|---|---|---|"]
                for campo in meta.get_fields():
                    if not getattr(campo, "concrete", False) or campo.many_to_many:
                        continue
                    if campo.primary_key or isinstance(campo, models.GeneratedField):
                        obligatoria = "calculada"
                    elif not campo.editable:
                        obligatoria = "del sistema"
                    else:
                        obligatoria = "no" if (campo.null or campo.blank) else "sí"
                    descripcion = _limpio(campo.help_text) or _limpio(
                        getattr(campo, "verbose_name", "")
                    )
                    if getattr(campo, "choices", None):
                        descripcion += " · valores: " + ", ".join(str(v) for v, _ in campo.choices)
                    salida.append(
                        f"| `{campo.column}` | {_tipo(campo)} | {obligatoria} | {descripcion} |"
                    )
                restricciones = [r.name for r in meta.constraints]
                if restricciones:
                    salida += ["", "Restricciones: " + ", ".join(f"`{r}`" for r in restricciones)]
                salida.append("")
        self.stdout.write("\n".join(salida))
