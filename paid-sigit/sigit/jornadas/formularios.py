"""
Formularios de jornada.

Ningún campo que alimente el consolidado arranca con un valor supuesto: ni
coordenadas, ni fechas, ni «Sí/No» marcado de antemano. Quien no elige, no
puede guardar (lección D-30 de la PAID). La única propuesta es el hemisferio
occidental: Colombia entera está al oeste de Greenwich.
"""

from __future__ import annotations

from typing import Any

from django import forms
from django.db.models import Model, QuerySet

from sigit.maestros.models import Entidad
from sigit.nucleo.geo import a_decimal, dentro_de_colombia
from sigit.nucleo.models import Departamento, Municipio

from . import models as j

SI_NO = [("si", "Sí"), ("no", "No")]
SI_NO_NR = [("si", "Sí"), ("no", "No"), ("nr", "No se registró")]


def _a_booleano(valor: str) -> bool | None:
    return {"si": True, "no": False}.get(valor)


class SiNo(forms.TypedChoiceField):
    def __init__(self, *args: Any, con_no_registrado: bool = False, **kwargs: Any) -> None:
        super().__init__(
            *args,
            choices=SI_NO_NR if con_no_registrado else SI_NO,
            widget=forms.RadioSelect,
            coerce=_a_booleano,
            empty_value=None,
            **kwargs,
        )


class FormularioJornada(forms.ModelForm):
    departamento = forms.ModelChoiceField(
        Departamento.objects.all(),
        empty_label="Elija el departamento",
        widget=forms.Select(
            attrs={"hx-get": "", "hx-target": "#id_municipio", "hx-trigger": "change"}
        ),
    )
    participo_ejc = SiNo(label="¿Participó el Ejército?")
    participo_fac = SiNo(label="¿Participó la Fuerza Aérea?")
    poblacion_afecta_tropa = SiNo(
        label="¿La población es afecta a la tropa?", con_no_registrado=True, required=True
    )
    confirmo_no_duplicado = forms.BooleanField(
        required=False,
        label="Revisé las jornadas parecidas y confirmo que esta es una jornada distinta.",
    )

    class Meta:
        model = j.Jornada
        fields = [
            "unidad",
            "tipo_jornada",
            "fecha_inicio",
            "fecha_fin",
            "fecha_ejecucion",
            "lugar",
            "departamento",
            "municipio",
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
            "participo_ejc",
            "participo_fac",
            "poblacion_afecta_tropa",
        ]
        widgets = {
            "fecha_inicio": forms.DateInput(attrs={"type": "date"}, format="%Y-%m-%d"),
            "fecha_fin": forms.DateInput(attrs={"type": "date"}, format="%Y-%m-%d"),
            "fecha_ejecucion": forms.DateInput(attrs={"type": "date"}, format="%Y-%m-%d"),
            "descripcion": forms.Textarea(attrs={"rows": 4}),
            "observaciones": forms.Textarea(attrs={"rows": 3}),
            "latitud_segundos": forms.NumberInput(attrs={"step": "0.00001"}),
            "longitud_segundos": forms.NumberInput(attrs={"step": "0.00001"}),
        }
        help_texts = {
            "descripcion": "El clavegrama: qué se hizo, con quién y para quién.",
            "lugar": "Sitio concreto: escuela, coliseo, vereda, muelle…",
        }

    def __init__(self, *args: Any, unidades: QuerySet, url_municipios: str, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.fields["unidad"].queryset = unidades
        self.fields["tipo_jornada"].queryset = j.TipoJornada.objects.filter(activo=True)
        self.fields["tipo_jornada"].empty_label = "Elija el tipo"
        self.fields["departamento"].widget.attrs["hx-get"] = url_municipios
        self.fields["departamento"].widget.attrs["name"] = "departamento"
        # El municipio depende del departamento elegido.
        depto = self.data.get("departamento") or (
            self.instance.municipio.departamento_id if self.instance.pk else None
        )
        if depto is None and self.initial.get("departamento"):
            depto = self.initial["departamento"]
        self.fields["municipio"].queryset = (
            Municipio.objects.filter(departamento_id=depto) if depto else Municipio.objects.none()
        )
        self.fields["municipio"].empty_label = "Elija el municipio"
        if self.instance.pk:
            self.initial.setdefault("departamento", self.instance.municipio.departamento_id)
            for campo in ("participo_ejc", "participo_fac"):
                self.initial[campo] = "si" if getattr(self.instance, campo) else "no"
            valor = self.instance.poblacion_afecta_tropa
            self.initial["poblacion_afecta_tropa"] = (
                "nr" if valor is None else ("si" if valor else "no")
            )
        # Sin hemisferio marcado de antemano, salvo el oeste (toda Colombia).
        self.fields["latitud_hemisferio"].choices = [("", "—"), *j.Jornada.Latitud.choices]
        self.fields["longitud_hemisferio"].choices = [("", "—"), *j.Jornada.Longitud.choices]
        if not self.instance.pk and not self.data:
            self.initial.setdefault("longitud_hemisferio", "W")

    def clean(self) -> dict[str, Any]:
        datos = super().clean()
        claves = (
            "latitud_grados",
            "latitud_minutos",
            "latitud_segundos",
            "latitud_hemisferio",
            "longitud_grados",
            "longitud_minutos",
            "longitud_segundos",
            "longitud_hemisferio",
        )
        if all(datos.get(c) not in (None, "") for c in claves):
            lat = a_decimal(
                datos["latitud_grados"],
                datos["latitud_minutos"],
                datos["latitud_segundos"],
                datos["latitud_hemisferio"],
            )
            lon = a_decimal(
                datos["longitud_grados"],
                datos["longitud_minutos"],
                datos["longitud_segundos"],
                datos["longitud_hemisferio"],
            )
            if not dentro_de_colombia(lat, lon):
                self.add_error(
                    "latitud_grados",
                    f"El punto ({lat:.5f}, {lon:.5f}) queda fuera de Colombia. "
                    "Revise los hemisferios.",
                )
        municipio = datos.get("municipio")
        departamento = datos.get("departamento")
        if municipio and departamento and municipio.departamento_id != departamento.pk:
            self.add_error("municipio", "El municipio no pertenece al departamento elegido.")
        ejecucion, inicio, fin = (
            datos.get("fecha_ejecucion"),
            datos.get("fecha_inicio"),
            datos.get("fecha_fin"),
        )
        if inicio and fin and fin < inicio:
            self.add_error("fecha_fin", "La fecha de fin no puede ser anterior a la de inicio.")
        if inicio and ejecucion and ejecucion < inicio:
            self.add_error("fecha_ejecucion", "La ejecución no puede ser anterior al inicio.")
        return datos


# ── Pestañas ────────────────────────────────────────────────────────────────
CAMPOS_PESTANA: dict[str, list[str]] = {
    "tipo-operacion": ["tipo_operacion", "observacion"],
    "entidades-servicios": ["entidad", "observacion"],
    "servicios": ["servicio", "cantidad", "observacion"],
    "poblacion": ["grupo", "cantidad_personas", "observacion"],
    "entidades-apoyadas": ["entidad", "observacion"],
    "medios-difusion": ["medio", "detalle"],
    "medios-utilizados": ["medio", "cantidad", "detalle"],
    "recursos": ["tipo_recurso", "cantidad", "unidad_medida", "valor", "detalle"],
    "bienes-donados": [
        "tipo_bien",
        "descripcion",
        "cantidad",
        "unidad_medida",
        "valor_estimado",
        "entidad_donante",
    ],
    "resumen": ["texto"],
}
# El campo de catálogo que no se puede repetir dentro de la misma jornada.
CAMPO_UNICO: dict[str, str] = {
    "tipo-operacion": "tipo_operacion",
    "entidades-servicios": "entidad",
    "servicios": "servicio",
    "poblacion": "grupo",
    "entidades-apoyadas": "entidad",
    "medios-difusion": "medio",
    "medios-utilizados": "medio",
    "recursos": "tipo_recurso",
}


def formulario_pestana(clave: str, modelo: type[Model]) -> type[forms.ModelForm]:
    campos = CAMPOS_PESTANA[clave]
    widgets: dict[str, forms.Widget] = {
        "observacion": forms.TextInput(attrs={"placeholder": "Opcional"}),
        "detalle": forms.TextInput(attrs={"placeholder": "Opcional"}),
        "texto": forms.Textarea(attrs={"rows": 6}),
    }
    return forms.modelform_factory(modelo, fields=campos, widgets=widgets)


def preparar_formulario_pestana(
    formulario: forms.ModelForm, clave: str, jornada: j.Jornada
) -> forms.ModelForm:
    """Solo opciones activas, y sin las que la jornada ya tiene (no se repiten)."""
    unico = CAMPO_UNICO.get(clave)
    for nombre, campo in formulario.fields.items():
        if isinstance(campo, forms.ModelChoiceField):
            consulta = campo.queryset
            if hasattr(consulta.model, "activo"):
                consulta = consulta.filter(activo=True)
            if consulta.model is Entidad:
                consulta = Entidad.vigentes.all()
            if nombre == unico:
                usados = formulario._meta.model.objects.filter(jornada=jornada).values_list(
                    f"{nombre}_id", flat=True
                )
                consulta = consulta.exclude(pk__in=list(usados))
            campo.queryset = consulta
            campo.empty_label = "Elija…"
    return formulario


class FormularioAdjunto(forms.Form):
    archivo = forms.FileField(label="Archivo")
