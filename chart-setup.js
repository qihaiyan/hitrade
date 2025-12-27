(function () {
  const chartContainer = document.getElementById('chart');
  const volumeContainer = document.getElementById('volume-chart');
  const macdContainer = document.getElementById('macd-chart');
  const rsiContainer = document.getElementById('rsi-chart');

  const chart = LightweightCharts.createChart(chartContainer, {
    layout: { background: { type: 'solid', color: '#071122' }, textColor: '#dbeafe' },
    rightPriceScale: { visible: false },
    timeScale: { timeVisible: true, secondsVisible: false },
    grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.02)' } },
  });

  const candleSeries = chart.addSeries(LightweightCharts.CandlestickSeries, { upColor: '#26a69a', downColor: '#ef5350', borderVisible: true, wickUpColor: '#26a69a', wickDownColor: '#ef5350' });

  const volumeChart = LightweightCharts.createChart(volumeContainer, {
    layout: { background: { type: 'solid', color: '#071122' }, textColor: '#9fb4d9' },
    rightPriceScale: { visible: false },
    timeScale: { timeVisible: true, secondsVisible: false },
    grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.02)' } },
  });
  const volumeSeries = volumeChart.addSeries(LightweightCharts.HistogramSeries, { priceFormat: { type: 'volume' }, color: '#26a69a' });

  const smaSeries = chart.addSeries(LightweightCharts.LineSeries, { color: '#eab308', lineWidth: 2, visible: false });
  const emaSeries = chart.addSeries(LightweightCharts.LineSeries, { color: '#60a5fa', lineWidth: 2, visible: false });

  const bbUpper = chart.addSeries(LightweightCharts.LineSeries, { color: '#06b6d4', lineWidth: 1, visible: false });
  const bbLower = chart.addSeries(LightweightCharts.LineSeries, { color: '#06b6d4', lineWidth: 1, visible: false });

  const macdChart = LightweightCharts.createChart(macdContainer, {
    layout: { background: { type: 'solid', color: '#071122' }, textColor: '#9fb4d9' },
    rightPriceScale: { visible: false },
    timeScale: { timeVisible: true, secondsVisible: false },
    grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.02)' } },
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
      vertLine: { visible: false },
      horzLine: { visible: false },
    },
  });
  const macdLine = macdChart.addSeries(LightweightCharts.LineSeries, { color: '#7c3aed', lineWidth: 2, visible: false });
  const macdSignal = macdChart.addSeries(LightweightCharts.LineSeries, { color: '#ef4444', lineWidth: 1, visible: false });
  const macdHist = macdChart.addSeries(LightweightCharts.HistogramSeries, { color: '#60a5fa', visible: false, priceFormat: { type: 'volume' } });

  const rsiChart = LightweightCharts.createChart(rsiContainer, {
    layout: { background: { type: 'solid', color: '#071122' }, textColor: '#9fb4d9' },
    rightPriceScale: { visible: false },
    timeScale: { timeVisible: true, secondsVisible: false },
    grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.02)' } },
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
      vertLine: { visible: false },
      horzLine: { visible: false },
    },
  });
  const rsiSeries = rsiChart.addSeries(LightweightCharts.LineSeries, { color: '#f97316', lineWidth: 2, visible: false });
  const rsiOB = rsiChart.addSeries(LightweightCharts.LineSeries, { color: '#ef4444', lineWidth: 1, lineStyle: window.LightweightCharts ? window.LightweightCharts.LineStyle.Dashed : 1, visible: false });
  const rsiOS = rsiChart.addSeries(LightweightCharts.LineSeries, { color: '#10b981', lineWidth: 1, lineStyle: window.LightweightCharts ? window.LightweightCharts.LineStyle.Dashed : 1, visible: false });

  window.ChartApp = window.ChartApp || {};
  window.ChartApp.charts = {
    chart,
    volumeChart,
    macdChart,
    rsiChart,
  };
  window.ChartApp.series = {
    candleSeries,
    volumeSeries,
    smaSeries,
    emaSeries,
    bbUpper,
    bbLower,
    macdLine,
    macdSignal,
    macdHist,
    rsiSeries,
    rsiOB,
    rsiOS,
  };
  window.ChartApp.containers = {
    chartContainer,
    volumeContainer,
    macdContainer,
    rsiContainer,
  };
})();
