from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from . import models as m

CATALOGOS = [
    m.TipoJornada,
    m.TipoHerramientaAid,
    m.TipoOperacion,
    m.ServicioPrestado,
    m.GrupoPoblacional,
    m.MedioDifusion,
    m.MedioUtilizado,
    m.TipoRecurso,
    m.TipoBienDonado,
    m.TipoDocumentoIdentidad,
    m.Escalafon,
    m.Grado,
    m.TipoEntidad,
    m.CategoriaAdjunto,
    m.NivelJerarquia,
]


class CatalogoAdmin(admin.ModelAdmin):
    list_display = ("codigo", "nombre", "orden", "activo")
    list_editable = ("orden", "activo")
    search_fields = ("codigo", "nombre")
    list_filter = ("activo",)

    def has_delete_permission(self, request, obj=None):  # type: ignore[no-untyped-def]
        return False  # Se desactiva: hay registros que lo citan.


for modelo in CATALOGOS:
    admin.site.register(modelo, CatalogoAdmin)


@admin.register(m.EstadoHerramientaAid)
class EstadoHerramientaAdmin(CatalogoAdmin):
    list_display = ("codigo", "nombre", "exige_observacion", "orden", "activo")


@admin.register(m.Periodicidad)
class PeriodicidadAdmin(CatalogoAdmin):
    list_display = ("codigo", "nombre", "meses", "orden", "activo")


@admin.register(m.Unidad)
class UnidadAdmin(admin.ModelAdmin):
    list_display = ("sigla", "codigo", "nombre", "nivel", "superior", "ruta", "activa")
    list_filter = ("nivel", "activa")
    search_fields = ("sigla", "codigo", "nombre")
    readonly_fields = ("ruta",)

    def has_delete_permission(self, request, obj=None):  # type: ignore[no-untyped-def]
        return False


@admin.register(m.Usuario)
class UsuarioAdmin(UserAdmin):
    ordering = ("credencial",)
    list_display = ("credencial", "nombre_responsable", "unidad", "is_active", "bloqueado_hasta")
    list_filter = ("is_active", "groups", "unidad")
    search_fields = ("credencial", "nombre_responsable")
    readonly_fields = ("intentos_fallidos", "bloqueado_hasta", "last_login", "creado_en")
    fieldsets = (
        (None, {"fields": ("credencial", "password")}),
        ("Responsable", {"fields": ("nombre_responsable", "correo", "unidad")}),
        (
            "Acceso",
            {"fields": ("is_active", "is_staff", "groups", "intentos_fallidos", "bloqueado_hasta")},
        ),
        ("Registro", {"fields": ("last_login", "creado_en")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "fields": (
                    "credencial",
                    "nombre_responsable",
                    "unidad",
                    "password1",
                    "password2",
                    "groups",
                )
            },
        ),
    )
    filter_horizontal = ("groups",)


@admin.register(m.Departamento)
class DepartamentoAdmin(admin.ModelAdmin):
    list_display = ("codigo_dane", "nombre")
    search_fields = ("nombre",)


@admin.register(m.Municipio)
class MunicipioAdmin(admin.ModelAdmin):
    list_display = ("codigo_dane", "nombre", "departamento")
    search_fields = ("nombre", "codigo_dane")
    list_filter = ("departamento",)


@admin.register(m.IntentoIngreso)
class IntentoIngresoAdmin(admin.ModelAdmin):
    list_display = ("instante", "credencial_intentada", "resultado", "direccion_ip")
    list_filter = ("resultado",)
    search_fields = ("credencial_intentada",)

    def has_add_permission(self, request):  # type: ignore[no-untyped-def]
        return False

    def has_change_permission(self, request, obj=None):  # type: ignore[no-untyped-def]
        return False

    def has_delete_permission(self, request, obj=None):  # type: ignore[no-untyped-def]
        return False


@admin.register(m.Bitacora)
class BitacoraAdmin(IntentoIngresoAdmin):
    list_display = ("instante", "tabla", "operacion", "id_registro", "id_usuario")
    list_filter = ("tabla", "operacion")
    search_fields = ("tabla",)
