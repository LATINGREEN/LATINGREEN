from django.contrib import admin
from django.urls import include, path

admin.site.site_header = "PAID SIGIT · Gestión"
admin.site.site_title = "PAID SIGIT"
admin.site.index_title = "Catálogos, unidades, usuarios y sistemas externos"

urlpatterns = [
    path("", include("sigit.nucleo.urls")),
    path("jornadas/", include("sigit.jornadas.urls")),
    path("maestros/", include("sigit.maestros.urls")),
    path("analitica/", include("sigit.analitica.urls")),
    path("integracion/", include("sigit.integracion.urls")),
    path("api/v1/", include("sigit.api.urls")),
    path("gestion/", admin.site.urls),
]

handler403 = "sigit.nucleo.vistas.error_403"
handler404 = "sigit.nucleo.vistas.error_404"
handler500 = "sigit.nucleo.vistas.error_500"
