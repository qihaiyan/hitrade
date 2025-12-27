(function () {
  const tooltip = document.getElementById('tooltip');
  const timeframeSelect = document.getElementById('timeframe');
  const symbolInput = document.getElementById('symbol');
  const smaToggle = document.getElementById('smaToggle');
  const emaToggle = document.getElementById('emaToggle');
  const drawToggle = document.getElementById('drawToggle');
  const exportBtn = document.getElementById('exportBtn');
  const rsiPeriodInput = document.getElementById('rsiPeriod');
  const rsiOverlay = document.getElementById('rsi-overlay');

  function showTooltipAtPoint(point, html) {
    if (!tooltip) return;
    const wrapper = document.getElementById('chart-wrapper');
    const wrapRect = wrapper.getBoundingClientRect();
    tooltip.style.display = 'block';
    tooltip.innerHTML = html;
    const maxW = Math.min(360, Math.max(220, wrapRect.width - 24));
    tooltip.style.maxWidth = maxW + 'px';
    tooltip.style.width = 'auto';
    const ttRect = tooltip.getBoundingClientRect();
    let left = point.x + 12;
    let top = point.y + 12;
    if (left + ttRect.width > wrapRect.width) left = Math.max(8, wrapRect.width - ttRect.width - 8);
    if (top + ttRect.height > wrapRect.height) top = Math.max(8, wrapRect.height - ttRect.height - 8);
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
  }

  function pointForSeriesAtTime(series, time) {
    const candleData = window.ChartApp.dataService.getCandleData();
    const data = series === window.ChartApp.series.smaSeries ? window.ChartApp.indicators.calcSMA(candleData, 20) : (series === window.ChartApp.series.emaSeries ? window.ChartApp.indicators.calcEMA(candleData, 20) : []);
    for (const p of data) { if (p.time === time) return p.value.toFixed(4); }
    return null;
  }

  function resizeRSIOverlay() {
    if (!rsiOverlay) return;
    const rsiContainer = document.getElementById('rsi-container');
    const rect = rsiContainer.getBoundingClientRect();
    rsiOverlay.width = rect.width * devicePixelRatio;
    rsiOverlay.height = rect.height * devicePixelRatio;
    rsiOverlay.style.width = rect.width + 'px';
    rsiOverlay.style.height = rect.height + 'px';
    const ctx = rsiOverlay.getContext('2d');
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  function clearRSIOverlay() {
    if (!rsiOverlay) return;
    const ctx = rsiOverlay.getContext('2d');
    ctx.clearRect(0, 0, rsiOverlay.width, rsiOverlay.height);
  }

  function drawRSIBand() {
    if (!rsiOverlay) return;
    const ctx = rsiOverlay.getContext('2d');
    ctx.clearRect(0, 0, rsiOverlay.width, rsiOverlay.height);
    try {
      const y70 = window.ChartApp.series.rsiSeries.priceToCoordinate(70);
      const y30 = window.ChartApp.series.rsiSeries.priceToCoordinate(30);
      if (typeof y70 !== 'number' || typeof y30 !== 'number') return;
      const rectTop = Math.min(y70, y30);
      const rectHeight = Math.abs(y70 - y30);
      ctx.fillStyle = 'rgba(234,88,12,0.08)';
      ctx.fillRect(0, rectTop, rsiOverlay.width / devicePixelRatio, rectHeight);
    } catch (e) { }
  }

  function updateIndicators() {
    const candleData = window.ChartApp.dataService.getCandleData();
    const volumeData = window.ChartApp.dataService.getVolumeData();

    if (smaToggle.checked) {
      const sma = window.ChartApp.indicators.calcSMA(candleData, 20);
      window.ChartApp.series.smaSeries.setData(sma);
      window.ChartApp.series.smaSeries.applyOptions({ visible: true });
    } else {
      window.ChartApp.series.smaSeries.setData([]);
      window.ChartApp.series.smaSeries.applyOptions({ visible: false });
    }
    if (emaToggle.checked) {
      const ema = window.ChartApp.indicators.calcEMA(candleData, 20);
      window.ChartApp.series.emaSeries.setData(ema);
      window.ChartApp.series.emaSeries.applyOptions({ visible: true });
    } else {
      window.ChartApp.series.emaSeries.setData([]);
      window.ChartApp.series.emaSeries.applyOptions({ visible: false });
    }

    const macdToggle = document.getElementById('macdToggle');
    const macd = window.ChartApp.indicators.calcMACD(candleData, 12, 26, 9);
    window.ChartApp.series.macdLine.setData(macd.macd);
    window.ChartApp.series.macdSignal.setData(macd.signal);
    window.ChartApp.series.macdHist.setData(macd.hist);
    if (macdToggle && macdToggle.checked) {
      window.ChartApp.series.macdLine.applyOptions({ visible: true });
      window.ChartApp.series.macdSignal.applyOptions({ visible: true });
      window.ChartApp.series.macdHist.applyOptions({ visible: true });
    } else {
      window.ChartApp.series.macdLine.applyOptions({ visible: false });
      window.ChartApp.series.macdSignal.applyOptions({ visible: false });
      window.ChartApp.series.macdHist.applyOptions({ visible: false });
    }

    const rsiToggleEl = document.getElementById('rsiToggle');
    const rp = Number(rsiPeriodInput?.value) || 14;
    const rsi = window.ChartApp.indicators.calcRSI(candleData, rp);
    window.ChartApp.series.rsiSeries.setData(rsi);
    window.ChartApp.series.rsiSeries.applyOptions({ visible: true });
    const ob = rsi.map(p => ({ time: p.time, value: 70 }));
    const os = rsi.map(p => ({ time: p.time, value: 30 }));
    window.ChartApp.series.rsiOB.setData(ob);
    window.ChartApp.series.rsiOS.setData(os);
    if (rsiToggleEl && rsiToggleEl.checked) {
      window.ChartApp.series.rsiOB.applyOptions({ visible: true });
      window.ChartApp.series.rsiOS.applyOptions({ visible: true });
      drawRSIBand();
    } else {
      window.ChartApp.series.rsiSeries.applyOptions({ visible: false });
      window.ChartApp.series.rsiOB.applyOptions({ visible: false });
      window.ChartApp.series.rsiOS.applyOptions({ visible: false });
      clearRSIOverlay();
    }

    const bbToggleEl = document.getElementById('bbToggle');
    if (bbToggleEl && bbToggleEl.checked) {
      const bb = window.ChartApp.indicators.calcBollingerBands(candleData, 20, 2);
      window.ChartApp.series.bbUpper.setData(bb.upper);
      window.ChartApp.series.bbLower.setData(bb.lower);
      window.ChartApp.series.bbUpper.applyOptions({ visible: true });
      window.ChartApp.series.bbLower.applyOptions({ visible: true });
    } else {
      window.ChartApp.series.bbUpper.setData([]);
      window.ChartApp.series.bbUpper.applyOptions({ visible: false });
      window.ChartApp.series.bbLower.setData([]);
      window.ChartApp.series.bbLower.applyOptions({ visible: false });
    }
  }

  function initChartEvents() {
    const chart = window.ChartApp.charts.chart;
    const dataMap = window.ChartApp.dataService.getDataMap();
    const volumeData = window.ChartApp.dataService.getVolumeData();
    const candleData = window.ChartApp.dataService.getCandleData();

    chart.subscribeCrosshairMove(param => {
      if (!param || !param.time) { if (tooltip) tooltip.style.display = 'none'; return; }
      const t = typeof param.time === 'object' && param.time.year ? (new Date(param.time.year, param.time.month - 1, param.time.day).getTime() / 1000) : param.time;
      const d = dataMap[t];
      if (!d) { if (tooltip) tooltip.style.display = 'none'; return; }

      let html = `<div style="margin-bottom:6px"><strong>${symbolInput.value}</strong></div>`;
      const dt = new Date(t * 1000);
      html += `<div style="font-size:12px;margin-bottom:6px">${dt.toLocaleString()}</div>`;
      html += `<div style="font-size:13px">O: ${d.open} &nbsp; H: ${d.high} &nbsp; L: ${d.low} &nbsp; C: ${d.close}</div>`;

      const vol = window.ChartApp.dataService.getValueAtTime(volumeData, t);
      if (vol != null) html += `<div style="font-size:13px">Vol: ${vol}</div>`;

      if (smaToggle.checked) { const s = pointForSeriesAtTime(window.ChartApp.series.smaSeries, t); if (s != null) html += `<div style="font-size:13px">SMA: ${s}</div>`; }
      if (emaToggle.checked) { const e = pointForSeriesAtTime(window.ChartApp.series.emaSeries, t); if (e != null) html += `<div style="font-size:13px">EMA: ${e}</div>`; }

      if (document.getElementById('macdToggle')?.checked) {
        try {
          const mac = window.ChartApp.indicators.calcMACD(candleData, 12, 26, 9);
          const m = window.ChartApp.dataService.getValueAtTime(mac.macd, t);
          const s = window.ChartApp.dataService.getValueAtTime(mac.signal, t);
          const h = window.ChartApp.dataService.getValueAtTime(mac.hist, t);
          if (m != null) html += `<div style="font-size:13px">MACD: ${m} &nbsp; Signal: ${s} &nbsp; Hist: ${h}</div>`;
        } catch (e) { }
      }

      if (document.getElementById('rsiToggle')?.checked) {
        try {
          const rp = Number(rsiPeriodInput?.value) || 14;
          const r = window.ChartApp.indicators.calcRSI(candleData, rp);
          const rv = window.ChartApp.dataService.getValueAtTime(r, t);
          if (rv != null) html += `<div style="font-size:13px">RSI(${rp}): ${rv}</div>`;
        } catch (e) { }
      }

      showTooltipAtPoint(param.point, html);
      try { window.ChartApp.crosshair.updatePanelOverlays(t, 'chart', param.point); } catch (e) { }
    });
  }

  function resizeAllCharts() {
    const chartContainer = document.getElementById('chart');
    const w = chartContainer.clientWidth;
    const mainH = chartContainer.clientHeight;
    window.ChartApp.charts.chart.resize(w, mainH);
    const volH = document.getElementById('volume-container').clientHeight;
    const macdH = document.getElementById('macd-container').clientHeight;
    const rsiH = document.getElementById('rsi-container').clientHeight;
    window.ChartApp.charts.volumeChart.resize(w, volH);
    window.ChartApp.charts.macdChart.resize(w, macdH);
    window.ChartApp.charts.rsiChart.resize(w, rsiH);
    window.ChartApp.drawing.resizeCanvas();
    resizeRSIOverlay();
    drawRSIBand();
  }

  function init() {
    const chartContainer = document.getElementById('chart');
    window.ChartApp.charts.chart.resize(chartContainer.clientWidth, chartContainer.clientHeight);
    window.ChartApp.charts.volumeChart.resize(chartContainer.clientWidth, document.getElementById('volume-container').clientHeight);
    window.ChartApp.charts.macdChart.resize(chartContainer.clientWidth, document.getElementById('macd-container').clientHeight);
    window.ChartApp.charts.rsiChart.resize(chartContainer.clientWidth, document.getElementById('rsi-container').clientHeight);
    const { candleData, volumeData } = window.ChartApp.dataService.loadDataForTimeframe(timeframeSelect.value);
    window.ChartApp.series.candleSeries.setData(candleData);
    window.ChartApp.series.volumeSeries.setData(volumeData);
    updateIndicators();
    window.ChartApp.drawing.setDrawMode(false);
    window.ChartApp.drawing.resizeCanvas();
  }

  function initUIBindings() {
    timeframeSelect.addEventListener('change', () => {
      const { candleData, volumeData } = window.ChartApp.dataService.loadDataForTimeframe(timeframeSelect.value);
      window.ChartApp.series.candleSeries.setData(candleData);
      window.ChartApp.series.volumeSeries.setData(volumeData);
      updateIndicators();
    });
    smaToggle.addEventListener('change', updateIndicators);
    emaToggle.addEventListener('change', updateIndicators);
    document.getElementById('macdToggle')?.addEventListener('change', updateIndicators);
    document.getElementById('rsiToggle')?.addEventListener('change', updateIndicators);
    document.getElementById('bbToggle')?.addEventListener('change', updateIndicators);
    drawToggle.addEventListener('click', () => {
      const currentMode = drawToggle.textContent.includes('开启');
      window.ChartApp.drawing.setDrawMode(!currentMode);
    });
    rsiPeriodInput?.addEventListener('change', () => updateIndicators());
    exportBtn.addEventListener('click', () => {
      const wrapper = document.getElementById('chart-wrapper');
      html2canvas(wrapper, { backgroundColor: '#071122', scale: devicePixelRatio }).then(canvas => {
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = `${symbolInput.value || 'chart'}_${Date.now()}.png`;
        a.click();
      });
    });
    window.addEventListener('resize', resizeAllCharts);
  }

  window.addEventListener('DOMContentLoaded', () => {
    init();
    window.ChartApp.crosshair.initPanelOverlays();
    window.ChartApp.crosshair.initCrosshairEvents();
    window.ChartApp.crosshair.initTimeRangeSync();
    window.ChartApp.drawing.initDrawingEvents();
    window.ChartApp.navigation.initKeyboardShortcuts();
    initChartEvents();
    initUIBindings();
  });
})();
