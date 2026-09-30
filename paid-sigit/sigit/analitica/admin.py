from django.contrib import admin

from .models import IndicadorImpacto, InformeGuardado, MedicionIndicador


@admin.register(IndicadorImpacto)
class IndicadorAdmin(admin.ModelAdmin):
    list_display = ("codigo", "nombre", "periodicidad", "linea_base", "meta", "activo")
    list_filter = ("activo", "periodicidad")
    search_fields = ("codigo", "nombre")


@admin.register(MedicionIndicador)
class MedicionAdmin(admin.ModelAdmin):
    list_display = ("indicador", "unidad", "municipio", "periodo_inicio", "periodo_fin", "valor")
    list_filter = ("indicador",)


admin.site.register(InformeGuardado)
