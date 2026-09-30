from __future__ import annotations

from django import forms
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.shortcuts import redirect, render
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.http import require_GET, require_POST

from .ingreso import MENSAJE_CREDENCIALES_INVALIDAS, autenticar, emitir_reto
from .models import Municipio
from .red import ip_de_origen


class FormularioIngreso(forms.Form):
    credencial = forms.CharField(
        max_length=40,
        widget=forms.TextInput(
            attrs={
                "autocomplete": "username",
                "autocapitalize": "characters",
                "spellcheck": "false",
                "placeholder": "BIM23_PAID",
            }
        ),
    )
    clave = forms.CharField(
        max_length=128, widget=forms.PasswordInput(attrs={"autocomplete": "current-password"})
    )
    id_captcha = forms.IntegerField(widget=forms.HiddenInput)
    respuesta_captcha = forms.CharField(
        label="Respuesta",
        max_length=4,
        widget=forms.TextInput(attrs={"inputmode": "numeric", "autocomplete": "off"}),
    )


def ingreso(request: HttpRequest) -> HttpResponse:
    if request.user.is_authenticated:
        return redirect("analitica:tablero")
    error = ""
    if request.method == "POST":
        formulario = FormularioIngreso(request.POST)
        if formulario.is_valid():
            datos = formulario.cleaned_data
            resultado = autenticar(
                datos["credencial"],
                datos["clave"],
                datos["id_captcha"],
                datos["respuesta_captcha"],
                ip_de_origen(request),
                request.META.get("HTTP_USER_AGENT", ""),
            )
            if resultado.usuario is not None:
                login(request, resultado.usuario)
                destino = request.GET.get("next", "")
                if not url_has_allowed_host_and_scheme(destino, {request.get_host()}, True):
                    destino = ""
                return redirect(destino or "analitica:tablero")
        # Un solo mensaje para todas las causas, también para el formulario
        # incompleto: no se le dice a nadie qué parte falló.
        error = MENSAJE_CREDENCIALES_INVALIDAS
    reto = emitir_reto()
    formulario = FormularioIngreso(
        initial={"id_captcha": reto.id_captcha, "credencial": request.POST.get("credencial", "")}
    )
    return render(
        request,
        "nucleo/ingreso.html",
        {"formulario": formulario, "reto": reto, "error": error},
        status=401 if error else 200,
    )


@require_POST
def salida(request: HttpRequest) -> HttpResponse:
    logout(request)
    return redirect("nucleo:ingreso")


@login_required
@require_POST
def renovar_sesion(request: HttpRequest) -> JsonResponse:
    """La sesión se renueva sola con cada petición; esto solo es una petición."""
    return JsonResponse({"renovada": True})


@login_required
@require_GET
def municipios(request: HttpRequest) -> HttpResponse:
    """Opciones de municipio para el departamento elegido (select dependiente)."""
    departamento = request.GET.get("departamento", "")
    opciones = (
        Municipio.objects.filter(departamento_id=departamento).order_by("nombre")
        if departamento.isdigit()
        else Municipio.objects.none()
    )
    return render(request, "nucleo/_opciones_municipio.html", {"municipios": opciones})


def error_403(request: HttpRequest, exception: Exception | None = None) -> HttpResponse:
    return render(
        request,
        "nucleo/error.html",
        {"codigo": 403, "mensaje": "No tiene permiso para ver esta página."},
        status=403,
    )


def error_404(request: HttpRequest, exception: Exception | None = None) -> HttpResponse:
    return render(
        request,
        "nucleo/error.html",
        {"codigo": 404, "mensaje": "La página que busca no existe o no está en su ámbito."},
        status=404,
    )


def error_500(request: HttpRequest) -> HttpResponse:
    return render(
        request,
        "nucleo/error.html",
        {"codigo": 500, "mensaje": "Ocurrió un error. Ya quedó registrado; intente de nuevo."},
        status=500,
    )
