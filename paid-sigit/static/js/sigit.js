// PAID SIGIT · comportamiento común de la interfaz.
// Sin dependencias salvo htmx. Todo el JavaScript vive en archivos estáticos:
// la política de seguridad de contenido no admite scripts en línea.
(function () {
  'use strict';

  var raiz = document.documentElement;

  function guardar(clave, valor) {
    try { window.localStorage.setItem('sigit.' + clave, valor); } catch (e) { /* modo privado */ }
  }

  // ── Accesibilidad y presentación ─────────────────────────────────────────
  function alternar(atributo, valor, clave) {
    var activo = raiz.getAttribute(atributo) === valor;
    if (activo) raiz.removeAttribute(atributo); else raiz.setAttribute(atributo, valor);
    guardar(clave, activo ? 'no' : valor);
    document.dispatchEvent(new CustomEvent('sigit:tema'));
    return !activo;
  }

  function escala(delta) {
    var actual = parseFloat(getComputedStyle(raiz).getPropertyValue('--escala')) || 1;
    var nueva = Math.min(1.4, Math.max(0.9, Math.round((actual + delta) * 10) / 10));
    raiz.style.setProperty('--escala', String(nueva));
    guardar('escala', String(nueva));
    document.dispatchEvent(new CustomEvent('sigit:tema'));
  }

  function reflejarEstado() {
    var tema = document.querySelector('[data-accion="tema"]');
    var contraste = document.querySelector('[data-accion="contraste"]');
    if (tema) tema.setAttribute('aria-pressed', String(raiz.getAttribute('data-tema') === 'oscuro'));
    if (contraste) contraste.setAttribute('aria-pressed', String(raiz.getAttribute('data-contraste') === 'alto'));
  }

  document.addEventListener('click', function (evento) {
    var boton = evento.target.closest('[data-accion]');
    if (!boton) return;
    switch (boton.getAttribute('data-accion')) {
      case 'tema': alternar('data-tema', 'oscuro', 'tema'); reflejarEstado(); break;
      case 'contraste': alternar('data-contraste', 'alto', 'contraste'); reflejarEstado(); break;
      case 'letra-mas': escala(0.1); break;
      case 'letra-menos': escala(-0.1); break;
      case 'plegar': alternar('data-lateral', 'plegado', 'lateral'); break;
      case 'menu':
        raiz.setAttribute('data-menu', raiz.getAttribute('data-menu') === 'abierto' ? 'cerrado' : 'abierto');
        break;
      case 'paleta': abrirPaleta(); break;
      case 'cerrar-notificacion': boton.closest('.notificacion').remove(); break;
      default: break;
    }
  });

  // ── Paleta de órdenes (Ctrl+K) ───────────────────────────────────────────
  var paleta, entrada, lista, destinos = [], seleccion = 0, temporizador;

  function abrirPaleta() {
    if (!paleta) return;
    paleta.showModal();
    entrada.value = '';
    pintar(destinos, []);
    entrada.focus();
  }

  function elemento(texto, url, detalle) {
    var li = document.createElement('li');
    var a = document.createElement('a');
    a.href = url;
    a.setAttribute('role', 'option');
    a.textContent = texto;
    if (detalle) {
      var s = document.createElement('small');
      s.textContent = detalle;
      a.appendChild(s);
    }
    li.appendChild(a);
    return li;
  }

  function pintar(secciones, jornadas) {
    lista.replaceChildren();
    secciones.forEach(function (d) { lista.appendChild(elemento(d.t, d.u, 'Sección')); });
    jornadas.forEach(function (j) { lista.appendChild(elemento(j.codigo + ' · ' + j.lugar, j.url, j.fecha)); });
    seleccion = 0;
    marcar();
  }

  function marcar() {
    var opciones = lista.querySelectorAll('a');
    opciones.forEach(function (a, i) { a.setAttribute('aria-selected', String(i === seleccion)); });
    if (opciones[seleccion]) opciones[seleccion].scrollIntoView({ block: 'nearest' });
  }

  function buscar() {
    var texto = entrada.value.trim().toLowerCase();
    var secciones = destinos.filter(function (d) { return d.t.toLowerCase().indexOf(texto) !== -1; });
    if (texto.length < 2) { pintar(secciones, []); return; }
    clearTimeout(temporizador);
    temporizador = setTimeout(function () {
      fetch(lista.getAttribute('data-fuente') + '?q=' + encodeURIComponent(texto), {
        headers: { 'Accept': 'application/json' }, credentials: 'same-origin'
      }).then(function (r) { return r.ok ? r.json() : { resultados: [] }; })
        .then(function (datos) { pintar(secciones, datos.resultados || []); })
        .catch(function () { pintar(secciones, []); });
    }, 180);
  }

  document.addEventListener('keydown', function (evento) {
    if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k') {
      evento.preventDefault();
      abrirPaleta();
    }
  });

  // ── Reloj de sesión: 10 minutos deslizantes, evaluados en el servidor ────
  // El reloj solo AVISA. Quien decide si la sesión sigue viva es el servidor;
  // cada petición la renueva. A los 2 minutos del final se ofrece renovarla.
  function relojSesion() {
    var reloj = document.querySelector('.reloj-sesion');
    if (!reloj) return;
    var total = parseInt(reloj.getAttribute('data-segundos'), 10) * 60;
    var fin = Date.now() + total * 1000;
    var avisado = false;

    function reiniciar() { fin = Date.now() + total * 1000; avisado = false; reloj.removeAttribute('data-alerta'); }
    document.body.addEventListener('htmx:afterRequest', reiniciar);

    setInterval(function () {
      var restante = Math.max(0, Math.round((fin - Date.now()) / 1000));
      var m = Math.floor(restante / 60), s = restante % 60;
      reloj.textContent = 'Sesión: ' + m + ':' + (s < 10 ? '0' : '') + s;
      if (restante <= 120 && !avisado) {
        avisado = true;
        reloj.setAttribute('data-alerta', '');
        notificar('Su sesión se cierra en 2 minutos por inactividad.', 'warning', 'Seguir trabajando', function () {
          fetch(reloj.getAttribute('data-renovar'), {
            method: 'POST', credentials: 'same-origin',
            headers: { 'X-CSRFToken': token() }
          }).then(function (r) { if (r.ok) reiniciar(); });
        });
      }
      if (restante === 0) window.location.assign(reloj.getAttribute('data-salir'));
    }, 1000);
  }

  function token() {
    var h = document.body.getAttribute('hx-headers');
    try { return JSON.parse(h)['X-CSRFToken']; } catch (e) { return ''; }
  }

  function notificar(texto, tipo, accion, alPulsar) {
    var zona = document.querySelector('.notificaciones');
    if (!zona) return;
    var caja = document.createElement('div');
    caja.className = 'notificacion ' + (tipo || '');
    caja.setAttribute('role', 'status');
    var span = document.createElement('span');
    span.textContent = texto;
    caja.appendChild(span);
    if (accion) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'boton pequeno';
      b.textContent = accion;
      b.addEventListener('click', function () { alPulsar(); caja.remove(); });
      caja.appendChild(b);
    }
    var cerrar = document.createElement('button');
    cerrar.type = 'button';
    cerrar.setAttribute('aria-label', 'Cerrar');
    cerrar.textContent = '×';
    cerrar.addEventListener('click', function () { caja.remove(); });
    caja.appendChild(cerrar);
    zona.appendChild(caja);
  }
  window.sigitNotificar = notificar;

  // ── Coordenadas GMS: vista previa en decimal y control «dentro de Colombia»
  function vistaPreviaGms(contenedor) {
    var salida = contenedor.querySelector('.vista-previa-coord');
    if (!salida) return;
    function valor(nombre) {
      var campo = contenedor.querySelector('[name$="' + nombre + '"]');
      return campo ? campo.value : '';
    }
    function calcular(prefijo) {
      var g = valor(prefijo + '_grados'), m = valor(prefijo + '_minutos'), s = valor(prefijo + '_segundos'),
          h = valor(prefijo + '_hemisferio');
      if (g === '' || m === '' || s === '' || h === '') return null;
      var d = Number(g) + Number(m) / 60 + Number(s) / 3600;
      return (h === 'S' || h === 'W') ? -d : d;
    }
    function actualizar() {
      var lat = calcular('latitud'), lon = calcular('longitud');
      if (lat === null || lon === null || isNaN(lat) || isNaN(lon)) {
        salida.textContent = 'Complete grados, minutos, segundos y hemisferio.';
        salida.removeAttribute('data-estado');
        return;
      }
      var dentro = lat >= -4.3 && lat <= 16.2 && lon >= -82.2 && lon <= -66.8;
      salida.textContent = lat.toFixed(6) + ', ' + lon.toFixed(6) + (dentro ? ' · dentro de Colombia' : ' · FUERA de Colombia: revise el hemisferio');
      salida.setAttribute('data-estado', dentro ? 'dentro' : 'fuera');
    }
    contenedor.addEventListener('input', actualizar);
    contenedor.addEventListener('change', actualizar);
    actualizar();
  }

  function iniciar(ambito) {
    ambito.querySelectorAll('[data-gms]').forEach(vistaPreviaGms);
    // Una confirmación nativa para acciones que no se deshacen con un clic.
    ambito.querySelectorAll('form[data-confirmar]').forEach(function (f) {
      f.addEventListener('submit', function (e) {
        if (!window.confirm(f.getAttribute('data-confirmar'))) e.preventDefault();
      });
    });
    // Filtros que se aplican solos al cambiar un desplegable.
    ambito.querySelectorAll('form[data-autoenviar] select').forEach(function (s) {
      s.addEventListener('change', function () { s.form.requestSubmit(); });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    paleta = document.getElementById('paleta');
    if (paleta) {
      entrada = document.getElementById('paleta-busqueda');
      lista = document.getElementById('paleta-resultados');
      try { destinos = JSON.parse(lista.getAttribute('data-destinos')); } catch (e) { destinos = []; }
      entrada.addEventListener('input', buscar);
      entrada.addEventListener('keydown', function (e) {
        var opciones = lista.querySelectorAll('a');
        if (e.key === 'ArrowDown') { seleccion = Math.min(opciones.length - 1, seleccion + 1); marcar(); e.preventDefault(); }
        if (e.key === 'ArrowUp') { seleccion = Math.max(0, seleccion - 1); marcar(); e.preventDefault(); }
        if (e.key === 'Enter' && opciones[seleccion]) { window.location.assign(opciones[seleccion].href); }
        // En un campo de búsqueda, el primer Esc solo borra el texto: se cierra a mano.
        if (e.key === 'Escape') { e.preventDefault(); paleta.close(); }
      });
    }
    reflejarEstado();
    relojSesion();
    iniciar(document);
    // Las notificaciones de éxito se retiran solas; los errores se quedan.
    document.querySelectorAll('.notificacion.success, .notificacion.info').forEach(function (n) {
      setTimeout(function () { n.remove(); }, 6000);
    });
  });

  document.addEventListener('htmx:afterSwap', function (e) { iniciar(e.target); });
})();
