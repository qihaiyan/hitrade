import { useEffect, useRef, useState, useCallback } from 'react'
import * as LightweightCharts from 'lightweight-charts'
import { chartDataService } from '../services/chartDataService'
import { chartIndicators } from '../services/chartIndicators'

interface ChartProps {
  initialTimeframe?: string
}

function Chart({ initialTimeframe = '1m' }: ChartProps) {
  // Type aliases for convenience
  type ChartApiRef = LightweightCharts.IChartApi | null
  type CandlestickSeriesRef = LightweightCharts.ISeriesApi<'Candlestick'> | null
  type LineSeriesRef = LightweightCharts.ISeriesApi<'Line'> | null
  type HistogramSeriesRef = LightweightCharts.ISeriesApi<'Histogram'> | null
  
  // Chart containers
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const volumeContainerRef = useRef<HTMLDivElement>(null)
  const macdContainerRef = useRef<HTMLDivElement>(null)
  const rsiContainerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  
  // Chart instances organized by type
  const chartsRef = useRef<{
    main: ChartApiRef
    volume: ChartApiRef
    macd: ChartApiRef
    rsi: ChartApiRef
  }>({ main: null, volume: null, macd: null, rsi: null })
  
  // Series instances organized by chart and type
  const seriesRef = useRef<{
    // Main chart series
    candle: CandlestickSeriesRef
    sma: LineSeriesRef
    ema: LineSeriesRef
    bbUpper: LineSeriesRef
    bbMiddle: LineSeriesRef
    bbLower: LineSeriesRef
    
    // Volume chart series
    volume: HistogramSeriesRef
    
    // MACD chart series
    macd: LineSeriesRef
    macdSignal: LineSeriesRef
    macdHistogram: HistogramSeriesRef
    
    // RSI chart series
    rsi: LineSeriesRef
  }>({
    candle: null,
    sma: null,
    ema: null,
    bbUpper: null,
    bbMiddle: null,
    bbLower: null,
    volume: null,
    macd: null,
    macdSignal: null,
    macdHistogram: null,
    rsi: null
  })
  
  const eventListenersRef = useRef<{
    chartContainer?: HTMLElement | null
    volumeContainer?: HTMLElement | null
    macdContainer?: HTMLElement | null
    rsiContainer?: HTMLElement | null
    handleZoom?: (e: WheelEvent) => void
  }>({})
  
  // State
  const [timeframe, setTimeframe] = useState<string>(initialTimeframe)
  const [showSMA, setShowSMA] = useState<boolean>(true)
  const [showEMA, setShowEMA] = useState<boolean>(false)
  const [showMACD, setShowMACD] = useState<boolean>(true)
  const [showRSI, setShowRSI] = useState<boolean>(true)
  const [showBB, setShowBB] = useState<boolean>(false)
  const [smaPeriod] = useState<number>(20)
  const [emaPeriod] = useState<number>(20)
  const [rsiPeriod] = useState<number>(14)
  
  // Show tooltip at a specific point
  const showTooltipAtPoint = useCallback((point: { x: number, y: number }, html: string) => {
    if (!tooltipRef.current) return
    const wrapper = document.getElementById('chart-wrapper')
    if (!wrapper) return
    
    const tooltip = tooltipRef.current
    const wrapRect = wrapper.getBoundingClientRect()
    
    tooltip.style.display = 'block'
    tooltip.innerHTML = html
    
    const maxW = Math.min(360, Math.max(220, wrapRect.width - 24))
    tooltip.style.maxWidth = maxW + 'px'
    tooltip.style.width = 'auto'
    
    const ttRect = tooltip.getBoundingClientRect()
    let left = point.x + 12
    let top = point.y + 12
    
    // Ensure tooltip stays within bounds
    if (left + ttRect.width > wrapRect.right) {
      left = Math.max(8, wrapRect.width - ttRect.width - 8)
    }
    if (top + ttRect.height > wrapRect.bottom) {
      top = Math.max(8, wrapRect.height - ttRect.height - 8)
    }
    
    tooltip.style.left = left + 'px'
    tooltip.style.top = top + 'px'
  }, [])
  
  // Hide tooltip
  const hideTooltip = useCallback(() => {
    if (tooltipRef.current) {
      tooltipRef.current.style.display = 'none'
    }
  }, [])
  
  // Initialize charts
  const initializeCharts = useCallback(() => {
    if (!chartContainerRef.current || !volumeContainerRef.current) return
    
    // Main chart
    const chart = LightweightCharts.createChart(chartContainerRef.current, {
      layout: {
        background: {
          type: LightweightCharts.ColorType.Solid,
          color: '#071122'
        },
        textColor: '#dbeafe'
      },
      rightPriceScale: { visible: false },
      timeScale: { timeVisible: true, secondsVisible: false },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.02)' }
      }
    })
    
    // Volume chart
    const volumeChart = LightweightCharts.createChart(volumeContainerRef.current, {
      layout: {
        background: {
          type: LightweightCharts.ColorType.Solid,
          color: '#071122'
        },
        textColor: '#9fb4d9'
      },
      rightPriceScale: { visible: false },
      timeScale: { timeVisible: true, secondsVisible: false },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.02)' }
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
        vertLine: { visible: false },
        horzLine: { visible: false }
      }
    })
    
    // MACD chart
    const macdChart = macdContainerRef.current ? LightweightCharts.createChart(macdContainerRef.current, {
      layout: {
        background: {
          type: LightweightCharts.ColorType.Solid,
          color: '#071122'
        },
        textColor: '#9fb4d9'
      },
      rightPriceScale: { visible: false },
      timeScale: { timeVisible: true, secondsVisible: false },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.02)' }
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
        vertLine: { visible: false },
        horzLine: { visible: false }
      }
    }) : null
    
    // RSI chart
    const rsiChart = rsiContainerRef.current ? LightweightCharts.createChart(rsiContainerRef.current, {
      layout: {
        background: {
          type: LightweightCharts.ColorType.Solid,
          color: '#071122'
        },
        textColor: '#9fb4d9'
      },
      rightPriceScale: { visible: false },
      timeScale: { timeVisible: true, secondsVisible: false },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.02)' }
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
        vertLine: { visible: false },
        horzLine: { visible: false }
      }
    }) : null

    // Force resize to ensure charts are rendered properly
    chart.applyOptions({ width: chartContainerRef.current?.clientWidth || 800, height: 400 })
    volumeChart.applyOptions({ width: volumeContainerRef.current?.clientWidth || 800, height: 120 })
    macdChart?.applyOptions({ width: macdContainerRef.current?.clientWidth || 800, height: 120 })
    rsiChart?.applyOptions({ width: rsiContainerRef.current?.clientWidth || 800, height: 120 })

    // Call resize explicitly to ensure proper rendering
    chart.resize(chartContainerRef.current?.clientWidth || 800, 400)
    volumeChart.resize(volumeContainerRef.current?.clientWidth || 800, 120)
    macdChart?.resize(macdContainerRef.current?.clientWidth || 800, 120)
    rsiChart?.resize(rsiContainerRef.current?.clientWidth || 800, 120)
    
    // Add series
    const candleSeries = chart.addSeries(LightweightCharts.CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: true,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350'
    }) as LightweightCharts.ISeriesApi<'Candlestick'>
    
    const volumeSeries = volumeChart.addSeries(LightweightCharts.HistogramSeries, {
      priceFormat: { type: 'volume' },
      color: '#26a69a'
    }) as LightweightCharts.ISeriesApi<'Histogram'>
    
    const smaSeries = chart.addSeries(LightweightCharts.LineSeries, {
      color: '#eab308',
      lineWidth: 2,
      visible: false
    }) as LightweightCharts.ISeriesApi<'Line'>
    
    const emaSeries = chart.addSeries(LightweightCharts.LineSeries, {
      color: '#60a5fa',
      lineWidth: 2,
      visible: false
    }) as LightweightCharts.ISeriesApi<'Line'>
    
    const bbUpperSeries = chart.addSeries(LightweightCharts.LineSeries, {
      color: '#06b6d4',
      lineWidth: 1,
      visible: false
    }) as LightweightCharts.ISeriesApi<'Line'>
    
    const bbMiddleSeries = chart.addSeries(LightweightCharts.LineSeries, {
      color: '#fbbf24',
      lineWidth: 1,
      visible: false
    }) as LightweightCharts.ISeriesApi<'Line'>
    
    const bbLowerSeries = chart.addSeries(LightweightCharts.LineSeries, {
      color: '#06b6d4',
      lineWidth: 1,
      visible: false
    }) as LightweightCharts.ISeriesApi<'Line'>
    
    let macdSeries: LightweightCharts.ISeriesApi<'Line'> | null = null
    let macdSignalSeries: LightweightCharts.ISeriesApi<'Line'> | null = null
    let macdHistogramSeries: LightweightCharts.ISeriesApi<'Histogram'> | null = null
    if (macdChart) {
      macdSeries = macdChart.addSeries(LightweightCharts.LineSeries, {
        color: '#7c3aed',
        lineWidth: 2,
        visible: false
      }) as LightweightCharts.ISeriesApi<'Line'>
      
      macdSignalSeries = macdChart.addSeries(LightweightCharts.LineSeries, {
        color: '#ef4444',
        lineWidth: 1,
        visible: false
      }) as LightweightCharts.ISeriesApi<'Line'>
      
      macdHistogramSeries = macdChart.addSeries(LightweightCharts.HistogramSeries, {
        color: '#60a5fa',
        visible: false,
        priceFormat: { type: 'volume' }
      }) as LightweightCharts.ISeriesApi<'Histogram'>
    }
    
    let rsiSeries: LightweightCharts.ISeriesApi<'Line'> | null = null
    if (rsiChart) {
      rsiSeries = rsiChart.addSeries(LightweightCharts.LineSeries, {
        color: '#f97316',
        lineWidth: 2,
        visible: false
      }) as LightweightCharts.ISeriesApi<'Line'>
    }
    
    // Connect time scales and price scales for full synchronization
    // Sync time scales
    const syncTimeScales = () => {
      const range = chart.timeScale().getVisibleLogicalRange()
      if (range) {
        volumeChart.timeScale().setVisibleLogicalRange(range)
        macdChart?.timeScale().setVisibleLogicalRange(range)
        rsiChart?.timeScale().setVisibleLogicalRange(range)
      }
    }
    
    // Sync price scales - volume, MACD, and RSI charts have fixed height, so only sync time scales for them
    // For main chart, we'll handle mouse wheel zoom specifically
    let isSyncing = false
    
    // Handle mouse wheel for zoom sync - use event delegation to prevent duplicate events
    const handleZoom = (_e: WheelEvent) => {
      if (isSyncing) return
      isSyncing = true
      
      // The main chart handles zooming, others will sync time scale
      // The price axis scaling is handled by each chart independently based on their data
      
      // Small delay to ensure main chart has updated before syncing
      setTimeout(() => {
        syncTimeScales()
        isSyncing = false
      }, 10)
    }
    
    // Add wheel event listeners to all chart containers
    const chartContainer = chartContainerRef.current
    const volumeContainer = volumeContainerRef.current
    const macdContainer = macdContainerRef.current
    const rsiContainer = rsiContainerRef.current
    
    chartContainer?.addEventListener('wheel', handleZoom, { passive: false })
    volumeContainer?.addEventListener('wheel', handleZoom, { passive: false })
    macdContainer?.addEventListener('wheel', handleZoom, { passive: false })
    rsiContainer?.addEventListener('wheel', handleZoom, { passive: false })
    
    // Subscribe to time scale changes
    chart.timeScale().subscribeVisibleLogicalRangeChange(syncTimeScales)
    volumeChart.timeScale().subscribeVisibleLogicalRangeChange(syncTimeScales)
    macdChart?.timeScale().subscribeVisibleLogicalRangeChange(syncTimeScales)
    rsiChart?.timeScale().subscribeVisibleLogicalRangeChange(syncTimeScales)
    
    // Store event listeners for cleanup
    eventListenersRef.current = {
      chartContainer,
      volumeContainer,
      macdContainer,
      rsiContainer,
      handleZoom
    }
    
    // Setup crosshair
    chart.subscribeCrosshairMove(param => {
      // Update position of crosshair in other charts
      // For simplicity, we'll just sync time scales
      const range = chart.timeScale().getVisibleLogicalRange()
      if (range) {
        volumeChart.timeScale().setVisibleLogicalRange(range)
        macdChart?.timeScale().setVisibleLogicalRange(range)
        rsiChart?.timeScale().setVisibleLogicalRange(range)
      }
      
      if (param.point && param.seriesData) {
        const data = param.seriesData.get(candleSeries)
        if (data && data.time) {
          const time = data.time
          const candle = chartDataService.getDataByTime(time)
          
          if (candle) {
            const html = `
              <div class="font-mono text-sm">
                <div class="mb-2 font-semibold text-white">${new Date(Number(time) * 1000).toLocaleString()}</div>
                <div class="grid grid-cols-2 gap-2">
                  <div><span class="text-gray-400">Open:</span> <span class="text-white">${candle.open.toFixed(2)}</span></div>
                  <div><span class="text-gray-400">Close:</span> <span class="text-white">${candle.close.toFixed(2)}</span></div>
                  <div><span class="text-gray-400">High:</span> <span class="text-white">${candle.high.toFixed(2)}</span></div>
                  <div><span class="text-gray-400">Low:</span> <span class="text-white">${candle.low.toFixed(2)}</span></div>
                  <div class="col-span-2"><span class="text-gray-400">Volume:</span> <span class="text-white">${chartDataService.getValueAtTime(chartDataService.getVolumeData(), time)}</span></div>
                </div>
              </div>
            `
            
            showTooltipAtPoint(param.point, html)
          } else {
            hideTooltip()
          }
        } else {
          hideTooltip()
        }
      } else {
        hideTooltip()
      }
    })
    
    // Save instances to organized refs
    chartsRef.current = {
      main: chart,
      volume: volumeChart,
      macd: macdChart,
      rsi: rsiChart
    }
    
    seriesRef.current = {
      candle: candleSeries,
      sma: smaSeries,
      ema: emaSeries,
      bbUpper: bbUpperSeries,
      bbMiddle: bbMiddleSeries,
      bbLower: bbLowerSeries,
      volume: volumeSeries,
      macd: macdSeries,
      macdSignal: macdSignalSeries,
      macdHistogram: macdHistogramSeries,
      rsi: rsiSeries
    }
    
    // Load initial data
    loadData(timeframe)
  }, [timeframe, showTooltipAtPoint, hideTooltip])
  
  // Load data based on timeframe
  const loadData = useCallback((tf: string) => {
    const { candleData, volumeData } = chartDataService.loadDataForTimeframe(tf)
    
    // Update main chart
    seriesRef.current.candle?.setData(candleData)
    seriesRef.current.volume?.setData(volumeData)
    
    // Update indicators
    updateIndicators()
  }, [])
  
  // Update indicators
  const updateIndicators = useCallback(() => {
    const data = chartDataService.getCandleData()
    const { sma, ema, bbUpper, bbMiddle, bbLower, macd, macdSignal, macdHistogram, rsi } = seriesRef.current
    
    // Update SMA
    if (showSMA && sma) {
      const smaData = chartIndicators.calcSMA(data, smaPeriod)
      sma.setData(smaData)
      sma.applyOptions({ visible: true })
    } else if (sma) {
      sma.applyOptions({ visible: false })
    }
    
    // Update EMA
    if (showEMA && ema) {
      const emaData = chartIndicators.calcEMA(data, emaPeriod)
      ema.setData(emaData)
      ema.applyOptions({ visible: true })
    } else if (ema) {
      ema.applyOptions({ visible: false })
    }
    
    // Update Bollinger Bands
    if (showBB && bbUpper && bbMiddle && bbLower) {
      const { upper, middle, lower } = chartIndicators.calcBB(data, smaPeriod)
      bbUpper.setData(upper)
      bbMiddle.setData(middle)
      bbLower.setData(lower)
      bbUpper.applyOptions({ visible: true })
      bbMiddle.applyOptions({ visible: true })
      bbLower.applyOptions({ visible: true })
    } else {
      bbUpper?.applyOptions({ visible: false })
      bbMiddle?.applyOptions({ visible: false })
      bbLower?.applyOptions({ visible: false })
    }
    
    // Update MACD
    if (showMACD && macd && macdSignal && macdHistogram) {
      const { macd: macdData, signal, histogram } = chartIndicators.calcMACD(data)
      macd.setData(macdData)
      macdSignal.setData(signal)
      macdHistogram.setData(histogram)
      macd.applyOptions({ visible: true })
      macdSignal.applyOptions({ visible: true })
      macdHistogram.applyOptions({ visible: true })
    } else {
      macd?.applyOptions({ visible: false })
      macdSignal?.applyOptions({ visible: false })
      macdHistogram?.applyOptions({ visible: false })
    }
    
    // Update RSI
    if (showRSI && rsi) {
      const rsiData = chartIndicators.calcRSI(data, rsiPeriod)
      rsi.setData(rsiData)
      rsi.applyOptions({ visible: true })
    } else if (rsi) {
      rsi.applyOptions({ visible: false })
    }
    
    // Force complete rendering of all charts, regardless of mouse position
    // This robust approach ensures charts display correctly after indicator visibility changes
    
    // Function to trigger complete chart update
    const forceChartUpdate = () => {
      const width = chartContainerRef.current?.clientWidth || 800
      const height = 400
      const indicatorHeight = 120
      const { main, volume, macd, rsi } = chartsRef.current
      
      // Resize all charts
      main?.resize(width, height)
      volume?.resize(width, indicatorHeight)
      macd?.resize(width, indicatorHeight)
      rsi?.resize(width, indicatorHeight)
      
      // Force time scale update to ensure proper data range display
      const mainRange = main?.timeScale().getVisibleLogicalRange()
      if (mainRange) {
        volume?.timeScale().setVisibleLogicalRange(mainRange)
        macd?.timeScale().setVisibleLogicalRange(mainRange)
        rsi?.timeScale().setVisibleLogicalRange(mainRange)
      }
      
      // Force redraw by toggling autoSize temporarily (if supported)
      if (main?.applyOptions) {
        main.applyOptions({ autoSize: false })
        main.applyOptions({ autoSize: false })
      }
    }
    
    // Use requestAnimationFrame to ensure updates happen in browser rendering cycle
    requestAnimationFrame(() => {
      forceChartUpdate()
      
      // Additional updates with increasing delays for maximum reliability
      setTimeout(() => {
        forceChartUpdate()
      }, 50)
      
      setTimeout(() => {
        forceChartUpdate()
      }, 150)
      
      setTimeout(() => {
        forceChartUpdate()
      }, 300)
      
      // Final update to ensure complete stabilization
      setTimeout(() => {
        forceChartUpdate()
      }, 500)
    })
  }, [showSMA, showEMA, showMACD, showRSI, smaPeriod, emaPeriod, rsiPeriod, showBB])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const width = chartContainerRef.current?.clientWidth || 800
      const height = 400
      const indicatorHeight = 120
      const { main, volume, macd, rsi } = chartsRef.current
      
      main?.resize(width, height)
      volume?.resize(width, indicatorHeight)
      macd?.resize(width, indicatorHeight)
      rsi?.resize(width, indicatorHeight)
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  
  // Handle timeframe change
  const handleTimeframeChange = useCallback((tf: string) => {
    setTimeframe(tf)
    loadData(tf)
  }, [loadData])
  
  // Initialize charts on mount
  useEffect(() => {
    initializeCharts()
    
    return () => {
      // Clean up event listeners
      const eventListeners = eventListenersRef.current
      if (eventListeners && eventListeners.handleZoom) {
        eventListeners.chartContainer?.removeEventListener('wheel', eventListeners.handleZoom)
        eventListeners.volumeContainer?.removeEventListener('wheel', eventListeners.handleZoom)
        eventListeners.macdContainer?.removeEventListener('wheel', eventListeners.handleZoom)
        eventListeners.rsiContainer?.removeEventListener('wheel', eventListeners.handleZoom)
      }
      
      // Clean up charts using organized refs
      const { main, volume, macd, rsi } = chartsRef.current
      main?.remove()
      volume?.remove()
      macd?.remove()
      rsi?.remove()
    }
  }, [initializeCharts])
  
  // Update indicators when settings change
  useEffect(() => {
    updateIndicators()
  }, [updateIndicators])

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-wrap gap-4 items-center">
        <div>
          <label className="mr-2 text-sm text-gray-400">Timeframe:</label>
          <select
            value={timeframe}
            onChange={(e) => handleTimeframeChange(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded px-3 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="1m">1 Minute</option>
            <option value="5m">5 Minutes</option>
            <option value="15m">15 Minutes</option>
            <option value="1h">1 Hour</option>
            <option value="4h">4 Hours</option>
            <option value="1d">1 Day</option>
          </select>
        </div>
        
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="show-sma"
              checked={showSMA}
              onChange={(e) => setShowSMA(e.target.checked)}
              className="mr-2 accent-blue-500"
            />
            <label htmlFor="show-sma" className="text-sm">SMA ({smaPeriod})</label>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="show-ema"
              checked={showEMA}
              onChange={(e) => setShowEMA(e.target.checked)}
              className="mr-2 accent-blue-500"
            />
            <label htmlFor="show-ema" className="text-sm">EMA ({emaPeriod})</label>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="show-macd"
              checked={showMACD}
              onChange={(e) => setShowMACD(e.target.checked)}
              className="mr-2 accent-blue-500"
            />
            <label htmlFor="show-macd" className="text-sm">MACD</label>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="show-rsi"
              checked={showRSI}
              onChange={(e) => setShowRSI(e.target.checked)}
              className="mr-2 accent-blue-500"
            />
            <label htmlFor="show-rsi" className="text-sm">RSI ({rsiPeriod})</label>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="show-bb"
              checked={showBB}
              onChange={(e) => setShowBB(e.target.checked)}
              className="mr-2 accent-blue-500"
            />
            <label htmlFor="show-bb" className="text-sm">Bollinger Bands</label>
          </div>
        </div>
      </div>
      
      <div id="chart-wrapper" className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700 shadow-xl">
        <div
          ref={chartContainerRef}
          className="h-[400px] sm:h-[500px]"
        ></div>
        <div
          ref={volumeContainerRef}
          className="h-[120px] sm:h-[150px] border-t border-slate-700"
        ></div>
        <div
          ref={macdContainerRef}
          className="h-[120px] sm:h-[150px] border-t border-slate-700"
        ></div>
        <div
          ref={rsiContainerRef}
          className="h-[120px] sm:h-[150px] border-t border-slate-700"
        ></div>
        
        <div
          ref={tooltipRef}
          className="absolute z-50 pointer-events-none bg-slate-800/95 backdrop-blur-sm border border-slate-700 rounded-lg p-3 shadow-lg hidden"
        ></div>
      </div>
    </div>
  )
}

export default Chart
