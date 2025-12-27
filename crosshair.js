(function () {
  const panelCharts = [
    { id: 'chart', chartRef: window.ChartApp.charts.chart },
    { id: 'volume-chart', chartRef: window.ChartApp.charts.volumeChart },
    { id: 'macd-chart', chartRef: window.ChartApp.charts.macdChart },
    { id: 'rsi-chart', chartRef: window.ChartApp.charts.rsiChart },
  ];
  const panelOverlays = {};

  function initPanelOverlays() {
    panelCharts.forEach(p => {
      const cont = document.getElementById(p.id);
      if (!cont) return;
      const v = document.createElement('div');
      v.className = 'panel-crosshair-vert';
      v.style.display = 'none';
      cont.style.position = cont.style.position || 'relative';
      cont.appendChild(v);
      const h = document.createElement('div');
      h.className = 'panel-crosshair-hor';
      h.style.display = 'none';
      cont.appendChild(h);
      const label = document.createElement('div');
      label.className = 'panel-price-label';
      label.style.display = 'none';
      cont.appendChild(label);
      let seriesRef = null;
      if (p.id === 'chart') seriesRef = window.ChartApp.series.candleSeries;
      else if (p.id === 'volume-chart') seriesRef = window.ChartApp.series.volumeSeries;
      else if (p.id === 'macd-chart') seriesRef = window.ChartApp.series.macdLine;
      else if (p.id === 'rsi-chart') seriesRef = window.ChartApp.series.rsiSeries;
      panelOverlays[p.id] = { container: cont, chartRef: p.chartRef, vert: v, hor: h, label: label, series: seriesRef };
    });
  }

  function updatePanelOverlays(time, sourceId, sourcePoint) {
    for (const id in panelOverlays) {
      const po = panelOverlays[id];
      let x = null;
      const useSourceChart = (id === sourceId);
      const chartRef = useSourceChart ? po.chartRef : window.ChartApp.charts.chart;
      try { x = chartRef.timeScale().timeToCoordinate(time); } catch (e) { x = null; }
      if (typeof x === 'number' && !isNaN(x)) {
        const contRect = po.container.getBoundingClientRect();
        const canvasEl = id === 'rsi-chart' ? po.container.querySelector('canvas:not(.indicator-overlay)') : po.container.querySelector('canvas');
        let canvasLeftOffset = 0;
        if (canvasEl) {
          try {
            const canvRect = canvasEl.getBoundingClientRect();
            canvasLeftOffset = canvRect.left - contRect.left;
          } catch (e) { canvasLeftOffset = 0; }
        }
        po.vert.style.left = Math.round(x + canvasLeftOffset) + 'px';
        po.vert.style.display = 'block';
      } else {
        po.vert.style.display = 'none';
      }
      let priceVal = null;
      if (id === 'chart') {
        const b = window.ChartApp.dataService.getDataMap()[time]; if (b) priceVal = b.close;
      } else if (id === 'volume-chart') {
        priceVal = window.ChartApp.dataService.getValueAtTime(window.ChartApp.dataService.getVolumeData(), time);
      } else if (id === 'macd-chart') {
        try { const mac = window.ChartApp.indicators.calcMACD(window.ChartApp.dataService.getCandleData(), 12, 26, 9); priceVal = window.ChartApp.dataService.getValueAtTime(mac.macd, time); } catch (e) { priceVal = null; }
      } else if (id === 'rsi-chart') {
        try { const rp = Number(document.getElementById('rsiPeriod')?.value) || 14; const r = window.ChartApp.indicators.calcRSI(window.ChartApp.dataService.getCandleData(), rp); priceVal = window.ChartApp.dataService.getValueAtTime(r, time); } catch (e) { priceVal = null; }
      }
      let y = null;
      if (priceVal != null && po.series) {
        try { y = po.series.priceToCoordinate(priceVal); } catch (e) { y = null; }
      }
      if ((typeof y !== 'number' || isNaN(y)) && sourceId === id && sourcePoint && typeof sourcePoint.y === 'number') {
        y = sourcePoint.y;
      }
      if (typeof y === 'number' && !isNaN(y)) {
        const contRect2 = po.container.getBoundingClientRect();
        const canvasEl2 = po.container.querySelector('canvas');
        let canvasTopOffset = 0;
        if (canvasEl2) {
          try {
            const canvRect2 = canvasEl2.getBoundingClientRect();
            canvasTopOffset = canvRect2.top - contRect2.top;
          } catch (e) { canvasTopOffset = 0; }
        }
        const topPos = Math.round(y + canvasTopOffset);
        po.hor.style.top = topPos + 'px';
        po.hor.style.display = 'block';
        if (priceVal != null) {
          po.label.textContent = typeof priceVal === 'number' ? priceVal.toFixed(4) : String(priceVal);
          po.label.style.top = Math.round(topPos - 10) + 'px';
          po.label.style.display = 'block';
        } else {
          po.label.style.display = 'none';
        }
      } else {
        po.hor.style.display = 'none';
        po.label.style.display = 'none';
      }
    }
  }

  function initCrosshairEvents() {
    const chart = window.ChartApp.charts.chart;
    const macdChart = window.ChartApp.charts.macdChart;
    const rsiChart = window.ChartApp.charts.rsiChart;

    chart.subscribeCrosshairMove(param => {
      if (!param || !param.time) { if (document.getElementById('tooltip')) document.getElementById('tooltip').style.display = 'none'; return; }
      const t = typeof param.time === 'object' && param.time.year ? (new Date(param.time.year, param.time.month - 1, param.time.day).getTime() / 1000) : param.time;
      try { updatePanelOverlays(t, 'chart', param.point); } catch (e) { }
    });

    try {
      macdChart.subscribeCrosshairMove(param => {
        const t = typeof param.time === 'object' && param.time.year ? (new Date(param.time.year, param.time.month - 1, param.time.day).getTime() / 1000) : param.time;
        try { updatePanelOverlays(t, 'macd-chart', param.point); } catch (e) { }
      });
    } catch (e) { }
    try {
      rsiChart.subscribeCrosshairMove(param => {
        const t = typeof param.time === 'object' && param.time.year ? (new Date(param.time.year, param.time.month - 1, param.time.day).getTime() / 1000) : param.time;
        try { updatePanelOverlays(t, 'rsi-chart', param.point); } catch (e) { }
      });
    } catch (e) { }
  }

  function initTimeRangeSync() {
    const chart = window.ChartApp.charts.chart;
    const volumeChart = window.ChartApp.charts.volumeChart;
    const macdChart = window.ChartApp.charts.macdChart;
    const rsiChart = window.ChartApp.charts.rsiChart;

    chart.timeScale().subscribeVisibleTimeRangeChange(() => {
      const vr = chart.timeScale().getVisibleRange();
      if (vr && vr.from != null && vr.to != null) {
        try { volumeChart.timeScale().setVisibleRange(vr); } catch (e) { console.warn('volumeChart.setVisibleRange failed', e); }
        try { macdChart.timeScale().setVisibleRange(vr); } catch (e) { console.warn('macdChart.setVisibleRange failed', e); }
        try { rsiChart.timeScale().setVisibleRange(vr); } catch (e) { console.warn('rsiChart.setVisibleRange failed', e); }
      }
    });

    chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (range) {
        try { volumeChart.timeScale().setVisibleLogicalRange(range); } catch (e) { }
        try { macdChart.timeScale().setVisibleLogicalRange(range); } catch (e) { }
        try { rsiChart.timeScale().setVisibleLogicalRange(range); } catch (e) { }
      }
    });

    volumeChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (range) {
        try { chart.timeScale().setVisibleLogicalRange(range); } catch (e) { }
        try { macdChart.timeScale().setVisibleLogicalRange(range); } catch (e) { }
        try { rsiChart.timeScale().setVisibleLogicalRange(range); } catch (e) { }
      }
    });

    macdChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (range) {
        try { chart.timeScale().setVisibleLogicalRange(range); } catch (e) { }
        try { volumeChart.timeScale().setVisibleLogicalRange(range); } catch (e) { }
        try { rsiChart.timeScale().setVisibleLogicalRange(range); } catch (e) { }
      }
    });

    rsiChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (range) {
        try { chart.timeScale().setVisibleLogicalRange(range); } catch (e) { }
        try { volumeChart.timeScale().setVisibleLogicalRange(range); } catch (e) { }
        try { macdChart.timeScale().setVisibleLogicalRange(range); } catch (e) { }
      }
    });
  }

  window.ChartApp = window.ChartApp || {};
  window.ChartApp.crosshair = {
    initPanelOverlays,
    updatePanelOverlays,
    initCrosshairEvents,
    initTimeRangeSync,
  };
})();
