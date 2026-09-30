from django.contrib import admin, messages

from .models import LoteImportacion, RegistroExterno, SistemaExterno


@admin.register(SistemaExterno)
class SistemaExternoAdmin(admin.ModelAdmin):
    list_display = (
        "codigo",
        "nombre",
        "alcance",
        "unidad",
        "prefijo_testigo",
        "activo",
        "ultimo_uso",
    )
    list_filter = ("alcance", "activo")
    readonly_fields = ("prefijo_testigo", "ultimo_uso", "creado_en")
    exclude = ("resumen_testigo",)
    actions = ["emitir_testigo"]

    def save_model(self, request, obj, form, change):  # type: ignore[no-untyped-def]
        if not change:
            testigo = obj.emitir_testigo()
            super().save_model(request, obj, form, change)
            self._mostrar(request, obj, testigo)
        else:
            super().save_model(request, obj, form, change)

    @admin.action(description="Emitir un testigo nuevo (invalida el anterior)")
    def emitir_testigo(self, request, queryset):  # type: ignore[no-untyped-def]
        for sistema in queryset:
            testigo = sistema.emitir_testigo()
            sistema.save(update_fields=["resumen_testigo", "prefijo_testigo"])
            self._mostrar(request, sistema, testigo)

    def _mostrar(self, request, sistema, testigo):  # type: ignore[no-untyped-def]
        messages.warning(
            request,
            f"Testigo de {sistema.codigo} (cópielo ahora; no se volverá a mostrar): {testigo}",
        )


@admin.register(LoteImportacion)
class LoteAdmin(admin.ModelAdmin):
    list_display = (
        "pk",
        "sistema",
        "via",
        "recibido_en",
        "total",
        "aceptados",
        "repetidos",
        "rechazados",
    )
    readonly_fields = [f.name for f in LoteImportacion._meta.fields]

    def has_add_permission(self, request):  # type: ignore[no-untyped-def]
        return False


@admin.register(RegistroExterno)
class RegistroExternoAdmin(admin.ModelAdmin):
    list_display = ("id_externo", "sistema", "estado", "recibido_en", "jornada")
    list_filter = ("estado", "sistema")
    search_fields = ("id_externo",)
    readonly_fields = [f.name for f in RegistroExterno._meta.fields]

    def has_add_permission(self, request):  # type: ignore[no-untyped-def]
        return False
