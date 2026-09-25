-- ═══════════════════════════════════════════════════════════════════════════
-- R2 — Red abierta: el ingreso procede desde cualquier dirección (D-38).
--
-- La PAID puede desplegarse en internet, y ahí no hay un rango que cerrar:
-- quien entra lo decide la credencial, la clave, el captcha y el bloqueo por
-- intentos (R3, R4), no la red. Estos dos rangos lo hacen explícito, en la
-- tabla y no en el código, para que se vea y se pueda cambiar.
--
-- Para cerrar la red —un despliegue en la Intranet ARC, por ejemplo— se
-- registran los rangos propios en `seg.red_autorizada` y se desactivan estos
-- dos (`activo = false`). El arranque de la API dice cuál está en vigor.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO seg.red_autorizada (rango, id_tipo_red, descripcion)
VALUES
  ('0.0.0.0/0',
   (SELECT id FROM ref.tipo_red WHERE codigo = 'ADMINISTRACION'),
   'Red abierta: cualquier dirección IPv4 (D-38).'),
  ('::/0',
   (SELECT id FROM ref.tipo_red WHERE codigo = 'ADMINISTRACION'),
   'Red abierta: cualquier dirección IPv6 (D-38).')
ON CONFLICT (rango) DO NOTHING;
