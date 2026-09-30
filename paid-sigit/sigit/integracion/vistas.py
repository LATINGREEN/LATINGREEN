from __future__ import annotations

from typing import Any

from django import forms
from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Count
from django.http import HttpRequest, HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from sigit.jornadas.formularios import SiNo
from sigit.nucleo.models import GrupoPoblacional, Municipio, ServicioPrestado, TipoJornada
from sigit.nucleo.permisos import REVISAR, requiere_rol, unidades_de

from . import servicios
from .models import EstadoRevision, LoteImportacion, RegistroExterno, SistemaExterno


@requiere_rol(*REVISAR)
def bandeja(request: HttpRequest) -> HttpResponse:
    estado = request.GET.get("estado", EstadoRevision.PENDIENTE)
    consulta = RegistroExterno.objects.select_related(
        "sistema", "unidad_propuesta", "jornada", "revisado_por"
    )
    if estado in EstadoRevision.values:
        consulta = consulta.filter(estado=estado)
    conteos = dict(RegistroExterno.objects.values_list("estado").annotate(n=Count("id")))
    con_duplicados = (
        RegistroExterno.objects.filter(estado=EstadoRevision.PENDIENTE)
        .exclude(posibles_duplicados=[])
        .count()
    )
    return render(
        request,
        "integracion/bandeja.html",
        {
            "pagina": Paginator(consulta.order_by("recibido_en"), 25).get_page(
                request.GET.get("pagina")
            ),
            "estado": estado,
            "estados": EstadoRevision.choices,
            "conteos": conteos,
            "con_duplicados": con_duplicados,
            "lotes": LoteImportacion.objects.select_related("sistema", "recibido_por")[:8],
        },
    )


class FormularioAprobacion(forms.Form):
    unidad = forms.ModelChoiceField(queryset=None, label="Unidad a la que se asigna")
    tipo_jornada = forms.ModelChoiceField(
        TipoJornada.objects.filter(activo=True), label="Tipo de jornada (puede reclasificarla)"
    )
    participo_ejc = SiNo(label="¿Participó el Ejército?")
    participo_fac = SiNo(label="¿Participó la Fuerza Aérea?")
    poblacion_afecta_tropa = SiNo(
        label="¿La población es afecta a la tropa?", con_no_registrado=True
    )
    confirmo_no_duplicado = forms.BooleanField(
        required=False, label="Revisé las jornadas parecidas: esta actividad no está registrada."
    )

    def __init__(self, *args: Any, unidades: Any, hay_duplicados: bool, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.fields["unidad"].queryset = unidades
        self.hay_duplicados = hay_duplicados

    def clean(self) -> dict[str, Any]:
        datos = super().clean()
        if self.hay_duplicados and not datos.get("confirmo_no_duplicado"):
            raise forms.ValidationError(
                "Hay jornadas parecidas ya registradas. Ábralas; si es la misma, "
                "rechace esta como duplicada."
            )
        return datos


def _inicial(registro: RegistroExterno) -> dict[str, Any]:
    datos = registro.datos
    como_si_no = {True: "si", False: "no", None: None}
    return {
        "unidad": registro.unidad_propuesta_id,
        "tipo_jornada": TipoJornada.objects.filter(codigo=datos.get("tipo_jornada")).first(),
        "participo_ejc": como_si_no[datos.get("participo_ejc")],
        "participo_fac": como_si_no[datos.get("participo_fac")],
        "poblacion_afecta_tropa": {True: "si", False: "no", None: None}[
            datos.get("poblacion_afecta_tropa")
        ],
    }


@requiere_rol(*REVISAR)
def detalle(request: HttpRequest, pk: int) -> HttpResponse:
    registro = get_object_or_404(
        RegistroExterno.objects.select_related("sistema", "lote", "jornada"), pk=pk
    )
    duplicados = (
        servicios.recalcular_duplicados(registro)
        if registro.estado == EstadoRevision.PENDIENTE
        else []
    )
    formulario = FormularioAprobacion(
        request.POST or None,
        unidades=unidades_de(request.user),
        hay_duplicados=bool(duplicados),
        initial=_inicial(registro),
    )
    if (
        request.method == "POST"
        and request.POST.get("accion") == "aprobar"
        and formulario.is_valid()
    ):
        d = formulario.cleaned_data
        try:
            jornada = servicios.aprobar(
                registro,
                request.user,
                servicios.DecisionRevision(
                    unidad=d["unidad"],
                    tipo_jornada=d["tipo_jornada"],
                    participo_ejc=d["participo_ejc"],
                    participo_fac=d["participo_fac"],
                    poblacion_afecta_tropa=d["poblacion_afecta_tropa"],
                ),
            )
        except ValueError as error:
            messages.error(request, str(error))
            return redirect("integracion:detalle", pk=registro.pk)
        messages.success(
            request, f"Aprobada: se creó la jornada {jornada.codigo}. Complete sus pestañas."
        )
        return redirect("jornadas:detalle", pk=jornada.pk)
    datos = registro.datos
    grupos = dict(GrupoPoblacional.objects.values_list("codigo", "nombre"))
    servicios_nombres = dict(ServicioPrestado.objects.values_list("codigo", "nombre"))
    return render(
        request,
        "integracion/detalle.html",
        {
            "registro": registro,
            "datos": datos,
            "duplicados": duplicados,
            "formulario": formulario,
            "municipio": Municipio.objects.select_related("departamento")
            .filter(codigo_dane=datos.get("municipio_dane"))
            .first(),
            "poblacion": [
                (grupos.get(p["codigo"], p["codigo"]), p["cantidad"])
                for p in datos.get("poblacion", [])
            ],
            "servicios_prestados": [
                (servicios_nombres.get(s["codigo"], s["codigo"]), s["cantidad"])
                for s in datos.get("servicios", [])
            ],
        },
    )


@requiere_rol(*REVISAR)
@require_POST
def rechazar(request: HttpRequest, pk: int) -> HttpResponse:
    registro = get_object_or_404(RegistroExterno, pk=pk)
    try:
        servicios.rechazar(registro, request.user, request.POST.get("motivo", ""))
        messages.success(
            request, f"Actividad {registro.id_externo} rechazada. SIGIT puede consultar el motivo."
        )
        return redirect("integracion:bandeja")
    except ValueError as error:
        messages.error(request, str(error))
        return redirect("integracion:detalle", pk=registro.pk)


class FormularioArchivo(forms.Form):
    sistema = forms.ModelChoiceField(
        SistemaExterno.objects.filter(activo=True, alcance=SistemaExterno.Alcance.ENTREGA),
        label="Sistema de origen",
        empty_label="Elija el sistema",
    )
    archivo = forms.FileField(
        label="Archivo CSV", help_text="Use la plantilla. Máximo 500 actividades."
    )


@requiere_rol(*REVISAR)
def cargar_archivo(request: HttpRequest) -> HttpResponse:
    formulario = FormularioArchivo(request.POST or None, request.FILES or None)
    resultados = None
    if request.method == "POST" and formulario.is_valid():
        archivo = formulario.cleaned_data["archivo"]
        if archivo.size > 5 * 1024 * 1024:
            formulario.add_error("archivo", "El archivo supera 5 MB.")
        else:
            try:
                actividades = servicios.leer_archivo(archivo.read())
                lote, resultados = servicios.recibir_lote(
                    formulario.cleaned_data["sistema"],
                    actividades,
                    LoteImportacion.Via.ARCHIVO,
                    usuario=request.user,
                    nombre_archivo=archivo.name or "",
                )
                messages.success(
                    request,
                    f"Lote {lote.pk}: {lote.aceptados} recibidas, {lote.repetidos} repetidas, "
                    f"{lote.rechazados} con errores.",
                )
            except (UnicodeDecodeError, ValueError) as error:
                formulario.add_error("archivo", str(error))
    return render(
        request, "integracion/cargar.html", {"formulario": formulario, "resultados": resultados}
    )


@requiere_rol(*REVISAR)
def plantilla(request: HttpRequest) -> HttpResponse:
    respuesta = HttpResponse(servicios.plantilla_csv(), content_type="text/csv; charset=utf-8")
    respuesta["Content-Disposition"] = 'attachment; filename="plantilla-actividades-sigit.csv"'
    return respuesta
