import * as LightweightCharts from 'lightweight-charts'
import { ChartData, MACDResult, BBResult } from '../types/chart'

// Indicators implementation
export class ChartIndicators {
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
  }
  
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
  }
  
  // Moving Average Convergence Divergence (using macd.js logic)
  calcMACD(data: ChartData[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9): MACDResult {
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
  }
  
  // Relative Strength Index (using rsi.js logic with complete data points)
  calcRSI(data: ChartData[], period = 14): LightweightCharts.LineData[] {
    const res: LightweightCharts.LineData[] = [];
    let gains = 0, losses = 0;
    
    // Calculate RSI for all data points
    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        // For the first data point, use the same value as the second point (or default to 50)
        res.push({ time: data[i].time as LightweightCharts.UTCTimestamp, value: 50 });
      } else {
        const change = data[i].close - data[i - 1].close;
        
        if (i <= period) {
          if (change > 0) {
            gains += change;
          } else {
            losses += Math.abs(change);
          }
          
          if (i === period) {
            const rs = gains / (losses || 1e-8);
            const rsiValue = +(100 - (100 / (1 + rs))).toFixed(4);
            res.push({ time: data[i].time as LightweightCharts.UTCTimestamp, value: rsiValue });
            
            // Fill previous points with the same RSI value to match K线数量
            for (let j = 1; j < period; j++) {
              res[j] = { time: data[j].time as LightweightCharts.UTCTimestamp, value: rsiValue };
            }
          } else {
            // Temporarily push a placeholder, will be replaced later
            res.push({ time: data[i].time as LightweightCharts.UTCTimestamp, value: 50 });
          }
        } else {
          gains = (gains * (period - 1) + Math.max(0, change)) / period;
          losses = (losses * (period - 1) + Math.max(0, -change)) / period;
          const rs = gains / (losses || 1e-8);
          res.push({ time: data[i].time as LightweightCharts.UTCTimestamp, value: +(100 - (100 / (1 + rs))).toFixed(4) });
        }
      }
    }
    
    return res;
  }
  
  // Bollinger Bands
  calcBB(data: ChartData[], period = 20, stdDev = 2): BBResult {
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

// Create and export a singleton instance
export const chartIndicators = new ChartIndicators()
