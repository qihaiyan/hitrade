(function () {
  let candleData = [];
  let volumeData = [];
  let dataMap = {};

  function toUnixSeconds(date) { return Math.floor(date.getTime() / 1000); }

  function generateBars(count = 400, timeframeSec = 60) {
    const bars = [];
    const volumes = [];
    let t = toUnixSeconds(new Date());
    t -= count * timeframeSec;
    let price = 100;
    for (let i = 0; i < count; i++) {
      const open = price;
      const change = (Math.random() - 0.5) * 2 * (Math.random() * 1.5 + 0.2);
      let close = Math.max(0.1, +(open + change).toFixed(2));
      const high = Math.max(open, close) + +(Math.random() * 1.2).toFixed(2);
      const low = Math.min(open, close) - +(Math.random() * 1.2).toFixed(2);
      const vol = Math.round(100 + Math.random() * 900);
      const bar = { time: t, open: +open.toFixed(2), high: +high.toFixed(2), low: +low.toFixed(2), close: +close.toFixed(2) };
      bars.push(bar);
      volumes.push({ time: t, value: vol, color: close >= open ? '#26a69a' : '#ef5350' });
      dataMap[t] = bar;
      price = close;
      t += timeframeSec;
    }
    return { bars, volumes };
  }

  function loadDataForTimeframe(tf) {
    const sec = tf === 'D' ? 86400 : parseInt(tf, 10) * 60;
    const { bars, volumes } = generateBars(500, sec);
    candleData = bars;
    volumeData = volumes;
    dataMap = {};
    for (const b of bars) dataMap[b.time] = b;
    return { candleData, volumeData, dataMap };
  }

  function getValueAtTime(arr, time) { if (!arr) return null; for (const p of arr) if (p.time === time) return p.value ?? p.close ?? p; return null; }

  function getDataTimeBounds() {
    if (!candleData || candleData.length === 0) return null;
    return { min: candleData[0].time, max: candleData[candleData.length - 1].time };
  }

  window.ChartApp = window.ChartApp || {};
  window.ChartApp.dataService = {
    getCandleData: () => candleData,
    getVolumeData: () => volumeData,
    getDataMap: () => dataMap,
    generateBars,
    loadDataForTimeframe,
    getValueAtTime,
    getDataTimeBounds,
  };
})();
