"""
Recepción, revisión y aprobación de actividades de SIGIT.

Idempotencia: el par (sistema, id_externo) identifica una actividad. Reenviar
el mismo lote no duplica nada; reenviar una actividad CAMBIADA mientras sigue
pendiente actualiza su contenido; una actividad ya revisada no se reescribe.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
from dataclasses import dataclass, field
from datetime import date
from typing import Any

from django.db import transaction
from django.utils import timezone

from sigit.jornadas import models as j
from sigit.jornadas.servicios import (
    buscar_posibles_duplicados,
    guardar_con_codigo,
    recalcular_completo,
)
from sigit.nucleo.models import (
    GrupoPoblacional,
    Municipio,
    ServicioPrestado,
    TipoJornada,
    Unidad,
    Usuario,
)

from .esquema import ActividadSigit, como_json, gms_de
from .models import EstadoRevision, LoteImportacion, RegistroExterno, SistemaExterno


@dataclass
class ResultadoItem:
    id_externo: str
    resultado: str  # RECIBIDA | ACTUALIZADA | REPETIDA | RECHAZADA
    errores: dict[str, Any] = field(default_factory=dict)
    posibles_duplicados: int = 0


def _resumen(datos: dict[str, Any]) -> str:
    return hashlib.sha256(
        json.dumps(datos, sort_keys=True, ensure_ascii=False).encode()
    ).hexdigest()


def _duplicados(datos: dict[str, Any]) -> list[dict[str, object]]:
    municipio = Municipio.objects.get(codigo_dane=datos["municipio_dane"])
    return [
        d.como_dict()
        for d in buscar_posibles_duplicados(
            municipio_id=municipio.pk,
            fecha_ejecucion=date.fromisoformat(datos["fecha_ejecucion"]),
            lugar=datos["lugar"],
        )
    ]


@transaction.atomic
def recibir_lote(
    sistema: SistemaExterno,
    actividades: list[dict[str, Any]],
    via: str,
    usuario: Usuario | None = None,
    nombre_archivo: str = "",
) -> tuple[LoteImportacion, list[ResultadoItem]]:
    lote = LoteImportacion.objects.create(
        sistema=sistema,
        via=via,
        recibido_por=usuario,
        nombre_archivo=nombre_archivo[:255],
        total=len(actividades),
    )
    resultados: list[ResultadoItem] = []
    for posicion, bruto in enumerate(actividades, start=1):
        esquema = ActividadSigit(data=bruto)
        id_externo = str(bruto.get("id_externo", f"(fila {posicion})"))[:80]
        if not esquema.is_valid():
            resultados.append(ResultadoItem(id_externo, "RECHAZADA", errores=esquema.errors))
            continue
        datos = como_json(esquema.validated_data)
        resumen = _resumen(datos)
        unidad = sistema.unidad
        if datos.get("unidad_codigo"):
            unidad = Unidad.objects.get(codigo=datos["unidad_codigo"])
        existente = RegistroExterno.objects.filter(
            sistema=sistema, id_externo=datos["id_externo"]
        ).first()
        if existente and existente.resumen_contenido == resumen:
            resultados.append(ResultadoItem(id_externo, "REPETIDA"))
            continue
        if existente and existente.estado != EstadoRevision.PENDIENTE:
            resultados.append(
                ResultadoItem(
                    id_externo,
                    "RECHAZADA",
                    errores={
                        "id_externo": [
                            f"Ya fue {existente.get_estado_display().lower()}; "
                            "no se puede modificar."
                        ]
                    },
                )
            )
            continue
        duplicados = _duplicados(datos)
        if existente:
            existente.datos, existente.resumen_contenido = datos, resumen
            existente.unidad_propuesta, existente.lote = unidad, lote
            existente.posibles_duplicados = duplicados
            existente.save()
            resultados.append(
                ResultadoItem(id_externo, "ACTUALIZADA", posibles_duplicados=len(duplicados))
            )
        else:
            RegistroExterno.objects.create(
                sistema=sistema,
                lote=lote,
                id_externo=datos["id_externo"],
                datos=datos,
                resumen_contenido=resumen,
                unidad_propuesta=unidad,
                posibles_duplicados=duplicados,
            )
            resultados.append(
                ResultadoItem(id_externo, "RECIBIDA", posibles_duplicados=len(duplicados))
            )
    lote.aceptados = sum(r.resultado in {"RECIBIDA", "ACTUALIZADA"} for r in resultados)
    lote.repetidos = sum(r.resultado == "REPETIDA" for r in resultados)
    lote.rechazados = sum(r.resultado == "RECHAZADA" for r in resultados)
    lote.errores = [
        {"id_externo": r.id_externo, "errores": r.errores} for r in resultados if r.errores
    ]
    lote.save()
    return lote, resultados


# ── Archivo plano ────────────────────────────────────────────────────────────
COLUMNAS_ARCHIVO = [
    "id_externo",
    "tipo_jornada",
    "descripcion",
    "fecha_inicio",
    "fecha_ejecucion",
    "fecha_fin",
    "lugar",
    "municipio_dane",
    "latitud",
    "longitud",
    "unidad_codigo",
    "participo_ejc",
    "participo_fac",
    "poblacion_afecta_tropa",
    "poblacion",
    "servicios",
    "observaciones",
]


def _lista_codigos(texto: str) -> list[dict[str, Any]]:
    """'EJ_ADULTOS:40|EJ_NINOS:25' → [{'codigo': 'EJ_ADULTOS', 'cantidad': '40'}, …]"""
    salida = []
    for parte in filter(None, (p.strip() for p in (texto or "").split("|"))):
        codigo, _, cantidad = parte.partition(":")
        salida.append({"codigo": codigo.strip(), "cantidad": cantidad.strip()})
    return salida


def _booleano(texto: str) -> bool | None:
    valor = (texto or "").strip().lower()
    return {
        "si": True,
        "sí": True,
        "true": True,
        "1": True,
        "no": False,
        "false": False,
        "0": False,
    }.get(valor)


def leer_archivo(contenido: bytes) -> list[dict[str, Any]]:
    texto = contenido.decode("utf-8-sig")
    muestra = texto[:2048]
    separador = ";" if muestra.count(";") >= muestra.count(",") else ","
    lector = csv.DictReader(io.StringIO(texto), delimiter=separador)
    faltan = [
        c for c in ("id_externo", "fecha_ejecucion", "lugar") if c not in (lector.fieldnames or [])
    ]
    if faltan:
        raise ValueError(f"Al archivo le faltan columnas: {', '.join(faltan)}. Use la plantilla.")
    actividades = []
    for fila in lector:
        actividad: dict[str, Any] = {
            k: (fila.get(k) or "").strip()
            for k in COLUMNAS_ARCHIVO
            if k
            not in {
                "poblacion",
                "servicios",
                "participo_ejc",
                "participo_fac",
                "poblacion_afecta_tropa",
            }
        }
        for opcional in ("fecha_inicio", "fecha_fin"):
            if not actividad.get(opcional):
                actividad[opcional] = None
        for campo in ("participo_ejc", "participo_fac", "poblacion_afecta_tropa"):
            actividad[campo] = _booleano(fila.get(campo, ""))
        actividad["poblacion"] = _lista_codigos(fila.get("poblacion", ""))
        actividad["servicios"] = _lista_codigos(fila.get("servicios", ""))
        actividades.append(actividad)
    if len(actividades) > 500:
        raise ValueError("Máximo 500 actividades por archivo.")
    return actividades


def plantilla_csv() -> str:
    salida = io.StringIO()
    salida.write("﻿")
    escritor = csv.writer(salida, delimiter=";")
    escritor.writerow(COLUMNAS_ARCHIVO)
    escritor.writerow(
        [
            "RES-2026-0001",
            "CONJUNTA",
            "Jornada de salud con la reserva naval",
            "",
            "2026-09-20",
            "",
            "Coliseo municipal",
            "52835",
            "1.80670",
            "-78.76470",
            "",
            "no",
            "no",
            "",
            "CODIGO_GRUPO:40",
            "CODIGO_SERVICIO:120",
            "",
        ]
    )
    return salida.getvalue()


# ── Revisión ─────────────────────────────────────────────────────────────────
@dataclass(frozen=True)
class DecisionRevision:
    unidad: Unidad
    tipo_jornada: TipoJornada
    participo_ejc: bool
    participo_fac: bool
    poblacion_afecta_tropa: bool | None


@transaction.atomic
def aprobar(registro: RegistroExterno, revisor: Usuario, decision: DecisionRevision) -> j.Jornada:
    registro = RegistroExterno.objects.select_for_update().get(pk=registro.pk)
    if registro.estado != EstadoRevision.PENDIENTE:
        raise ValueError("Esta actividad ya fue revisada.")
    datos = registro.datos
    ejecucion = date.fromisoformat(datos["fecha_ejecucion"])
    jornada = j.Jornada(
        unidad=decision.unidad,
        tipo_jornada=decision.tipo_jornada,
        descripcion=datos["descripcion"],
        fecha_inicio=date.fromisoformat(datos["fecha_inicio"])
        if datos.get("fecha_inicio")
        else ejecucion,
        fecha_fin=date.fromisoformat(datos["fecha_fin"]) if datos.get("fecha_fin") else None,
        fecha_ejecucion=ejecucion,
        lugar=datos["lugar"],
        municipio=Municipio.objects.get(codigo_dane=datos["municipio_dane"]),
        participo_ejc=decision.participo_ejc,
        participo_fac=decision.participo_fac,
        poblacion_afecta_tropa=decision.poblacion_afecta_tropa,
        observaciones=datos.get("observaciones", ""),
        origen=j.Origen.SIGIT,
        **gms_de(datos),
    )
    guardar_con_codigo(jornada)
    grupos = {
        g.codigo: g
        for g in GrupoPoblacional.objects.filter(
            codigo__in=[p["codigo"] for p in datos.get("poblacion", [])]
        )
    }
    for fila in datos.get("poblacion", []):
        j.JornadaPoblacion.objects.create(
            jornada=jornada, grupo=grupos[fila["codigo"]], cantidad_personas=fila["cantidad"]
        )
    servicios = {
        s.codigo: s
        for s in ServicioPrestado.objects.filter(
            codigo__in=[p["codigo"] for p in datos.get("servicios", [])]
        )
    }
    for fila in datos.get("servicios", []):
        j.JornadaServicioPrestado.objects.create(
            jornada=jornada, servicio=servicios[fila["codigo"]], cantidad=fila["cantidad"]
        )
    recalcular_completo(jornada)
    registro.estado = EstadoRevision.APROBADO
    registro.jornada = jornada
    registro.revisado_por = revisor
    registro.revisado_en = timezone.now()
    registro.save()
    return jornada


@transaction.atomic
def rechazar(registro: RegistroExterno, revisor: Usuario, motivo: str) -> None:
    registro = RegistroExterno.objects.select_for_update().get(pk=registro.pk)
    if registro.estado != EstadoRevision.PENDIENTE:
        raise ValueError("Esta actividad ya fue revisada.")
    if not motivo.strip():
        raise ValueError("Escriba el motivo del rechazo: SIGIT lo recibe.")
    registro.estado = EstadoRevision.RECHAZADO
    registro.motivo_rechazo = motivo.strip()
    registro.revisado_por = revisor
    registro.revisado_en = timezone.now()
    registro.save()


def recalcular_duplicados(registro: RegistroExterno) -> list[dict[str, object]]:
    """Con los ojos del revisor (JACID ve todo), no con los del sistema que envió."""
    return _duplicados(registro.datos)
