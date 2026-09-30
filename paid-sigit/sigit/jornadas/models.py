"""
Jornadas de Apoyo al Desarrollo y sus once pestañas.

Una jornada está COMPLETA cuando las once pestañas tienen contenido: las diez
de detalle y al menos un soporte. Los consolidados del RAO y las gráficas
pueden filtrar por `registro_completo`, que se recalcula en cada cambio.
"""

from __future__ import annotations

from django.core.validators import MinValueValidator
from django.db import models

from sigit.maestros.models import BorradoLogico, Entidad
from sigit.nucleo.geo import Georreferenciado
from sigit.nucleo.models import (
    Auditado,
    CategoriaAdjunto,
    GrupoPoblacional,
    MedioDifusion,
    MedioUtilizado,
    Municipio,
    ServicioPrestado,
    TipoBienDonado,
    TipoJornada,
    TipoOperacion,
    TipoRecurso,
    Unidad,
)


class Origen(models.TextChoices):
    """De dónde vino el registro. Es del sistema, no un dominio de negocio."""

    MANUAL = "MANUAL", "Registrada en PAID SIGIT"
    SIGIT = "SIGIT", "Recibida de SIGIT y aprobada por JACID"


class Jornada(Auditado, BorradoLogico, Georreferenciado):
    # TODO(JACID) Q1: el algoritmo oficial del código no se conoce. Se usa el
    # patrón observado <código unidad>R<mes><año><5 caracteres> detrás de una
    # función sustituible (jornadas/servicios.py: generar_codigo).
    codigo = models.CharField(max_length=40, unique=True, editable=False)
    unidad = models.ForeignKey(Unidad, on_delete=models.PROTECT, related_name="jornadas")
    tipo_jornada = models.ForeignKey(TipoJornada, on_delete=models.PROTECT)
    # El clavegrama: la descripción narrativa de la jornada.
    descripcion = models.TextField("descripción (clavegrama)")
    fecha_inicio = models.DateField()
    fecha_fin = models.DateField(null=True, blank=True)
    fecha_ejecucion = models.DateField("fecha de ejecución")
    lugar = models.CharField(max_length=250)
    municipio = models.ForeignKey(Municipio, on_delete=models.PROTECT)
    # La ARC participa siempre. Lo impone la base, no la pantalla.
    participo_arc = models.BooleanField("participó ARC", default=True, editable=False)
    participo_ejc = models.BooleanField("participó Ejército")
    participo_fac = models.BooleanField("participó Fuerza Aérea")
    # NULL = no se registró, que no es lo mismo que «no».
    poblacion_afecta_tropa = models.BooleanField(null=True, blank=True)
    observaciones = models.TextField(blank=True)
    registro_completo = models.BooleanField(default=False, editable=False)
    origen = models.CharField(
        max_length=10, choices=Origen.choices, default=Origen.MANUAL, editable=False
    )

    class Meta:
        ordering = ["-fecha_ejecucion", "-id"]
        indexes = [
            models.Index(fields=["unidad", "fecha_ejecucion"], name="jornada_unidad_fecha_idx"),
            models.Index(
                fields=["municipio", "fecha_ejecucion"], name="jornada_municipio_fecha_idx"
            ),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(participo_arc=True), name="jornada_participo_arc_siempre"
            ),
            models.CheckConstraint(
                condition=models.Q(fecha_fin__isnull=True)
                | models.Q(fecha_fin__gte=models.F("fecha_inicio")),
                name="jornada_fechas_coherentes",
            ),
            models.CheckConstraint(
                condition=models.Q(fecha_ejecucion__gte=models.F("fecha_inicio")),
                name="jornada_ejecucion_no_antes_del_inicio",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.codigo} · {self.lugar}"


class Pestana(models.Model):
    """Fila de una pestaña. Cuelga de una jornada; RLS la filtra por ella."""

    jornada = models.ForeignKey(Jornada, on_delete=models.CASCADE)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True

    def __str__(self) -> str:
        return f"{self._meta.verbose_name} · jornada {self.jornada_id}"


class JornadaTipoOperacion(Pestana):
    tipo_operacion = models.ForeignKey(TipoOperacion, on_delete=models.PROTECT)
    observacion = models.TextField(blank=True)

    class Meta:
        verbose_name = "tipo de operación"
        constraints = [
            models.UniqueConstraint(fields=["jornada", "tipo_operacion"], name="jto_unico")
        ]


class JornadaEntidadServicio(Pestana):
    entidad = models.ForeignKey(Entidad, on_delete=models.PROTECT)
    observacion = models.TextField(blank=True)

    class Meta:
        verbose_name = "entidad que prestó servicios"
        constraints = [models.UniqueConstraint(fields=["jornada", "entidad"], name="jes_unica")]


class JornadaServicioPrestado(Pestana):
    servicio = models.ForeignKey(ServicioPrestado, on_delete=models.PROTECT)
    cantidad = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    observacion = models.TextField(blank=True)

    class Meta:
        verbose_name = "servicio prestado"
        constraints = [
            models.UniqueConstraint(fields=["jornada", "servicio"], name="jsp_unico"),
            models.CheckConstraint(
                condition=models.Q(cantidad__gt=0), name="jsp_cantidad_positiva"
            ),
        ]


class JornadaPoblacion(Pestana):
    grupo = models.ForeignKey(GrupoPoblacional, on_delete=models.PROTECT)
    cantidad_personas = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    observacion = models.TextField(blank=True)

    class Meta:
        verbose_name = "población beneficiada"
        constraints = [
            models.UniqueConstraint(fields=["jornada", "grupo"], name="jpb_unica_por_grupo"),
            models.CheckConstraint(
                condition=models.Q(cantidad_personas__gt=0), name="jpb_cantidad_positiva"
            ),
        ]


class JornadaEntidadApoyada(Pestana):
    entidad = models.ForeignKey(Entidad, on_delete=models.PROTECT)
    observacion = models.TextField(blank=True)

    class Meta:
        verbose_name = "entidad apoyada"
        constraints = [models.UniqueConstraint(fields=["jornada", "entidad"], name="jea_unica")]


class JornadaMedioDifusion(Pestana):
    medio = models.ForeignKey(MedioDifusion, on_delete=models.PROTECT)
    detalle = models.CharField(max_length=500, blank=True)

    class Meta:
        verbose_name = "medio de difusión"
        constraints = [models.UniqueConstraint(fields=["jornada", "medio"], name="jmd_unico")]


class JornadaMedioUtilizado(Pestana):
    medio = models.ForeignKey(MedioUtilizado, on_delete=models.PROTECT)
    cantidad = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    detalle = models.CharField(max_length=500, blank=True)

    class Meta:
        verbose_name = "medio utilizado"
        constraints = [
            models.UniqueConstraint(fields=["jornada", "medio"], name="jmu_unico"),
            models.CheckConstraint(
                condition=models.Q(cantidad__gt=0), name="jmu_cantidad_positiva"
            ),
        ]


class JornadaRecurso(Pestana):
    tipo_recurso = models.ForeignKey(TipoRecurso, on_delete=models.PROTECT)
    cantidad = models.DecimalField(max_digits=18, decimal_places=2)
    unidad_medida = models.CharField(max_length=40, blank=True)
    valor = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    detalle = models.CharField(max_length=500, blank=True)

    class Meta:
        verbose_name = "recurso utilizado"
        constraints = [
            models.UniqueConstraint(fields=["jornada", "tipo_recurso"], name="jru_unico"),
            models.CheckConstraint(
                condition=models.Q(cantidad__gt=0), name="jru_cantidad_positiva"
            ),
            models.CheckConstraint(
                condition=models.Q(valor__isnull=True) | models.Q(valor__gte=0),
                name="jru_valor_no_negativo",
            ),
        ]


class JornadaBienDonado(Pestana):
    tipo_bien = models.ForeignKey(TipoBienDonado, on_delete=models.PROTECT)
    descripcion = models.CharField(max_length=500)
    cantidad = models.DecimalField(max_digits=18, decimal_places=2)
    unidad_medida = models.CharField(max_length=40, blank=True)
    valor_estimado = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    entidad_donante = models.ForeignKey(Entidad, null=True, blank=True, on_delete=models.PROTECT)

    class Meta:
        verbose_name = "bien donado"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(cantidad__gt=0), name="jbd_cantidad_positiva"
            ),
            models.CheckConstraint(
                condition=models.Q(valor_estimado__isnull=True) | models.Q(valor_estimado__gte=0),
                name="jbd_valor_no_negativo",
            ),
        ]


class JornadaResumen(Pestana):
    jornada = models.OneToOneField(Jornada, on_delete=models.CASCADE)
    texto = models.TextField()

    class Meta:
        verbose_name = "resumen"


class Adjunto(Pestana):
    """
    Soporte de la jornada. 10 MB AGREGADOS por jornada, no por archivo. El tipo
    se comprueba contra el CONTENIDO del archivo, no contra su nombre, y el
    mismo archivo no entra dos veces a la misma jornada (resumen SHA-256).
    """

    nombre_archivo = models.CharField(max_length=255)
    extension = models.CharField(max_length=10)
    categoria = models.ForeignKey(CategoriaAdjunto, on_delete=models.PROTECT)
    mime_detectado = models.CharField(max_length=120)
    peso_bytes = models.PositiveBigIntegerField()
    resumen_sha256 = models.CharField(max_length=64)
    ruta_almacen = models.CharField(max_length=300, editable=False)

    class Meta:
        verbose_name = "soporte"
        constraints = [
            models.UniqueConstraint(
                fields=["jornada", "resumen_sha256"], name="adjunto_sin_duplicado_por_contenido"
            ),
            models.CheckConstraint(
                condition=models.Q(peso_bytes__gt=0) & models.Q(peso_bytes__lte=10 * 1024 * 1024),
                name="adjunto_peso_valido",
            ),
            models.CheckConstraint(
                condition=models.Q(resumen_sha256__regex=r"^[0-9a-f]{64}$"),
                name="adjunto_resumen_hex",
            ),
        ]


# Las once pestañas, en el orden del manual. La décima primera son los soportes.
PESTANAS: list[tuple[str, str, type[models.Model]]] = [
    ("tipo-operacion", "Tipo de operación", JornadaTipoOperacion),
    ("entidades-servicios", "Entidades que prestaron servicios", JornadaEntidadServicio),
    ("servicios", "Servicios prestados", JornadaServicioPrestado),
    ("poblacion", "Población beneficiada", JornadaPoblacion),
    ("entidades-apoyadas", "Entidades apoyadas", JornadaEntidadApoyada),
    ("medios-difusion", "Medios de difusión", JornadaMedioDifusion),
    ("medios-utilizados", "Medios utilizados", JornadaMedioUtilizado),
    ("recursos", "Recursos utilizados", JornadaRecurso),
    ("bienes-donados", "Bienes donados", JornadaBienDonado),
    ("resumen", "Resumen", JornadaResumen),
    ("soportes", "Soportes", Adjunto),
]
