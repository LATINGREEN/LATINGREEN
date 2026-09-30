"""
`python manage.py cargar_divipola archivo.csv` — municipios oficiales del DANE.

El listado DIVIPOLA vigente no se versiona en el repositorio: cambia, y quien
despliega debe traer el oficial. El CSV necesita las columnas
`codigo_municipio` (5 dígitos) y `nombre_municipio`; el departamento sale de
los dos primeros dígitos del código.
"""

from __future__ import annotations

import csv
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from sigit.nucleo.contexto_bd import contexto_de_sistema
from sigit.nucleo.models import Departamento, Municipio


class Command(BaseCommand):
    help = "Carga o actualiza los municipios desde un CSV DIVIPOLA."

    def add_arguments(self, parser) -> None:  # type: ignore[no-untyped-def]
        parser.add_argument("archivo", type=Path)

    def handle(self, *args: object, **opciones: object) -> None:
        archivo: Path = opciones["archivo"]  # type: ignore[assignment]
        if not archivo.is_file():
            raise CommandError(f"No existe {archivo}")
        departamentos = {d.codigo_dane: d for d in Departamento.objects.all()}
        cargados = 0
        with archivo.open(encoding="utf-8-sig", newline="") as flujo, contexto_de_sistema():
            for numero, fila in enumerate(csv.DictReader(flujo), start=2):
                codigo = (fila.get("codigo_municipio") or "").strip().zfill(5)
                nombre = (fila.get("nombre_municipio") or "").strip()
                departamento = departamentos.get(codigo[:2])
                if not codigo.isdigit() or not nombre or departamento is None:
                    raise CommandError(f"Fila {numero} inválida: {fila}")
                Municipio.objects.update_or_create(
                    codigo_dane=codigo, defaults={"nombre": nombre, "departamento": departamento}
                )
                cargados += 1
        self.stdout.write(self.style.SUCCESS(f"{cargados} municipios cargados."))
