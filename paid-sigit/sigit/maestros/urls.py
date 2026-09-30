from django.urls import path

from . import vistas

app_name = "maestros"
urlpatterns = [
    path("entidades/", vistas.entidades, name="entidades"),
    path("entidades/semejantes/", vistas.entidades_semejantes_vista, name="entidades_semejantes"),
    path("personal/", vistas.personal, name="personal"),
    path("herramientas/", vistas.herramientas, name="herramientas"),
]
