"""`python manage.py sembrar` — catálogos con fuente y roles. Idempotente."""

from __future__ import annotations

from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand

from sigit.nucleo import models as m
from sigit.nucleo.contexto_bd import contexto_de_sistema
from sigit.nucleo.semillas import (
    CATALOGOS,
    DEPARTAMENTOS,
    ESTADOS_HERRAMIENTA,
    EXTENSIONES,
    PERIODICIDADES,
)


class Command(BaseCommand):
    help = "Siembra los catálogos con fuente (manual, DANE) y los roles. Se puede repetir."

    def handle(self, *args: object, **opciones: object) -> None:
        with contexto_de_sistema():
            for modelo, filas in CATALOGOS.items():
                clase = getattr(m, modelo)
                for orden, (codigo, nombre, descripcion) in enumerate(filas, start=1):
                    clase.objects.update_or_create(
                        codigo=codigo,
                        defaults={"nombre": nombre, "descripcion": descripcion, "orden": orden},
                    )
            for orden, (codigo, nombre, descripcion, exige) in enumerate(ESTADOS_HERRAMIENTA, 1):
                m.EstadoHerramientaAid.objects.update_or_create(
                    codigo=codigo,
                    defaults={
                        "nombre": nombre,
                        "descripcion": descripcion,
                        "orden": orden,
                        "exige_observacion": exige,
                    },
                )
            for orden, (codigo, nombre, meses) in enumerate(PERIODICIDADES, start=1):
                m.Periodicidad.objects.update_or_create(
                    codigo=codigo, defaults={"nombre": nombre, "orden": orden, "meses": meses}
                )
            for extension, (categoria, mimes) in EXTENSIONES.items():
                m.ExtensionPermitida.objects.update_or_create(
                    extension=extension,
                    defaults={
                        "categoria": m.CategoriaAdjunto.objects.get(codigo=categoria),
                        "mimes_esperados": mimes,
                    },
                )
            for codigo, nombre in DEPARTAMENTOS:
                m.Departamento.objects.update_or_create(
                    codigo_dane=codigo, defaults={"nombre": nombre}
                )
            for rol in m.Rol.TODOS:
                Group.objects.get_or_create(name=rol)
        self.stdout.write(self.style.SUCCESS("Catálogos y roles sembrados."))
        self.stdout.write(
            "Pendiente de JACID (no se siembran): tipos de operación, servicios prestados, "
            "grupos poblacionales, medios, recursos y bienes. Municipios: cargar_divipola."
        )
