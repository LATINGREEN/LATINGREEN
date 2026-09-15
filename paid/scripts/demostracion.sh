#!/usr/bin/env bash
#
# Demostración de la PAID de punta a punta, contra la API real.
#
# Recorre el camino completo que hoy funciona:
#
#   1. pide el reto de captcha (R3)
#   2. lo resuelve e ingresa (R1–R5)
#   3. registra una jornada con su clavegrama y sus coordenadas GMS (R13)
#   4. consulta la cuota de adjuntos ANTES de subir nada (R11)
#   5. llena las diez pestañas de datos y sube un adjunto (R19, R12)
#   6. comprueba que `registro_completo` pasa a verdadero solo con las once
#   7. exporta el consolidado a CSV (con registro en aud.exportacion)
#   8. demuestra el aislamiento por unidad: BIM24 no ve nada de BIM23 (R6)
#   9. demuestra que la bitácora registró todo (R15)
#  10. cierra la sesión
#
# NO es una prueba: las pruebas están en apps/api/src/pruebas. Esto es para
# VERLO, con la salida en claro.
#
# Uso:
#   ./scripts/demostracion.sh
#
# Requisitos: PostgreSQL 16 con PostGIS y pgvector, Redis, y `pnpm -r build`
# ya ejecutado. Las variables de abajo se pueden sobrescribir desde el entorno.
set -euo pipefail

BASE_DEMO="${BASE_DEMO:-paid_demostracion}"
URL_ADMIN="${DATABASE_URL_ADMIN_DEMO:-postgres://paid_migrador:clave_local@127.0.0.1:5432}"
PUERTO="${PUERTO_DEMO:-3210}"
RAIZ_ALMACEN="${PAID_ALMACEN_RAIZ:-/tmp/paid-demo-adjuntos}"
API="http://127.0.0.1:${PUERTO}/api"
IP="10.10.1.5"

raiz="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$raiz"

azul=$'\e[1;34m'; verde=$'\e[1;32m'; rojo=$'\e[1;31m'; gris=$'\e[0;90m'; fin=$'\e[0m'
paso() { printf '\n%s▸ %s%s\n' "$azul" "$1" "$fin"; }
ok()   { printf '  %s✓%s %s\n' "$verde" "$fin" "$1"; }
mal()  { printf '  %s✗%s %s\n' "$rojo" "$fin" "$1"; }
dato() { printf '    %s%s%s\n' "$gris" "$1" "$fin"; }

limpiar() {
  if [[ -n "${PID_API:-}" ]]; then kill "$PID_API" 2>/dev/null || true; fi
}
trap limpiar EXIT

# ── Base de datos desechable ─────────────────────────────────────────────────
paso "Preparando una base de datos desechable ($BASE_DEMO)"
psql "$URL_ADMIN/postgres" -qc "DROP DATABASE IF EXISTS $BASE_DEMO" >/dev/null
psql "$URL_ADMIN/postgres" -qc "CREATE DATABASE $BASE_DEMO" >/dev/null
ok "base creada"

paso "Aplicando las migraciones"
DATABASE_URL_ADMIN="$URL_ADMIN/$BASE_DEMO" node packages/db/dist/migrar.js | sed 's/^/    /'

paso "Sembrando catálogos, roles y datos de desarrollo"
PAID_SEMILLA_DESARROLLO=1 DATABASE_URL_ADMIN="$URL_ADMIN/$BASE_DEMO" \
  node packages/db/dist/sembrar.js | sed 's/^/    /'

# Rol de aplicación SIN privilegios: un superusuario ignora RLS y el
# aislamiento por unidad no se aplicaría.
psql "$URL_ADMIN/$BASE_DEMO" -q <<SQL >/dev/null
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='paid_demo_app') THEN
    CREATE ROLE paid_demo_app LOGIN PASSWORD 'demo' NOSUPERUSER NOBYPASSRLS;
  END IF;
END \$\$;
GRANT paid_operacion TO paid_demo_app;
SQL
ok "rol paid_demo_app creado (NOSUPERUSER NOBYPASSRLS)"

# ── Arranque de la API ───────────────────────────────────────────────────────
paso "Arrancando la API en el puerto $PUERTO"
mkdir -p "$RAIZ_ALMACEN"
DATABASE_URL="postgres://paid_demo_app:demo@127.0.0.1:5432/$BASE_DEMO" \
DATABASE_URL_ADMIN="$URL_ADMIN/$BASE_DEMO" \
API_PUERTO="$PUERTO" LOG_LEVEL=warn NODE_ENV=development \
PAID_ALMACEN_RAIZ="$RAIZ_ALMACEN" \
  node apps/api/dist/main.js > /tmp/paid-demo-api.log 2>&1 &
PID_API=$!

for _ in $(seq 1 40); do
  if curl -fsS "$API/salud" >/dev/null 2>&1; then break; fi
  sleep 0.5
done
if ! curl -fsS "$API/salud" >/dev/null 2>&1; then
  mal "la API no arrancó. Log:"; tail -20 /tmp/paid-demo-api.log; exit 1
fi
ok "API sana: $(curl -fsS "$API/salud")"
dato "(en el log del arranque está el aviso llamativo de R2: la red está abierta)"
grep -q 'LA RED NO ESTÁ CERRADA' /tmp/paid-demo-api.log && \
  ok "R2 — avisó de que seg.red_autorizada tiene un rango abierto (0.0.0.0/0)"

# ── 1 y 2. Captcha e ingreso ─────────────────────────────────────────────────
ingresar() {
  local credencial="$1"
  local reto id texto respuesta
  reto=$(curl -fsS -X POST "$API/autenticacion/reto" -H "X-Forwarded-For: $IP" \
         -H 'Content-Type: application/json' -d '{}')
  id=$(printf '%s' "$reto" | python3 -c 'import sys,json;print(json.load(sys.stdin)["idCaptcha"])')
  texto=$(printf '%s' "$reto" | python3 -c 'import sys,json;print(json.load(sys.stdin)["textoReto"])')
  # Se resuelve el reto aritmético, como haría una persona.
  respuesta=$(python3 -c "
import re,sys
t = '''$texto'''
m = re.match(r'(\d+)\s*([+-])\s*(\d+)', t)
a, op, b = int(m.group(1)), m.group(2), int(m.group(3))
print(a + b if op == '+' else a - b)
")
  # El texto del reto se deja en un archivo y no en una variable: esta funcion
  # se invoca dentro de $( ), que corre en una subshell, y una variable no
  # sobrevive a eso.
  printf '%s' "$texto" > /tmp/paid-demo-reto.txt
  curl -fsS -X POST "$API/autenticacion/ingreso" -H "X-Forwarded-For: $IP" \
    -H 'Content-Type: application/json' \
    -d "$(python3 -c "
import json
print(json.dumps({'credencial':'$credencial','clave':'Desarrollo2026*',
  'idCaptcha':'$id','respuestaCaptcha':'$respuesta'}))")"
}

paso "1) Pidiendo el reto de captcha y resolviéndolo (R3)"
ingreso=$(ingresar BIM23_PAID)
dato "reto resuelto: $(cat /tmp/paid-demo-reto.txt)"
TESTIGO=$(printf '%s' "$ingreso" | python3 -c 'import sys,json;print(json.load(sys.stdin)["testigo"])')
ok "ingresó BIM23_PAID"
printf '%s' "$ingreso" | python3 -c '
import sys, json
d = json.load(sys.stdin)
u = d["unidad"]
print("    unidad     : " + u["sigla"] + " — " + u["nombre"])
print("    roles      : " + ", ".join(d["roles"]))
print("    permisos   : " + str(len(d["permisos"])))
print("    expira en  : " + d["expiraEnUtc"] + "   (R1: 10 min deslizantes)")
print("    testigo    : " + d["testigo"][:16] + "...   (en la base solo queda su resumen SHA-256 — P7)")
'

aut() { curl -sS -H "X-Paid-Testigo: $TESTIGO" -H "X-Forwarded-For: $IP" "$@"; }

paso "2) Comprobando que el testigo NO está en claro en la base (P7)"
en_claro=$(psql "$URL_ADMIN/$BASE_DEMO" -tAc \
  "SELECT count(*) FROM seg.sesion s WHERE to_jsonb(s)::text LIKE '%${TESTIGO}%'")
if [[ "$en_claro" == "0" ]]; then
  ok "el testigo entregado no aparece en ninguna columna de seg.sesion"
else
  mal "el testigo aparece en la base"
fi

# ── 3. Registrar la jornada ──────────────────────────────────────────────────
paso "3) Registrando una jornada con su clavegrama y coordenadas GMS (R13)"
jornada=$(aut -X POST "$API/jornadas" -H 'Content-Type: application/json' -d '{
  "descripcion": "CLAVEGRAMA. Jornada de apoyo al desarrollo en el corregimiento de La Boquilla. Se entregaron 120 raciones alimentarias. Se atendieron 85 personas en consulta medica general. Participo la Fundacion El Futuro. Difusion por emisora comunitaria.",
  "fechaInicio": "05/03/2026",
  "fechaEjecucion": "05/03/2026",
  "lugar": "Corregimiento de La Boquilla, Cartagena",
  "latitudGrados": 10, "latitudMinutos": 23, "latitudSegundos": 27, "latitudHemisferio": "N",
  "longitudGrados": 75, "longitudMinutos": 30, "longitudSegundos": 51, "longitudHemisferio": "W",
  "coami": ["CARTAGENA"]
}')
ID=$(printf '%s' "$jornada" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
CODIGO=$(printf '%s' "$jornada" | python3 -c 'import sys,json;print(json.load(sys.stdin)["codigoActividad"])')
ok "jornada $ID creada"
dato "código de actividad: $CODIGO   (Q1: patrón <unidad>R<mes><año><sufijo de 5>)"
psql "$URL_ADMIN/$BASE_DEMO" -tAc "
SELECT '    GMS digitadas : ' || latitud_grados || '° ' || latitud_minutos || ''' ' ||
       latitud_segundos || '\" ' || latitud_hemisferio || '  /  ' ||
       longitud_grados || '° ' || longitud_minutos || ''' ' || longitud_segundos || '\" ' ||
       longitud_hemisferio || E'\n' ||
       '    decimales     : ' || latitud_decimal || ', ' || longitud_decimal ||
       '   (columnas GENERADAS: no se escriben, se derivan — P6)' || E'\n' ||
       '    punto ArcGIS  : ' || ST_AsText(ubicacion::geometry) || '   (también generado)'
  FROM ai.actividad WHERE id = $ID"

# ── 4. La cuota, antes de subir nada ─────────────────────────────────────────
paso "4) Consultando la cuota de adjuntos ANTES de intentar subir (R11)"
aut "$API/jornadas/$ID/adjuntos/cuota" | python3 -c '
import sys, json
d = json.load(sys.stdin)
def mb(b): return "%.1f MB" % (b / 1048576)
print("    usado      : " + mb(d["bytesUsados"]))
print("    disponible : " + mb(d["bytesDisponibles"]) + " de " + mb(d["cuotaTotalBytes"]))
print("    (la cuota de 10 MB es del TOTAL de la actividad, no de cada archivo)")
'

# ── 5. Las once pestañas ─────────────────────────────────────────────────────
paso "5) Llenando las once pestañas (R19)"
# Los catálogos que dependen de JACID se siembran vacíos a propósito (Q2/Q4),
# así que la demostración crea los suyos. En producción los entrega JACID.
psql "$URL_ADMIN/$BASE_DEMO" -q <<'SQL' >/dev/null
INSERT INTO ref.tipo_operacion    (codigo,nombre) VALUES ('APOYO_DESARROLLO','Apoyo al desarrollo') ON CONFLICT DO NOTHING;
INSERT INTO ref.servicio_prestado (codigo,nombre) VALUES ('CONSULTA_MEDICA','Consulta médica general') ON CONFLICT DO NOTHING;
INSERT INTO ref.grupo_poblacional (codigo,nombre) VALUES ('COMUNIDAD','Comunidad en general') ON CONFLICT DO NOTHING;
INSERT INTO ref.medio_difusion    (codigo,nombre) VALUES ('EMISORA','Emisora comunitaria') ON CONFLICT DO NOTHING;
INSERT INTO ref.medio_utilizado   (codigo,nombre) VALUES ('LANCHA','Lancha') ON CONFLICT DO NOTHING;
INSERT INTO ref.tipo_recurso      (codigo,nombre) VALUES ('COMBUSTIBLE','Combustible') ON CONFLICT DO NOTHING;
INSERT INTO ref.tipo_bien_donado  (codigo,nombre) VALUES ('RACIONES','Raciones alimentarias') ON CONFLICT DO NOTHING;
SQL
# ⚠️ Envuelto en un CTE a proposito. Con `psql -tAc "INSERT ... RETURNING id"`,
# psql imprime el valor devuelto Y la etiqueta del comando («INSERT 0 1»), asi
# que la variable acaba valiendo $'2\nINSERT 0 1' y el JSON que se compone con
# ella esta roto. Envolverlo en un CTE lo convierte en un SELECT, que no lleva
# etiqueta.
ID_ENTIDAD=$(psql "$URL_ADMIN/$BASE_DEMO" -tAc "
  WITH nueva AS (
    INSERT INTO ai.entidad (id_tipo_entidad, nombre, id_unidad, id_estado_registro)
    VALUES ((SELECT id FROM ref.tipo_entidad WHERE codigo='ONG'),
            'Fundación El Futuro',
            (SELECT id FROM org.unidad WHERE sigla='BIM23'),
            (SELECT id FROM ref.estado_registro WHERE codigo='ACTIVO'))
    RETURNING id
  )
  SELECT id FROM nueva")
cat_id() { psql "$URL_ADMIN/$BASE_DEMO" -tAc "SELECT id FROM ref.$1 WHERE codigo='$2'"; }

pestana() {
  local nombre="$1" cuerpo="$2" respuesta codigo texto
  # `curl -s` sin `-f` devuelve 0 aunque el servidor responda 4xx, asi que hay
  # que mirar el CODIGO. La primera version de este guion daba un ✓ por
  # respuestas 400, que es exactamente el tipo de falso positivo que esta
  # demostracion no puede permitirse.
  respuesta=$(aut -w $'\n%{http_code}' -X POST "$API/jornadas/$ID/pestanas/$nombre" \
              -H 'Content-Type: application/json' -d "$cuerpo")
  codigo=$(printf '%s' "$respuesta" | tail -1)
  texto=$(printf '%s' "$respuesta" | sed '$d')
  if [[ "$codigo" == "201" ]]; then
    ok "$nombre"
  else
    mal "$nombre  (HTTP $codigo)"
    dato "$texto"
  fi
}
pestana TIPO_OPERACION        "{\"idTipoOperacion\":$(cat_id tipo_operacion APOYO_DESARROLLO)}"
pestana ENTIDADES_SERVICIOS   "{\"idEntidad\":$ID_ENTIDAD}"
pestana SERVICIOS_PRESTADOS   "{\"idServicioPrestado\":$(cat_id servicio_prestado CONSULTA_MEDICA),\"cantidad\":85}"
pestana POBLACION_BENEFICIADA "{\"idGrupoPoblacional\":$(cat_id grupo_poblacional COMUNIDAD),\"cantidadPersonas\":120}"
pestana ENTIDADES_APOYADAS    "{\"idEntidad\":$ID_ENTIDAD}"
pestana MEDIOS_DIFUSION       "{\"idMedioDifusion\":$(cat_id medio_difusion EMISORA),\"detalle\":\"Emisora comunitaria\"}"
pestana MEDIOS_UTILIZADOS     "{\"idMedioUtilizado\":$(cat_id medio_utilizado LANCHA),\"cantidad\":2}"
pestana RECURSOS_UTILIZADOS   "{\"idTipoRecurso\":$(cat_id tipo_recurso COMBUSTIBLE),\"cantidad\":40,\"unidadMedida\":\"galones\"}"
pestana BIENES_DONADOS        "{\"idTipoBienDonado\":$(cat_id tipo_bien_donado RACIONES),\"descripcion\":\"120 raciones alimentarias\",\"cantidad\":120}"
pestana RESUMEN               "{\"texto\":\"Resumen JAD de la jornada en La Boquilla.\"}"

estado_pestanas() {
  aut "$API/jornadas/$ID/pestanas" | python3 -c '
import sys, json
d = json.load(sys.stdin)
marca = "SÍ" if d["registroCompleto"] else "NO"
faltan = d["faltantes"]
print("    registro_completo = " + marca + "   ·  faltan " + str(len(faltan)) +
      ": " + (", ".join(faltan) if faltan else "—"))
'
}
printf '\n  Con diez de once pestañas:\n'; estado_pestanas

# ── El adjunto, con su MIME real ─────────────────────────────────────────────
paso "6) Subiendo un adjunto — se valida el CONTENIDO real, no la extensión (R12)"
printf '%%PDF-1.4\n' > /tmp/paid-demo-acta.pdf
head -c 2048 /dev/zero | tr '\0' ' ' >> /tmp/paid-demo-acta.pdf

printf '  Primero, un ejecutable renombrado a .jpg:\n'
respuesta=$(printf 'MZ' > /tmp/paid-demo-falso.jpg; head -c 400 /dev/zero >> /tmp/paid-demo-falso.jpg
  aut -o /dev/null -w '%{http_code}' -X POST "$API/jornadas/$ID/adjuntos" \
      -F 'faseDocumental=1' -F 'archivo=@/tmp/paid-demo-falso.jpg')
[[ "$respuesta" == "415" ]] && ok "RECHAZADO con HTTP 415 — el contenido no es una imagen" \
                            || mal "se esperaba 415, llegó $respuesta"

printf '\n  Ahora, un PDF que de verdad es PDF:\n'
adjunto=$(aut -X POST "$API/jornadas/$ID/adjuntos" \
  -F 'faseDocumental=1' -F 'archivo=@/tmp/paid-demo-acta.pdf')
printf '%s' "$adjunto" | python3 -c '
import sys, json
d = json.load(sys.stdin)
print("    aceptado   : " + d["nombreArchivo"] + " (" + d["categoria"] + ")")
print("    MIME real  : " + d["mimeDetectado"])
print("    sha256     : " + d["hashSha256"][:32] + "...")
print("    cuota      : " + str(d["cuota"]["bytesUsados"]) + " bytes usados")
'

printf '\n  Con las ONCE pestañas:\n'; estado_pestanas

# ── 7. Exportación ───────────────────────────────────────────────────────────
paso "7) Exportando el consolidado a CSV"
aut -o /tmp/paid-demo.csv -D /tmp/paid-demo-cabeceras.txt "$API/jornadas/exportacion/csv"
# El CSV usa CRLF y no termina en salto de linea, asi que `wc -l` cuenta uno
# menos. Se cuentan los CR.
ok "$(tr -cd '\r' < /tmp/paid-demo.csv | wc -c) filas · $(wc -c < /tmp/paid-demo.csv) bytes"
dato "primeras dos líneas:"
head -2 /tmp/paid-demo.csv | cut -c1-150 | sed 's/^/      /'
psql "$URL_ADMIN/$BASE_DEMO" -tAc "
SELECT '    aud.exportacion: ' || modulo || ' ' || formato || ', ' ||
       cantidad_filas || ' filas, usuario ' || id_usuario || ', filtros ' || filtros
  FROM aud.exportacion ORDER BY id DESC LIMIT 1"

# ── 8. Aislamiento por unidad ────────────────────────────────────────────────
paso "8) Aislamiento por unidad: ¿qué ve la unidad hermana? (R6)"
propias=$(aut "$API/jornadas?porPagina=100" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)["filas"]))')
ok "BIM23 ve $propias jornada(s)"
ingreso24=$(ingresar BIM24_PAID)
TESTIGO24=$(printf '%s' "$ingreso24" | python3 -c 'import sys,json;print(json.load(sys.stdin)["testigo"])')
ajenas=$(curl -sS -H "X-Paid-Testigo: $TESTIGO24" -H "X-Forwarded-For: $IP" \
         "$API/jornadas?porPagina=100" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)["filas"]))')
if [[ "$ajenas" == "0" ]]; then
  ok "BIM24 ve $ajenas — no puede ver nada de su hermana, y lo impide la BASE DE DATOS (RLS), no el servicio"
else
  mal "BIM24 ve $ajenas jornadas de otra unidad"
fi

# ── 9. La bitácora ───────────────────────────────────────────────────────────
paso "9) La bitácora, alimentada por disparador (R15)"
psql "$URL_ADMIN/$BASE_DEMO" -c "
SELECT tabla, operacion AS op, count(*) AS filas
  FROM aud.bitacora_cambio
 WHERE esquema = 'ai'
 GROUP BY tabla, operacion
 ORDER BY tabla" | sed 's/^/    /'
psql "$URL_ADMIN/$BASE_DEMO" -tAc "
SELECT '    Ejemplo — la creación de la jornada quedó con: usuario ' || id_usuario ||
       ', unidad ' || id_unidad || ', sesión ' || left(id_sesion, 8) || '..., IP ' || direccion_ip
  FROM aud.bitacora_cambio
 WHERE tabla = 'jornada_apoyo' AND operacion = 'I' ORDER BY id DESC LIMIT 1"
dato "y nadie puede modificarla: probemos, incluso como superusuario ⟶"
# El resultado se guarda en una variable y no se canaliza a `grep` dentro del
# `if`: con `set -o pipefail`, psql sale con codigo 3 al rechazar el DELETE y
# la tuberia entera se considera fallida aunque el grep SI haya encontrado el
# mensaje. La primera version de este guion informaba «la bitácora admitió un
# DELETE» cuando en realidad lo habia rechazado correctamente.
salida_delete=$(psql "$URL_ADMIN/$BASE_DEMO" -qc \
  "DELETE FROM aud.bitacora_cambio WHERE id = (SELECT min(id) FROM aud.bitacora_cambio)" 2>&1 || true)
if printf '%s' "$salida_delete" | grep -q 'solo insercion'; then
  ok "el DELETE fue RECHAZADO — la bitácora es de solo inserción"
  dato "$(printf '%s' "$salida_delete" | head -1)"
else
  mal "la bitácora admitió un DELETE"
  dato "$salida_delete"
fi

# ── 10. Cierre ───────────────────────────────────────────────────────────────
paso "10) Cerrando la sesión"
aut -o /dev/null -w '' -X POST "$API/autenticacion/salida"
codigo=$(aut -o /dev/null -w '%{http_code}' "$API/jornadas")
[[ "$codigo" == "401" ]] && ok "el testigo ya no sirve (HTTP 401)" || mal "esperaba 401, llegó $codigo"
psql "$URL_ADMIN/$BASE_DEMO" -tAc "
SELECT '    seg.sesion: motivo de cierre = ' || motivo_cierre
  FROM seg.sesion ORDER BY creada_en DESC LIMIT 1"

printf '\n%s╭──────────────────────────────────────────────────────────────╮%s\n' "$verde" "$fin"
printf '%s│  Demostración terminada.                                     │%s\n' "$verde" "$fin"
printf '%s╰──────────────────────────────────────────────────────────────╯%s\n' "$verde" "$fin"
printf '\n  La base de datos «%s» queda en pie para inspeccionarla:\n' "$BASE_DEMO"
printf '    psql "%s/%s"\n\n' "$URL_ADMIN" "$BASE_DEMO"
printf '  El CSV exportado: /tmp/paid-demo.csv\n'
printf '  El log de la API: /tmp/paid-demo-api.log\n\n'
