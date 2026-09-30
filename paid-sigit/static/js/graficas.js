// PAID SIGIT · gráficas interactivas con Apache ECharts (servido localmente).
//
// Los datos llegan en <script type="application/json">, que el navegador no
// ejecuta: así la política de seguridad de contenido sigue sin admitir scripts
// en línea. Cada gráfica filtra al pulsarla (exploración por clic).
(function () {
  'use strict';

  var PALETA_CLARA = ['#00205B', '#D4AF37', '#3A5A94', '#C8102E', '#6B8AC9', '#8A6D1E', '#9FB3D6', '#146C43', '#5B6B8C', '#E6C766'];
  var PALETA_OSCURA = ['#8FB0FF', '#D4AF37', '#5FD39B', '#FF7B8E', '#C9D6F2', '#F2D675', '#7FA0E0', '#FFB86B', '#B39DDB', '#80CBC4'];
  var instancias = [];

  function css(nombre) {
    return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
  }
  function oscuro() { return document.documentElement.getAttribute('data-tema') === 'oscuro'; }
  function altoContraste() { return document.documentElement.getAttribute('data-contraste') === 'alto'; }
  function numero(v) { return new Intl.NumberFormat('es-CO').format(v); }
  function moneda(v) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
  }

  function base() {
    var texto = css('--texto'), suave = css('--texto-suave'), borde = css('--borde');
    var escala = parseFloat(css('--escala')) || 1;
    return {
      color: oscuro() ? PALETA_OSCURA : PALETA_CLARA,
      textStyle: { fontFamily: 'Atkinson Hyperlegible, sans-serif', color: texto, fontSize: Math.round(12 * escala) },
      // En alto contraste, además del color, texturas: nada depende solo del color.
      aria: { enabled: true, decal: { show: altoContraste() } },
      // Información emergente dibujada en el lienzo, no en HTML: el HTML que
      // genera ECharts trae estilos en línea, que la CSP no admite.
      tooltip: {
        renderMode: 'richText', backgroundColor: css('--superficie'), borderColor: borde,
        borderWidth: 1, padding: [8, 12], textStyle: { color: texto }
      },
      grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
      legend: { textStyle: { color: suave }, top: 0 },
      animationDuration: 600, animationEasing: 'cubicOut',
      _eje: { axisLine: { lineStyle: { color: borde } }, axisLabel: { color: suave },
              splitLine: { lineStyle: { color: borde, type: 'dashed' } } }
    };
  }

  function eje(b, extra) { return Object.assign({}, b._eje, extra || {}); }

  function filtrar(parametros) {
    var url = new URL(window.location.href);
    Object.keys(parametros).forEach(function (k) {
      if (parametros[k] === null || parametros[k] === '') url.searchParams.delete(k);
      else url.searchParams.set(k, parametros[k]);
    });
    url.searchParams.delete('pagina');
    window.location.assign(url.toString());
  }

  function finDeMes(clave) {
    var partes = clave.split('-');
    var fin = new Date(Number(partes[0]), Number(partes[1]), 0);
    return clave + '-' + String(fin.getDate()).padStart(2, '0');
  }

  // ── Constructores por tipo de gráfica ─────────────────────────────────────
  var constructores = {
    meses: function (d, b) {
      var datos = d.meses;
      return {
        opcion: Object.assign(b, {
          tooltip: Object.assign(b.tooltip, { trigger: 'axis' }),
          legend: Object.assign(b.legend, { data: ['Jornadas', 'Personas beneficiadas'] }),
          grid: Object.assign(b.grid, { bottom: datos.length > 14 ? 48 : 8 }),
          dataZoom: datos.length > 14 ? [{ type: 'slider', height: 20, bottom: 8 }, { type: 'inside' }] : [],
          xAxis: eje(b, { type: 'category', data: datos.map(function (m) { return m.etiqueta; }) }),
          yAxis: [eje(b, { type: 'value', name: 'Jornadas', minInterval: 1 }),
                  eje(b, { type: 'value', name: 'Personas', splitLine: { show: false } })],
          series: [
            { name: 'Jornadas', type: 'bar', barMaxWidth: 28, itemStyle: { borderRadius: [6, 6, 0, 0] },
              data: datos.map(function (m) { return m.jornadas; }) },
            { name: 'Personas beneficiadas', type: 'line', yAxisIndex: 1, smooth: true, symbolSize: 7,
              areaStyle: { opacity: 0.12 }, data: datos.map(function (m) { return m.personas; }) }
          ]
        }),
        clic: function (p) {
          var m = datos[p.dataIndex];
          if (m) filtrar({ desde: m.clave + '-01', hasta: finDeMes(m.clave) });
        }
      };
    },
    tipos: function (d, b) {
      return {
        opcion: Object.assign(b, {
          tooltip: Object.assign(b.tooltip, { trigger: 'item', formatter: '{b}: {c} ({d} %)' }),
          legend: Object.assign(b.legend, { bottom: 0, top: 'auto', formatter: function (nombre) {
            var t = d.tipos.filter(function (x) { return x.nombre === nombre; })[0];
            var total = d.tipos.reduce(function (s, x) { return s + x.n; }, 0);
            return t ? nombre + ' · ' + Math.round(t.n * 100 / total) + ' %' : nombre;
          } }),
          series: [{ type: 'pie', radius: ['48%', '74%'], center: ['50%', '45%'], padAngle: 2,
            itemStyle: { borderRadius: 8, borderColor: css('--superficie'), borderWidth: 2 },
            label: { show: false }, emphasis: { label: { show: true, formatter: '{b}\n{d} %',
              fontSize: 16, fontWeight: 'bold', color: css('--texto') } },
            data: d.tipos.map(function (t) { return { name: t.nombre, value: t.n, id: t.id }; }) }]
        }),
        clic: function (p) { filtrar({ tipo: p.data.id }); }
      };
    },
    departamentos: function (d, b) {
      var datos = d.departamentos.slice().reverse();
      return {
        opcion: Object.assign(b, {
          tooltip: Object.assign(b.tooltip, { trigger: 'axis', axisPointer: { type: 'shadow' } }),
          xAxis: eje(b, { type: 'value', minInterval: 1 }),
          yAxis: eje(b, { type: 'category', data: datos.map(function (x) { return x.nombre.length > 26 ? x.nombre.slice(0, 24) + '…' : x.nombre; }) }),
          series: [{ type: 'bar', name: 'Jornadas', barMaxWidth: 22, itemStyle: { borderRadius: [0, 6, 6, 0] },
            label: { show: true, position: 'right', color: css('--texto-suave') },
            data: datos.map(function (x) { return { value: x.n, id: x.id }; }) }]
        }),
        clic: function (p) { filtrar({ departamento: p.data.id }); }
      };
    },
    unidades: function (d, b) {
      return {
        opcion: Object.assign(b, {
          tooltip: Object.assign(b.tooltip, { trigger: 'axis', axisPointer: { type: 'shadow' } }),
          xAxis: eje(b, { type: 'category', data: d.unidades.map(function (u) { return u.nombre; }) }),
          yAxis: eje(b, { type: 'value', minInterval: 1 }),
          series: [{ type: 'bar', name: 'Jornadas', barMaxWidth: 48, colorBy: 'data',
            itemStyle: { borderRadius: [6, 6, 0, 0] }, label: { show: true, position: 'top' },
            data: d.unidades.map(function (u) { return { value: u.n, id: u.id }; }) }]
        }),
        clic: function (p) { filtrar({ unidad: p.data.id }); }
      };
    },
    grupos: function (d, b) {
      return {
        opcion: Object.assign(b, {
          tooltip: Object.assign(b.tooltip, { formatter: function (p) { return p.name + ': ' + numero(p.value) + ' personas'; } }),
          series: [{ type: 'treemap', roam: false, nodeClick: false, breadcrumb: { show: false },
            width: '100%', height: '100%', top: 0, left: 0,
            itemStyle: { borderColor: css('--superficie'), borderWidth: 3, gapWidth: 3, borderRadius: 8 },
            label: { formatter: function (p) { return p.name + '\n' + numero(p.value); }, fontSize: 13 },
            data: d.grupos.map(function (g) { return { name: g.nombre, value: g.v }; }) }]
        })
      };
    },
    servicios: function (d, b) {
      var datos = d.servicios.slice().reverse();
      return {
        opcion: Object.assign(b, {
          tooltip: Object.assign(b.tooltip, { trigger: 'axis', axisPointer: { type: 'shadow' } }),
          xAxis: eje(b, { type: 'value' }),
          yAxis: eje(b, { type: 'category', data: datos.map(function (s) { return s.nombre; }) }),
          series: [{ type: 'bar', name: 'Servicios', barMaxWidth: 20, itemStyle: { borderRadius: [0, 6, 6, 0] },
            label: { show: true, position: 'right', color: css('--texto-suave'), formatter: function (p) { return numero(p.value); } },
            data: datos.map(function (s) { return s.v; }) }]
        })
      };
    },
    calendario: function (d, b) {
      var anio = d.anios.length ? d.anios[d.anios.length - 1] : new Date().getFullYear();
      var maximo = d.calendario.reduce(function (m, x) { return Math.max(m, x[1]); }, 1);
      return {
        opcion: Object.assign(b, {
          tooltip: Object.assign(b.tooltip, { formatter: function (p) { return p.value[0] + ': ' + p.value[1] + ' jornada(s)'; } }),
          visualMap: { min: 0, max: maximo, calculable: false, orient: 'horizontal', left: 'center', bottom: 0,
            inRange: { color: oscuro() ? ['#16233f', '#8FB0FF'] : ['#e6ecf6', '#00205B'] },
            textStyle: { color: css('--texto-suave') } },
          calendar: { top: 24, left: 28, right: 16, cellSize: ['auto', 16], range: String(anio),
            itemStyle: { borderColor: css('--superficie'), borderWidth: 3, color: css('--superficie-2') },
            splitLine: { show: false }, yearLabel: { show: false },
            dayLabel: { nameMap: ['D', 'L', 'M', 'M', 'J', 'V', 'S'], color: css('--texto-suave') },
            monthLabel: { nameMap: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'], color: css('--texto-suave') } },
          series: [{ type: 'heatmap', coordinateSystem: 'calendar', data: d.calendario }]
        }),
        clic: function (p) { filtrar({ desde: p.value[0], hasta: p.value[0] }); }
      };
    },
    puntos: function (d, b) {
      var unidades = {};
      d.puntos.forEach(function (p) { (unidades[p.unidad] = unidades[p.unidad] || []).push(p); });
      return {
        opcion: Object.assign(b, {
          tooltip: Object.assign(b.tooltip, { formatter: function (p) { return p.data.codigo + '\n' + p.data.lugar; } }),
          xAxis: eje(b, { type: 'value', name: 'Longitud', min: -82.5, max: -66.5, scale: true }),
          yAxis: eje(b, { type: 'value', name: 'Latitud', min: -4.5, max: 13.5, scale: true }),
          series: Object.keys(unidades).map(function (u) {
            return { name: u, type: 'scatter', symbolSize: 9, itemStyle: { opacity: 0.8 },
              data: unidades[u].map(function (p) { return { value: [p.lon, p.lat], codigo: p.codigo, lugar: p.lugar, id: p.id }; }) };
          })
        }),
        clic: function (p) {
          var listado = document.getElementById('url-listado');
          if (listado && p.data.id) window.location.assign(listado.getAttribute('data-url') + p.data.id + '/');
        }
      };
    },
    pivote: function (d, b) {
      var formato = d.formato === 'moneda' ? moneda : numero;
      return {
        opcion: Object.assign(b, {
          tooltip: Object.assign(b.tooltip, { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: formato }),
          legend: Object.assign(b.legend, { type: 'scroll' }),
          grid: Object.assign(b.grid, { top: 44 }),
          xAxis: eje(b, { type: 'category', data: d.categorias, axisLabel: { color: css('--texto-suave'),
            rotate: d.categorias.length > 8 ? 35 : 0,
            formatter: function (v) { return v.length > 18 ? v.slice(0, 17) + '…' : v; } } }),
          yAxis: eje(b, { type: 'value', axisLabel: { color: css('--texto-suave'), formatter: function (v) { return numero(v); } } }),
          series: d.series.map(function (s) {
            return { name: s.nombre, type: 'bar', stack: 'total', barMaxWidth: 42, emphasis: { focus: 'series' }, data: s.datos };
          })
        })
      };
    },
    indicador: function (serie, b) {
      var marcas = [];
      if (serie.meta !== null) marcas.push({ yAxis: serie.meta, name: 'Meta', label: { formatter: 'Meta {c}' }, lineStyle: { color: '#146C43' } });
      if (serie.base !== null) marcas.push({ yAxis: serie.base, name: 'Línea base', label: { formatter: 'Base {c}' }, lineStyle: { color: css('--texto-suave') } });
      return {
        opcion: Object.assign(b, {
          tooltip: Object.assign(b.tooltip, { trigger: 'axis', valueFormatter: function (v) { return numero(v) + ' ' + serie.unidad; } }),
          xAxis: eje(b, { type: 'category', data: serie.etiquetas, boundaryGap: false }),
          yAxis: eje(b, { type: 'value', scale: true }),
          series: [{ type: 'line', name: 'Medición', smooth: true, symbolSize: 8, areaStyle: { opacity: 0.14 },
            data: serie.valores, markLine: { symbol: 'none', data: marcas, lineStyle: { type: 'dashed' } } }]
        })
      };
    }
  };

  function leer(id) {
    var nodo = document.getElementById(id);
    if (!nodo) return null;
    try { return JSON.parse(nodo.textContent); } catch (e) { return null; }
  }

  function vacia(nodo) {
    nodo.classList.add('vacio');
    nodo.textContent = 'Sin datos para los filtros elegidos.';
  }

  function pintar() {
    if (typeof window.echarts === 'undefined') return;
    instancias.forEach(function (i) { i.dispose(); });
    instancias = [];
    var tablero = leer('datos-tablero');
    var pivote = leer('datos-pivote');
    var indicadores = leer('datos-indicadores') || [];

    document.querySelectorAll('[data-grafica]').forEach(function (nodo) {
      var tipo = nodo.getAttribute('data-grafica');
      var datos = tipo === 'pivote' ? pivote : tablero;
      if (!datos || !constructores[tipo]) return;
      var clave = { meses: 'meses', tipos: 'tipos', departamentos: 'departamentos', unidades: 'unidades',
        grupos: 'grupos', servicios: 'servicios', calendario: 'calendario', puntos: 'puntos' }[tipo];
      if (clave && (!datos[clave] || datos[clave].length === 0)) { vacia(nodo); return; }
      if (tipo === 'pivote' && datos.categorias.length === 0) { vacia(nodo); return; }
      montar(nodo, constructores[tipo](datos, base()));
    });

    indicadores.forEach(function (serie) {
      var nodo = document.querySelector('[data-indicador="' + serie.id + '"]');
      if (!nodo) return;
      if (!serie.valores.length) { vacia(nodo); return; }
      montar(nodo, constructores.indicador(serie, base()));
    });
  }

  function montar(nodo, definicion) {
    var grafica = window.echarts.init(nodo, null, { renderer: 'canvas' });
    delete definicion.opcion._eje;
    grafica.setOption(definicion.opcion);
    if (definicion.clic) {
      grafica.on('click', definicion.clic);
      nodo.classList.add('interactiva');
    }
    instancias.push(grafica);
  }

  var espera;
  window.addEventListener('resize', function () {
    clearTimeout(espera);
    espera = setTimeout(function () { instancias.forEach(function (i) { i.resize(); }); }, 120);
  });
  document.addEventListener('sigit:tema', pintar);
  document.addEventListener('DOMContentLoaded', pintar);
})();
