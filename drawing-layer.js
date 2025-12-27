(function () {
  const drawCanvas = document.getElementById('drawLayer');
  const drawCtx = drawCanvas.getContext('2d');
  let drawMode = false;
  let drawing = false;
  let startPt = null;
  const shapes = [];

  function setDrawMode(on) {
    drawMode = on;
    const drawToggle = document.getElementById('drawToggle');
    drawToggle.textContent = `绘图: ${on ? '开启' : '关闭'}`;
    drawCanvas.style.pointerEvents = on ? 'auto' : 'none';
  }

  function resizeCanvas() {
    const chartContainer = document.getElementById('chart');
    const rect = chartContainer.getBoundingClientRect();
    drawCanvas.width = rect.width * devicePixelRatio;
    drawCanvas.height = rect.height * devicePixelRatio;
    drawCanvas.style.width = rect.width + 'px';
    drawCanvas.style.height = rect.height + 'px';
    drawCtx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    redrawShapes();
  }

  function redrawShapes() {
    drawCtx.save();
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    for (const s of shapes) {
      if (s.type === 'line') {
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

  function initDrawingEvents() {
    drawCanvas.addEventListener('pointerdown', (ev) => {
      if (!drawMode) return;
      drawing = true;
      const r = drawCanvas.getBoundingClientRect();
      startPt = { x: (ev.clientX - r.left), y: (ev.clientY - r.top) };
    });

    drawCanvas.addEventListener('pointermove', (ev) => {
      if (!drawing) return;
      const r = drawCanvas.getBoundingClientRect();
      const pt = { x: (ev.clientX - r.left), y: (ev.clientY - r.top) };
      drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
      redrawShapes();
      drawCtx.strokeStyle = '#f97316';
      drawCtx.lineWidth = 2;
      drawCtx.beginPath();
      drawCtx.moveTo(startPt.x, startPt.y);
      drawCtx.lineTo(pt.x, pt.y);
      drawCtx.stroke();
    });

    drawCanvas.addEventListener('pointerup', (ev) => {
      if (!drawing) return;
      drawing = false;
      const r = drawCanvas.getBoundingClientRect();
      const endPt = { x: (ev.clientX - r.left), y: (ev.clientY - r.top) };
      shapes.push({ type: 'line', from: startPt, to: endPt, color: '#f97316', width: 2 });
      startPt = null;
      drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
      redrawShapes();
    });
  }

  window.ChartApp = window.ChartApp || {};
  window.ChartApp.drawing = {
    setDrawMode,
    resizeCanvas,
    redrawShapes,
    initDrawingEvents,
    getShapes: () => shapes,
  };
})();
