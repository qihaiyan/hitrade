// 客户端股票数据服务（模拟数据）
import type { StockPrice } from './stockPrice'
import { generateMockStockPrices } from './mockStockPrice'

// 模拟的股票数据缓存
let mockStocks: StockPrice[] = []

// 初始化模拟数据
const initMockData = () => {
  if (mockStocks.length === 0) {
    mockStocks = generateMockStockPrices(50)
  }
}

// 获取所有股票数据
export const getAllStockPrice = async (): Promise<StockPrice[]> => {
  initMockData()
  return mockStocks
}

// 根据股票代码获取股票数据
export const getStockPriceByCode = async (stock_code: string): Promise<StockPrice | undefined> => {
  initMockData()
  return mockStocks.find(stock => stock.stock_code === stock_code)
}

// 批量获取股票数据
export const getStockPriceByCodes = async (stock_codes: string[]): Promise<StockPrice[]> => {
  initMockData()
  return mockStocks.filter(stock => stock_codes.includes(stock.stock_code))
}

// 插入或更新股票数据
export const upsertStockPrice = async (stockPrice: Omit<StockPrice, 'id' | 'update_time'>): Promise<StockPrice> => {
  initMockData()
  const existingStockIndex = mockStocks.findIndex(stock => stock.stock_code === stockPrice.stock_code)
  
  if (existingStockIndex >= 0) {
    // 更新现有股票
    mockStocks[existingStockIndex] = {
      ...mockStocks[existingStockIndex],
      ...stockPrice,
      update_time: new Date().toISOString()
    }
    return mockStocks[existingStockIndex]
  } else {
    // 添加新股票
    const newStock: StockPrice = {
      ...stockPrice,
      id: mockStocks.length + 1,
      update_time: new Date().toISOString()
    }
    mockStocks.push(newStock)
    return newStock
  }
}

// 批量插入或更新股票数据
export const batchUpsertStockPrices = async (stockPrices: Omit<StockPrice, 'id' | 'update_time'>[]): Promise<number> => {
  initMockData()
  let count = 0
  
  for (const stockPrice of stockPrices) {
    await upsertStockPrice(stockPrice)
    count++
  }
  
  return count
}

// 删除股票数据
export const deleteStockPrice = async (id: number): Promise<boolean> => {
  initMockData()
  const initialLength = mockStocks.length
  mockStocks = mockStocks.filter(stock => stock.id !== id)
  return mockStocks.length < initialLength
}
