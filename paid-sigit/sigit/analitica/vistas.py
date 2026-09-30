from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from django import forms
from django.contrib import messages
from django.db.models import Q
from django.http import HttpRequest, HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_POST

from sigit.jornadas.models import Origen
from sigit.jornadas.vistas import filtrar
from sigit.nucleo.models import Departamento, TipoJornada, Unidad
from sigit.nucleo.permisos import REVISAR, requiere_rol

from .consultas import (
    DIMENSIONES,
    MEDIDAS,
    calcular_pivote,
    dimensiones_para,
    indicadores_clave,
    series_tablero,
)
from .exportar import respuesta_csv, respuesta_xlsx
from .models import IndicadorImpacto, InformeGuardado, MedicionIndicador


def _opciones_filtro(request: HttpRequest) -> dict[str, Any]:
    return {
        "unidades": Unidad.objects.filter(ruta__startswith=request.user.unidad.ruta),
        "tipos": TipoJornada.objects.filter(activo=True),
        "departamentos": Departamento.objects.all(),
        "origenes": Origen.choices,
    }


def _atajos_periodo() -> list[dict[str, str]]:
    hoy = timezone.localdate()
    return [
        {"texto": "Este año", "desde": f"{hoy.year}-01-01", "hasta": hoy.isoformat()},
        {
            "texto": "Últimos 12 meses",
            "desde": (hoy - timedelta(days=365)).isoformat(),
            "hasta": hoy.isoformat(),
        },
        {
            "texto": "Último trimestre",
            "desde": (hoy - timedelta(days=91)).isoformat(),
            "hasta": hoy.isoformat(),
        },
        {"texto": "Todo", "desde": "", "hasta": ""},
    ]


def _fichas(
    filtros: dict[str, str], opciones: dict[str, Any], request: HttpRequest
) -> list[dict[str, str]]:
    """Filtros activos como fichas que se quitan con un clic."""
    nombres = {
        "unidad": {str(u.pk): u.sigla for u in opciones["unidades"]},
        "tipo": {str(t.pk): t.nombre for t in opciones["tipos"]},
        "departamento": {str(d.pk): d.nombre for d in opciones["departamentos"]},
        "origen": dict(Origen.choices),
        "estado": {"completo": "Completas", "incompleto": "Incompletas"},
    }
    fichas = []
    for clave, valor in filtros.items():
        if not valor:
            continue
        resto = request.GET.copy()
        resto.pop(clave, None)
        texto = nombres.get(clave, {}).get(valor, valor)
        if clave in {"desde", "hasta"}:
            texto = f"{'Desde' if clave == 'desde' else 'Hasta'} {valor}"
        fichas.append({"texto": texto, "quitar": f"?{resto.urlencode()}"})
    return fichas


@requiere_rol()
def tablero(request: HttpRequest) -> HttpResponse:
    jornadas, filtros = filtrar(request)
    opciones = _opciones_filtro(request)
    return render(
        request,
        "analitica/tablero.html",
        {
            "kpi": indicadores_clave(jornadas),
            "series": series_tablero(jornadas),
            "filtros": filtros,
            "fichas": _fichas(filtros, opciones, request),
            "atajos": _atajos_periodo(),
            "url_listado": reverse("jornadas:listado"),
            **opciones,
        },
    )


# ── Tablas dinámicas ─────────────────────────────────────────────────────────
def _config_pivote(request: HttpRequest) -> dict[str, str]:
    medida = request.GET.get("medida", "jornadas")
    if medida not in MEDIDAS:
        medida = "jornadas"
    validas = {d.clave for d in dimensiones_para(medida)}
    fila = request.GET.get("fila", "departamento")
    fila = fila if fila in validas else "departamento"
    columna = request.GET.get("columna", "anio")
    columna = columna if columna in validas and columna != fila else ""
    return {"medida": medida, "fila": fila, "columna": columna}


@requiere_rol()
def pivote(request: HttpRequest) -> HttpResponse:
    config = _config_pivote(request)
    jornadas, filtros = filtrar(request)
    tabla = calcular_pivote(jornadas, config["fila"], config["columna"] or None, config["medida"])
    opciones = _opciones_filtro(request)
    informes = InformeGuardado.objects.filter(
        Q(propietario=request.user) | Q(compartido=True)
    ).select_related("propietario")
    medida = MEDIDAS[config["medida"]]
    grafica = {
        "categorias": tabla.filas,
        "series": (
            [
                {"nombre": c, "datos": [tabla.celdas.get((f, c), 0) for f in tabla.filas]}
                for c in tabla.columnas
            ]
            if tabla.columnas
            else [
                {
                    "nombre": medida.nombre,
                    "datos": [tabla.total_fila.get(f, 0) for f in tabla.filas],
                }
            ]
        ),
        "formato": medida.formato,
    }
    return render(
        request,
        "analitica/pivote.html",
        {
            "config": config,
            "tabla": tabla,
            "matriz": tabla.matriz(),
            "totales_columnas": [tabla.total_columna.get(c, 0) for c in tabla.columnas],
            "medida": medida,
            "medidas": MEDIDAS.values(),
            "dimensiones": dimensiones_para(config["medida"]),
            "nombre_fila": DIMENSIONES[config["fila"]].nombre,
            "nombre_columna": DIMENSIONES[config["columna"]].nombre if config["columna"] else "",
            "filtros": filtros,
            "fichas": _fichas(filtros, opciones, request),
            "informes": informes,
            "grafica": grafica,
            "parametros": request.GET.urlencode(),
            **opciones,
        },
    )


@requiere_rol()
def exportar_pivote(request: HttpRequest, formato: str) -> HttpResponse:
    config = _config_pivote(request)
    jornadas, _ = filtrar(request)
    tabla = calcular_pivote(jornadas, config["fila"], config["columna"] or None, config["medida"])
    nombre_fila = DIMENSIONES[config["fila"]].nombre
    encabezados = [nombre_fila, *tabla.columnas, "Total"]
    filas = [
        [f, *[tabla.celdas.get((f, c)) for c in tabla.columnas], tabla.total_fila.get(f, 0)]
        for f in tabla.filas
    ]
    filas.append(["Total", *[tabla.total_columna.get(c, 0) for c in tabla.columnas], tabla.total])
    nombre = f"tabla-dinamica-{config['medida']}-{timezone.localdate():%Y-%m-%d}"
    if formato == "xlsx":
        return respuesta_xlsx(nombre, MEDIDAS[config["medida"]].nombre, encabezados, filas)
    return respuesta_csv(nombre, encabezados, filas)


@requiere_rol()
@require_POST
def guardar_informe(request: HttpRequest) -> HttpResponse:
    nombre = request.POST.get("nombre", "").strip()[:150]
    parametros = request.POST.get("parametros", "")
    if not nombre:
        messages.error(request, "Escriba un nombre para el informe.")
    else:
        InformeGuardado.objects.create(
            nombre=nombre,
            configuracion={"parametros": parametros},
            propietario=request.user,
            compartido=request.POST.get("compartido") == "on",
        )
        messages.success(request, f"Informe «{nombre}» guardado.")
    return redirect(f"{reverse('analitica:pivote')}?{parametros}")


@requiere_rol()
@require_POST
def borrar_informe(request: HttpRequest, pk: int) -> HttpResponse:
    informe = get_object_or_404(InformeGuardado, pk=pk, propietario=request.user)
    informe.delete()
    messages.success(request, "Informe borrado.")
    return redirect("analitica:pivote")


# ── Indicadores de impacto ───────────────────────────────────────────────────
class FormularioMedicion(forms.ModelForm):
    class Meta:
        model = MedicionIndicador
        fields = [
            "indicador",
            "unidad",
            "municipio",
            "periodo_inicio",
            "periodo_fin",
            "valor",
            "observaciones",
        ]
        widgets = {
            "periodo_inicio": forms.DateInput(attrs={"type": "date"}),
            "periodo_fin": forms.DateInput(attrs={"type": "date"}),
            "observaciones": forms.Textarea(attrs={"rows": 2}),
        }


@requiere_rol()
def indicadores(request: HttpRequest) -> HttpResponse:
    lista = IndicadorImpacto.objects.filter(activo=True).select_related("periodicidad")
    formulario = None
    if request.user.tiene_rol(*REVISAR):
        formulario = FormularioMedicion(request.POST or None)
        formulario.fields["indicador"].queryset = lista
        formulario.fields["unidad"].queryset = Unidad.objects.filter(
            ruta__startswith=request.user.unidad.ruta
        )
        if request.method == "POST" and formulario.is_valid():
            medicion = formulario.save(commit=False)
            medicion.registrado_por = request.user
            medicion.save()
            messages.success(request, "Medición registrada.")
            return redirect("analitica:indicadores")
    datos = []
    for indicador in lista:
        mediciones = list(
            indicador.mediciones.order_by("periodo_inicio").values("periodo_inicio", "valor")
        )
        ultimo = mediciones[-1]["valor"] if mediciones else None
        avance = None
        if ultimo is not None and indicador.meta is not None and indicador.linea_base is not None:
            recorrido = indicador.meta - indicador.linea_base
            avance = (
                round(float((ultimo - indicador.linea_base) / recorrido) * 100)
                if recorrido
                else None
            )
        datos.append(
            {
                "indicador": indicador,
                "ultimo": ultimo,
                "avance": avance,
                "serie": {
                    "id": indicador.codigo,
                    "etiquetas": [f"{m['periodo_inicio']:%Y-%m}" for m in mediciones],
                    "valores": [float(m["valor"]) for m in mediciones],
                    "meta": float(indicador.meta) if indicador.meta is not None else None,
                    "base": float(indicador.linea_base)
                    if indicador.linea_base is not None
                    else None,
                    "unidad": indicador.unidad_medida,
                },
            }
        )
    return render(
        request,
        "analitica/indicadores.html",
        {
            "datos": datos,
            "formulario": formulario,
            "series": [d["serie"] for d in datos],
            "hoy": date.today(),
        },
    )
