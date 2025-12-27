(function () {
  function parseTimeVal(tv) {
    if (tv == null) return null;
    if (typeof tv === 'number') return tv;
    if (typeof tv === 'string') {
      const n = Number(tv); if (!isNaN(n)) return n; return null;
    }
    if (typeof tv === 'object' && tv.year) {
      return Math.floor(new Date(tv.year, tv.month - 1, tv.day).getTime() / 1000);
    }
    return null;
  }

  function getVisibleRangeNums(chartRef) {
    const vr = chartRef.timeScale().getVisibleRange();
    if (!vr) return null;
    const from = parseTimeVal(vr.from);
    const to = parseTimeVal(vr.to);
    if (from == null || to == null) return null;
    return { from, to };
  }

  function setVisibleRangeAll(range) {
    const chart = window.ChartApp.charts.chart;
    const volumeChart = window.ChartApp.charts.volumeChart;
    const macdChart = window.ChartApp.charts.macdChart;
    const rsiChart = window.ChartApp.charts.rsiChart;

    chart.timeScale().setVisibleRange(range);
    try { volumeChart.timeScale().setVisibleRange(range); } catch (e) { console.warn('volumeChart.setVisibleRange failed', e); }
    macdChart.timeScale().setVisibleRange(range);
    rsiChart.timeScale().setVisibleRange(range);
  }

  function panPercent(pct) {
    const chart = window.ChartApp.charts.chart;
    const vr = getVisibleRangeNums(chart);
    if (!vr) return;
    const span = vr.to - vr.from;
    const shift = Math.floor(span * pct);
    let newFrom = Math.floor(vr.from + shift);
    let newTo = Math.ceil(vr.to + shift);
    const bounds = window.ChartApp.dataService.getDataTimeBounds();
    if (bounds) {
      if (newFrom < bounds.min) {
        newFrom = bounds.min;
        newTo = bounds.min + span;
      }
      if (newTo > bounds.max) {
        newTo = bounds.max;
        newFrom = bounds.max - span;
      }
      if (newFrom >= newTo) return;
      if (newFrom === vr.from && newTo === vr.to) return;
    }
    setVisibleRangeAll({ from: newFrom, to: newTo });
  }

  function zoomFactor(factor) {
    const chart = window.ChartApp.charts.chart;
    const vr = getVisibleRangeNums(chart);
    if (!vr) return;
    const center = (vr.from + vr.to) / 2;
    const half = (vr.to - vr.from) / 2 * factor;
    const newRange = { from: Math.floor(center - half), to: Math.ceil(center + half) };
    setVisibleRangeAll(newRange);
  }

  function initKeyboardShortcuts() {
    const chart = window.ChartApp.charts.chart;
    const macdChart = window.ChartApp.charts.macdChart;
    const rsiChart = window.ChartApp.charts.rsiChart;

    window.addEventListener('keydown', (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const key = e.key;
      let handled = true;
      if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) { return; }
      switch (key) {
        case 'ArrowUp':
          zoomFactor(0.85);
          break;
        case 'ArrowDown':
          zoomFactor(1.15);
          break;
        case 'ArrowLeft':
          panPercent(-0.12);
          break;
        case 'ArrowRight':
          panPercent(0.12);
          break;
        case 'e':
          document.getElementById('emaToggle')?.click();
          break;
        case 'm':
          document.getElementById('macdToggle')?.click();
          break;
        case 's':
          document.getElementById('rsiToggle')?.click();
          break;
        case 'b':
          document.getElementById('bbToggle')?.click();
          break;
        case 'd':
          document.getElementById('drawToggle')?.click();
          break;
        case 'x':
          document.getElementById('exportBtn')?.click();
          break;
        case '0':
          chart.timeScale().fitContent();
          macdChart.timeScale().fitContent();
          rsiChart.timeScale().fitContent();
          break;
        default:
          handled = false;
      }
      if (handled) e.preventDefault();
    });
  }

  window.ChartApp = window.ChartApp || {};
  window.ChartApp.navigation = {
    parseTimeVal,
    getVisibleRangeNums,
    setVisibleRangeAll,
    panPercent,
    zoomFactor,
    initKeyboardShortcuts,
  };
})();
