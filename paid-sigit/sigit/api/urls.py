from django.urls import path
from drf_spectacular.views import SpectacularAPIView

from . import vistas

app_name = "api"
urlpatterns = [
    path("integracion/actividades/", vistas.ActividadesSigit.as_view(), name="actividades"),
    path(
        "integracion/actividades/<str:id_externo>/",
        vistas.EstadoActividadSigit.as_view(),
        name="estado_actividad",
    ),
    path("catalogos/<slug:nombre>/", vistas.Catalogo.as_view(), name="catalogo"),
    path("unidades/", vistas.Unidades.as_view(), name="unidades"),
    path("municipios/", vistas.Municipios.as_view(), name="municipios"),
    path("jornadas/", vistas.Jornadas.as_view(), name="jornadas"),
    path("esquema/", SpectacularAPIView.as_view(), name="esquema"),
    path("documentacion/", vistas.documentacion, name="documentacion"),
]
