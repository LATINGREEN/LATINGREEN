from django.urls import path

from . import vistas

app_name = "analitica"
urlpatterns = [
    path("tablero/", vistas.tablero, name="tablero"),
    path("tablas-dinamicas/", vistas.pivote, name="pivote"),
    path("tablas-dinamicas/exportar.<str:formato>", vistas.exportar_pivote, name="exportar_pivote"),
    path("tablas-dinamicas/informes/", vistas.guardar_informe, name="guardar_informe"),
    path(
        "tablas-dinamicas/informes/<int:pk>/borrar/", vistas.borrar_informe, name="borrar_informe"
    ),
    path("indicadores/", vistas.indicadores, name="indicadores"),
]
