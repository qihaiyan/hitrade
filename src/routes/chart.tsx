import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState, useCallback } from 'react'
import * as LightweightCharts from 'lightweight-charts'
import html2canvas from 'html2canvas'

// Define chart data types
type ChartTime = string | number | LightweightCharts.BusinessDay

interface ChartData extends LightweightCharts.CandlestickData {
  value?: number
}

interface HistogramData extends LightweightCharts.HistogramData {
  value: number
}

// Data service implementation
const dataService = {
  candleData: [] as ChartData[],
  volumeData: [] as HistogramData[],
  dataMap: new Map<ChartTime, ChartData>(),
  
  toUnixSeconds(date: Date): number {
    return Math.floor(date.getTime() / 1000)
  },
  
  generateBars(count = 400, timeframeSec = 60): { bars: ChartData[], volumes: HistogramData[] } {
    const bars: ChartData[] = []
    const volumes: HistogramData[] = []
    let t = this.toUnixSeconds(new Date())
    t -= count * timeframeSec
    let price = 100
    
    for (let i = 0; i < count; i++) {
      const open = price
      const change = (Math.random() - 0.5) * 2 * (Math.random() * 1.5 + 0.2)
      let close = Math.max(0.1, +(open + change).toFixed(2))
      const high = Math.max(open, close) + +(Math.random() * 1.2).toFixed(2)
      const low = Math.min(open, close) - +(Math.random() * 1.2).toFixed(2)
      const vol = Math.round(100 + Math.random() * 900)
      
      const bar: ChartData = {
        time: t as LightweightCharts.UTCTimestamp,
        open: +open.toFixed(2),
        high: +high.toFixed(2),
        low: +low.toFixed(2),
        close: +close.toFixed(2)
      }
      
      bars.push(bar)
      volumes.push({
        time: t as LightweightCharts.UTCTimestamp,
        value: vol,
        color: close >= open ? '#26a69a' : '#ef5350'
      })
      
      this.dataMap.set(t, bar)
      price = close
      t += timeframeSec
    }
    
    return { bars, volumes }
  },
  
  loadDataForTimeframe(tf: string): { candleData: ChartData[], volumeData: HistogramData[] } {
    const sec = tf === 'D' ? 86400 : parseInt(tf, 10) * 60
    const { bars, volumes } = this.generateBars(500, sec)
    this.candleData = bars
    this.volumeData = volumes
    this.dataMap.clear()
    for (const b of bars) {
      if (b.time !== undefined) {
        this.dataMap.set(b.time, b)
      }
    }
    return { candleData: this.candleData, volumeData: this.volumeData }
  },
  
  getCandleData(): ChartData[] {
    return this.candleData
  },
  
  getVolumeData(): HistogramData[] {
    return this.volumeData
  },
  
  getValueAtTime(arr: any[], time: ChartTime): any {
    if (!arr) return null
    for (const p of arr) {
      if (p.time === time) return p.value ?? p.close ?? p
    }
    return null
  },
  
  getDataTimeBounds(): { min: ChartTime, max: ChartTime } | null {
    if (!this.candleData || this.candleData.length === 0) return null
    const firstTime = this.candleData[0].time
    const lastTime = this.candleData[this.candleData.length - 1].time
    return firstTime !== undefined && lastTime !== undefined ? { min: firstTime, max: lastTime } : null
  }
}

// Indicators implementation
const indicators = {
  // Simple Moving Average
  calcSMA(data: ChartData[], period: number): LightweightCharts.LineData[] {
    if (!data || data.length < period) return []
    const result: LightweightCharts.LineData[] = []
    let sum = 0
    
    // Calculate first average
    for (let i = 0; i < period; i++) {
      sum += data[i].close
    }
    
    result.push({
      time: data[period - 1].time,
      value: sum / period
    })
    
    // Calculate remaining averages
    for (let i = period; i < data.length; i++) {
      sum += data[i].close - data[i - period].close
      result.push({
        time: data[i].time,
        value: sum / period
      })
    }
    
    return result
  },
  
  // Exponential Moving Average
  calcEMA(data: ChartData[], period: number): LightweightCharts.LineData[] {
    if (!data || data.length === 0) return []
    const result: LightweightCharts.LineData[] = []
    const k = 2 / (period + 1)
    
    // Calculate first average (SMA) - if data length < period, use all available data
    const smaPeriod = Math.min(period, data.length)
    let sum = 0
    for (let i = 0; i < smaPeriod; i++) {
      sum += data[i].close
    }
    let ema = sum / smaPeriod
    
    result.push({
      time: data[smaPeriod - 1].time,
      value: ema
    })
    
    // Calculate remaining averages
    for (let i = smaPeriod; i < data.length; i++) {
      ema = data[i].close * k + ema * (1 - k)
      result.push({
        time: data[i].time,
        value: ema
      })
    }
    
    return result
  },
  
  // Moving Average Convergence Divergence (using macd.js logic)
  calcMACD(data: ChartData[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9): {
    macd: LightweightCharts.LineData[],
    signal: LightweightCharts.LineData[],
    histogram: LightweightCharts.HistogramData[]
  } {
    // Helper function to calculate EMA values (from macd.js)
    const calcEMAValues = (input: ChartData[], period: number): LightweightCharts.LineData[] => {
      const res: LightweightCharts.LineData[] = [];
      const k = 2 / (period + 1);
      let ema = input[0].close;
      for (let i = 0; i < input.length; i++) {
        const price = input[i].close;
        ema = i === 0 ? price : (price * k + ema * (1 - k));
        res.push({ time: input[i].time as LightweightCharts.UTCTimestamp, value: +ema.toFixed(4) });
      }
      return res;
    };

    const fastEMA = calcEMAValues(data, fastPeriod);
    const slowEMA = calcEMAValues(data, slowPeriod);
    const macd: LightweightCharts.LineData[] = [];

    // Calculate MACD line for all data points
    for (let i = 0; i < data.length; i++) {
      const m = { 
        time: data[i].time as LightweightCharts.UTCTimestamp, 
        value: +(fastEMA[i].value! - slowEMA[i].value!).toFixed(4) 
      };
      macd.push(m);
    }

    // Calculate signal line
    const macdValues = macd.map(m => ({
      time: m.time,
      close: m.value!
    })) as ChartData[];

    const signalSeries = calcEMAValues(macdValues, signalPeriod);

    // Calculate histogram
    const histogram: LightweightCharts.HistogramData[] = macd.map((m, i) => ({
      time: m.time,
      value: +(m.value! - signalSeries[i].value!).toFixed(4),
      color: (m.value! - signalSeries[i].value!) >= 0 ? '#26a69a' : '#ef5350'
    }));

    return { macd, signal: signalSeries, histogram };
  },
  
  // Relative Strength Index
  calcRSI(data: ChartData[], period = 14): LightweightCharts.LineData[] {
    if (!data || data.length < period + 1) return []
    const result: LightweightCharts.LineData[] = []
    const changes: number[] = []
    
    // Calculate price changes
    for (let i = 1; i < data.length; i++) {
      changes.push(data[i].close - data[i - 1].close)
    }
    
    // Calculate first average gains and losses
    let avgGain = 0
    let avgLoss = 0
    for (let i = 0; i < period; i++) {
      if (changes[i] > 0) {
        avgGain += changes[i]
      } else {
        avgLoss += Math.abs(changes[i])
      }
    }
    avgGain /= period
    avgLoss /= period
    
    // Calculate first RSI
    const rs = avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)))
    result.push({
      time: data[period].time,
      value: rs
    })
    
    // Calculate remaining RSI values
    for (let i = period; i < changes.length; i++) {
      const change = changes[i]
      const gain = change > 0 ? change : 0
      const loss = change < 0 ? Math.abs(change) : 0
      
      avgGain = (avgGain * (period - 1) + gain) / period
      avgLoss = (avgLoss * (period - 1) + loss) / period
      
      const rs = avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)))
      result.push({
        time: data[i + 1].time,
        value: rs
      })
    }
    
    return result
  },
  
  // Bollinger Bands
  calcBB(data: ChartData[], period = 20, stdDev = 2): {
    upper: LightweightCharts.LineData[],
    middle: LightweightCharts.LineData[],
    lower: LightweightCharts.LineData[]
  } {
    const sma = this.calcSMA(data, period)
    const upper: LightweightCharts.LineData[] = []
    const middle: LightweightCharts.LineData[] = []
    const lower: LightweightCharts.LineData[] = []
    
    for (let i = 0; i < sma.length; i++) {
      const smaPoint = sma[i]
      if (!smaPoint.time) continue
      
      // Calculate standard deviation for this period
      const startIndex = data.findIndex(d => d.time === smaPoint.time) - period + 1
      const endIndex = data.findIndex(d => d.time === smaPoint.time)
      
      if (startIndex >= 0 && endIndex >= startIndex) {
        const periodData = data.slice(startIndex, endIndex + 1)
        const mean = smaPoint.value!
        
        // Calculate variance
        const variance = periodData.reduce((acc, point) => {
          const diff = point.close - mean
          return acc + diff * diff
        }, 0) / periodData.length
        
        const std = Math.sqrt(variance)
        
        upper.push({
          time: smaPoint.time,
          value: mean + stdDev * std
        })
        
        middle.push(smaPoint)
        
        lower.push({
          time: smaPoint.time,
          value: mean - stdDev * std
        })
      }
    }
    
    return { upper, middle, lower }
  }
}

// Main chart page component
function ChartPage() {
  // Chart containers
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const volumeContainerRef = useRef<HTMLDivElement>(null)
  const macdContainerRef = useRef<HTMLDivElement>(null)
  const rsiContainerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  
  // Chart instances
  const chartRef = useRef<LightweightCharts.IChartApi | null>(null)
  const candleSeriesRef = useRef<LightweightCharts.ISeriesApi<'Candlestick'> | null>(null)
  const volumeChartRef = useRef<LightweightCharts.IChartApi | null>(null)
  const volumeSeriesRef = useRef<LightweightCharts.ISeriesApi<'Histogram'> | null>(null)
  const smaSeriesRef = useRef<LightweightCharts.ISeriesApi<'Line'> | null>(null)
  const emaSeriesRef = useRef<LightweightCharts.ISeriesApi<'Line'> | null>(null)
  const bbUpperSeriesRef = useRef<LightweightCharts.ISeriesApi<'Line'> | null>(null)
  const bbMiddleSeriesRef = useRef<LightweightCharts.ISeriesApi<'Line'> | null>(null)
  const bbLowerSeriesRef = useRef<LightweightCharts.ISeriesApi<'Line'> | null>(null)
  const macdChartRef = useRef<LightweightCharts.IChartApi | null>(null)
  const macdSeriesRef = useRef<LightweightCharts.ISeriesApi<'Line'> | null>(null)
  const macdSignalSeriesRef = useRef<LightweightCharts.ISeriesApi<'Line'> | null>(null)
  const macdHistogramSeriesRef = useRef<LightweightCharts.ISeriesApi<'Histogram'> | null>(null)
  const rsiChartRef = useRef<LightweightCharts.IChartApi | null>(null)
  const rsiSeriesRef = useRef<LightweightCharts.ISeriesApi<'Line'> | null>(null)
  
  // State
  const [timeframe, setTimeframe] = useState<string>('1m')
  const [showSMA, setShowSMA] = useState<boolean>(false)
  const [showEMA, setShowEMA] = useState<boolean>(false)
  const [showMACD, setShowMACD] = useState<boolean>(false)
  const [showRSI, setShowRSI] = useState<boolean>(false)
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
    
    // Connect time scales
    const syncCharts = () => {
      const range = chart.timeScale().getVisibleLogicalRange()
      if (range) {
        volumeChart.timeScale().setVisibleLogicalRange(range)
        macdChart?.timeScale().setVisibleLogicalRange(range)
        rsiChart?.timeScale().setVisibleLogicalRange(range)
      }
    }
    
    chart.timeScale().subscribeVisibleLogicalRangeChange(syncCharts)
    volumeChart.timeScale().subscribeVisibleLogicalRangeChange(syncCharts)
    
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
          const candle = dataService.dataMap.get(time)
          
          if (candle) {
            const html = `
              <div class="font-mono text-sm">
                <div class="mb-2 font-semibold text-white">${new Date(Number(time) * 1000).toLocaleString()}</div>
                <div class="grid grid-cols-2 gap-2">
                  <div><span class="text-gray-400">Open:</span> <span class="text-white">${candle.open.toFixed(2)}</span></div>
                  <div><span class="text-gray-400">Close:</span> <span class="text-white">${candle.close.toFixed(2)}</span></div>
                  <div><span class="text-gray-400">High:</span> <span class="text-white">${candle.high.toFixed(2)}</span></div>
                  <div><span class="text-gray-400">Low:</span> <span class="text-white">${candle.low.toFixed(2)}</span></div>
                  <div class="col-span-2"><span class="text-gray-400">Volume:</span> <span class="text-white">${dataService.getValueAtTime(dataService.getVolumeData(), time)}</span></div>
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
    
    // Save instances
    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    volumeChartRef.current = volumeChart
    volumeSeriesRef.current = volumeSeries
    smaSeriesRef.current = smaSeries
    emaSeriesRef.current = emaSeries
    bbUpperSeriesRef.current = bbUpperSeries
    bbMiddleSeriesRef.current = bbMiddleSeries
    bbLowerSeriesRef.current = bbLowerSeries
    macdChartRef.current = macdChart
    macdSeriesRef.current = macdSeries
    macdSignalSeriesRef.current = macdSignalSeries
    macdHistogramSeriesRef.current = macdHistogramSeries
    rsiChartRef.current = rsiChart
    rsiSeriesRef.current = rsiSeries
    
    // Load initial data
    loadData(timeframe)
  }, [timeframe, showTooltipAtPoint, hideTooltip])
  
  // Load data based on timeframe
  const loadData = useCallback((tf: string) => {
    const { candleData, volumeData } = dataService.loadDataForTimeframe(tf)
    
    // Update main chart
    candleSeriesRef.current?.setData(candleData)
    volumeSeriesRef.current?.setData(volumeData)
    
    // Update indicators
    updateIndicators()
  }, [])
  
  // Update indicators
  const updateIndicators = useCallback(() => {
    const data = dataService.getCandleData()
    
    // Update SMA
    if (showSMA && smaSeriesRef.current) {
      const sma = indicators.calcSMA(data, smaPeriod)
      smaSeriesRef.current.setData(sma)
      smaSeriesRef.current.applyOptions({ visible: true })
    } else if (smaSeriesRef.current) {
      smaSeriesRef.current.applyOptions({ visible: false })
    }
    
    // Update EMA
    if (showEMA && emaSeriesRef.current) {
      const ema = indicators.calcEMA(data, emaPeriod)
      emaSeriesRef.current.setData(ema)
      emaSeriesRef.current.applyOptions({ visible: true })
    } else if (emaSeriesRef.current) {
      emaSeriesRef.current.applyOptions({ visible: false })
    }
    
    // Update Bollinger Bands
    if (showBB && bbUpperSeriesRef.current && bbMiddleSeriesRef.current && bbLowerSeriesRef.current) {
      const { upper, middle, lower } = indicators.calcBB(data, smaPeriod)
      bbUpperSeriesRef.current.setData(upper)
      bbMiddleSeriesRef.current.setData(middle)
      bbLowerSeriesRef.current.setData(lower)
      bbUpperSeriesRef.current.applyOptions({ visible: true })
      bbMiddleSeriesRef.current.applyOptions({ visible: true })
      bbLowerSeriesRef.current.applyOptions({ visible: true })
    } else {
      bbUpperSeriesRef.current?.applyOptions({ visible: false })
      bbMiddleSeriesRef.current?.applyOptions({ visible: false })
      bbLowerSeriesRef.current?.applyOptions({ visible: false })
    }
    
    // Update MACD
    if (showMACD && macdSeriesRef.current && macdSignalSeriesRef.current && macdHistogramSeriesRef.current) {
      const { macd, signal, histogram } = indicators.calcMACD(data)
      macdSeriesRef.current.setData(macd)
      macdSignalSeriesRef.current.setData(signal)
      macdHistogramSeriesRef.current.setData(histogram)
      macdSeriesRef.current.applyOptions({ visible: true })
      macdSignalSeriesRef.current.applyOptions({ visible: true })
      macdHistogramSeriesRef.current.applyOptions({ visible: true })
    } else {
      macdSeriesRef.current?.applyOptions({ visible: false })
      macdSignalSeriesRef.current?.applyOptions({ visible: false })
      macdHistogramSeriesRef.current?.applyOptions({ visible: false })
    }
    
    // Update RSI
    if (showRSI && rsiSeriesRef.current) {
      const rsi = indicators.calcRSI(data, rsiPeriod)
      rsiSeriesRef.current.setData(rsi)
      rsiSeriesRef.current.applyOptions({ visible: true })
    } else if (rsiSeriesRef.current) {
      rsiSeriesRef.current.applyOptions({ visible: false })
    }
  }, [showSMA, showEMA, showMACD, showRSI, smaPeriod, emaPeriod, rsiPeriod, showBB])
  
  // Handle timeframe change
  const handleTimeframeChange = useCallback((tf: string) => {
    setTimeframe(tf)
    loadData(tf)
  }, [loadData])
  
  // Export chart as PNG
  const exportChart = useCallback(() => {
    const wrapper = document.getElementById('chart-wrapper')
    if (!wrapper) return
    
    html2canvas(wrapper, {
      backgroundColor: '#071122',
      scale: 2
    }).then(canvas => {
      const link = document.createElement('a')
      link.download = 'chart.png'
      link.href = canvas.toDataURL()
      link.click()
    })
  }, [])
  
  // Initialize charts on mount
  useEffect(() => {
    initializeCharts()
    
    return () => {
      // Clean up charts
      chartRef.current?.remove()
      volumeChartRef.current?.remove()
      macdChartRef.current?.remove()
      rsiChartRef.current?.remove()
    }
  }, [initializeCharts])
  
  // Update indicators when settings change
  useEffect(() => {
    updateIndicators()
  }, [updateIndicators])
  
  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Financial Chart</h1>
          <p className="text-gray-400">Interactive chart with technical indicators</p>
        </header>
        
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
          
          <div>
            <button
              onClick={exportChart}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
            >
              Export PNG
            </button>
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
    </div>
  )
}

export const Route = createFileRoute('/chart')({
  component: ChartPage,
})
