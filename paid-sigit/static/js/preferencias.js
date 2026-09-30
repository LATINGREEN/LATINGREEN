// Aplica las preferencias de presentación antes de pintar, para que no haya un
// destello del tema claro al abrir cada página. Son comodidades del equipo en
// el que se trabaja (tema, contraste, tamaño de letra, menú plegado): nada de
// la sesión ni de los datos vive en localStorage.
(function () {
  'use strict';
  var raiz = document.documentElement;
  function leer(clave) {
    try { return window.localStorage.getItem('sigit.' + clave); } catch (e) { return null; }
  }
  var tema = leer('tema');
  if (tema === 'oscuro' || (tema === null && window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    raiz.setAttribute('data-tema', 'oscuro');
  }
  if (leer('contraste') === 'alto') raiz.setAttribute('data-contraste', 'alto');
  if (leer('lateral') === 'plegado') raiz.setAttribute('data-lateral', 'plegado');
  var escala = parseFloat(leer('escala') || '1');
  if (escala >= 0.9 && escala <= 1.4) raiz.style.setProperty('--escala', String(escala));
})();
