from django.urls import path

from . import vistas

app_name = "jornadas"
urlpatterns = [
    path("", vistas.listado, name="listado"),
    path("exportar.<str:formato>", vistas.exportar, name="exportar"),
    path("buscar/", vistas.busqueda_rapida, name="busqueda_rapida"),
    path("nueva/", vistas.nueva, name="nueva"),
    path("<int:pk>/", vistas.detalle, name="detalle"),
    path("<int:pk>/editar/", vistas.editar, name="editar"),
    path("<int:pk>/eliminar/", vistas.eliminar, name="eliminar"),
    path("<int:pk>/pasos/", vistas.pasos, name="pasos"),
    path("<int:pk>/pestana/<slug:clave>/agregar/", vistas.agregar_fila, name="agregar_fila"),
    path(
        "<int:pk>/pestana/<slug:clave>/<int:fila>/quitar/", vistas.quitar_fila, name="quitar_fila"
    ),
    path("<int:pk>/soportes/cargar/", vistas.cargar_soporte, name="cargar_soporte"),
    path("<int:pk>/soportes/<int:adjunto>/", vistas.descargar_soporte, name="descargar_soporte"),
]
