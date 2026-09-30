"""
Forma única de error de la API: {codigo, mensaje, detalles?, id_correlacion}.

El `id_correlacion` enlaza lo que ve quien integra con lo que queda en el
registro del servidor, sin exponer trazas internas.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler

registro = logging.getLogger("sigit.api")

CODIGOS = {
    status.HTTP_400_BAD_REQUEST: "DATOS_INVALIDOS",
    status.HTTP_401_UNAUTHORIZED: "NO_AUTENTICADO",
    status.HTTP_403_FORBIDDEN: "SIN_PERMISO",
    status.HTTP_404_NOT_FOUND: "NO_ENCONTRADO",
    status.HTTP_405_METHOD_NOT_ALLOWED: "METODO_NO_PERMITIDO",
    status.HTTP_429_TOO_MANY_REQUESTS: "DEMASIADAS_PETICIONES",
}


def manejar_error(excepcion: Exception, contexto: dict[str, Any]) -> Response:
    correlacion = uuid.uuid4().hex
    respuesta = exception_handler(excepcion, contexto)
    if respuesta is None:
        registro.exception("Error no controlado en la API [%s]", correlacion)
        return Response(
            {"codigo": "ERROR_INTERNO", "mensaje": "Error interno.", "id_correlacion": correlacion},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    cuerpo: dict[str, Any] = {
        "codigo": CODIGOS.get(respuesta.status_code, "ERROR"),
        "mensaje": _mensaje(excepcion),
        "id_correlacion": correlacion,
    }
    if isinstance(excepcion, exceptions.ValidationError):
        cuerpo["detalles"] = respuesta.data
    respuesta.data = cuerpo
    return respuesta


def _mensaje(excepcion: Exception) -> str:
    if isinstance(excepcion, exceptions.ValidationError):
        return "Los datos enviados no son válidos."
    if isinstance(excepcion, exceptions.APIException):
        return str(excepcion.detail)
    return "Error."
