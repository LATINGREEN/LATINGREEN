from __future__ import annotations

from typing import Any

from django import forms
from django.contrib import messages
from django.contrib.postgres.search import TrigramSimilarity
from django.core.paginator import Paginator
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import HttpRequest, HttpResponse
from django.shortcuts import redirect, render
from django.urls import reverse

from sigit.nucleo.models import Departamento, EstadoHerramientaAid, Municipio
from sigit.nucleo.permisos import REGISTRAR, requiere_rol, unidades_de
from sigit.nucleo.texto import normalizar

from .models import Entidad, HerramientaAid, Personal

UMBRAL_SEMEJANZA = 0.45


def entidades_semejantes(nombre: str, nit: str = "", limite: int = 5) -> list[dict[str, Any]]:
    """
    Antes de registrar una entidad se buscan las que se le parecen, en TODA la
    plataforma (la lectura de entidades no se limita a la unidad, D-S05). Así
    «Alcaldia de Tumaco» encuentra a «Alcaldía Municipal de Tumaco».
    """
    condicion = Q(semejanza__gte=UMBRAL_SEMEJANZA)
    if nit:
        condicion |= Q(nit=nit)  # El mismo NIT es la misma entidad, se llame como se llame.
    consulta = Entidad.vigentes.annotate(
        semejanza=TrigramSimilarity("nombre_normalizado", normalizar(nombre))
    ).filter(condicion)
    return [
        {
            "id": e.pk,
            "nombre": e.nombre,
            "nit": e.nit,
            "municipio": str(e.municipio or "—"),
            "semejanza": round(float(e.semejanza) * 100),
        }
        for e in consulta.select_related("municipio__departamento").order_by("-semejanza")[:limite]
    ]


class FormularioEntidad(forms.ModelForm):
    confirmo_distinta = forms.BooleanField(
        required=False, label="Revisé las parecidas y confirmo que es una entidad distinta."
    )

    class Meta:
        model = Entidad
        fields = [
            "tipo",
            "nombre",
            "nit",
            "unidad",
            "municipio",
            "direccion",
            "telefono",
            "correo",
            "contacto",
        ]
        help_texts = {
            "nit": "Sin puntos. Si no tiene (p. ej., una junta de acción comunal), déjelo vacío."
        }

    def __init__(self, *args: Any, unidades: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.fields["unidad"].queryset = unidades
        self.fields["tipo"].queryset = self.fields["tipo"].queryset.filter(activo=True)
        self.fields["municipio"].queryset = Municipio.objects.select_related(
            "departamento"
        ).order_by("departamento__nombre", "nombre")


@requiere_rol()
def entidades(request: HttpRequest) -> HttpResponse:
    texto = request.GET.get("q", "").strip()
    consulta = Entidad.vigentes.select_related("tipo", "municipio__departamento", "unidad")
    if texto:
        consulta = consulta.filter(
            Q(nombre_normalizado__icontains=normalizar(texto)) | Q(nit__icontains=texto)
        )
    formulario = None
    semejantes: list[dict[str, Any]] = []
    if request.user.tiene_rol(*REGISTRAR):
        formulario = FormularioEntidad(
            request.POST or None,
            unidades=unidades_de(request.user),
            initial={"unidad": request.user.unidad_id},
        )
        if request.method == "POST" and formulario.is_valid():
            datos = formulario.cleaned_data
            semejantes = entidades_semejantes(datos["nombre"], datos.get("nit", ""))
            if not semejantes or datos.get("confirmo_distinta"):
                try:
                    with transaction.atomic():
                        entidad = formulario.save()
                    messages.success(request, f"Entidad «{entidad.nombre}» registrada.")
                    return redirect("maestros:entidades")
                except IntegrityError:
                    formulario.add_error(
                        None,
                        "Ya existe una entidad con ese NIT, o con ese nombre en ese municipio.",
                    )
    pagina = Paginator(consulta, 30).get_page(request.GET.get("pagina"))
    return render(
        request,
        "maestros/entidades.html",
        {
            "pagina": pagina,
            "q": texto,
            "formulario": formulario,
            "semejantes": semejantes,
        },
    )


@requiere_rol()
def entidades_semejantes_vista(request: HttpRequest) -> HttpResponse:
    """Aviso en vivo mientras se escribe el nombre (htmx)."""
    nombre = request.GET.get("nombre", "").strip()
    semejantes = (
        entidades_semejantes(nombre, request.GET.get("nit", "").strip()) if len(nombre) >= 4 else []
    )
    return render(request, "maestros/_semejantes.html", {"semejantes": semejantes, "en_vivo": True})


class FormularioPersonal(forms.ModelForm):
    class Meta:
        model = Personal
        fields = [
            "tipo_documento",
            "numero_documento",
            "nombres",
            "apellidos",
            "grado",
            "escalafon",
            "unidad",
            "correo",
            "telefono",
        ]

    def __init__(self, *args: Any, unidades: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.fields["unidad"].queryset = unidades


@requiere_rol()
def personal(request: HttpRequest) -> HttpResponse:
    formulario = None
    if request.user.tiene_rol(*REGISTRAR):
        formulario = FormularioPersonal(
            request.POST or None,
            unidades=unidades_de(request.user),
            initial={"unidad": request.user.unidad_id},
        )
        if request.method == "POST" and formulario.is_valid():
            try:
                with transaction.atomic():
                    persona = formulario.save()
                messages.success(request, f"{persona} registrado.")
                return redirect("maestros:personal")
            except IntegrityError:
                formulario.add_error(
                    "numero_documento", "Esa persona ya está registrada (mismo documento)."
                )
    pagina = Paginator(
        Personal.vigentes.select_related("grado", "unidad", "tipo_documento"), 30
    ).get_page(request.GET.get("pagina"))
    return render(request, "maestros/personal.html", {"pagina": pagina, "formulario": formulario})


class FormularioHerramienta(forms.ModelForm):
    departamento = forms.ModelChoiceField(
        Departamento.objects.all(), empty_label="Elija el departamento"
    )

    class Meta:
        model = HerramientaAid
        fields = [
            "tipo",
            "codigo",
            "nombre",
            "estado",
            "unidad",
            "departamento",
            "municipio",
            "fecha_registro",
            "fecha_potenciacion",
            "responsable",
            "descripcion",
            "observaciones",
            "latitud_grados",
            "latitud_minutos",
            "latitud_segundos",
            "latitud_hemisferio",
            "longitud_grados",
            "longitud_minutos",
            "longitud_segundos",
            "longitud_hemisferio",
        ]
        widgets = {
            "fecha_registro": forms.DateInput(attrs={"type": "date"}),
            "fecha_potenciacion": forms.DateInput(attrs={"type": "date"}),
            "descripcion": forms.Textarea(attrs={"rows": 2}),
            "observaciones": forms.Textarea(attrs={"rows": 2}),
        }

    def __init__(self, *args: Any, unidades: Any, url_municipios: str, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.fields["unidad"].queryset = unidades
        self.fields["responsable"].queryset = Personal.vigentes.all()
        self.fields["departamento"].widget.attrs.update(
            {"hx-get": url_municipios, "hx-target": "#id_municipio", "hx-trigger": "change"}
        )
        depto = self.data.get("departamento")
        self.fields["municipio"].queryset = (
            Municipio.objects.filter(departamento_id=depto) if depto else Municipio.objects.none()
        )
        self.fields["latitud_hemisferio"].choices = [("", "—"), *HerramientaAid.Latitud.choices]
        self.fields["longitud_hemisferio"].choices = [("", "—"), *HerramientaAid.Longitud.choices]
        if not self.data:
            self.initial.setdefault("longitud_hemisferio", "W")

    def clean(self) -> dict[str, Any]:
        datos = super().clean()
        estado: EstadoHerramientaAid | None = datos.get("estado")
        if estado and estado.exige_observacion and not (datos.get("observaciones") or "").strip():
            self.add_error(
                "observaciones", "Si está inactiva, explique por qué y qué gestión se hizo."
            )
        return datos


@requiere_rol()
def herramientas(request: HttpRequest) -> HttpResponse:
    formulario = None
    if request.user.tiene_rol(*REGISTRAR):
        formulario = FormularioHerramienta(
            request.POST or None,
            unidades=unidades_de(request.user),
            url_municipios=reverse("nucleo:municipios"),
            initial={"unidad": request.user.unidad_id},
        )
        if request.method == "POST" and formulario.is_valid():
            try:
                with transaction.atomic():
                    herramienta = formulario.save()
                messages.success(request, f"Herramienta {herramienta.codigo} registrada.")
                return redirect("maestros:herramientas")
            except IntegrityError:
                formulario.add_error("codigo", "Ya existe una herramienta con ese código.")
    pagina = Paginator(
        HerramientaAid.vigentes.select_related(
            "tipo", "estado", "municipio", "unidad", "responsable"
        ),
        30,
    ).get_page(request.GET.get("pagina"))
    return render(
        request, "maestros/herramientas.html", {"pagina": pagina, "formulario": formulario}
    )
