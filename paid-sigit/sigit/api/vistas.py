"""
API de interoperabilidad de PAID SIGIT (v1).

En la reunión con el área de tecnología (30/09/2026) se habló de «gobernanza
del dato» y de no dejar sistemas aislados: la Armada tiene 38 sistemas de
información y los quiere conectados por API. Esta API cumple dos papeles:

1. ENTREGA — SIGIT envía actividades a la bandeja de revisión de JACID.
2. LECTURA — otros sistemas consultan datos maestros (catálogos, unidades,
   municipios) y el resumen de jornadas, siempre dentro del ámbito de la
   unidad a nombre de la cual consultan (RLS).

Autenticación: `Authorization: Bearer sigit_…` (testigo por sistema) o la
sesión de un usuario. Contrato OpenAPI en /api/v1/esquema/.
"""

from __future__ import annotations

from typing import Any

from django.db.models import QuerySet
from django.http import HttpRequest, HttpResponse
from django.shortcuts import render
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import generics, permissions, serializers, status
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from sigit.integracion import servicios as integracion
from sigit.integracion.esquema import ActividadSigit, LoteSigit
from sigit.integracion.models import LoteImportacion, RegistroExterno, SistemaExterno
from sigit.jornadas.models import Jornada
from sigit.nucleo import models as m
from sigit.nucleo.permisos import requiere_rol

from .limites import LimitePorSistema, sistema_de

# ── Permisos y límites ───────────────────────────────────────────────────────
_sistema = sistema_de


class EsSistemaDeEntrega(permissions.BasePermission):
    message = "Solo un sistema con alcance ENTREGA puede enviar actividades."

    def has_permission(self, request: Request, view: Any) -> bool:
        sistema = _sistema(request)
        return sistema is not None and sistema.alcance == SistemaExterno.Alcance.ENTREGA


class PuedeLeer(permissions.BasePermission):
    message = "Se requiere un testigo de LECTURA o una sesión de usuario."

    def has_permission(self, request: Request, view: Any) -> bool:
        if request.method not in permissions.SAFE_METHODS:
            return False
        sistema = _sistema(request)
        if sistema is not None:
            return True  # ENTREGA y LECTURA pueden consultar datos maestros.
        return bool(request.user and request.user.is_authenticated)


# ── Entrega de actividades (SIGIT) ───────────────────────────────────────────
class ActividadesSigit(APIView):
    permission_classes = [EsSistemaDeEntrega]
    throttle_classes = [LimitePorSistema]

    @extend_schema(
        summary="Entregar actividades a la bandeja de revisión de JACID",
        description=(
            "Hasta 500 actividades por llamada. Idempotente por `id_externo`: reenviar la misma "
            "actividad no la duplica; reenviarla cambiada mientras está pendiente la actualiza. "
            "Ninguna actividad se convierte en jornada sin la aprobación de JACID."
        ),
        request=inline_serializer("LoteSigit", {"actividades": ActividadSigit(many=True)}),
        responses={
            202: inline_serializer(
                "ResultadoLote",
                {
                    "lote": serializers.IntegerField(),
                    "resultados": inline_serializer(
                        "ResultadoActividad",
                        {
                            "id_externo": serializers.CharField(),
                            "resultado": serializers.ChoiceField(
                                ["RECIBIDA", "ACTUALIZADA", "REPETIDA", "RECHAZADA"]
                            ),
                            "errores": serializers.DictField(),
                            "posibles_duplicados": serializers.IntegerField(),
                        },
                        many=True,
                    ),
                },
            )
        },
        tags=["Integración SIGIT"],
    )
    def post(self, request: Request) -> Response:
        lote_valido = LoteSigit(data=request.data)
        lote_valido.is_valid(raise_exception=True)
        lote, resultados = integracion.recibir_lote(
            _sistema(request), lote_valido.validated_data["actividades"], LoteImportacion.Via.API
        )
        return Response(
            {"lote": lote.pk, "resultados": [r.__dict__ for r in resultados]},
            status=status.HTTP_202_ACCEPTED,
        )


class EstadoActividadSigit(APIView):
    permission_classes = [EsSistemaDeEntrega]
    throttle_classes = [LimitePorSistema]

    @extend_schema(
        summary="Consultar el estado de revisión de una actividad",
        responses={
            200: inline_serializer(
                "EstadoActividad",
                {
                    "id_externo": serializers.CharField(),
                    "estado": serializers.ChoiceField(["PENDIENTE", "APROBADO", "RECHAZADO"]),
                    "codigo_jornada": serializers.CharField(allow_null=True),
                    "motivo_rechazo": serializers.CharField(),
                    "revisado_en": serializers.DateTimeField(allow_null=True),
                },
            )
        },
        tags=["Integración SIGIT"],
    )
    def get(self, request: Request, id_externo: str) -> Response:
        registro = (
            RegistroExterno.objects.select_related("jornada")
            .filter(sistema=_sistema(request), id_externo=id_externo)
            .first()
        )
        if registro is None:
            raise NotFound("No hay una actividad con ese id_externo para este sistema.")
        return Response(
            {
                "id_externo": registro.id_externo,
                "estado": registro.estado,
                "codigo_jornada": registro.jornada.codigo if registro.jornada else None,
                "motivo_rechazo": registro.motivo_rechazo,
                "revisado_en": registro.revisado_en,
            }
        )


# ── Datos maestros (lectura) ─────────────────────────────────────────────────
CATALOGOS_EXPUESTOS: dict[str, type[m.Catalogo]] = {
    "tipo_jornada": m.TipoJornada,
    "tipo_herramienta_aid": m.TipoHerramientaAid,
    "estado_herramienta_aid": m.EstadoHerramientaAid,
    "tipo_operacion": m.TipoOperacion,
    "servicio_prestado": m.ServicioPrestado,
    "grupo_poblacional": m.GrupoPoblacional,
    "medio_difusion": m.MedioDifusion,
    "medio_utilizado": m.MedioUtilizado,
    "tipo_recurso": m.TipoRecurso,
    "tipo_bien_donado": m.TipoBienDonado,
    "tipo_documento_identidad": m.TipoDocumentoIdentidad,
    "grado": m.Grado,
    "escalafon": m.Escalafon,
    "tipo_entidad": m.TipoEntidad,
    "periodicidad": m.Periodicidad,
}


class ElementoCatalogo(serializers.Serializer):
    codigo = serializers.CharField()
    nombre = serializers.CharField()
    descripcion = serializers.CharField()
    activo = serializers.BooleanField()


class Catalogo(generics.ListAPIView):
    permission_classes = [PuedeLeer]
    throttle_classes = [LimitePorSistema]
    serializer_class = ElementoCatalogo
    pagination_class = None

    @extend_schema(
        summary="Elementos de un catálogo (dato maestro)",
        tags=["Datos maestros"],
        parameters=[
            OpenApiParameter("nombre", str, OpenApiParameter.PATH, enum=sorted(CATALOGOS_EXPUESTOS))
        ],
    )
    def get(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        return super().get(request, *args, **kwargs)

    def get_queryset(self) -> QuerySet:
        modelo = CATALOGOS_EXPUESTOS.get(self.kwargs["nombre"])
        if modelo is None:
            raise NotFound(
                f"Catálogo desconocido. Disponibles: {', '.join(sorted(CATALOGOS_EXPUESTOS))}."
            )
        return modelo.objects.all()


class UnidadSerializada(serializers.ModelSerializer):
    superior = serializers.SlugRelatedField(slug_field="codigo", read_only=True)
    nivel = serializers.SlugRelatedField(slug_field="codigo", read_only=True)

    class Meta:
        model = m.Unidad
        fields = ["codigo", "sigla", "nombre", "nivel", "superior", "activa"]


class Unidades(generics.ListAPIView):
    permission_classes = [PuedeLeer]
    throttle_classes = [LimitePorSistema]
    serializer_class = UnidadSerializada
    queryset = m.Unidad.objects.select_related("superior", "nivel").order_by("ruta")

    @extend_schema(summary="Unidades y su jerarquía", tags=["Datos maestros"])
    def get(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        return super().get(request, *args, **kwargs)


class MunicipioSerializado(serializers.ModelSerializer):
    departamento = serializers.SlugRelatedField(slug_field="codigo_dane", read_only=True)

    class Meta:
        model = m.Municipio
        fields = ["codigo_dane", "nombre", "departamento"]


class Municipios(generics.ListAPIView):
    permission_classes = [PuedeLeer]
    throttle_classes = [LimitePorSistema]
    serializer_class = MunicipioSerializado

    @extend_schema(
        summary="Municipios DANE",
        tags=["Datos maestros"],
        parameters=[OpenApiParameter("departamento", str, description="Código DANE de 2 dígitos")],
    )
    def get(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        return super().get(request, *args, **kwargs)

    def get_queryset(self) -> QuerySet:
        consulta = m.Municipio.objects.select_related("departamento").order_by("codigo_dane")
        depto = self.request.query_params.get("departamento")
        return consulta.filter(departamento__codigo_dane=depto) if depto else consulta


class JornadaResumida(serializers.ModelSerializer):
    unidad = serializers.SlugRelatedField(slug_field="codigo", read_only=True)
    tipo_jornada = serializers.SlugRelatedField(slug_field="codigo", read_only=True)
    municipio_dane = serializers.CharField(source="municipio.codigo_dane", read_only=True)

    class Meta:
        model = Jornada
        fields = [
            "codigo",
            "unidad",
            "tipo_jornada",
            "fecha_ejecucion",
            "lugar",
            "municipio_dane",
            "latitud_decimal",
            "longitud_decimal",
            "registro_completo",
            "origen",
        ]


class Jornadas(generics.ListAPIView):
    """Solo lo que la unidad del solicitante puede ver: lo decide RLS."""

    permission_classes = [PuedeLeer]
    throttle_classes = [LimitePorSistema]
    serializer_class = JornadaResumida

    @extend_schema(
        summary="Resumen de jornadas en el ámbito del solicitante",
        tags=["Jornadas"],
        parameters=[
            OpenApiParameter("desde", str),
            OpenApiParameter("hasta", str),
            OpenApiParameter("completas", bool),
        ],
    )
    def get(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        return super().get(request, *args, **kwargs)

    def get_queryset(self) -> QuerySet:
        consulta = Jornada.vigentes.select_related("unidad", "tipo_jornada", "municipio").order_by(
            "-fecha_ejecucion", "id"
        )
        p = self.request.query_params
        if p.get("desde"):
            consulta = consulta.filter(fecha_ejecucion__gte=p["desde"])
        if p.get("hasta"):
            consulta = consulta.filter(fecha_ejecucion__lte=p["hasta"])
        if p.get("completas") in {"true", "1"}:
            consulta = consulta.filter(registro_completo=True)
        return consulta


@requiere_rol()
def documentacion(request: HttpRequest) -> HttpResponse:
    return render(request, "api/documentacion.html", {"catalogos": sorted(CATALOGOS_EXPUESTOS)})
