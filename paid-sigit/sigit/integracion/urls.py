from django.urls import path

from . import vistas

app_name = "integracion"
urlpatterns = [
    path("bandeja/", vistas.bandeja, name="bandeja"),
    path("bandeja/<int:pk>/", vistas.detalle, name="detalle"),
    path("bandeja/<int:pk>/rechazar/", vistas.rechazar, name="rechazar"),
    path("archivo/", vistas.cargar_archivo, name="cargar_archivo"),
    path("archivo/plantilla.csv", vistas.plantilla, name="plantilla"),
]
