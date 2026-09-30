"""
Georreferenciación en grados, minutos y segundos (GMS), como la pide el manual.

Se guardan los ocho componentes GMS. Los decimales NO se escriben: son columnas
GENERADAS por PostgreSQL a partir de los GMS, así que no pueden contradecirlos.

Ningún componente tiene valor por omisión: un punto que nadie eligió pasa el
control de «dentro de Colombia» y parece correcto (lección D-30 de la PAID).
La única excepción razonable, el hemisferio occidental, se propone en el
formulario, no en la base.
"""

from __future__ import annotations

from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Case, ExpressionWrapper, F, Value, When

# Colombia continental e insular, con margen para San Andrés y los cayos.
LIMITES_COLOMBIA = {"lat_min": -4.3, "lat_max": 16.2, "lon_min": -82.2, "lon_max": -66.8}


def _decimal(grados: str, minutos: str, segundos: str, hemisferio: str, negativo: str) -> Case:
    magnitud = ExpressionWrapper(
        F(grados) + F(minutos) / Value(Decimal("60.0")) + F(segundos) / Value(Decimal("3600.0")),
        output_field=models.DecimalField(max_digits=12, decimal_places=6),
    )
    return Case(
        When(**{hemisferio: negativo}, then=magnitud * Value(Decimal("-1"))),
        default=magnitud,
        output_field=models.DecimalField(max_digits=12, decimal_places=6),
    )


class Georreferenciado(models.Model):
    class Latitud(models.TextChoices):
        NORTE = "N", "Norte"
        SUR = "S", "Sur"

    class Longitud(models.TextChoices):
        OESTE = "W", "Oeste"
        ESTE = "E", "Este"

    latitud_grados = models.PositiveSmallIntegerField(validators=[MaxValueValidator(90)])
    latitud_minutos = models.PositiveSmallIntegerField(validators=[MaxValueValidator(59)])
    latitud_segundos = models.DecimalField(
        max_digits=8,
        decimal_places=5,
        validators=[MinValueValidator(Decimal(0)), MaxValueValidator(Decimal("59.99999"))],
    )
    latitud_hemisferio = models.CharField(max_length=1, choices=Latitud.choices)
    longitud_grados = models.PositiveSmallIntegerField(validators=[MaxValueValidator(180)])
    longitud_minutos = models.PositiveSmallIntegerField(validators=[MaxValueValidator(59)])
    longitud_segundos = models.DecimalField(
        max_digits=8,
        decimal_places=5,
        validators=[MinValueValidator(Decimal(0)), MaxValueValidator(Decimal("59.99999"))],
    )
    longitud_hemisferio = models.CharField(max_length=1, choices=Longitud.choices)

    latitud_decimal = models.GeneratedField(
        expression=_decimal(
            "latitud_grados", "latitud_minutos", "latitud_segundos", "latitud_hemisferio", "S"
        ),
        output_field=models.DecimalField(max_digits=12, decimal_places=6),
        db_persist=True,
    )
    longitud_decimal = models.GeneratedField(
        expression=_decimal(
            "longitud_grados", "longitud_minutos", "longitud_segundos", "longitud_hemisferio", "W"
        ),
        output_field=models.DecimalField(max_digits=12, decimal_places=6),
        db_persist=True,
    )

    class Meta:
        abstract = True


def a_decimal(grados: int, minutos: int, segundos: Decimal, hemisferio: str) -> Decimal:
    """Espejo en Python de la columna generada, para la vista previa y las pruebas."""
    valor = Decimal(grados) + Decimal(minutos) / 60 + Decimal(segundos) / 3600
    return -valor if hemisferio in {"S", "W"} else valor


def dentro_de_colombia(latitud: Decimal, longitud: Decimal) -> bool:
    return (
        LIMITES_COLOMBIA["lat_min"] <= float(latitud) <= LIMITES_COLOMBIA["lat_max"]
        and LIMITES_COLOMBIA["lon_min"] <= float(longitud) <= LIMITES_COLOMBIA["lon_max"]
    )


def desde_decimal(valor: Decimal, es_latitud: bool) -> tuple[int, int, Decimal, str]:
    """Para quien trae coordenadas decimales (p. ej., un GPS o SIGIT)."""
    hemisferio = ("S" if valor < 0 else "N") if es_latitud else ("W" if valor < 0 else "E")
    absoluto = abs(Decimal(valor))
    grados = int(absoluto)
    resto = (absoluto - grados) * 60
    minutos = int(resto)
    segundos = ((resto - minutos) * 60).quantize(Decimal("0.00001"))
    if segundos >= 60:
        segundos = Decimal("59.99999")
    return grados, minutos, segundos, hemisferio
