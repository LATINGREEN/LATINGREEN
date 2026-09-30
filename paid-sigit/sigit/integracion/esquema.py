"""
Esquema de una actividad que entrega SIGIT. Lo usan la API y la carga de
archivo plano: una sola validación, dos vías de entrada.

Lo que SIGIT no sabe (por ejemplo, si participó la Fuerza Aérea) puede venir
vacío: lo decide el revisor de JACID al aprobar, no la plataforma por su cuenta.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from rest_framework import serializers

from sigit.nucleo.geo import dentro_de_colombia, desde_decimal
from sigit.nucleo.models import GrupoPoblacional, Municipio, ServicioPrestado, TipoJornada, Unidad


class CantidadPorCodigo(serializers.Serializer):
    codigo = serializers.CharField(max_length=60)
    cantidad = serializers.IntegerField(min_value=1, max_value=1_000_000)


class ActividadSigit(serializers.Serializer):
    id_externo = serializers.RegexField(
        r"^[A-Za-z0-9._:-]{1,80}$", help_text="Identificador en SIGIT."
    )
    tipo_jornada = serializers.CharField(
        max_length=60, help_text="Código del catálogo (p. ej. CONJUNTA)."
    )
    descripcion = serializers.CharField(max_length=10_000)
    fecha_inicio = serializers.DateField(required=False, allow_null=True)
    fecha_ejecucion = serializers.DateField()
    fecha_fin = serializers.DateField(required=False, allow_null=True)
    lugar = serializers.CharField(max_length=250)
    municipio_dane = serializers.RegexField(r"^[0-9]{5}$")
    latitud = serializers.DecimalField(max_digits=9, decimal_places=6)
    longitud = serializers.DecimalField(max_digits=9, decimal_places=6)
    unidad_codigo = serializers.CharField(max_length=30, required=False, allow_blank=True)
    participo_ejc = serializers.BooleanField(required=False, allow_null=True, default=None)
    participo_fac = serializers.BooleanField(required=False, allow_null=True, default=None)
    poblacion_afecta_tropa = serializers.BooleanField(required=False, allow_null=True, default=None)
    poblacion = CantidadPorCodigo(many=True, required=False, default=list)
    servicios = CantidadPorCodigo(many=True, required=False, default=list)
    observaciones = serializers.CharField(
        max_length=5_000, required=False, allow_blank=True, default=""
    )

    def validate_tipo_jornada(self, valor: str) -> str:
        if not TipoJornada.objects.filter(codigo=valor, activo=True).exists():
            raise serializers.ValidationError(f"Tipo de jornada desconocido: {valor}.")
        return valor

    def validate_municipio_dane(self, valor: str) -> str:
        if not Municipio.objects.filter(codigo_dane=valor).exists():
            raise serializers.ValidationError(f"Municipio DANE desconocido: {valor}.")
        return valor

    def validate_unidad_codigo(self, valor: str) -> str:
        if valor and not Unidad.objects.filter(codigo=valor, activa=True).exists():
            raise serializers.ValidationError(f"Unidad desconocida: {valor}.")
        return valor

    def validate_poblacion(self, valor: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return _validar_codigos(valor, GrupoPoblacional, "grupo poblacional")

    def validate_servicios(self, valor: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return _validar_codigos(valor, ServicioPrestado, "servicio")

    def validate(self, datos: dict[str, Any]) -> dict[str, Any]:
        if not dentro_de_colombia(datos["latitud"], datos["longitud"]):
            raise serializers.ValidationError(
                {"latitud": "Las coordenadas quedan fuera de Colombia."}
            )
        inicio, ejecucion, fin = (
            datos.get("fecha_inicio"),
            datos["fecha_ejecucion"],
            datos.get("fecha_fin"),
        )
        if inicio and ejecucion < inicio:
            raise serializers.ValidationError(
                {"fecha_ejecucion": "No puede ser anterior al inicio."}
            )
        if fin and fin < (inicio or ejecucion):
            raise serializers.ValidationError({"fecha_fin": "No puede ser anterior al inicio."})
        return datos


def _validar_codigos(filas: list[dict[str, Any]], modelo: Any, nombre: str) -> list[dict[str, Any]]:
    codigos = [f["codigo"] for f in filas]
    if len(codigos) != len(set(codigos)):
        raise serializers.ValidationError(f"Un {nombre} aparece dos veces.")
    existentes = set(
        modelo.objects.filter(codigo__in=codigos, activo=True).values_list("codigo", flat=True)
    )
    faltantes = sorted(set(codigos) - existentes)
    if faltantes:
        raise serializers.ValidationError(
            f"Código de {nombre} desconocido: {', '.join(faltantes)}."
        )
    return filas


class LoteSigit(serializers.Serializer):
    actividades = serializers.ListField(child=serializers.DictField(), min_length=1, max_length=500)


def como_json(datos: dict[str, Any]) -> dict[str, Any]:
    """Los datos validados, en forma serializable para guardarlos tal cual."""
    salida: dict[str, Any] = {}
    for clave, valor in datos.items():
        if isinstance(valor, Decimal):
            salida[clave] = str(valor)
        elif hasattr(valor, "isoformat"):
            salida[clave] = valor.isoformat()
        else:
            salida[clave] = valor
    return salida


def gms_de(datos: dict[str, Any]) -> dict[str, Any]:
    lat_g, lat_m, lat_s, lat_h = desde_decimal(Decimal(str(datos["latitud"])), True)
    lon_g, lon_m, lon_s, lon_h = desde_decimal(Decimal(str(datos["longitud"])), False)
    return {
        "latitud_grados": lat_g,
        "latitud_minutos": lat_m,
        "latitud_segundos": lat_s,
        "latitud_hemisferio": lat_h,
        "longitud_grados": lon_g,
        "longitud_minutos": lon_m,
        "longitud_segundos": lon_s,
        "longitud_hemisferio": lon_h,
    }
