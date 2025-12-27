(function () {
  function calcEMAValues(data, period) {
    const res = [];
    const k = 2 / (period + 1);
    let ema = data[0].close;
    for (let i = 0; i < data.length; i++) {
      const price = data[i].close;
      ema = i === 0 ? price : (price * k + ema * (1 - k));
      res.push({ time: data[i].time, value: +ema.toFixed(4) });
    }
    return res;
  }

  function calcMACD(data, fast = 12, slow = 26, signal = 9) {
    const fastEMA = calcEMAValues(data, fast);
    const slowEMA = calcEMAValues(data, slow);
    const macd = [];
    for (let i = 0; i < data.length; i++) {
      const m = { time: data[i].time, value: +(fastEMA[i].value - slowEMA[i].value).toFixed(4) };
      macd.push(m);
    }
    const macdValues = macd.map(m => ({ time: m.time, close: m.value }));
    const signalSeries = calcEMAValues(macdValues, signal);
    const hist = macd.map((m, i) => ({ time: m.time, value: +(m.value - signalSeries[i].value).toFixed(4), color: (m.value - signalSeries[i].value) >= 0 ? '#26a69a' : '#ef5350' }));
    return { macd, signal: signalSeries, hist };
  }

  window.ChartApp = window.ChartApp || {};
  window.ChartApp.indicators = window.ChartApp.indicators || {};
  window.ChartApp.indicators.calcMACD = calcMACD;
})();
