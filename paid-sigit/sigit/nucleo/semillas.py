"""
Datos de catálogo que PAID SIGIT siembra en TODO entorno.

Solo entra aquí lo que tiene fuente: el Manual del Usuario PAID (que es fuente
de JACID), el DANE, o la PAID anterior con su marca TODO(JACID). Los catálogos
de las pestañas (tipos de operación, servicios, grupos poblacionales, medios,
recursos, bienes) los define JACID (Q2/Q4) y NO se siembran: quedan vacíos
hasta que lleguen. Los datos de demostración viven en otro archivo y en otra
orden (`sembrar_demostracion`), y nunca corren solos.
"""

from __future__ import annotations

PENDIENTE = "TODO(JACID): confirmar listado oficial vigente."

CATALOGOS: dict[str, list[tuple[str, str, str]]] = {
    # Manual del Usuario PAID, lámina 20.
    "TipoJornada": [
        ("BINACIONAL", "Binacional", ""),
        ("CONJUNTA", "Conjunta", ""),
        ("ESTRATEGICA", "Estratégica", ""),
    ],
    # Manual del Usuario PAID, lámina 46. Siglas como en el manual.
    "TipoHerramientaAid": [
        ("COPAI", "COPAI", ""),
        ("GEOS", "GEOS", ""),
        ("VEMAI", "VEMAI", ""),
        ("EMISORA_INSTITUCIONAL", "Emisoras institucionales", ""),
        ("EQUIPO_PERIFONEO", "Equipos de perifoneo", ""),
        ("CIRCO_INSTITUCIONAL", "Circos institucionales", ""),
        ("IMPRESOS_PUBLICACIONES", "Impresos y publicaciones", ""),
        ("MAQUINA_REPROGRAFICA", "Máquinas duplicadoras o reprográficas", ""),
        ("AUDIOVISUAL", "Audiovisuales", ""),
        ("SIMULADOR_VUELO", "Simulador de vuelo", ""),
        ("GRUPO_MUSICAL", "Grupos musicales", ""),
    ],
    "TipoDocumentoIdentidad": [
        ("CC", "Cédula de ciudadanía", ""),
        ("CE", "Cédula de extranjería", ""),
        ("TI", "Tarjeta de identidad", ""),
        ("PA", "Pasaporte", ""),
        ("PEP", "Permiso Especial de Permanencia", ""),
        ("NIT", "NIT", ""),
    ],
    "Escalafon": [
        ("OFICIAL", "Oficial", PENDIENTE),
        ("SUBOFICIAL", "Suboficial", PENDIENTE),
        ("INFANTE", "Infantería de Marina", PENDIENTE),
        ("MARINERO", "Marinería", PENDIENTE),
        ("PERSONAL_CIVIL", "Personal civil", PENDIENTE),
        ("RESERVA_NAVAL", "Reserva Naval", "Profesionales oficiales de la reserva."),
    ],
    "Grado": [
        ("ALMIRANTE", "Almirante", PENDIENTE),
        ("VICEALMIRANTE", "Vicealmirante", PENDIENTE),
        ("CONTRALMIRANTE", "Contralmirante", PENDIENTE),
        ("CAPITAN_DE_NAVIO", "Capitán de Navío", PENDIENTE),
        ("CAPITAN_DE_FRAGATA", "Capitán de Fragata", PENDIENTE),
        ("CAPITAN_DE_CORBETA", "Capitán de Corbeta", PENDIENTE),
        ("TENIENTE_DE_NAVIO", "Teniente de Navío", PENDIENTE),
        ("TENIENTE_DE_FRAGATA", "Teniente de Fragata", PENDIENTE),
        ("TENIENTE_DE_CORBETA", "Teniente de Corbeta", PENDIENTE),
        ("SUBOFICIAL_JEFE_TECNICO", "Suboficial Jefe Técnico", PENDIENTE),
        ("SUBOFICIAL_JEFE", "Suboficial Jefe", PENDIENTE),
        ("SUBOFICIAL_PRIMERO", "Suboficial Primero", PENDIENTE),
        ("SUBOFICIAL_SEGUNDO", "Suboficial Segundo", PENDIENTE),
        ("SUBOFICIAL_TERCERO", "Suboficial Tercero", PENDIENTE),
        ("MARINERO_PRIMERO", "Marinero Primero", PENDIENTE),
        ("MARINERO_SEGUNDO", "Marinero Segundo", PENDIENTE),
        ("CIVIL", "Personal civil", PENDIENTE),
    ],
    "TipoEntidad": [
        ("PUBLICA", "Entidad pública", PENDIENTE),
        ("PRIVADA", "Entidad privada", PENDIENTE),
        ("ONG", "Organización no gubernamental", PENDIENTE),
        ("COOPERACION_INTERNACIONAL", "Cooperación internacional", PENDIENTE),
        (
            "ORGANIZACION_COMUNITARIA",
            "Organización comunitaria",
            "Juntas de acción comunal y similares, que a menudo no tienen NIT.",
        ),
        ("ACADEMICA", "Institución académica", PENDIENTE),
        ("RELIGIOSA", "Organización religiosa", PENDIENTE),
    ],
    "CategoriaAdjunto": [
        ("IMAGEN", "Imagen", ""),
        ("DOCUMENTO", "Documento", ""),
        ("AUDIO", "Audio", ""),
        ("VIDEO", "Video", ""),
    ],
    # Los mismos tres niveles de la PAID (R6).
    "NivelJerarquia": [
        ("FUERZA", "Fuerza", ""),
        ("COMPONENTE", "Componente", ""),
        ("UNIDAD_TACTICA", "Unidad Táctica", ""),
    ],
}

ESTADOS_HERRAMIENTA = [
    # Manual, lámina 46: «activa o inactiva»; la inactiva exige observaciones.
    ("ACTIVA", "Activa", "", False),
    (
        "INACTIVA",
        "Inactiva",
        "Exige observaciones: por qué está inactiva y qué gestión se hizo.",
        True,
    ),
]

PERIODICIDADES = [
    ("MENSUAL", "Mensual", 1),
    ("TRIMESTRAL", "Trimestral", 3),
    ("SEMESTRAL", "Semestral", 6),
    ("ANUAL", "Anual", 12),
]

# Extensión → (categoría, tipos MIME esperados del CONTENIDO).
EXTENSIONES = {
    "jpg": ("IMAGEN", ["image/jpeg"]),
    "jpeg": ("IMAGEN", ["image/jpeg"]),
    "png": ("IMAGEN", ["image/png"]),
    "gif": ("IMAGEN", ["image/gif"]),
    "pdf": ("DOCUMENTO", ["application/pdf"]),
    "doc": ("DOCUMENTO", ["application/x-cfb"]),
    "docx": ("DOCUMENTO", ["application/zip"]),
    "xls": ("DOCUMENTO", ["application/x-cfb"]),
    "xlsx": ("DOCUMENTO", ["application/zip"]),
    "ppt": ("DOCUMENTO", ["application/x-cfb"]),
    "pptx": ("DOCUMENTO", ["application/zip"]),
    "mp3": ("AUDIO", ["audio/mpeg"]),
    "mp4": ("VIDEO", ["video/mp4"]),
}

# DANE, códigos de departamento.
DEPARTAMENTOS = [
    ("05", "Antioquia"),
    ("08", "Atlántico"),
    ("11", "Bogotá D.C."),
    ("13", "Bolívar"),
    ("15", "Boyacá"),
    ("17", "Caldas"),
    ("18", "Caquetá"),
    ("19", "Cauca"),
    ("20", "Cesar"),
    ("23", "Córdoba"),
    ("25", "Cundinamarca"),
    ("27", "Chocó"),
    ("41", "Huila"),
    ("44", "La Guajira"),
    ("47", "Magdalena"),
    ("50", "Meta"),
    ("52", "Nariño"),
    ("54", "Norte de Santander"),
    ("63", "Quindío"),
    ("66", "Risaralda"),
    ("68", "Santander"),
    ("70", "Sucre"),
    ("73", "Tolima"),
    ("76", "Valle del Cauca"),
    ("81", "Arauca"),
    ("85", "Casanare"),
    ("86", "Putumayo"),
    ("88", "Archipiélago de San Andrés, Providencia y Santa Catalina"),
    ("91", "Amazonas"),
    ("94", "Guainía"),
    ("95", "Guaviare"),
    ("97", "Vaupés"),
    ("99", "Vichada"),
]
