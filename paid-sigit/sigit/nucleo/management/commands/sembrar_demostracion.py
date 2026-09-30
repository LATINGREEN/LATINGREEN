"""
`python manage.py sembrar_demostracion` — datos de EJEMPLO para ver la plataforma.

⚠️ NUNCA en producción: trae claves conocidas y catálogos inventados para que
las gráficas tengan qué mostrar. Todo lo inventado lleva la marca EJEMPLO. Se
niega a correr sin SIGIT_DEBUG o SIGIT_DEMOSTRACION (despliegue de demostración).
"""

from __future__ import annotations

import hashlib
import random
from datetime import date, timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.auth.models import Group
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

from sigit.analitica.models import IndicadorImpacto, MedicionIndicador
from sigit.integracion.models import LoteImportacion, RegistroExterno, SistemaExterno
from sigit.integracion.servicios import recibir_lote
from sigit.jornadas import models as j
from sigit.jornadas.servicios import recalcular_completo
from sigit.maestros.models import Entidad, HerramientaAid, Personal
from sigit.nucleo import models as m
from sigit.nucleo.contexto_bd import contexto_de_sistema, establecer_contexto
from sigit.nucleo.geo import desde_decimal

CLAVE_DEMOSTRACION = "Desarrollo2026*"
MARCA = "EJEMPLO — no es catálogo oficial; lo define JACID (Q2/Q4)."

MUNICIPIOS = [
    # codigo DANE, nombre, departamento, latitud, longitud, costa
    ("52835", "San Andrés de Tumaco", "52", 1.8067, -78.7647, "P"),
    ("76109", "Buenaventura", "76", 3.8801, -77.0312, "P"),
    ("27001", "Quibdó", "27", 5.6947, -76.6611, "P"),
    ("19809", "Timbiquí", "19", 2.7719, -77.6653, "P"),
    ("13001", "Cartagena de Indias", "13", 10.3910, -75.4794, "C"),
    ("08001", "Barranquilla", "08", 10.9685, -74.7813, "C"),
    ("47001", "Santa Marta", "47", 11.2408, -74.1990, "C"),
    ("44001", "Riohacha", "44", 11.5444, -72.9072, "C"),
    ("70221", "Coveñas", "70", 9.4027, -75.6803, "C"),
    ("05837", "Turbo", "05", 8.0928, -76.7282, "C"),
    ("88001", "San Andrés", "88", 12.5847, -81.7006, "C"),
    ("91001", "Leticia", "91", -4.2153, -69.9406, "F"),
    ("99001", "Puerto Carreño", "99", 6.1890, -67.4859, "F"),
]

CATALOGOS_EJEMPLO = {
    m.TipoOperacion: ["Acción integral", "Apoyo humanitario", "Operación conjunta"],
    m.ServicioPrestado: [
        "Consulta médica general",
        "Odontología",
        "Vacunación",
        "Corte de cabello",
        "Asesoría jurídica",
        "Registro civil",
        "Entrega de medicamentos",
        "Recreación infantil",
    ],
    m.GrupoPoblacional: [
        "Niños y niñas",
        "Adolescentes",
        "Adultos",
        "Adultos mayores",
        "Comunidades indígenas",
        "Comunidades afrodescendientes",
        "Personas con discapacidad",
    ],
    m.MedioDifusion: ["Emisora comunitaria", "Redes sociales", "Perifoneo", "Carteles"],
    m.MedioUtilizado: ["Embarcación", "Vehículo terrestre", "Aeronave"],
    m.TipoRecurso: ["Combustible", "Raciones", "Horas de embarcación"],
    m.TipoBienDonado: ["Mercados", "Kits escolares", "Kits de aseo", "Agua potable"],
}

LUGARES = [
    "Coliseo municipal",
    "Escuela rural",
    "Parque principal",
    "Centro de salud",
    "Muelle turístico",
    "Casa comunal",
    "Cancha múltiple",
    "Institución educativa",
    "Plaza de mercado",
    "Vereda El Carmen",
    "Corregimiento La Playa",
    "Resguardo indígena",
]

PDF_MINIMO = (
    b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]"
    b"/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 200 200]/Parent 2 0 R>>endobj\n"
    b"trailer<</Root 1 0 R>>\n%%EOF\n"
)


class Command(BaseCommand):
    help = "Siembra datos de EJEMPLO (unidades, usuarios, jornadas, SIGIT). Solo en desarrollo."

    def handle(self, *args: object, **opciones: object) -> None:
        if not (settings.DEBUG or settings.PRUEBAS or settings.DEMOSTRACION):
            raise CommandError(
                "sembrar_demostracion solo corre con SIGIT_DEBUG=1 o SIGIT_DEMOSTRACION=1."
            )
        call_command("sembrar")
        # Azar reproducible de la demostración, no criptográfico.
        azar = random.Random(2026)  # nosec B311
        with contexto_de_sistema():
            self._catalogos()
            unidades = self._unidades()
            usuarios = self._usuarios(unidades)
            municipios = self._municipios()
            entidades = self._entidades(unidades, municipios, azar)
            personal = self._personal(unidades)
            self._herramientas(unidades, municipios, personal, azar)
            if not j.Jornada.objects.exists():
                self._jornadas(unidades, municipios, entidades, usuarios, azar)
            self._sigit(unidades, municipios, azar)
            self._indicadores(unidades, usuarios["JACID_PAID"], azar)
        self.stdout.write(self.style.SUCCESS("Demostración lista."))
        self.stdout.write(
            f"Credenciales (clave {CLAVE_DEMOSTRACION}): JACID_PAID (revisor y administrador), "
            "BIM23_PAID y BIM24_PAID (operadores), FNP_PAID (consulta)."
        )

    # ── Catálogos y organización ─────────────────────────────────────────────
    def _catalogos(self) -> None:
        for modelo, nombres in CATALOGOS_EJEMPLO.items():
            for orden, nombre in enumerate(nombres, start=1):
                codigo = "EJ_" + "".join(c if c.isalnum() else "_" for c in nombre.upper())[:50]
                codigo = (
                    codigo.replace("Á", "A")
                    .replace("É", "E")
                    .replace("Í", "I")
                    .replace("Ó", "O")
                    .replace("Ú", "U")
                    .replace("Ñ", "N")
                )
                modelo.objects.update_or_create(
                    codigo=codigo, defaults={"nombre": nombre, "descripcion": MARCA, "orden": orden}
                )

    def _unidades(self) -> dict[str, m.Unidad]:
        niveles = {n.codigo: n for n in m.NivelJerarquia.objects.all()}
        definicion = [
            ("JACID", "1000001", "Jefatura de Acción Integral y Desarrollo", "FUERZA", None),
            ("FNP", "2510444", "Fuerza Naval del Pacífico", "COMPONENTE", "JACID"),
            ("FNC", "6102320", "Fuerza Naval del Caribe", "COMPONENTE", "JACID"),
            (
                "BIM23",
                "2813304",
                "Batallón de Infantería de Marina N.º 23",
                "UNIDAD_TACTICA",
                "FNP",
            ),
            (
                "BIM24",
                "1111853",
                "Batallón de Infantería de Marina N.º 24",
                "UNIDAD_TACTICA",
                "FNC",
            ),
        ]
        unidades: dict[str, m.Unidad] = {}
        for sigla, codigo, nombre, nivel, superior in definicion:
            unidad, _ = m.Unidad.objects.update_or_create(
                sigla=sigla,
                defaults={
                    "codigo": codigo,
                    "nombre": f"{nombre} (EJEMPLO)",
                    "nivel": niveles[nivel],
                    "superior": unidades.get(superior) if superior else None,
                },
            )
            unidad.refresh_from_db()  # La ruta la calcula el disparador.
            unidades[sigla] = unidad
        return unidades

    def _usuarios(self, unidades: dict[str, m.Unidad]) -> dict[str, m.Usuario]:
        definicion = [
            ("JACID_PAID", "JACID", [m.Rol.REVISOR_JACID, m.Rol.ADMINISTRADOR], True),
            ("FNP_PAID", "FNP", [m.Rol.CONSULTA], False),
            ("BIM23_PAID", "BIM23", [m.Rol.OPERADOR], False),
            ("BIM24_PAID", "BIM24", [m.Rol.OPERADOR], False),
        ]
        usuarios: dict[str, m.Usuario] = {}
        for credencial, sigla, roles, gestion in definicion:
            usuario = m.Usuario.objects.filter(credencial=credencial).first()
            if usuario is None:
                usuario = m.Usuario.objects.create_user(
                    credencial,
                    CLAVE_DEMOSTRACION,
                    unidad=unidades[sigla],
                    nombre_responsable=f"Responsable {sigla} (EJEMPLO)",
                    is_staff=gestion,
                )
            usuario.groups.set(Group.objects.filter(name__in=roles))
            usuarios[credencial] = usuario
        return usuarios

    def _municipios(self) -> dict[str, tuple[m.Municipio, float, float, str]]:
        resultado = {}
        for codigo, nombre, depto, lat, lon, costa in MUNICIPIOS:
            municipio, _ = m.Municipio.objects.update_or_create(
                codigo_dane=codigo,
                defaults={
                    "nombre": nombre,
                    "departamento": m.Departamento.objects.get(codigo_dane=depto),
                },
            )
            resultado[codigo] = (municipio, lat, lon, costa)
        return resultado

    # ── Maestros ─────────────────────────────────────────────────────────────
    def _entidades(self, unidades, municipios, azar) -> list[Entidad]:  # type: ignore[no-untyped-def]
        tipos = {t.codigo: t for t in m.TipoEntidad.objects.all()}
        entidades = []
        for codigo, (municipio, _lat, _lon, costa) in municipios.items():
            unidad = unidades["BIM23"] if costa == "P" else unidades["BIM24"]
            for tipo, nombre in (
                ("PUBLICA", f"Alcaldía de {municipio.nombre}"),
                ("PUBLICA", f"Hospital local de {municipio.nombre}"),
            ):
                entidad = Entidad.objects.filter(
                    nombre=nombre, municipio=municipio
                ).first() or Entidad(
                    nombre=nombre,
                    municipio=municipio,
                    tipo=tipos[tipo],
                    unidad=unidad,
                    nit=f"8{codigo}{azar.randint(100, 999)}-{azar.randint(0, 9)}",
                )
                entidad.save()
                entidades.append(entidad)
        for nombre, tipo in (
            ("Cruz Roja Colombiana (EJEMPLO)", "ONG"),
            ("Fundación Mar Adentro (EJEMPLO)", "ONG"),
            ("Universidad del Litoral (EJEMPLO)", "ACADEMICA"),
        ):
            entidad = Entidad.objects.filter(nombre=nombre).first() or Entidad(
                nombre=nombre, tipo=tipos[tipo], unidad=unidades["JACID"]
            )
            entidad.save()
            entidades.append(entidad)
        return entidades

    def _personal(self, unidades) -> list[Personal]:  # type: ignore[no-untyped-def]
        cc = m.TipoDocumentoIdentidad.objects.get(codigo="CC")
        grados = {g.codigo: g for g in m.Grado.objects.all()}
        personas = []
        for documento, nombres, apellidos, grado, sigla in (
            ("1000000001", "Andrés", "Mejía (EJEMPLO)", "TENIENTE_DE_CORBETA", "BIM23"),
            ("1000000002", "Laura", "Rincón (EJEMPLO)", "SUBOFICIAL_PRIMERO", "BIM23"),
            ("1000000003", "Camilo", "Durán (EJEMPLO)", "TENIENTE_DE_FRAGATA", "BIM24"),
        ):
            persona, _ = Personal.objects.get_or_create(
                tipo_documento=cc,
                numero_documento=documento,
                defaults={
                    "nombres": nombres,
                    "apellidos": apellidos,
                    "grado": grados[grado],
                    "unidad": unidades[sigla],
                },
            )
            personas.append(persona)
        return personas

    def _herramientas(self, unidades, municipios, personal, azar) -> None:  # type: ignore[no-untyped-def]
        if HerramientaAid.objects.exists():
            return
        activa = m.EstadoHerramientaAid.objects.get(codigo="ACTIVA")
        for indice, tipo in enumerate(m.TipoHerramientaAid.objects.all()[:6], start=1):
            municipio, lat, lon, costa = list(municipios.values())[indice]
            unidad = unidades["BIM23"] if costa == "P" else unidades["BIM24"]
            responsable = personal[0] if costa == "P" else personal[2]
            HerramientaAid.objects.create(
                tipo=tipo,
                estado=activa,
                codigo=f"HAID-EJ-{indice:03d}",
                nombre=f"{tipo.nombre} {municipio.nombre} (EJEMPLO)",
                unidad=unidad,
                municipio=municipio,
                fecha_registro=date(2025, indice, 10),
                responsable=responsable,
                **_gms(lat, lon, azar),
            )

    # ── Jornadas ─────────────────────────────────────────────────────────────
    def _jornadas(self, unidades, municipios, entidades, usuarios, azar) -> None:  # type: ignore[no-untyped-def]
        tipos = list(m.TipoJornada.objects.all())
        cat = {modelo: list(modelo.objects.filter(activo=True)) for modelo in CATALOGOS_EJEMPLO}
        pdf = m.CategoriaAdjunto.objects.get(codigo="DOCUMENTO")
        carpeta = settings.MEDIA_ROOT / "demostracion"
        carpeta.mkdir(parents=True, exist_ok=True)
        inicio = date(2025, 1, 6)
        dias = (date(2026, 9, 26) - inicio).days
        pacifico = [v for v in municipios.values() if v[3] == "P"]
        caribe = [v for v in municipios.values() if v[3] == "C"]
        fronteras = [v for v in municipios.values() if v[3] == "F"]
        for numero in range(260):
            # Más actividad en el segundo semestre y en 2026: la curva sube.
            fecha = inicio + timedelta(days=int(dias * (azar.random() ** 0.8)))
            eleccion = azar.random()
            if eleccion < 0.48:
                unidad, (municipio, lat, lon, _c) = unidades["BIM23"], azar.choice(pacifico)
            elif eleccion < 0.92:
                unidad, (municipio, lat, lon, _c) = unidades["BIM24"], azar.choice(caribe)
            else:
                unidad, (municipio, lat, lon, _c) = unidades["FNP"], azar.choice(fronteras)
            operador = usuarios["BIM23_PAID"] if unidad.sigla != "BIM24" else usuarios["BIM24_PAID"]
            establecer_contexto("/", operador.pk)
            lugar = f"{azar.choice(LUGARES)} de {municipio.nombre}"
            jornada = j.Jornada(
                codigo=f"{unidad.codigo}R{fecha.month}{fecha.year}EJ{numero:03d}",
                unidad=unidad,
                tipo_jornada=azar.choices(tipos, weights=[1, 5, 3])[0],
                descripcion=f"Jornada de apoyo al desarrollo en {lugar}. Texto de EJEMPLO.",
                fecha_inicio=fecha,
                fecha_fin=fecha + timedelta(days=azar.choice([0, 0, 1, 2])),
                fecha_ejecucion=fecha,
                lugar=lugar,
                municipio=municipio,
                participo_ejc=azar.random() < 0.3,
                participo_fac=azar.random() < 0.15,
                poblacion_afecta_tropa=azar.choice([True, False, None]),
                **_gms(lat, lon, azar),
            )
            jornada.save()
            completa = azar.random() < 0.72
            self._pestanas(jornada, cat, entidades, azar, completa)
            if completa:
                ruta = carpeta / f"soporte-{jornada.pk}.pdf"
                contenido = PDF_MINIMO + str(jornada.pk).encode()
                ruta.write_bytes(contenido)
                j.Adjunto.objects.create(
                    jornada=jornada,
                    nombre_archivo=f"acta-{jornada.codigo}.pdf",
                    extension="pdf",
                    categoria=pdf,
                    mime_detectado="application/pdf",
                    peso_bytes=len(contenido),
                    resumen_sha256=hashlib.sha256(contenido).hexdigest(),
                    ruta_almacen=str(ruta.relative_to(settings.MEDIA_ROOT)),
                )
            recalcular_completo(jornada)
        establecer_contexto("/", None)

    def _pestanas(self, jornada, cat, entidades, azar, completa) -> None:  # type: ignore[no-untyped-def]
        def algunos(lista, maximo):  # type: ignore[no-untyped-def]
            return azar.sample(lista, k=azar.randint(1, min(maximo, len(lista))))

        cercanas = [e for e in entidades if e.municipio_id in (None, jornada.municipio_id)]
        for tipo in algunos(cat[m.TipoOperacion], 1):
            j.JornadaTipoOperacion.objects.create(jornada=jornada, tipo_operacion=tipo)
        for servicio in algunos(cat[m.ServicioPrestado], 4):
            j.JornadaServicioPrestado.objects.create(
                jornada=jornada, servicio=servicio, cantidad=azar.randint(10, 180)
            )
        for grupo in algunos(cat[m.GrupoPoblacional], 4):
            j.JornadaPoblacion.objects.create(
                jornada=jornada, grupo=grupo, cantidad_personas=azar.randint(15, 320)
            )
        if not completa and azar.random() < 0.5:
            return  # Jornada a medio diligenciar: así se ven las incompletas.
        for entidad in algunos(cercanas, 2):
            j.JornadaEntidadServicio.objects.create(jornada=jornada, entidad=entidad)
        for entidad in algunos(cercanas, 1):
            j.JornadaEntidadApoyada.objects.create(jornada=jornada, entidad=entidad)
        for medio in algunos(cat[m.MedioDifusion], 2):
            j.JornadaMedioDifusion.objects.create(jornada=jornada, medio=medio)
        for medio in algunos(cat[m.MedioUtilizado], 2):
            j.JornadaMedioUtilizado.objects.create(
                jornada=jornada, medio=medio, cantidad=azar.randint(1, 4)
            )
        for recurso in algunos(cat[m.TipoRecurso], 2):
            j.JornadaRecurso.objects.create(
                jornada=jornada,
                tipo_recurso=recurso,
                cantidad=Decimal(azar.randint(5, 400)),
                valor=Decimal(azar.randint(2, 90) * 100000),
            )
        for bien in algunos(cat[m.TipoBienDonado], 2):
            j.JornadaBienDonado.objects.create(
                jornada=jornada,
                tipo_bien=bien,
                descripcion=f"{bien.nombre} entregados",
                cantidad=Decimal(azar.randint(20, 500)),
                valor_estimado=Decimal(azar.randint(5, 250) * 100000),
            )
        j.JornadaResumen.objects.create(
            jornada=jornada, texto="Resumen de EJEMPLO: la jornada se desarrolló sin novedad."
        )

    # ── SIGIT e indicadores ──────────────────────────────────────────────────
    def _sigit(self, unidades, municipios, azar) -> None:  # type: ignore[no-untyped-def]
        sistema = SistemaExterno.objects.filter(codigo="SIGIT_RESERVA").first()
        if sistema is None:
            sistema = SistemaExterno(
                codigo="SIGIT_RESERVA",
                nombre="SIGIT — Profesionales Oficiales de la Reserva (EJEMPLO)",
                alcance=SistemaExterno.Alcance.ENTREGA,
                unidad=unidades["JACID"],
            )
            testigo = sistema.emitir_testigo()
            sistema.save()
            self.stdout.write(
                f"Testigo de EJEMPLO para SIGIT_RESERVA (se muestra una vez): {testigo}"
            )
        if RegistroExterno.objects.exists():
            return
        tipos = [t.codigo for t in m.TipoJornada.objects.all()]
        grupos = list(m.GrupoPoblacional.objects.values_list("codigo", flat=True))
        servicios = list(m.ServicioPrestado.objects.values_list("codigo", flat=True))
        existentes = list(j.Jornada.objects.select_related("municipio").order_by("?")[:3])
        propuestas = []
        for numero in range(12):
            municipio, lat, lon, _c = azar.choice(list(municipios.values()))
            fecha = date(2026, 9, 1) + timedelta(days=azar.randint(0, 25))
            lugar = f"{azar.choice(LUGARES)} de {municipio.nombre}"
            propuestas.append((f"RES-2026-{numero + 101:04d}", municipio, fecha, lugar, lat, lon))
        # Tres propuestas repiten jornadas ya registradas: la bandeja tiene que avisarlo.
        for numero, existente in enumerate(existentes):
            propuestas.append(
                (
                    f"RES-2026-{numero + 201:04d}",
                    existente.municipio,
                    existente.fecha_ejecucion,
                    existente.lugar,
                    float(existente.latitud_decimal),
                    float(existente.longitud_decimal),
                )
            )
        actividades = [
            {
                "id_externo": id_externo,
                "tipo_jornada": azar.choice(tipos),
                "descripcion": f"Actividad de la reserva naval en {lugar}. EJEMPLO.",
                "fecha_ejecucion": fecha.isoformat(),
                "lugar": lugar,
                "municipio_dane": municipio.codigo_dane,
                "latitud": f"{lat + azar.uniform(-0.01, 0.01):.5f}",
                "longitud": f"{lon + azar.uniform(-0.01, 0.01):.5f}",
                "participo_ejc": azar.choice([False, None]),
                "poblacion": [
                    {"codigo": g, "cantidad": azar.randint(20, 150)} for g in azar.sample(grupos, 2)
                ],
                "servicios": [
                    {"codigo": s, "cantidad": azar.randint(10, 90)}
                    for s in azar.sample(servicios, 2)
                ],
            }
            for id_externo, municipio, fecha, lugar, lat, lon in propuestas
        ]
        # Por la MISMA vía que usa la API: validación, idempotencia y duplicados.
        recibir_lote(sistema, actividades, LoteImportacion.Via.API)

    def _indicadores(self, unidades, jacid, azar) -> None:  # type: ignore[no-untyped-def]
        if IndicadorImpacto.objects.exists():
            return
        trimestral = m.Periodicidad.objects.get(codigo="TRIMESTRAL")
        ejemplos = [
            (
                "EJ_COBERTURA_SALUD",
                "Cobertura en salud en zonas de jornada (EJEMPLO)",
                "Personas con atención en salud por cada 1.000 habitantes del municipio.",
                "por 1.000 hab.",
                12,
                40,
            ),
            (
                "EJ_CONFIANZA_INSTITUCIONAL",
                "Confianza en la institución (EJEMPLO)",
                "Porcentaje de encuestados que confía en la ARC, en municipios con jornadas.",
                "%",
                55,
                75,
            ),
        ]
        for codigo, nombre, formula, unidad_medida, base, meta in ejemplos:
            indicador = IndicadorImpacto.objects.create(
                codigo=codigo,
                nombre=nombre,
                objetivo="EJEMPLO: lo define la mesa de expertos SIGIT.",
                formula=formula,
                unidad_medida=unidad_medida,
                periodicidad=trimestral,
                sentido=IndicadorImpacto.Sentido.ASCENDENTE,
                linea_base=Decimal(base),
                meta=Decimal(meta),
                fuente="EJEMPLO",
            )
            valor = float(base)
            for trimestre in range(7):
                inicio = date(2025 + (trimestre // 4), (trimestre % 4) * 3 + 1, 1)
                fin = date(
                    inicio.year + (inicio.month + 3 > 12), (inicio.month + 2) % 12 + 1, 1
                ) - timedelta(days=1)
                valor += azar.uniform(0.5, (meta - base) / 5)
                MedicionIndicador.objects.create(
                    indicador=indicador,
                    unidad=unidades["JACID"],
                    periodo_inicio=inicio,
                    periodo_fin=fin,
                    valor=Decimal(str(round(valor, 2))),
                    registrado_por=jacid,
                )


def _gms(lat: float, lon: float, azar: random.Random) -> dict[str, object]:
    lat_g, lat_m, lat_s, lat_h = desde_decimal(Decimal(str(lat + azar.uniform(-0.05, 0.05))), True)
    lon_g, lon_m, lon_s, lon_h = desde_decimal(Decimal(str(lon + azar.uniform(-0.05, 0.05))), False)
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
