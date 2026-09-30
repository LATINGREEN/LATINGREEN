"""
Reglas de las jornadas que no caben en una restricción de la base.
"""

from __future__ import annotations

import secrets
import string
from dataclasses import dataclass
from datetime import date, timedelta

from django.contrib.postgres.search import TrigramSimilarity
from django.db import IntegrityError, transaction
from django.db.models import Q

from sigit.nucleo.models import Unidad

from .models import PESTANAS, Jornada

ALFABETO_CODIGO = string.ascii_uppercase + string.digits


def generar_codigo(unidad: Unidad, fecha: date) -> str:
    """
    TODO(JACID) Q1: el algoritmo oficial del código de actividad no se conoce.
    Se sigue el patrón observado en los ejemplos: <código de la unidad>R<mes>
    <año><5 caracteres>. Si JACID confirma otro, se cambia SOLO esta función.
    """
    sufijo = "".join(secrets.choice(ALFABETO_CODIGO) for _ in range(5))
    return f"{unidad.codigo}R{fecha.month}{fecha.year}{sufijo}"


def guardar_con_codigo(jornada: Jornada, intentos: int = 5) -> Jornada:
    """La unicidad del código la garantiza la base; aquí solo se reintenta."""
    for _ in range(intentos):
        jornada.codigo = generar_codigo(jornada.unidad, jornada.fecha_ejecucion)
        try:
            with transaction.atomic():
                jornada.save()
            return jornada
        except IntegrityError as error:
            if "codigo" not in str(error):
                raise
    raise RuntimeError("No se pudo generar un código de jornada único.")


def estado_pestanas(jornada: Jornada) -> list[dict[str, object]]:
    """Cuántas filas tiene cada una de las once pestañas, en el orden del manual."""
    estado = []
    for clave, titulo, modelo in PESTANAS:
        cantidad = modelo.objects.filter(jornada=jornada).count()
        estado.append(
            {"clave": clave, "titulo": titulo, "filas": cantidad, "completa": cantidad > 0}
        )
    return estado


def recalcular_completo(jornada: Jornada) -> bool:
    completo = all(p["completa"] for p in estado_pestanas(jornada))
    if completo != jornada.registro_completo:
        Jornada.objects.filter(pk=jornada.pk).update(registro_completo=completo)
        jornada.registro_completo = completo
    return completo


# ── Evitar la duplicidad de entradas ─────────────────────────────────────────
DIAS_DE_TOLERANCIA = 3
UMBRAL_LUGAR = 0.35


@dataclass(frozen=True)
class PosibleDuplicado:
    id: int
    codigo: str
    lugar: str
    fecha_ejecucion: date
    unidad: str
    semejanza: float

    def como_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "codigo": self.codigo,
            "lugar": self.lugar,
            "fecha_ejecucion": self.fecha_ejecucion.isoformat(),
            "unidad": self.unidad,
            "semejanza": round(self.semejanza, 2),
        }


def buscar_posibles_duplicados(
    *,
    municipio_id: int,
    fecha_ejecucion: date,
    lugar: str,
    excluir_id: int | None = None,
    limite: int = 5,
) -> list[PosibleDuplicado]:
    """
    Una jornada se parece a otra si es en el MISMO municipio, en fechas
    cercanas (±3 días) y en un lugar de nombre semejante (trigramas), o en
    exactamente la misma fecha. No se bloquea: se muestra a quien registra y
    se le pide confirmar. Dos jornadas legítimas pueden coincidir; lo que no
    puede pasar es que nadie se entere.

    La búsqueda respeta RLS: solo compara contra lo que la unidad puede ver.
    Por eso las jornadas recibidas de SIGIT se comparan en la bandeja de
    JACID, que ve todo.
    """
    desde = fecha_ejecucion - timedelta(days=DIAS_DE_TOLERANCIA)
    hasta = fecha_ejecucion + timedelta(days=DIAS_DE_TOLERANCIA)
    consulta = (
        Jornada.vigentes.filter(municipio_id=municipio_id, fecha_ejecucion__range=(desde, hasta))
        .annotate(semejanza=TrigramSimilarity("lugar", lugar))
        .filter(Q(semejanza__gte=UMBRAL_LUGAR) | Q(fecha_ejecucion=fecha_ejecucion))
        .select_related("unidad")
        .order_by("-semejanza", "fecha_ejecucion")
    )
    if excluir_id is not None:
        consulta = consulta.exclude(pk=excluir_id)
    return [
        PosibleDuplicado(
            id=j.pk,
            codigo=j.codigo,
            lugar=j.lugar,
            fecha_ejecucion=j.fecha_ejecucion,
            unidad=j.unidad.sigla,
            semejanza=float(j.semejanza or 0),
        )
        for j in consulta[:limite]
    ]
