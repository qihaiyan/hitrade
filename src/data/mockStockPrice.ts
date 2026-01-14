import { faker } from '@faker-js/faker'
import { StockPrice } from './stockPrice'

// 生成随机股票代码
export const generateStockCode = (): string => {
  // 随机选择交易所
  const exchange = faker.helpers.arrayElement(['SH', 'SZ', 'BJ'])
  // 生成6位数字股票代码
  const code = faker.number.int({ min: 100000, max: 999999 })
  return `${code}.${exchange}`
}

// 生成随机股票名称
export const generateStockName = (): string => {
  // 常用股票名称前缀
  const prefixes = ['中国', '科技', '创新', '发展', '国际', '金融', '能源', '医药', '电子', '机械']
  // 常用股票名称后缀
  const suffixes = ['集团', '股份', '科技', '发展', '控股', '投资', '产业', '生物', '电子', '机械']
  
  const prefix = faker.helpers.arrayElement(prefixes)
  const suffix = faker.helpers.arrayElement(suffixes)
  
  // 确保前缀和后缀不相同
  const middle = faker.company.name().replace(/[^\u4e00-\u9fa5]/g, '').slice(0, 2)
  
  return `${prefix}${middle}${suffix}`
}

// 生成单个股票价格mock数据
export const generateMockStockPrice = (id: number): StockPrice => {
  // 基础价格在1-1000之间
  const basePrice = faker.number.float({ min: 1, max: 1000, fractionDigits: 2 })
  
  // 开盘价在基础价格的±2%范围内
  const open = faker.number.float({ min: basePrice * 0.98, max: basePrice * 1.02, fractionDigits: 2 })
  
  // 最高价在开盘价的100%-105%范围内
  const high = faker.number.float({ min: open, max: open * 1.05, fractionDigits: 2 })
  
  // 最低价在开盘价的95%-100%范围内
  const low = faker.number.float({ min: open * 0.95, max: open, fractionDigits: 2 })
  
  // 最新价在最低价和最高价之间
  const latest_price = faker.number.float({ min: low, max: high, fractionDigits: 2 })
  
  // 前收盘价为基础价格
  const pre_close = basePrice
  
  // 计算涨跌额和涨跌幅
  const change = +(latest_price - pre_close).toFixed(2)
  const change_percent = +((change / pre_close) * 100).toFixed(2)
  
  // 成交量在10000-10000000之间
  const volume = faker.number.int({ min: 10000, max: 10000000 })
  
  // 成交额 = 最新价 * 成交量
  const amount = +(latest_price * volume).toFixed(2)
  
  // 生成随机更新时间
  const update_time = faker.date.recent().toISOString()
  
  // 随机交易所
  const exchange = faker.helpers.arrayElement(['上交所', '深交所', '北交所'])
  
  return {
    id,
    stock_code: generateStockCode(),
    stock_name: generateStockName(),
    latest_price,
    pre_close,
    open,
    high,
    low,
    change,
    change_percent,
    volume,
    amount,
    update_time,
    exchange
  }
}

// 生成多个股票价格mock数据
export const generateMockStockPrices = (count: number): StockPrice[] => {
  return Array.from({ length: count }, (_, i) => generateMockStockPrice(i + 1))
}

// 将mock数据插入到数据库
export const insertMockStockPrices = async (count: number = 50) => {
  const { upsertStockPrice } = await import('./stockPrice')
  const mockData = generateMockStockPrices(count)
  
  for (const data of mockData) {
    await upsertStockPrice({
      stock_code: data.stock_code,
      stock_name: data.stock_name,
      latest_price: data.latest_price,
      pre_close: data.pre_close,
      open: data.open,
      high: data.high,
      low: data.low,
      change: data.change,
      change_percent: data.change_percent,
      volume: data.volume,
      amount: data.amount,
      exchange: data.exchange
    })
  }
  
  return mockData.length
}