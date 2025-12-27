(function () {
  function calcBollingerBands(data, period = 20, mult = 2) {
    const resUpper = [];
    const resLower = [];
    for (let i = 0; i < data.length; i++) {
      if (i >= period - 1) {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += data[j].close;
        const sma = sum / period;
        let variance = 0;
        for (let j = i - period + 1; j <= i; j++) variance += Math.pow(data[j].close - sma, 2);
        variance /= period;
        const std = Math.sqrt(variance);
        resUpper.push({ time: data[i].time, value: +(sma + mult * std).toFixed(4) });
        resLower.push({ time: data[i].time, value: +(sma - mult * std).toFixed(4) });
      }
    }
    return { upper: resUpper, lower: resLower };
  }

  window.ChartApp = window.ChartApp || {};
  window.ChartApp.indicators = window.ChartApp.indicators || {};
  window.ChartApp.indicators.calcBollingerBands = calcBollingerBands;
})();
