(function(){
  const { createChart } = window.LightweightCharts;

  // DOM
  const chartContainer = document.getElementById('chart');
  const drawCanvas = document.getElementById('drawLayer');
  const tooltip = document.getElementById('tooltip');
  const timeframeSelect = document.getElementById('timeframe');
  const symbolInput = document.getElementById('symbol');
  const smaToggle = document.getElementById('smaToggle');
  const emaToggle = document.getElementById('emaToggle');
  const drawToggle = document.getElementById('drawToggle');
  const exportBtn = document.getElementById('exportBtn');

  // Chart
  let chart = createChart(chartContainer, {
    layout: { background: { type: 'solid', color: '#071122' }, textColor: '#dbeafe' },
    rightPriceScale: { visible: true },
    timeScale: { timeVisible: true, secondsVisible: false },
    grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.02)' } },
  });

  const candleSeries = chart.addCandlestickSeries({ upColor: '#26a69a', downColor: '#ef5350', borderVisible: true, wickUpColor: '#26a69a', wickDownColor: '#ef5350' });
//   const volumeSeries = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, scaleMargins: { top: 0.7, bottom: 0 }, color: '#26a69a', priceScaleId: '' });

  const smaSeries = chart.addLineSeries({ color: '#eab308', lineWidth: 2, visible: false });
  const emaSeries = chart.addLineSeries({ color: '#60a5fa', lineWidth: 2, visible: false });

  // MACD: macd line, signal line, histogram (placed below volume via scaleMargins)
  // RSI (plotted lower) + overbought/oversold horizontal lines

  // Bollinger Bands (upper / lower)
  const bbUpper = chart.addLineSeries({ color: '#06b6d4', lineWidth: 1, visible: false });
  const bbLower = chart.addLineSeries({ color: '#06b6d4', lineWidth: 1, visible: false });
  
    // Create separate indicator charts for MACD and RSI
    const macdContainer = document.getElementById('macd-chart');
    const rsiContainer = document.getElementById('rsi-chart');
  
    const macdChart = createChart(macdContainer, {
      layout: { background: { type: 'solid', color: '#071122' }, textColor: '#9fb4d9' },
      rightPriceScale: { visible: false },
      timeScale: { timeVisible: true, secondsVisible: false },
    });
    const macdLine = macdChart.addLineSeries({ color: '#7c3aed', lineWidth: 2, visible: false });
    const macdSignal = macdChart.addLineSeries({ color: '#ef4444', lineWidth: 1, visible: false });
    const macdHist = macdChart.addHistogramSeries({ color: '#60a5fa', visible: false, priceFormat: { type: 'volume' } });
  
    const rsiChart = createChart(rsiContainer, {
      layout: { background: { type: 'solid', color: '#071122' }, textColor: '#9fb4d9' },
      rightPriceScale: { visible: false },
      timeScale: { timeVisible: true, secondsVisible: false },
    });
    // RSI (plotted lower) + overbought/oversold horizontal lines
    const rsiSeries = rsiChart.addLineSeries({ color: '#f97316', lineWidth: 2, visible: false });
    const rsiOB = rsiChart.addLineSeries({ color: '#ef4444', lineWidth: 1, lineStyle: window.LightweightCharts ? window.LightweightCharts.LineStyle.Dashed : 1, visible: false });
    const rsiOS = rsiChart.addLineSeries({ color: '#10b981', lineWidth: 1, lineStyle: window.LightweightCharts ? window.LightweightCharts.LineStyle.Dashed : 1, visible: false });

    // RSI overlay canvas for filled 70/30 band
    const rsiOverlay = document.getElementById('rsi-overlay');
    const rsiPeriodInput = document.getElementById('rsiPeriod');

  // Data storage
  let candleData = [];
  let volumeData = [];
  let dataMap = {}; // time -> ohlc

  // Utilities
  function toUnixSeconds(date){ return Math.floor(date.getTime()/1000); }

  function generateBars(count=400, timeframeSec=60){
    const bars = [];
    const volumes = [];
    let t = toUnixSeconds(new Date());
    t -= count * timeframeSec;
    let price = 100;
    for(let i=0;i<count;i++){
      const open = price;
      const change = (Math.random()-0.5) * 2 * (Math.random()*1.5 + 0.2);
      let close = Math.max(0.1, +(open + change).toFixed(2));
      const high = Math.max(open, close) + +(Math.random()*1.2).toFixed(2);
      const low = Math.min(open, close) - +(Math.random()*1.2).toFixed(2);
      const vol = Math.round(100 + Math.random()*900);
      const bar = { time: t, open: +open.toFixed(2), high: +high.toFixed(2), low: +low.toFixed(2), close: +close.toFixed(2) };
      bars.push(bar);
      volumes.push({ time: t, value: vol, color: close >= open ? '#26a69a' : '#ef5350' });
      dataMap[t] = bar;
      price = close;
      t += timeframeSec;
    }
    return {bars, volumes};
  }

  function calcSMA(data, period){
    const res = [];
    let sum = 0;
    for(let i=0;i<data.length;i++){
      sum += data[i].close;
      if(i >= period) sum -= data[i-period].close;
      if(i >= period - 1){
        res.push({ time: data[i].time, value: +(sum / period).toFixed(4) });
      }
    }
    return res;
  }

  function calcEMAValues(data, period){
    const res = [];
    const k = 2/(period+1);
    let ema = data[0].close;
    for(let i=0;i<data.length;i++){
      const price = data[i].close;
      ema = i===0 ? price : (price * k + ema * (1-k));
      res.push({ time: data[i].time, value: +ema.toFixed(4) });
    }
    return res;
  }

  function calcMACD(data, fast=12, slow=26, signal=9){
    const fastEMA = calcEMAValues(data, fast);
    const slowEMA = calcEMAValues(data, slow);
    const macd = [];
    for(let i=0;i<data.length;i++){
      const m = { time: data[i].time, value: +(fastEMA[i].value - slowEMA[i].value).toFixed(4) };
      macd.push(m);
    }
    // signal is EMA of macd values
    const macdValues = macd.map(m=>({ time: m.time, close: m.value }));
    const signalSeries = calcEMAValues(macdValues, signal);
    const hist = macd.map((m, i)=>({ time: m.time, value: +(m.value - signalSeries[i].value).toFixed(4), color: (m.value - signalSeries[i].value) >= 0 ? '#26a69a' : '#ef5350' }));
    return { macd, signal: signalSeries, hist };
  }

  function calcRSI(data, period=14){
    const res = [];
    let gains = 0, losses = 0;
    for(let i=1;i<data.length;i++){
      const change = data[i].close - data[i-1].close;
      if(i<=period){
        if(change>0) gains += change; else losses += Math.abs(change);
        if(i===period){
          let rs = gains / (losses || 1e-8);
          res.push({ time: data[i].time, value: +(100 - (100/(1+rs))).toFixed(4) });
        }
      } else {
        const change = data[i].close - data[i-1].close;
        gains = (gains * (period-1) + Math.max(0,change)) / period;
        losses = (losses * (period-1) + Math.max(0,-change)) / period;
        const rs = gains / (losses || 1e-8);
        res.push({ time: data[i].time, value: +(100 - (100/(1+rs))).toFixed(4) });
      }
    }
    return res;
  }

  function calcBollingerBands(data, period=20, mult=2){
    const resUpper = [];
    const resLower = [];
    for(let i=0;i<data.length;i++){
      if(i >= period-1){
        let sum = 0;
        for(let j=i-period+1;j<=i;j++) sum += data[j].close;
        const sma = sum / period;
        let variance = 0;
        for(let j=i-period+1;j<=i;j++) variance += Math.pow(data[j].close - sma, 2);
        variance /= period;
        const std = Math.sqrt(variance);
        resUpper.push({ time: data[i].time, value: +(sma + mult*std).toFixed(4) });
        resLower.push({ time: data[i].time, value: +(sma - mult*std).toFixed(4) });
      }
    }
    return { upper: resUpper, lower: resLower };
  }

  function calcEMA(data, period){
    const res = [];
    const k = 2/(period+1);
    let ema = data[0].close;
    for(let i=0;i<data.length;i++){
      const price = data[i].close;
      ema = i===0 ? price : (price * k + ema * (1-k));
      if(i >= period-1) res.push({ time: data[i].time, value: +ema.toFixed(4) });
    }
    return res;
  }

  function loadDataForTimeframe(tf){
    const sec = tf === 'D' ? 86400 : parseInt(tf,10) * 60;
    const { bars, volumes } = generateBars(500, sec);
    candleData = bars;
    volumeData = volumes;
    // rebuild map
    dataMap = {};
    for(const b of bars) dataMap[b.time] = b;
    candleSeries.setData(candleData);
    volumeSeries.setData(volumeData);
    updateIndicators();
  }

  function updateIndicators(){
    if(smaToggle.checked){
      const sma = calcSMA(candleData, 20);
      smaSeries.setData(sma);
      smaSeries.applyOptions({ visible: true });
    } else {
      smaSeries.setData([]);
      smaSeries.applyOptions({ visible: false });
    }
    if(emaToggle.checked){
      const ema = calcEMA(candleData, 20);
      emaSeries.setData(ema);
      emaSeries.applyOptions({ visible: true });
    } else {
      emaSeries.setData([]);
      emaSeries.applyOptions({ visible: false });
    }
    // MACD
    const macdToggle = document.getElementById('macdToggle');
    if(macdToggle && macdToggle.checked){
      const macd = calcMACD(candleData,12,26,9);
      macdLine.setData(macd.macd);
      macdSignal.setData(macd.signal);
      macdHist.setData(macd.hist);
      macdLine.applyOptions({ visible: true });
      macdSignal.applyOptions({ visible: true });
      macdHist.applyOptions({ visible: true });
    } else {
      macdLine.setData([]); macdLine.applyOptions({ visible: false });
      macdSignal.setData([]); macdSignal.applyOptions({ visible: false });
      macdHist.setData([]); macdHist.applyOptions({ visible: false });
    }
    // RSI
    const rsiToggleEl = document.getElementById('rsiToggle');
      if(rsiToggleEl && rsiToggleEl.checked){
        const rp = Number(rsiPeriodInput?.value) || 14;
        const rsi = calcRSI(candleData,rp);
        rsiSeries.setData(rsi);
        rsiSeries.applyOptions({ visible: true });
        // overbought / oversold lines (70 / 30) aligned to RSI timestamps
        const ob = rsi.map(p => ({ time: p.time, value: 70 }));
        const os = rsi.map(p => ({ time: p.time, value: 30 }));
        rsiOB.setData(ob); rsiOS.setData(os);
        rsiOB.applyOptions({ visible: true }); rsiOS.applyOptions({ visible: true });
        drawRSIBand();
      } else {
        rsiSeries.setData([]); rsiSeries.applyOptions({ visible: false });
        rsiOB.setData([]); rsiOB.applyOptions({ visible: false });
        rsiOS.setData([]); rsiOS.applyOptions({ visible: false });
        clearRSIOverlay();
    }
      // RSI overlay draw helpers
      function resizeRSIOverlay(){
        if(!rsiOverlay) return;
        const rect = rsiContainer.getBoundingClientRect();
        rsiOverlay.width = rect.width * devicePixelRatio;
        rsiOverlay.height = rect.height * devicePixelRatio;
        rsiOverlay.style.width = rect.width + 'px';
        rsiOverlay.style.height = rect.height + 'px';
        const ctx = rsiOverlay.getContext('2d');
        ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
      }

      function clearRSIOverlay(){
        if(!rsiOverlay) return;
        const ctx = rsiOverlay.getContext('2d');
        ctx.clearRect(0,0,rsiOverlay.width, rsiOverlay.height);
      }

      function drawRSIBand(){
        if(!rsiOverlay) return;
        const ctx = rsiOverlay.getContext('2d');
        ctx.clearRect(0,0,rsiOverlay.width, rsiOverlay.height);
        // need coordinates for 70 and 30
        try{
          const y70 = rsiSeries.priceToCoordinate(70);
          const y30 = rsiSeries.priceToCoordinate(30);
          if(typeof y70 !== 'number' || typeof y30 !== 'number') return;
          const rectTop = Math.min(y70,y30);
          const rectHeight = Math.abs(y70-y30);
          ctx.fillStyle = 'rgba(234,88,12,0.08)';
          ctx.fillRect(0, rectTop, rsiOverlay.width/devicePixelRatio, rectHeight);
        }catch(e){
          // priceToCoordinate may fail if scale not ready
        }
      }
    // Bollinger Bands
    const bbToggleEl = document.getElementById('bbToggle');
    if(bbToggleEl && bbToggleEl.checked){
      const bb = calcBollingerBands(candleData,20,2);
      bbUpper.setData(bb.upper); bbLower.setData(bb.lower);
      bbUpper.applyOptions({ visible: true }); bbLower.applyOptions({ visible: true });
    } else {
      bbUpper.setData([]); bbUpper.applyOptions({ visible: false });
      bbLower.setData([]); bbLower.applyOptions({ visible: false });
    }
  }

  // Tooltip
  function showTooltipAtPoint(point, content){
    tooltip.style.left = (point.x + 12) + 'px';
    tooltip.style.top = (point.y + 12) + 'px';
    tooltip.innerHTML = content;
    tooltip.style.display = 'block';
  }

  chart.subscribeCrosshairMove(param=>{
    if(!param.time){ tooltip.style.display = 'none'; return; }
    const t = typeof param.time === 'object' && param.time.year ? (new Date(param.time.year, param.time.month-1, param.time.day).getTime()/1000) : param.time;
    const d = dataMap[t];
    if(!d){ tooltip.style.display='none'; return; }
    let html = `<div><strong>${symbolInput.value}</strong></div>`;
    const dt = new Date(t*1000);
    html += `<div>${dt.toLocaleString()}</div>`;
    html += `<div>O: ${d.open} H: ${d.high} L: ${d.low} C: ${d.close}</div>`;
    if(smaToggle.checked){
      const s = pointForSeriesAtTime(smaSeries, t);
      if(s!=null) html += `<div>SMA: ${s}</div>`;
    }
    if(emaToggle.checked){
      const e = pointForSeriesAtTime(emaSeries, t);
      if(e!=null) html += `<div>EMA: ${e}</div>`;
    }
    showTooltipAtPoint(param.point, html);
  });

  function pointForSeriesAtTime(series, time){
    // use series data by searching in its internal data array (we keep our own arrays)
    const data = series === smaSeries ? calcSMA(candleData,20) : (series===emaSeries ? calcEMA(candleData,20) : []);
    for(const p of data){ if(p.time === time) return p.value.toFixed(4); }
    return null;
  }

  // Resizing
  function resizeCanvas(){
    const rect = chartContainer.getBoundingClientRect();
    drawCanvas.width = rect.width * devicePixelRatio;
    drawCanvas.height = rect.height * devicePixelRatio;
    drawCanvas.style.width = rect.width + 'px';
    drawCanvas.style.height = rect.height + 'px';
    drawCtx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
    redrawShapes();
  }

  function resizeAllCharts(){
    const w = chartContainer.clientWidth;
    const mainH = chartContainer.clientHeight;
    chart.resize(w, mainH);
    const macdH = document.getElementById('macd-container').clientHeight;
    const rsiH = document.getElementById('rsi-container').clientHeight;
    macdChart.resize(w, macdH);
    rsiChart.resize(w, rsiH);
    resizeCanvas();
    resizeRSIOverlay();
    drawRSIBand();
  }

  window.addEventListener('resize', resizeAllCharts);

  // keep indicator charts time range synced with main chart
  chart.timeScale().subscribeVisibleTimeRangeChange(()=>{
    const vr = chart.timeScale().getVisibleRange();
    if(vr){
      macdChart.timeScale().setVisibleRange(vr);
      rsiChart.timeScale().setVisibleRange(vr);
    }
  });

  // Drawing layer (simple straight-line tool)
  const drawCtx = drawCanvas.getContext('2d');
  let drawMode = false;
  let drawing = false;
  let startPt = null;
  const shapes = [];

  function setDrawMode(on){ drawMode = on; drawToggle.textContent = `绘图: ${on? '开启':'关闭'}`; drawCanvas.style.pointerEvents = on ? 'auto' : 'none'; }

  drawCanvas.addEventListener('pointerdown', (ev)=>{
    if(!drawMode) return;
    drawing = true;
    const r = drawCanvas.getBoundingClientRect();
    startPt = { x: (ev.clientX - r.left), y: (ev.clientY - r.top) };
  });
  drawCanvas.addEventListener('pointermove', (ev)=>{
    if(!drawing) return;
    const r = drawCanvas.getBoundingClientRect();
    const pt = { x: (ev.clientX - r.left), y: (ev.clientY - r.top) };
    drawCtx.clearRect(0,0,drawCanvas.width,drawCanvas.height);
    redrawShapes();
    drawCtx.strokeStyle = '#f97316';
    drawCtx.lineWidth = 2;
    drawCtx.beginPath();
    drawCtx.moveTo(startPt.x, startPt.y);
    drawCtx.lineTo(pt.x, pt.y);
    drawCtx.stroke();
  });
  drawCanvas.addEventListener('pointerup', (ev)=>{
    if(!drawing) return;
    drawing = false;
    const r = drawCanvas.getBoundingClientRect();
    const endPt = { x: (ev.clientX - r.left), y: (ev.clientY - r.top) };
    shapes.push({ type: 'line', from: startPt, to: endPt, color: '#f97316', width: 2 });
    startPt = null;
    drawCtx.clearRect(0,0,drawCanvas.width,drawCanvas.height);
    redrawShapes();
  });

  function redrawShapes(){
    drawCtx.save();
    drawCtx.clearRect(0,0,drawCanvas.width,drawCanvas.height);
    for(const s of shapes){
      if(s.type==='line'){
        drawCtx.strokeStyle = s.color;
        drawCtx.lineWidth = s.width;
        drawCtx.beginPath();
        drawCtx.moveTo(s.from.x, s.from.y);
        drawCtx.lineTo(s.to.x, s.to.y);
        drawCtx.stroke();
      }
    }
    drawCtx.restore();
  }

  // Export screenshot using html2canvas
  exportBtn.addEventListener('click', ()=>{
    const wrapper = document.getElementById('chart-wrapper');
    html2canvas(wrapper, { backgroundColor: '#071122', scale: devicePixelRatio }).then(canvas=>{
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `${symbolInput.value || 'chart'}_${Date.now()}.png`;
      a.click();
    });
  });

  // UI bindings
  timeframeSelect.addEventListener('change', ()=> loadDataForTimeframe(timeframeSelect.value));
  smaToggle.addEventListener('change', updateIndicators);
  emaToggle.addEventListener('change', updateIndicators);
  document.getElementById('macdToggle')?.addEventListener('change', updateIndicators);
  document.getElementById('rsiToggle')?.addEventListener('change', updateIndicators);
  document.getElementById('bbToggle')?.addEventListener('change', updateIndicators);
  drawToggle.addEventListener('click', ()=> setDrawMode(!drawMode));
  rsiPeriodInput?.addEventListener('change', ()=> updateIndicators());

  // init
  function init(){
    // size chart container to CSS size
    chart.resize(chartContainer.clientWidth, chartContainer.clientHeight);
    // also size indicator charts
    macdChart.resize(chartContainer.clientWidth, document.getElementById('macd-container').clientHeight);
    rsiChart.resize(chartContainer.clientWidth, document.getElementById('rsi-container').clientHeight);
    loadDataForTimeframe(timeframeSelect.value);
    setDrawMode(false);
    // initial canvas sizing
    resizeCanvas();
  }

  init();
})();