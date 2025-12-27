(function () {
  function calcRSI(data, period = 14) {
    const res = [];
    res.push({ time: data[0].time, value: null });
    let gains = 0, losses = 0;
    for (let i = 1; i < data.length; i++) {
      const change = data[i].close - data[i - 1].close;
      if (i <= period) {
        if (change > 0) gains += change; else losses += Math.abs(change);
        if (i === period) {
          let rs = gains / (losses || 1e-8);
          res.push({ time: data[i].time, value: +(100 - (100 / (1 + rs))).toFixed(4) });
        } else {
          res.push({ time: data[i].time, value: null });
        }
      } else {
        gains = (gains * (period - 1) + Math.max(0, change)) / period;
        losses = (losses * (period - 1) + Math.max(0, -change)) / period;
        const rs = gains / (losses || 1e-8);
        res.push({ time: data[i].time, value: +(100 - (100 / (1 + rs))).toFixed(4) });
      }
    }
    return res;
  }

  window.ChartApp = window.ChartApp || {};
  window.ChartApp.indicators = window.ChartApp.indicators || {};
  window.ChartApp.indicators.calcRSI = calcRSI;
})();
