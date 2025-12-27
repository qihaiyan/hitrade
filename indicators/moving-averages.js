(function () {
  function calcSMA(data, period) {
    const res = [];
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i].close;
      if (i >= period) sum -= data[i - period].close;
      if (i >= period - 1) {
        res.push({ time: data[i].time, value: +(sum / period).toFixed(4) });
      }
    }
    return res;
  }

  function calcEMA(data, period) {
    const res = [];
    const k = 2 / (period + 1);
    let ema = data[0].close;
    for (let i = 0; i < data.length; i++) {
      const price = data[i].close;
      ema = i === 0 ? price : (price * k + ema * (1 - k));
      if (i >= period - 1) res.push({ time: data[i].time, value: +ema.toFixed(4) });
    }
    return res;
  }

  window.ChartApp = window.ChartApp || {};
  window.ChartApp.indicators = window.ChartApp.indicators || {};
  window.ChartApp.indicators.calcSMA = calcSMA;
  window.ChartApp.indicators.calcEMA = calcEMA;
})();
