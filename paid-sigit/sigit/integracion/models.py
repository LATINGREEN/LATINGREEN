"""
Integración SIGIT → PAID.

En la reunión con el área de tecnología (30/09/2026) quedaron tres ideas:

1. Evitar el doble proceso: hoy la reserva reporta y JACID vuelve a digitar,
   y cada digitación es una fuente de error.
2. JACID supervisa: no toda actividad propuesta entra con la categoría que se
   propone; hay que revisarla (Capitán Ramos).
3. La vía puede ser una API o un archivo plano periódico, pasando por la
   validación de seguridad (Teniente Vélez).

Por eso nada de lo que llega de SIGIT se convierte en jornada por sí solo:
entra a una BANDEJA DE REVISIÓN, y es un revisor de JACID quien aprueba,
reclasifica o rechaza. La aprobación crea la jornada; el registro externo
queda enlazado a ella para siempre (trazabilidad).
"""

from __future__ import annotations

import hashlib
import secrets

from django.conf import settings
from django.db import models

from sigit.jornadas.models import Jornada
from sigit.nucleo.models import Unidad


class SistemaExterno(models.Model):
    """
    Un sistema que habla con PAID SIGIT por la API (SIGIT de la reserva, u
    otro de los sistemas de información de la Armada).

    Del testigo de acceso solo se guarda el RESUMEN SHA-256: si alguien copia
    la base, no se lleva testigos utilizables. El testigo en claro se muestra
    una sola vez, al emitirlo.
    """

    class Alcance(models.TextChoices):
        ENTREGA = "ENTREGA", "Entrega actividades a la bandeja de revisión"
        LECTURA = "LECTURA", "Solo consulta datos maestros"

    codigo = models.CharField(max_length=40, unique=True)
    nombre = models.CharField(max_length=200)
    alcance = models.CharField(max_length=10, choices=Alcance.choices)
    # Unidad a nombre de la cual consulta (LECTURA) y a la que se proponen por
    # omisión las actividades que entrega (ENTREGA). El revisor puede cambiarla.
    unidad = models.ForeignKey(Unidad, on_delete=models.PROTECT)
    resumen_testigo = models.CharField(max_length=64, unique=True, editable=False)
    prefijo_testigo = models.CharField(max_length=8, editable=False)
    activo = models.BooleanField(default=True)
    ultimo_uso = models.DateTimeField(null=True, blank=True, editable=False)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "sistema externo"
        verbose_name_plural = "sistemas externos"

    def __str__(self) -> str:
        return f"{self.codigo} ({self.get_alcance_display()})"

    @staticmethod
    def resumir(testigo: str) -> str:
        return hashlib.sha256(testigo.encode()).hexdigest()

    def emitir_testigo(self) -> str:
        """Genera un testigo nuevo, guarda su resumen y lo devuelve UNA vez."""
        testigo = f"sigit_{secrets.token_urlsafe(32)}"
        self.resumen_testigo = self.resumir(testigo)
        self.prefijo_testigo = testigo[:8]
        return testigo


class LoteImportacion(models.Model):
    class Via(models.TextChoices):
        API = "API", "API"
        ARCHIVO = "ARCHIVO", "Archivo plano"

    sistema = models.ForeignKey(SistemaExterno, on_delete=models.PROTECT)
    via = models.CharField(max_length=10, choices=Via.choices)
    nombre_archivo = models.CharField(max_length=255, blank=True)
    recibido_en = models.DateTimeField(auto_now_add=True)
    recibido_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT
    )
    total = models.PositiveIntegerField(default=0)
    aceptados = models.PositiveIntegerField(default=0)
    repetidos = models.PositiveIntegerField(default=0)
    rechazados = models.PositiveIntegerField(default=0)
    errores = models.JSONField(default=list)

    class Meta:
        ordering = ["-recibido_en"]
        verbose_name = "lote de importación"
        verbose_name_plural = "lotes de importación"

    def __str__(self) -> str:
        return f"Lote {self.pk} · {self.sistema_id}"


class EstadoRevision(models.TextChoices):
    PENDIENTE = "PENDIENTE", "Pendiente de revisión"
    APROBADO = "APROBADO", "Aprobado: jornada creada"
    RECHAZADO = "RECHAZADO", "Rechazado"


class RegistroExterno(models.Model):
    """
    Una actividad propuesta por un sistema externo, tal como llegó, más el
    resultado de la revisión de JACID.
    """

    sistema = models.ForeignKey(SistemaExterno, on_delete=models.PROTECT)
    lote = models.ForeignKey(LoteImportacion, on_delete=models.PROTECT, related_name="registros")
    # Identificador de la actividad en el sistema de origen. Con él, reenviar
    # el mismo lote no duplica nada (idempotencia).
    id_externo = models.CharField(max_length=80)
    datos = models.JSONField()
    resumen_contenido = models.CharField(max_length=64)
    unidad_propuesta = models.ForeignKey(Unidad, on_delete=models.PROTECT)
    estado = models.CharField(
        max_length=10, choices=EstadoRevision.choices, default=EstadoRevision.PENDIENTE
    )
    # Jornadas ya registradas que se parecen a esta (misma fecha y municipio,
    # lugar semejante). Se calcula al recibir y se muestra al revisor.
    posibles_duplicados = models.JSONField(default=list)
    motivo_rechazo = models.TextField(blank=True)
    revisado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )
    revisado_en = models.DateTimeField(null=True, blank=True)
    jornada = models.OneToOneField(
        Jornada, null=True, blank=True, on_delete=models.PROTECT, related_name="registro_externo"
    )
    recibido_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-recibido_en"]
        verbose_name = "registro externo"
        verbose_name_plural = "registros externos"
        constraints = [
            models.UniqueConstraint(
                fields=["sistema", "id_externo"], name="registro_externo_unico"
            ),
            models.CheckConstraint(
                condition=~models.Q(estado="RECHAZADO") | ~models.Q(motivo_rechazo=""),
                name="rechazo_exige_motivo",
            ),
            models.CheckConstraint(
                condition=~models.Q(estado="APROBADO") | models.Q(jornada__isnull=False),
                name="aprobado_exige_jornada",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.id_externo} ({self.estado})"
