"""
Núcleo de PAID SIGIT: catálogos, unidades, usuarios y seguridad.

Reglas que vienen de la PAID y se conservan (ver docs/DECISIONES.md):

- Los dominios cerrados viven en tablas de catálogo, nunca en texto libre.
- La jerarquía de unidades se guarda como ruta materializada, calculada por
  disparador. Row Level Security decide sobre esa ruta, así que no se escribe
  a mano.
- Instantes en UTC; fechas sin hora en DATE.
"""

from __future__ import annotations

from django.conf import settings
from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.core.validators import RegexValidator
from django.db import models
from django.db.models.functions import Lower

codigo_catalogo = RegexValidator(
    r"^[A-Z0-9_]+$", "Use mayúsculas, números y guion bajo, sin espacios ni tildes."
)
credencial_valida = RegexValidator(
    r"^[A-Z0-9]{2,20}_PAID$", "La credencial tiene la forma SIGLA_PAID (por ejemplo, BIM23_PAID)."
)


class Auditado(models.Model):
    """
    Cuatro columnas de auditoría de fila. Las llena un disparador con el
    usuario del contexto de la transacción, no el código: así no dependen de
    que cada vista se acuerde. El detalle de cada cambio va además a la
    bitácora (ver migración 0002 de este módulo).
    """

    creado_en = models.DateTimeField(auto_now_add=True, editable=False)
    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        editable=False,
        on_delete=models.PROTECT,
        related_name="+",
    )
    modificado_en = models.DateTimeField(auto_now=True, editable=False)
    modificado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        editable=False,
        on_delete=models.PROTECT,
        related_name="+",
    )

    class Meta:
        abstract = True


class Catalogo(models.Model):
    """Dominio cerrado. Se desactiva, no se borra: hay registros que lo citan."""

    codigo = models.CharField(max_length=60, unique=True, validators=[codigo_catalogo])
    nombre = models.CharField(max_length=200)
    descripcion = models.TextField(blank=True)
    orden = models.PositiveSmallIntegerField(default=0)
    activo = models.BooleanField(default=True)

    class Meta:
        abstract = True
        ordering = ["orden", "nombre"]

    def __str__(self) -> str:
        return self.nombre


# ── Catálogos que el Manual del Usuario enumera literalmente ────────────────
class TipoJornada(Catalogo):
    class Meta(Catalogo.Meta):
        verbose_name = "tipo de jornada"
        verbose_name_plural = "tipos de jornada"


class TipoHerramientaAid(Catalogo):
    class Meta(Catalogo.Meta):
        verbose_name = "tipo de herramienta AID"
        verbose_name_plural = "tipos de herramienta AID"


class EstadoHerramientaAid(Catalogo):
    exige_observacion = models.BooleanField(default=False)

    class Meta(Catalogo.Meta):
        verbose_name = "estado de herramienta AID"
        verbose_name_plural = "estados de herramienta AID"


# ── Catálogos de las pestañas: los define JACID (Q2/Q4). Vacíos en producción.
class TipoOperacion(Catalogo):
    class Meta(Catalogo.Meta):
        verbose_name = "tipo de operación"
        verbose_name_plural = "tipos de operación"


class ServicioPrestado(Catalogo):
    class Meta(Catalogo.Meta):
        verbose_name = "servicio prestado"
        verbose_name_plural = "servicios prestados"


class GrupoPoblacional(Catalogo):
    class Meta(Catalogo.Meta):
        verbose_name = "grupo poblacional"
        verbose_name_plural = "grupos poblacionales"


class MedioDifusion(Catalogo):
    class Meta(Catalogo.Meta):
        verbose_name = "medio de difusión"
        verbose_name_plural = "medios de difusión"


class MedioUtilizado(Catalogo):
    class Meta(Catalogo.Meta):
        verbose_name = "medio utilizado"
        verbose_name_plural = "medios utilizados"


class TipoRecurso(Catalogo):
    class Meta(Catalogo.Meta):
        verbose_name = "tipo de recurso"
        verbose_name_plural = "tipos de recurso"


class TipoBienDonado(Catalogo):
    class Meta(Catalogo.Meta):
        verbose_name = "tipo de bien donado"
        verbose_name_plural = "tipos de bien donado"


# ── Catálogos de personas, entidades y soportes ─────────────────────────────
class TipoDocumentoIdentidad(Catalogo):
    class Meta(Catalogo.Meta):
        verbose_name = "tipo de documento de identidad"
        verbose_name_plural = "tipos de documento de identidad"


class Escalafon(Catalogo):
    class Meta(Catalogo.Meta):
        verbose_name = "escalafón"
        verbose_name_plural = "escalafones"


class Grado(Catalogo):
    class Meta(Catalogo.Meta):
        verbose_name = "grado"
        verbose_name_plural = "grados"


class TipoEntidad(Catalogo):
    class Meta(Catalogo.Meta):
        verbose_name = "tipo de entidad"
        verbose_name_plural = "tipos de entidad"


class CategoriaAdjunto(Catalogo):
    class Meta(Catalogo.Meta):
        verbose_name = "categoría de soporte"
        verbose_name_plural = "categorías de soporte"


class ExtensionPermitida(models.Model):
    """Extensión → tipos MIME reales. Se valida contra el CONTENIDO del archivo."""

    extension = models.CharField(max_length=10, unique=True)
    categoria = models.ForeignKey(CategoriaAdjunto, on_delete=models.PROTECT)
    mimes_esperados = models.JSONField(default=list)

    class Meta:
        verbose_name = "extensión permitida"
        verbose_name_plural = "extensiones permitidas"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(extension=Lower("extension")), name="extension_en_minuscula"
            )
        ]

    def __str__(self) -> str:
        return self.extension


class NivelJerarquia(Catalogo):
    class Meta(Catalogo.Meta):
        verbose_name = "nivel de jerarquía"
        verbose_name_plural = "niveles de jerarquía"


class Periodicidad(Catalogo):
    """Para los indicadores de impacto de la metodología SIGIT."""

    meses = models.PositiveSmallIntegerField()

    class Meta(Catalogo.Meta):
        verbose_name = "periodicidad"
        verbose_name_plural = "periodicidades"


# ── División político-administrativa (DANE) ─────────────────────────────────
class Departamento(models.Model):
    codigo_dane = models.CharField(max_length=2, unique=True)
    nombre = models.CharField(max_length=120)

    class Meta:
        ordering = ["nombre"]

    def __str__(self) -> str:
        return self.nombre


class Municipio(models.Model):
    departamento = models.ForeignKey(Departamento, on_delete=models.PROTECT)
    codigo_dane = models.CharField(max_length=5, unique=True)
    nombre = models.CharField(max_length=120)

    class Meta:
        ordering = ["nombre"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(codigo_dane__regex=r"^[0-9]{5}$"),
                name="municipio_dane_5_digitos",
            )
        ]

    def __str__(self) -> str:
        return f"{self.nombre} ({self.departamento.nombre})"


# ── Unidades ────────────────────────────────────────────────────────────────
class Unidad(Auditado):
    codigo = models.CharField(max_length=30, unique=True)
    sigla = models.CharField(
        max_length=20,
        unique=True,
        validators=[RegexValidator(r"^[A-Z0-9]{2,20}$", "Sigla en mayúsculas, sin espacios.")],
    )
    nombre = models.CharField(max_length=250)
    nivel = models.ForeignKey(NivelJerarquia, on_delete=models.PROTECT)
    superior = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.PROTECT, related_name="subordinadas"
    )
    # DERIVADA por disparador desde `superior`: '/1/5/23/'. RLS decide sobre
    # ella, así que si se pudiera escribir a mano la visibilidad sería opinable.
    ruta = models.CharField(max_length=500, editable=False, default="")
    municipio = models.ForeignKey(Municipio, null=True, blank=True, on_delete=models.PROTECT)
    activa = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = "unidades"
        ordering = ["ruta"]
        indexes = [
            models.Index(
                fields=["ruta"], name="unidad_ruta_patron_idx", opclasses=["varchar_pattern_ops"]
            )
        ]
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(superior=models.F("id")), name="unidad_no_es_su_propia_superior"
            )
        ]

    def __str__(self) -> str:
        return f"{self.sigla} — {self.nombre}"


# ── Usuarios ────────────────────────────────────────────────────────────────
class GestorUsuarios(BaseUserManager["Usuario"]):
    def create_user(
        self, credencial: str, password: str | None = None, **campos: object
    ) -> Usuario:
        usuario = self.model(credencial=credencial, **campos)
        usuario.set_password(password)
        usuario.full_clean(exclude=["password"])
        usuario.save(using=self._db)
        return usuario

    def create_superuser(
        self, credencial: str, password: str | None = None, **campos: object
    ) -> Usuario:
        campos.setdefault("is_staff", True)
        campos.setdefault("is_superuser", True)
        return self.create_user(credencial, password, **campos)


class Usuario(AbstractBaseUser, PermissionsMixin):
    """
    La credencial es de unidad, con la forma SIGLA_PAID, como en la PAID.
    La persona responsable queda en `nombre_responsable` y en la bitácora.
    """

    credencial = models.CharField(max_length=40, unique=True, validators=[credencial_valida])
    nombre_responsable = models.CharField(max_length=200)
    correo = models.EmailField(blank=True)
    unidad = models.ForeignKey(Unidad, on_delete=models.PROTECT, related_name="usuarios")
    is_active = models.BooleanField("activo", default=True)
    is_staff = models.BooleanField("acceso a la gestión", default=False)
    intentos_fallidos = models.PositiveSmallIntegerField(default=0, editable=False)
    bloqueado_hasta = models.DateTimeField(null=True, blank=True, editable=False)
    creado_en = models.DateTimeField(auto_now_add=True)

    objects = GestorUsuarios()

    USERNAME_FIELD = "credencial"
    REQUIRED_FIELDS = ["nombre_responsable", "unidad"]

    class Meta:
        ordering = ["credencial"]

    def __str__(self) -> str:
        return self.credencial

    def tiene_rol(self, *roles: str) -> bool:
        if self.is_superuser:
            return True
        return self.groups.filter(name__in=roles).exists()


class Rol:
    """Nombres de los grupos de Django que hacen de roles."""

    CONSULTA = "CONSULTA"
    OPERADOR = "OPERADOR"
    REVISOR_JACID = "REVISOR_JACID"
    ADMINISTRADOR = "ADMINISTRADOR"
    TODOS = (CONSULTA, OPERADOR, REVISOR_JACID, ADMINISTRADOR)


class ResultadoIngreso(models.TextChoices):
    """
    Las causas se guardan para el análisis forense. La pantalla SIEMPRE dice
    lo mismo: «Credenciales inválidas». Distinguirlas en pantalla le diría a
    quien prueba credenciales cuáles existen.
    """

    EXITOSO = "EXITOSO", "Exitoso"
    CREDENCIAL_INEXISTENTE = "CREDENCIAL_INEXISTENTE", "Credencial inexistente"
    CLAVE_ERRADA = "CLAVE_ERRADA", "Clave errada"
    CAPTCHA_ERRADO = "CAPTCHA_ERRADO", "Captcha errado o vencido"
    USUARIO_BLOQUEADO = "USUARIO_BLOQUEADO", "Usuario bloqueado por intentos"
    USUARIO_INACTIVO = "USUARIO_INACTIVO", "Usuario inactivo"
    UNIDAD_INACTIVA = "UNIDAD_INACTIVA", "Unidad inactiva"


class IntentoIngreso(models.Model):
    credencial_intentada = models.CharField(max_length=60)
    usuario = models.ForeignKey(Usuario, null=True, blank=True, on_delete=models.SET_NULL)
    resultado = models.CharField(max_length=30, choices=ResultadoIngreso.choices)
    direccion_ip = models.GenericIPAddressField(null=True)
    agente = models.CharField(max_length=300, blank=True)
    instante = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-instante"]
        verbose_name = "intento de ingreso"
        verbose_name_plural = "intentos de ingreso"

    def __str__(self) -> str:
        return f"{self.credencial_intentada} · {self.resultado}"


class Captcha(models.Model):
    """Se guarda el RESUMEN de la respuesta, no la respuesta. Un solo uso."""

    resumen_respuesta = models.CharField(max_length=64)
    creado_en = models.DateTimeField(auto_now_add=True)
    consumido_en = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return f"captcha {self.pk}"


class Bitacora(models.Model):
    """
    Registro de cambios. La alimenta un disparador sobre cada tabla del
    dominio: no depende de que la vista se acuerde. Solo se inserta; el rol de
    la aplicación no tiene UPDATE ni DELETE sobre ella.
    """

    tabla = models.CharField(max_length=80)
    operacion = models.CharField(max_length=10)
    id_registro = models.BigIntegerField(null=True)
    datos_antes = models.JSONField(null=True)
    datos_despues = models.JSONField(null=True)
    id_usuario = models.BigIntegerField(null=True)
    instante = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-instante"]
        verbose_name = "cambio en bitácora"
        verbose_name_plural = "bitácora de cambios"
        indexes = [models.Index(fields=["tabla", "id_registro"], name="bitacora_registro_idx")]

    def __str__(self) -> str:
        return f"{self.operacion} {self.tabla} #{self.id_registro}"
