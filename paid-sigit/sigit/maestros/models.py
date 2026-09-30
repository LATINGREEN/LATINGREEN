"""
Maestros de precedencia: personal, entidades y herramientas AID.

Se registran una vez y las jornadas los citan. Es la primera línea contra la
duplicidad de entradas: la entidad «Alcaldía de Tumaco» existe una sola vez y
las jornadas la eligen de una lista, en lugar de escribirla cada vez.
"""

from __future__ import annotations

from django.core.validators import RegexValidator
from django.db import models
from django.db.models.functions import Upper

from sigit.nucleo.geo import Georreferenciado
from sigit.nucleo.models import (
    Auditado,
    Escalafon,
    EstadoHerramientaAid,
    Grado,
    Municipio,
    TipoDocumentoIdentidad,
    TipoEntidad,
    TipoHerramientaAid,
    Unidad,
)
from sigit.nucleo.texto import normalizar


class Vigentes(models.Manager):
    def get_queryset(self) -> models.QuerySet:
        return super().get_queryset().filter(eliminado_en__isnull=True)


class BorradoLogico(models.Model):
    """El borrado es lógico: el registro queda para la bitácora y el RAO."""

    eliminado_en = models.DateTimeField(null=True, blank=True, editable=False)

    objects = models.Manager()
    vigentes = Vigentes()

    class Meta:
        abstract = True


class Personal(Auditado, BorradoLogico):
    tipo_documento = models.ForeignKey(TipoDocumentoIdentidad, on_delete=models.PROTECT)
    numero_documento = models.CharField(
        max_length=30,
        validators=[RegexValidator(r"^[0-9A-Za-z-]+$", "Solo números, letras y guion.")],
    )
    nombres = models.CharField(max_length=150)
    apellidos = models.CharField(max_length=150)
    grado = models.ForeignKey(Grado, null=True, blank=True, on_delete=models.PROTECT)
    escalafon = models.ForeignKey(Escalafon, null=True, blank=True, on_delete=models.PROTECT)
    unidad = models.ForeignKey(Unidad, on_delete=models.PROTECT)
    correo = models.EmailField(blank=True)
    telefono = models.CharField(max_length=30, blank=True)

    class Meta:
        verbose_name_plural = "personal"
        ordering = ["apellidos", "nombres"]
        constraints = [
            # Una persona, un registro: el mismo documento no entra dos veces.
            models.UniqueConstraint(
                "tipo_documento",
                Upper("numero_documento"),
                name="personal_documento_unico",
                violation_error_message="Esa persona ya está registrada (mismo documento).",
            )
        ]

    def __str__(self) -> str:
        grado = f"{self.grado} " if self.grado_id else ""
        return f"{grado}{self.nombres} {self.apellidos}"


class Entidad(Auditado, BorradoLogico):
    tipo = models.ForeignKey(TipoEntidad, on_delete=models.PROTECT)
    nit = models.CharField(
        max_length=20,
        blank=True,
        validators=[
            RegexValidator(r"^[0-9]{6,12}(-[0-9])?$", "NIT sin puntos, p. ej. 800123456-7.")
        ],
    )
    nombre = models.CharField(max_length=250)
    # Forma normalizada del nombre: sobre ella se buscan las semejantes
    # (trigramas) antes de registrar una entidad nueva.
    nombre_normalizado = models.CharField(max_length=250, editable=False, db_index=True)
    unidad = models.ForeignKey(Unidad, on_delete=models.PROTECT)
    municipio = models.ForeignKey(Municipio, null=True, blank=True, on_delete=models.PROTECT)
    direccion = models.CharField(max_length=250, blank=True)
    telefono = models.CharField(max_length=30, blank=True)
    correo = models.EmailField(blank=True)
    contacto = models.CharField(max_length=150, blank=True)

    class Meta:
        verbose_name_plural = "entidades"
        ordering = ["nombre"]
        constraints = [
            models.UniqueConstraint(
                fields=["nit"],
                condition=~models.Q(nit=""),
                name="entidad_nit_unico",
                violation_error_message="Ya hay una entidad registrada con ese NIT.",
            ),
            models.UniqueConstraint(
                fields=["nombre_normalizado", "municipio"],
                condition=models.Q(eliminado_en__isnull=True),
                name="entidad_nombre_municipio_unico",
                violation_error_message="Ya hay una entidad con ese nombre en ese municipio.",
            ),
        ]

    def __str__(self) -> str:
        return self.nombre

    def save(self, *args: object, **kwargs: object) -> None:
        self.nombre_normalizado = normalizar(self.nombre)
        super().save(*args, **kwargs)


class HerramientaAid(Auditado, BorradoLogico, Georreferenciado):
    tipo = models.ForeignKey(TipoHerramientaAid, on_delete=models.PROTECT)
    estado = models.ForeignKey(EstadoHerramientaAid, on_delete=models.PROTECT)
    codigo = models.CharField(max_length=40, unique=True)
    nombre = models.CharField(max_length=250)
    descripcion = models.TextField(blank=True)
    unidad = models.ForeignKey(Unidad, on_delete=models.PROTECT)
    municipio = models.ForeignKey(Municipio, on_delete=models.PROTECT)
    fecha_registro = models.DateField()
    fecha_potenciacion = models.DateField(null=True, blank=True)
    responsable = models.ForeignKey(Personal, on_delete=models.PROTECT)
    observaciones = models.TextField(blank=True)

    class Meta:
        verbose_name = "herramienta AID"
        verbose_name_plural = "herramientas AID"
        ordering = ["codigo"]

    def __str__(self) -> str:
        return f"{self.codigo} — {self.nombre}"
