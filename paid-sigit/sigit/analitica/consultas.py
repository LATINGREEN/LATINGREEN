"""
Consultas del tablero y motor de tablas dinámicas.

Todo pasa por el ORM sobre las tablas con RLS: una unidad solo agrega lo que
puede ver, sin que ninguna consulta de este archivo tenga que acordarse.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any

from django.db.models import (
    CharField,
    Count,
    DecimalField,
    F,
    Model,
    QuerySet,
    Sum,
    Value,
)
from django.db.models.functions import (
    Cast,
    Coalesce,
    Concat,
    ExtractQuarter,
    ExtractYear,
    TruncMonth,
)

from sigit.integracion.models import EstadoRevision, RegistroExterno
from sigit.jornadas import models as j

MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]


def _numero(valor: Any) -> float:
    if valor is None:
        return 0.0
    return float(valor) if isinstance(valor, Decimal) else valor


# ── Tablero ──────────────────────────────────────────────────────────────────
def indicadores_clave(jornadas: QuerySet[j.Jornada]) -> dict[str, Any]:
    total = jornadas.count()
    completas = jornadas.filter(registro_completo=True).count()
    personas = (
        j.JornadaPoblacion.objects.filter(jornada__in=jornadas).aggregate(
            v=Sum("cantidad_personas")
        )["v"]
        or 0
    )
    servicios = (
        j.JornadaServicioPrestado.objects.filter(jornada__in=jornadas).aggregate(v=Sum("cantidad"))[
            "v"
        ]
        or 0
    )
    bienes = j.JornadaBienDonado.objects.filter(jornada__in=jornadas).aggregate(
        v=Sum("valor_estimado")
    )["v"] or Decimal(0)
    municipios = jornadas.values("municipio").distinct().count()
    return {
        "total": total,
        "completas": completas,
        "pct_completas": round(completas * 100 / total) if total else 0,
        # Clase de ancho en pasos de 5 %: la CSP no admite estilos en línea.
        "clase_pct": f"pct-{round(completas * 20 / total) * 5 if total else 0}",
        "personas": personas,
        "servicios": servicios,
        "valor_bienes": bienes,
        "municipios": municipios,
        "sigit": jornadas.filter(origen=j.Origen.SIGIT).count(),
        "pendientes_revision": RegistroExterno.objects.filter(
            estado=EstadoRevision.PENDIENTE
        ).count(),
    }


def series_tablero(jornadas: QuerySet[j.Jornada]) -> dict[str, Any]:
    por_mes = (
        jornadas.annotate(mes=TruncMonth("fecha_ejecucion"))
        .values("mes")
        .annotate(n=Count("id"))
        .order_by("mes")
    )
    personas_mes = dict(
        j.JornadaPoblacion.objects.filter(jornada__in=jornadas)
        .annotate(mes=TruncMonth("jornada__fecha_ejecucion"))
        .values("mes")
        .annotate(v=Sum("cantidad_personas"))
        .values_list("mes", "v")
    )
    meses = [
        {
            "clave": f"{f['mes']:%Y-%m}",
            "etiqueta": f"{MESES[f['mes'].month - 1]} {f['mes']:%y}",
            "jornadas": f["n"],
            "personas": personas_mes.get(f["mes"], 0),
        }
        for f in por_mes
    ]
    por_tipo = list(
        jornadas.values("tipo_jornada_id", "tipo_jornada__nombre")
        .annotate(n=Count("id"))
        .order_by("-n")
    )
    por_departamento = list(
        jornadas.values("municipio__departamento_id", "municipio__departamento__nombre")
        .annotate(n=Count("id"))
        .order_by("-n")[:12]
    )
    por_unidad = list(
        jornadas.values("unidad_id", "unidad__sigla").annotate(n=Count("id")).order_by("-n")
    )
    por_grupo = list(
        j.JornadaPoblacion.objects.filter(jornada__in=jornadas)
        .values("grupo__nombre")
        .annotate(v=Sum("cantidad_personas"))
        .order_by("-v")
    )
    servicios = list(
        j.JornadaServicioPrestado.objects.filter(jornada__in=jornadas)
        .values("servicio__nombre")
        .annotate(v=Sum("cantidad"))
        .order_by("-v")[:10]
    )
    calendario = list(
        jornadas.values("fecha_ejecucion").annotate(n=Count("id")).order_by("fecha_ejecucion")
    )
    puntos = list(
        jornadas.values(
            "id", "codigo", "lugar", "unidad__sigla", "latitud_decimal", "longitud_decimal"
        )[:2000]
    )
    return {
        "meses": meses,
        "tipos": [
            {"id": t["tipo_jornada_id"], "nombre": t["tipo_jornada__nombre"], "n": t["n"]}
            for t in por_tipo
        ],
        "departamentos": [
            {
                "id": d["municipio__departamento_id"],
                "nombre": d["municipio__departamento__nombre"],
                "n": d["n"],
            }
            for d in por_departamento
        ],
        "unidades": [
            {"id": u["unidad_id"], "nombre": u["unidad__sigla"], "n": u["n"]} for u in por_unidad
        ],
        "grupos": [{"nombre": g["grupo__nombre"], "v": g["v"]} for g in por_grupo],
        "servicios": [{"nombre": s["servicio__nombre"], "v": s["v"]} for s in servicios],
        "calendario": [[f"{c['fecha_ejecucion']:%Y-%m-%d}", c["n"]] for c in calendario],
        "anios": sorted({c["fecha_ejecucion"].year for c in calendario}),
        "puntos": [
            {
                "id": p["id"],
                "codigo": p["codigo"],
                "lugar": p["lugar"],
                "unidad": p["unidad__sigla"],
                "lat": _numero(p["latitud_decimal"]),
                "lon": _numero(p["longitud_decimal"]),
            }
            for p in puntos
        ],
    }


# ── Tablas dinámicas ─────────────────────────────────────────────────────────
@dataclass(frozen=True)
class Dimension:
    clave: str
    nombre: str
    # Expresión relativa a la JORNADA; el motor le antepone el prefijo del modelo.
    expresion: Callable[[str], Any]
    solo_para: tuple[str, ...] = ()


def _campo(ruta: str) -> Callable[[str], Any]:
    return lambda prefijo: F(f"{prefijo}{ruta}")


DIMENSIONES: dict[str, Dimension] = {
    d.clave: d
    for d in [
        Dimension("anio", "Año", lambda p: ExtractYear(f"{p}fecha_ejecucion")),
        Dimension(
            "trimestre",
            "Trimestre",
            lambda p: Concat(
                Cast(ExtractYear(f"{p}fecha_ejecucion"), CharField()),
                Value("-T"),
                Cast(ExtractQuarter(f"{p}fecha_ejecucion"), CharField()),
                output_field=CharField(),
            ),
        ),
        Dimension("mes", "Mes", lambda p: TruncMonth(f"{p}fecha_ejecucion")),
        Dimension("unidad", "Unidad", _campo("unidad__sigla")),
        Dimension("tipo", "Tipo de jornada", _campo("tipo_jornada__nombre")),
        Dimension("departamento", "Departamento", _campo("municipio__departamento__nombre")),
        Dimension("municipio", "Municipio", _campo("municipio__nombre")),
        Dimension("origen", "Origen", _campo("origen")),
        Dimension("completo", "Registro completo", _campo("registro_completo")),
        Dimension("grupo", "Grupo poblacional", lambda p: F("grupo__nombre"), ("personas",)),
        Dimension("servicio", "Servicio prestado", lambda p: F("servicio__nombre"), ("servicios",)),
        Dimension(
            "bien",
            "Tipo de bien donado",
            lambda p: F("tipo_bien__nombre"),
            ("valor_bienes", "cantidad_bienes"),
        ),
        Dimension(
            "recurso", "Tipo de recurso", lambda p: F("tipo_recurso__nombre"), ("valor_recursos",)
        ),
    ]
}


@dataclass(frozen=True)
class Medida:
    clave: str
    nombre: str
    modelo: type[Model]
    agregado: Callable[[], Any]
    formato: str = "entero"  # entero | moneda


def _suma(campo: str, decimal: bool = False) -> Callable[[], Any]:
    if decimal:
        return lambda: Coalesce(
            Sum(campo),
            Value(Decimal(0)),
            output_field=DecimalField(max_digits=20, decimal_places=2),
        )
    return lambda: Coalesce(Sum(campo), Value(0))


MEDIDAS: dict[str, Medida] = {
    m.clave: m
    for m in [
        Medida("jornadas", "Número de jornadas", j.Jornada, lambda: Count("id", distinct=True)),
        Medida(
            "municipios",
            "Municipios atendidos",
            j.Jornada,
            lambda: Count("municipio", distinct=True),
        ),
        Medida("personas", "Personas beneficiadas", j.JornadaPoblacion, _suma("cantidad_personas")),
        Medida("servicios", "Servicios prestados", j.JornadaServicioPrestado, _suma("cantidad")),
        Medida(
            "valor_bienes",
            "Valor de bienes donados (COP)",
            j.JornadaBienDonado,
            _suma("valor_estimado", decimal=True),
            "moneda",
        ),
        Medida(
            "cantidad_bienes",
            "Cantidad de bienes donados",
            j.JornadaBienDonado,
            _suma("cantidad", decimal=True),
        ),
        Medida(
            "valor_recursos",
            "Valor de recursos utilizados (COP)",
            j.JornadaRecurso,
            _suma("valor", decimal=True),
            "moneda",
        ),
    ]
}


def dimensiones_para(medida: str) -> list[Dimension]:
    return [d for d in DIMENSIONES.values() if not d.solo_para or medida in d.solo_para]


@dataclass
class TablaDinamica:
    filas: list[str] = field(default_factory=list)
    columnas: list[str] = field(default_factory=list)
    celdas: dict[tuple[str, str], float] = field(default_factory=dict)
    total_fila: dict[str, float] = field(default_factory=dict)
    total_columna: dict[str, float] = field(default_factory=dict)
    total: float = 0.0
    maximo: float = 0.0

    def matriz(self) -> list[dict[str, Any]]:
        """Filas listas para pintar, con el nivel del mapa de calor (1–10)."""
        resultado = []
        for fila in self.filas:
            celdas = []
            for columna in self.columnas:
                valor = self.celdas.get((fila, columna))
                nivel = (
                    0 if not valor or not self.maximo else max(1, round(valor * 10 / self.maximo))
                )
                celdas.append({"valor": valor, "nivel": nivel})
            resultado.append(
                {"etiqueta": fila, "celdas": celdas, "total": self.total_fila.get(fila, 0)}
            )
        return resultado


def _etiqueta(valor: Any) -> str:
    if valor is None:
        return "Sin dato"
    if valor is True:
        return "Sí"
    if valor is False:
        return "No"
    if hasattr(valor, "month") and hasattr(valor, "year"):
        return f"{valor:%Y-%m}"
    return str(valor)


def calcular_pivote(
    jornadas: QuerySet[j.Jornada], fila: str, columna: str | None, medida: str
) -> TablaDinamica:
    m = MEDIDAS[medida]
    prefijo = "" if m.modelo is j.Jornada else "jornada__"
    base = jornadas if m.modelo is j.Jornada else m.modelo.objects.filter(jornada__in=jornadas)
    dim_fila = DIMENSIONES[fila].expresion(prefijo)
    tabla = TablaDinamica()
    if columna:
        dim_col = DIMENSIONES[columna].expresion(prefijo)
        datos = base.annotate(_f=dim_fila, _c=dim_col).values("_f", "_c").annotate(_v=m.agregado())
        for d in datos:
            clave = (_etiqueta(d["_f"]), _etiqueta(d["_c"]))
            tabla.celdas[clave] = tabla.celdas.get(clave, 0) + _numero(d["_v"])
        tabla.columnas = sorted({c for _, c in tabla.celdas})
        por_col = base.annotate(_c=dim_col).values("_c").annotate(_v=m.agregado())
        tabla.total_columna = {_etiqueta(d["_c"]): _numero(d["_v"]) for d in por_col}
    else:
        datos = base.annotate(_f=dim_fila).values("_f").annotate(_v=m.agregado())
        for d in datos:
            tabla.celdas[(_etiqueta(d["_f"]), "Total")] = _numero(d["_v"])
        tabla.columnas = []
    # Los totales se piden a la base, no se suman: con medidas distintas (p. ej.,
    # municipios atendidos) la suma de las celdas contaría dos veces.
    por_fila = base.annotate(_f=dim_fila).values("_f").annotate(_v=m.agregado())
    tabla.total_fila = {_etiqueta(d["_f"]): _numero(d["_v"]) for d in por_fila}
    tabla.filas = sorted(tabla.total_fila, key=lambda e: (e == "Sin dato", e))
    tabla.total = _numero(base.aggregate(_v=m.agregado())["_v"])
    tabla.maximo = max(tabla.celdas.values(), default=0)
    return tabla
