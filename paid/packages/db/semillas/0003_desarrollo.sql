-- ═══════════════════════════════════════════════════════════════════════════
-- Datos de DESARROLLO.
--
-- ⚠️ ESTE ARCHIVO NO DEBE EJECUTARSE EN PRODUCCION.
--
-- `sembrar.ts` lo omite salvo que `PAID_SEMILLA_DESARROLLO=1`. Contiene
-- credenciales con clave conocida: en un despliegue expuesto a internet, eso
-- es una puerta abierta. El fichero no corre por omision.
--
-- La red abierta ya no esta aqui: la siembra `0004_red_abierta.sql` en todo
-- entorno (D-38).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Arbol de unidades de ejemplo ───────────────────────────────────────────
--
-- Los codigos son NUMERICOS y estan tomados de los ejemplos de codigo de
-- actividad de Q1 (2813304, 1111853, 2510444, 6102320). No es cosmetica: el
-- generador de `codigo_actividad` usa `org.unidad.codigo` tal cual, asi que un
-- codigo de unidad con guiones producia codigos de actividad que no se parecen
-- a los observados. Con estos, las semillas ejercitan el patron real.
--
-- TODO(JACID) Q1: sigue sin confirmarse que el primer bloque del codigo de
-- actividad SEA el codigo de la unidad, ni de que catalogo sale.
--
-- FNP (Fuerza) -> CFM (Componente) -> { BIM23, BIM24 }
-- BIM23 y BIM24 son HERMANAS: es el par con el que se comprueba que R6 no se
-- cruza.
INSERT INTO org.unidad (codigo, sigla, nombre, id_nivel_jerarquia, id_unidad_superior,
                        ruta_jerarquica, id_estado_registro)
VALUES ('6102320', 'FNP', 'Fuerza Naval del Pacifico',
        (SELECT id FROM ref.nivel_jerarquia WHERE codigo = 'FUERZA'), NULL,
        'pendiente', (SELECT id FROM ref.estado_registro WHERE codigo = 'ACTIVO'))
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO org.unidad (codigo, sigla, nombre, id_nivel_jerarquia, id_unidad_superior,
                        ruta_jerarquica, id_estado_registro)
VALUES ('2510444', 'CFM', 'Comando de Infanteria de Marina',
        (SELECT id FROM ref.nivel_jerarquia WHERE codigo = 'COMPONENTE'),
        (SELECT id FROM org.unidad WHERE codigo = '6102320'),
        'pendiente', (SELECT id FROM ref.estado_registro WHERE codigo = 'ACTIVO'))
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO org.unidad (codigo, sigla, nombre, id_nivel_jerarquia, id_unidad_superior,
                        ruta_jerarquica, id_estado_registro)
SELECT v.codigo, v.sigla, v.nombre,
       (SELECT id FROM ref.nivel_jerarquia WHERE codigo = 'UNIDAD_TACTICA'),
       (SELECT id FROM org.unidad WHERE codigo = '2510444'),
       'pendiente', (SELECT id FROM ref.estado_registro WHERE codigo = 'ACTIVO')
FROM (VALUES
  ('2813304', 'BIM23', 'Batallon de Infanteria de Marina No. 23'),
  ('1111853', 'BIM24', 'Batallon de Infanteria de Marina No. 24')
) AS v(codigo, sigla, nombre)
ON CONFLICT (codigo) DO NOTHING;

-- ── Credenciales de unidad (R5) ────────────────────────────────────────────
--
-- Clave de todas: `Desarrollo2026*`
-- El resumen es Argon2id, como exige el CHECK de seg.usuario. Se deja fijo y
-- no generado, para que las semillas sean reproducibles.
INSERT INTO seg.usuario (credencial, hash_clave, id_unidad, id_estado_registro, clave_expira_en)
SELECT v.credencial,
       '$argon2id$v=19$m=19456,t=2,p=1$ra4Ce8kJvtVCfvOhyZ81RA$Q5QdJUz6AKmXxdYDiyrh3qlhvnrRaOSLvAcWK1orJHU',
       (SELECT id FROM org.unidad WHERE codigo = v.unidad),
       (SELECT id FROM ref.estado_registro WHERE codigo = 'ACTIVO'),
       NULL
FROM (VALUES
  ('ADMIN_PAID',      '6102320'),
  ('FUNCIONAL_PAID',  '6102320'),
  ('FNP_PAID',        '6102320'),
  ('BIM23_PAID',      '2813304'),
  ('BIM24_PAID',      '1111853')
) AS v(credencial, unidad)
ON CONFLICT (credencial) DO NOTHING;

-- ── Asignacion de roles, con vigencia abierta (P4) ─────────────────────────
INSERT INTO seg.usuario_rol (id_usuario, id_rol)
SELECT u.id, r.id
FROM (VALUES
  ('ADMIN_PAID',     'ADMINISTRADOR'),
  ('FUNCIONAL_PAID', 'FUNCIONAL_JACID'),
  ('FNP_PAID',       'OPERADOR_UNIDAD'),
  ('BIM23_PAID',     'OPERADOR_UNIDAD'),
  ('BIM24_PAID',     'OPERADOR_UNIDAD')
) AS v(credencial, rol)
JOIN seg.usuario u ON u.credencial = v.credencial
JOIN seg.rol r ON r.codigo = v.rol
ON CONFLICT DO NOTHING;
