"""
Analítica: informes guardados e indicadores de impacto (metodología SIGIT).

Los indicadores los está definiendo la mesa de expertos de la reserva con
JACID (reunión del 30/09/2026). Aquí está la ESTRUCTURA para registrarlos y
medirlos en el tiempo; el catálogo arranca vacío y no se rellena con supuestos.
TODO(JACID/mesa SIGIT): cargar los indicadores aprobados.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models

from sigit.jornadas.models import Jornada
from sigit.nucleo.models import Municipio, Periodicidad, Unidad, codigo_catalogo


class InformeGuardado(models.Model):
    """Configuración de una tabla dinámica que alguien quiere volver a ver."""

    nombre = models.CharField(max_length=150)
    configuracion = models.JSONField()
    propietario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    compartido = models.BooleanField(
        default=False, help_text="Visible para todos los usuarios de la plataforma."
    )
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["nombre"]
        verbose_name = "informe guardado"
        verbose_name_plural = "informes guardados"

    def __str__(self) -> str:
        return self.nombre


class IndicadorImpacto(models.Model):
    class Sentido(models.TextChoices):
        ASCENDENTE = "ASCENDENTE", "Mejor cuanto más alto"
        DESCENDENTE = "DESCENDENTE", "Mejor cuanto más bajo"

    codigo = models.CharField(max_length=40, unique=True, validators=[codigo_catalogo])
    nombre = models.CharField(max_length=200)
    objetivo = models.TextField(help_text="Qué impacto de largo plazo mide.")
    formula = models.TextField(help_text="Cómo se calcula, en palabras.")
    unidad_medida = models.CharField(max_length=60)
    periodicidad = models.ForeignKey(Periodicidad, on_delete=models.PROTECT)
    sentido = models.CharField(max_length=12, choices=Sentido.choices)
    linea_base = models.DecimalField(max_digits=18, decimal_places=4, null=True, blank=True)
    meta = models.DecimalField(max_digits=18, decimal_places=4, null=True, blank=True)
    fuente = models.CharField(max_length=250, help_text="De dónde sale el dato.")
    activo = models.BooleanField(default=True)

    class Meta:
        ordering = ["codigo"]
        verbose_name = "indicador de impacto"
        verbose_name_plural = "indicadores de impacto"

    def __str__(self) -> str:
        return f"{self.codigo} — {self.nombre}"


class MedicionIndicador(models.Model):
    indicador = models.ForeignKey(
        IndicadorImpacto, on_delete=models.PROTECT, related_name="mediciones"
    )
    unidad = models.ForeignKey(Unidad, on_delete=models.PROTECT)
    municipio = models.ForeignKey(Municipio, null=True, blank=True, on_delete=models.PROTECT)
    periodo_inicio = models.DateField()
    periodo_fin = models.DateField()
    valor = models.DecimalField(max_digits=18, decimal_places=4)
    jornada = models.ForeignKey(Jornada, null=True, blank=True, on_delete=models.PROTECT)
    observaciones = models.TextField(blank=True)
    registrado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    registrado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["indicador", "periodo_inicio"]
        verbose_name = "medición de indicador"
        verbose_name_plural = "mediciones de indicadores"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(periodo_fin__gte=models.F("periodo_inicio")),
                name="medicion_periodo_coherente",
            ),
            models.UniqueConstraint(
                fields=["indicador", "unidad", "municipio", "periodo_inicio"],
                name="medicion_unica_por_periodo",
                nulls_distinct=False,
            ),
        ]

    def __str__(self) -> str:
        return f"{self.indicador_id} · {self.periodo_inicio}: {self.valor}"
