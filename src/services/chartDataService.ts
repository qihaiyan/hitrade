import * as LightweightCharts from 'lightweight-charts'
import { ChartData, HistogramData, ChartTime, DataServiceResult, ChartBounds, ChartService } from '../types/chart'

// Data service implementation
export class ChartDataService implements ChartService {
  private candleData: ChartData[] = []
  private volumeData: HistogramData[] = []
  private dataMap: Map<ChartTime, ChartData> = new Map()
  
  private toUnixSeconds(date: Date): number {
    return Math.floor(date.getTime() / 1000)
  }
  
  private generateBars(count = 400, timeframeSec = 60): { bars: ChartData[], volumes: HistogramData[] } {
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
  }
  
  loadDataForTimeframe(tf: string): DataServiceResult {
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
  }
  
  getCandleData(): ChartData[] {
    return this.candleData
  }
  
  getVolumeData(): HistogramData[] {
    return this.volumeData
  }
  
  getValueAtTime(arr: any[], time: ChartTime): any {
    if (!arr) return null
    for (const p of arr) {
      if (p.time === time) return p.value ?? p.close ?? p
    }
    return null
  }
  
  getDataTimeBounds(): ChartBounds | null {
    if (!this.candleData || this.candleData.length === 0) return null
    const firstTime = this.candleData[0].time
    const lastTime = this.candleData[this.candleData.length - 1].time
    return firstTime !== undefined && lastTime !== undefined ? { min: firstTime, max: lastTime } : null
  }

  // Get data by time
  getDataByTime(time: ChartTime): ChartData | undefined {
    return this.dataMap.get(time)
  }
}

// Create and export a singleton instance
export const chartDataService = new ChartDataService()
