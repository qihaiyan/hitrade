import * as LightweightCharts from 'lightweight-charts'

// Define chart data types
export type ChartTime = string | number | LightweightCharts.BusinessDay

export interface ChartData extends LightweightCharts.CandlestickData {
  value?: number
}

export interface HistogramData extends LightweightCharts.HistogramData {
  value: number
}

export interface ChartBounds {
  min: ChartTime
  max: ChartTime
}

export interface MACDResult {
  macd: LightweightCharts.LineData[]
  signal: LightweightCharts.LineData[]
  histogram: LightweightCharts.HistogramData[]
}

export interface BBResult {
  upper: LightweightCharts.LineData[]
  middle: LightweightCharts.LineData[]
  lower: LightweightCharts.LineData[]
}

export interface DataServiceResult {
  candleData: ChartData[]
  volumeData: HistogramData[]
}

export interface ChartService {
  loadDataForTimeframe(tf: string): DataServiceResult
  getCandleData(): ChartData[]
  getVolumeData(): HistogramData[]
  getValueAtTime(arr: any[], time: ChartTime): any
  getDataTimeBounds(): ChartBounds | null
}
