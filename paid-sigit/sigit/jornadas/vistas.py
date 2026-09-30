from __future__ import annotations

import logging
from typing import Any

from django.contrib import messages
from django.core.paginator import Paginator
from django.db import IntegrityError, transaction
from django.db.models import Q, QuerySet
from django.http import FileResponse, Http404, HttpRequest, HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST

from sigit.analitica.exportar import respuesta_csv, respuesta_xlsx
from sigit.nucleo.models import Departamento, TipoJornada, Unidad
from sigit.nucleo.permisos import REGISTRAR, requiere_rol, unidades_de

from . import adjuntos as servicio_adjuntos
from .formularios import (
    CAMPO_UNICO,
    FormularioAdjunto,
    FormularioJornada,
    formulario_pestana,
    preparar_formulario_pestana,
)
from .models import PESTANAS, Adjunto, Jornada, JornadaResumen, Origen
from .servicios import (
    buscar_posibles_duplicados,
    estado_pestanas,
    guardar_con_codigo,
    recalcular_completo,
)

registro = logging.getLogger("sigit.jornadas")
POR_PAGINA = 25
PESTANAS_POR_CLAVE = {clave: (titulo, modelo) for clave, titulo, modelo in PESTANAS}


# ── Listado ──────────────────────────────────────────────────────────────────
def filtrar(request: HttpRequest) -> tuple[QuerySet[Jornada], dict[str, str]]:
    """Filtros compartidos por el listado y las exportaciones. RLS ya acotó."""
    f = {
        k: request.GET.get(k, "").strip()
        for k in ("q", "unidad", "tipo", "departamento", "estado", "origen", "desde", "hasta")
    }
    consulta = Jornada.vigentes.select_related("unidad", "tipo_jornada", "municipio__departamento")
    if f["q"]:
        consulta = consulta.filter(
            Q(codigo__icontains=f["q"])
            | Q(lugar__icontains=f["q"])
            | Q(descripcion__icontains=f["q"])
        )
    if f["unidad"].isdigit():
        unidad = Unidad.objects.filter(pk=f["unidad"]).first()
        if unidad:
            consulta = consulta.filter(unidad__ruta__startswith=unidad.ruta)
    if f["tipo"].isdigit():
        consulta = consulta.filter(tipo_jornada_id=f["tipo"])
    if f["departamento"].isdigit():
        consulta = consulta.filter(municipio__departamento_id=f["departamento"])
    if f["estado"] in {"completo", "incompleto"}:
        consulta = consulta.filter(registro_completo=f["estado"] == "completo")
    if f["origen"] in Origen.values:
        consulta = consulta.filter(origen=f["origen"])
    if f["desde"]:
        consulta = consulta.filter(fecha_ejecucion__gte=f["desde"])
    if f["hasta"]:
        consulta = consulta.filter(fecha_ejecucion__lte=f["hasta"])
    return consulta, f


@requiere_rol()
def listado(request: HttpRequest) -> HttpResponse:
    consulta, filtros = filtrar(request)
    pagina = Paginator(consulta, POR_PAGINA).get_page(request.GET.get("pagina"))
    parametros = request.GET.copy()
    parametros.pop("pagina", None)
    contexto = {
        "pagina": pagina,
        "filtros": filtros,
        "parametros": parametros.urlencode(),
        "total": pagina.paginator.count,
        "completas": consulta.filter(registro_completo=True).count(),
        "unidades": Unidad.objects.filter(ruta__startswith=request.user.unidad.ruta),
        "tipos": TipoJornada.objects.filter(activo=True),
        "departamentos": Departamento.objects.all(),
        "origenes": Origen.choices,
    }
    plantilla = (
        "jornadas/_tabla.html" if request.headers.get("HX-Request") else "jornadas/listado.html"
    )
    return render(request, plantilla, contexto)


COLUMNAS_EXPORTACION = [
    ("Código", lambda j: j.codigo),
    ("Unidad", lambda j: j.unidad.sigla),
    ("Tipo de jornada", lambda j: j.tipo_jornada.nombre),
    ("Fecha de inicio", lambda j: j.fecha_inicio),
    ("Fecha de fin", lambda j: j.fecha_fin),
    ("Fecha de ejecución", lambda j: j.fecha_ejecucion),
    ("Departamento", lambda j: j.municipio.departamento.nombre),
    ("Municipio", lambda j: j.municipio.nombre),
    ("Código DANE", lambda j: j.municipio.codigo_dane),
    ("Lugar", lambda j: j.lugar),
    ("Latitud", lambda j: j.latitud_decimal),
    ("Longitud", lambda j: j.longitud_decimal),
    ("Participó ARC", lambda j: "Sí"),
    ("Participó EJC", lambda j: "Sí" if j.participo_ejc else "No"),
    ("Participó FAC", lambda j: "Sí" if j.participo_fac else "No"),
    (
        "Población afecta a la tropa",
        lambda j: {True: "Sí", False: "No", None: "No se registró"}[j.poblacion_afecta_tropa],
    ),
    ("Registro completo", lambda j: "Sí" if j.registro_completo else "No"),
    ("Origen", lambda j: j.get_origen_display()),
    ("Descripción", lambda j: j.descripcion),
]


@requiere_rol()
def exportar(request: HttpRequest, formato: str) -> HttpResponse:
    consulta, _ = filtrar(request)
    filas = [[f(j) for _, f in COLUMNAS_EXPORTACION] for j in consulta.iterator(chunk_size=500)]
    encabezados = [c for c, _ in COLUMNAS_EXPORTACION]
    nombre = f"jornadas-{timezone.localdate():%Y-%m-%d}"
    registro.info("Exportación %s de %d jornadas por %s", formato, len(filas), request.user)
    if formato == "xlsx":
        return respuesta_xlsx(nombre, "Jornadas", encabezados, filas)
    return respuesta_csv(nombre, encabezados, filas)


@requiere_rol()
@require_GET
def busqueda_rapida(request: HttpRequest) -> JsonResponse:
    """Para la paleta de órdenes: código o lugar."""
    texto = request.GET.get("q", "").strip()
    if len(texto) < 2:
        return JsonResponse({"resultados": []})
    jornadas = Jornada.vigentes.filter(
        Q(codigo__icontains=texto) | Q(lugar__icontains=texto)
    ).order_by("-fecha_ejecucion")[:8]
    return JsonResponse(
        {
            "resultados": [
                {
                    "codigo": j.codigo,
                    "lugar": j.lugar,
                    "fecha": j.fecha_ejecucion.strftime("%d/%m/%Y"),
                    "url": reverse("jornadas:detalle", args=[j.pk]),
                }
                for j in jornadas
            ]
        }
    )


# ── Datos generales ──────────────────────────────────────────────────────────
def _formulario(request: HttpRequest, **kwargs: Any) -> FormularioJornada:
    return FormularioJornada(
        request.POST or None,
        unidades=unidades_de(request.user),
        url_municipios=reverse("nucleo:municipios"),
        **kwargs,
    )


def _guardar_si_no_es_duplicado(
    request: HttpRequest, formulario: FormularioJornada, excluir: int | None
) -> list[dict[str, object]] | None:
    """
    Devuelve las jornadas parecidas si hay que confirmar; None si se guardó.
    No bloquea: dos jornadas legítimas pueden coincidir. Pero nadie guarda
    una posible repetición sin haberla visto.
    """
    datos = formulario.cleaned_data
    parecidas = buscar_posibles_duplicados(
        municipio_id=datos["municipio"].pk,
        fecha_ejecucion=datos["fecha_ejecucion"],
        lugar=datos["lugar"],
        excluir_id=excluir,
    )
    if parecidas and not datos.get("confirmo_no_duplicado"):
        return [
            p.como_dict() | {"url": reverse("jornadas:detalle", args=[p.id])} for p in parecidas
        ]
    return None


@requiere_rol(*REGISTRAR)
def nueva(request: HttpRequest) -> HttpResponse:
    inicial: dict[str, object] = {"unidad": request.user.unidad_id}
    base = None
    if request.method == "GET" and request.GET.get("basada_en", "").isdigit():
        # «Registrar otra como esta»: copia lo que se repite de una jornada a la
        # siguiente en el mismo sitio, NUNCA las fechas ni lo que se mide.
        base = get_object_or_404(Jornada.vigentes, pk=request.GET["basada_en"])
        for campo in (
            "unidad",
            "tipo_jornada",
            "lugar",
            "municipio",
            "latitud_grados",
            "latitud_minutos",
            "latitud_segundos",
            "latitud_hemisferio",
            "longitud_grados",
            "longitud_minutos",
            "longitud_segundos",
            "longitud_hemisferio",
        ):
            inicial[campo] = getattr(base, f"{campo}_id", None) or getattr(base, campo)
        inicial["departamento"] = base.municipio.departamento_id
    formulario = _formulario(request, initial=inicial)
    parecidas = None
    if request.method == "POST" and formulario.is_valid():
        parecidas = _guardar_si_no_es_duplicado(request, formulario, None)
        if parecidas is None:
            jornada = formulario.save(commit=False)
            guardar_con_codigo(jornada)
            messages.success(
                request, f"Jornada {jornada.codigo} registrada. Continúe con las pestañas."
            )
            return redirect(f"{reverse('jornadas:detalle', args=[jornada.pk])}?paso=tipo-operacion")
    return render(
        request,
        "jornadas/formulario.html",
        {
            "formulario": formulario,
            "parecidas": parecidas,
            "base": base,
            "titulo": "Nueva jornada",
        },
    )


@requiere_rol()
def detalle(request: HttpRequest, pk: int) -> HttpResponse:
    jornada = get_object_or_404(
        Jornada.vigentes.select_related("unidad", "tipo_jornada", "municipio__departamento"), pk=pk
    )
    paso = request.GET.get("paso", "generales")
    pestanas = estado_pestanas(jornada)
    contexto: dict[str, object] = {
        "jornada": jornada,
        "pestanas": pestanas,
        "paso": paso,
        "listas": sum(1 for p in pestanas if p["completa"]),
        "puede_editar": request.user.tiene_rol(*REGISTRAR),
    }
    if paso in PESTANAS_POR_CLAVE:
        contexto |= _contexto_pestana(request, jornada, paso)
        contexto["plantilla_paso"] = (
            "jornadas/_soportes.html" if paso == "soportes" else "jornadas/_pestana.html"
        )
    return render(request, "jornadas/detalle.html", contexto)


@requiere_rol(*REGISTRAR)
def editar(request: HttpRequest, pk: int) -> HttpResponse:
    jornada = get_object_or_404(Jornada.vigentes, pk=pk)
    formulario = _formulario(request, instance=jornada)
    parecidas = None
    if request.method == "POST" and formulario.is_valid():
        parecidas = _guardar_si_no_es_duplicado(request, formulario, jornada.pk)
        if parecidas is None:
            formulario.save()
            messages.success(request, "Datos generales actualizados.")
            return redirect("jornadas:detalle", pk=jornada.pk)
    return render(
        request,
        "jornadas/formulario.html",
        {
            "formulario": formulario,
            "parecidas": parecidas,
            "jornada": jornada,
            "titulo": f"Editar {jornada.codigo}",
        },
    )


# ── Pestañas ─────────────────────────────────────────────────────────────────
def _contexto_pestana(
    request: HttpRequest, jornada: Jornada, clave: str, formulario: Any = None
) -> dict[str, object]:
    titulo, modelo = PESTANAS_POR_CLAVE[clave]
    filas = modelo.objects.filter(jornada=jornada).order_by("id")
    claves = [c for c, _, _ in PESTANAS]
    indice = claves.index(clave)
    contexto: dict[str, object] = {
        "clave": clave,
        "titulo_pestana": titulo,
        "filas": filas,
        "jornada": jornada,
        "numero_pestana": indice + 1,
        "anterior": PESTANAS[indice - 1][:2] if indice > 0 else ("generales", "Datos generales"),
        "siguiente": PESTANAS[indice + 1][:2] if indice + 1 < len(PESTANAS) else None,
    }
    if clave == "soportes":
        usada = servicio_adjuntos.cuota_usada(jornada)
        contexto |= {
            "formulario_adjunto": formulario or FormularioAdjunto(),
            "cuota_usada_mb": usada / 1024 / 1024,
            "cuota_pct": min(100, round(usada * 100 / (10 * 1024 * 1024))),
            # Clase de ancho en pasos de 5 %: la CSP no admite estilos en línea.
            "cuota_clase": f"pct-{min(100, round(usada * 20 / (10 * 1024 * 1024)) * 5)}",
        }
        return contexto
    if clave == "resumen":
        existente = JornadaResumen.objects.filter(jornada=jornada).first()
        clase = formulario_pestana(clave, modelo)
        contexto["formulario"] = formulario or clase(instance=existente)
        return contexto
    clase = formulario_pestana(clave, modelo)
    contexto["formulario"] = preparar_formulario_pestana(formulario or clase(), clave, jornada)
    contexto["campos_visibles"] = [
        f for f in contexto["formulario"].fields if f not in ("observacion", "detalle")
    ]
    return contexto


def _responder_pestana(
    request: HttpRequest, jornada: Jornada, clave: str, **extra: Any
) -> HttpResponse:
    recalcular_completo(jornada)
    contexto = _contexto_pestana(request, jornada, clave, extra.pop("formulario", None))
    contexto |= extra | {"puede_editar": True, "pestanas": estado_pestanas(jornada)}
    plantilla = "jornadas/_soportes.html" if clave == "soportes" else "jornadas/_pestana.html"
    respuesta = render(request, plantilla, contexto)
    # Avisa a los pasos de la izquierda que se repinten (conteos y marcas).
    respuesta["HX-Trigger"] = "pestanaCambiada"
    return respuesta


@requiere_rol(*REGISTRAR)
@require_POST
def agregar_fila(request: HttpRequest, pk: int, clave: str) -> HttpResponse:
    if clave not in PESTANAS_POR_CLAVE or clave == "soportes":
        raise Http404
    jornada = get_object_or_404(Jornada.vigentes, pk=pk)
    _, modelo = PESTANAS_POR_CLAVE[clave]
    clase = formulario_pestana(clave, modelo)
    instancia = (
        JornadaResumen.objects.filter(jornada=jornada).first() if clave == "resumen" else None
    )
    formulario = clase(request.POST, instance=instancia)
    if clave != "resumen":
        preparar_formulario_pestana(formulario, clave, jornada)
    if not formulario.is_valid():
        return _responder_pestana(request, jornada, clave, formulario=formulario)
    fila = formulario.save(commit=False)
    fila.jornada = jornada
    try:
        with transaction.atomic():
            fila.save()
    except IntegrityError:
        unico = CAMPO_UNICO.get(clave, "")
        formulario.add_error(
            unico or None, "Ese elemento ya está en la jornada. Edite la fila existente."
        )
        return _responder_pestana(request, jornada, clave, formulario=formulario)
    return _responder_pestana(request, jornada, clave, aviso="Fila agregada.")


@requiere_rol(*REGISTRAR)
@require_POST
def quitar_fila(request: HttpRequest, pk: int, clave: str, fila: int) -> HttpResponse:
    if clave not in PESTANAS_POR_CLAVE:
        raise Http404
    jornada = get_object_or_404(Jornada.vigentes, pk=pk)
    _, modelo = PESTANAS_POR_CLAVE[clave]
    objeto = get_object_or_404(modelo, pk=fila, jornada=jornada)
    if isinstance(objeto, Adjunto):
        try:
            servicio_adjuntos.ruta_de(objeto).unlink(missing_ok=True)
        except servicio_adjuntos.SoporteRechazado:
            registro.warning("Soporte %s con ruta inválida", objeto.pk)
    objeto.delete()
    return _responder_pestana(request, jornada, clave, aviso="Fila quitada.")


@requiere_rol()
@require_GET
def pasos(request: HttpRequest, pk: int) -> HttpResponse:
    jornada = get_object_or_404(Jornada.vigentes, pk=pk)
    pestanas = estado_pestanas(jornada)
    return render(
        request,
        "jornadas/_pasos.html",
        {
            "jornada": jornada,
            "pestanas": pestanas,
            "paso": request.GET.get("paso", ""),
            "listas": sum(1 for p in pestanas if p["completa"]),
        },
    )


# ── Soportes ─────────────────────────────────────────────────────────────────
@requiere_rol(*REGISTRAR)
@require_POST
def cargar_soporte(request: HttpRequest, pk: int) -> HttpResponse:
    jornada = get_object_or_404(Jornada.vigentes, pk=pk)
    formulario = FormularioAdjunto(request.POST, request.FILES)
    if formulario.is_valid():
        try:
            servicio_adjuntos.cargar(jornada, formulario.cleaned_data["archivo"])
            return _responder_pestana(request, jornada, "soportes", aviso="Soporte cargado.")
        except servicio_adjuntos.SoporteRechazado as error:
            formulario.add_error("archivo", str(error))
    return _responder_pestana(request, jornada, "soportes", formulario=formulario)


@requiere_rol()
@require_GET
def descargar_soporte(request: HttpRequest, pk: int, adjunto: int) -> FileResponse:
    # RLS decide: si la jornada no es visible, el soporte tampoco (404).
    objeto = get_object_or_404(Adjunto, pk=adjunto, jornada_id=pk)
    ruta = servicio_adjuntos.ruta_de(objeto)
    if not ruta.is_file():
        raise Http404
    respuesta = FileResponse(
        ruta.open("rb"),
        as_attachment=True,
        filename=objeto.nombre_archivo,
        content_type=objeto.mime_detectado,
    )
    respuesta["X-Content-Type-Options"] = "nosniff"
    return respuesta


@requiere_rol(*REGISTRAR)
@require_POST
def eliminar(request: HttpRequest, pk: int) -> HttpResponse:
    """Borrado LÓGICO: la jornada sale de listados y consolidados, no de la bitácora."""
    jornada = get_object_or_404(Jornada.vigentes, pk=pk)
    Jornada.objects.filter(pk=jornada.pk).update(eliminado_en=timezone.now())
    messages.success(request, f"Jornada {jornada.codigo} retirada. Queda en la bitácora.")
    return redirect("jornadas:listado")
