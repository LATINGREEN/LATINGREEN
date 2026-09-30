from django.urls import path
from django.views.generic import RedirectView

from . import vistas

app_name = "nucleo"
urlpatterns = [
    path("", RedirectView.as_view(pattern_name="analitica:tablero"), name="inicio"),
    path("ingreso/", vistas.ingreso, name="ingreso"),
    path("salida/", vistas.salida, name="salida"),
    path("sesion/renovar/", vistas.renovar_sesion, name="renovar_sesion"),
    path("municipios/", vistas.municipios, name="municipios"),
    path("salud/", vistas.salud, name="salud"),
]
