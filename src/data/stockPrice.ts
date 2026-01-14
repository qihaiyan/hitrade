import { withDatabase } from './db'
import { initializeDatabase } from './migrations'

export interface StockPrice {
  id: number
  stock_code: string
  stock_name: string
  latest_price: number
  pre_close: number
  open: number
  high: number
  low: number
  change: number
  change_percent: number
  volume: number
  amount: number
  update_time: string
  exchange: string
}

// 获取所有股票价格
export async function getAllStockPrice(): Promise<StockPrice[]> {
  await initializeDatabase()
  return withDatabase((db) => {
    return db.prepare('SELECT * FROM stock_price ORDER BY stock_code').all() as StockPrice[]
  })
}

// 根据股票代码获取价格
export async function getStockPriceByCode(stockCode: string): Promise<StockPrice | null> {
  await initializeDatabase()
  return withDatabase((db) => {
    return db.prepare('SELECT * FROM stock_price WHERE stock_code = ?').get(stockCode) as StockPrice | null
  })
}

// 更新或插入股票价格（Upsert）
export async function upsertStockPrice(price: {
  stock_code: string
  stock_name: string
  latest_price: number
  pre_close: number
  open: number
  high: number
  low: number
  change: number
  change_percent: number
  volume: number
  amount: number
  exchange: string
}): Promise<StockPrice> {
  await initializeDatabase()
  return withDatabase((db) => {
    // 检查是否已存在该股票代码
    const existing = db.prepare('SELECT * FROM stock_price WHERE stock_code = ?').get(price.stock_code) as StockPrice | undefined
    
    if (existing) {
      // 更新现有记录
      const stmt = db.prepare(`
        UPDATE stock_price SET
          stock_name = ?,
          latest_price = ?,
          pre_close = ?,
          open = ?,
          high = ?,
          low = ?,
          change = ?,
          change_percent = ?,
          volume = ?,
          amount = ?,
          update_time = CURRENT_TIMESTAMP,
          exchange = ?
        WHERE stock_code = ?
      `)
      stmt.run(
        price.stock_name,
        price.latest_price,
        price.pre_close,
        price.open,
        price.high,
        price.low,
        price.change,
        price.change_percent,
        price.volume,
        price.amount,
        price.exchange,
        price.stock_code
      )
      return db.prepare('SELECT * FROM stock_price WHERE stock_code = ?').get(price.stock_code) as StockPrice
    } else {
      // 插入新记录
      const stmt = db.prepare(`
        INSERT INTO stock_price (
          stock_code,
          stock_name,
          latest_price,
          pre_close,
          open,
          high,
          low,
          change,
          change_percent,
          volume,
          amount,
          exchange
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      const result = stmt.run(
        price.stock_code,
        price.stock_name,
        price.latest_price,
        price.pre_close,
        price.open,
        price.high,
        price.low,
        price.change,
        price.change_percent,
        price.volume,
        price.amount,
        price.exchange
      )
      return db.prepare('SELECT * FROM stock_price WHERE id = ?').get(result.lastInsertRowid) as StockPrice
    }
  })
}

// 删除股票价格
export async function deleteStockPrice(stockCode: string): Promise<void> {
  await initializeDatabase()
  return withDatabase((db) => {
    const stmt = db.prepare('DELETE FROM stock_price WHERE stock_code = ?')
    stmt.run(stockCode)
  })
}

// 批量更新或插入股票价格
export async function batchUpsertStockPrice(prices: Array<{
  stock_code: string
  stock_name: string
  latest_price: number
  pre_close: number
  open: number
  high: number
  low: number
  change: number
  change_percent: number
  volume: number
  amount: number
  exchange: string
}>): Promise<void> {
  await initializeDatabase()
  return withDatabase((db) => {
    // 开始事务
    db.exec('BEGIN TRANSACTION')
    
    try {
      for (const price of prices) {
        // 检查是否已存在该股票代码
        const existing = db.prepare('SELECT * FROM stock_price WHERE stock_code = ?').get(price.stock_code) as StockPrice | undefined
        
        if (existing) {
          // 更新现有记录
          const stmt = db.prepare(`
            UPDATE stock_price SET
              stock_name = ?,
              latest_price = ?,
              pre_close = ?,
              open = ?,
              high = ?,
              low = ?,
              change = ?,
              change_percent = ?,
              volume = ?,
              amount = ?,
              update_time = CURRENT_TIMESTAMP,
              exchange = ?
            WHERE stock_code = ?
          `)
          stmt.run(
            price.stock_name,
            price.latest_price,
            price.pre_close,
            price.open,
            price.high,
            price.low,
            price.change,
            price.change_percent,
            price.volume,
            price.amount,
            price.exchange,
            price.stock_code
          )
        } else {
          // 插入新记录
          const stmt = db.prepare(`
            INSERT INTO stock_price (
              stock_code,
              stock_name,
              latest_price,
              pre_close,
              open,
              high,
              low,
              change,
              change_percent,
              volume,
              amount,
              exchange
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          stmt.run(
            price.stock_code,
            price.stock_name,
            price.latest_price,
            price.pre_close,
            price.open,
            price.high,
            price.low,
            price.change,
            price.change_percent,
            price.volume,
            price.amount,
            price.exchange
          )
        }
      }
      // 提交事务
      db.exec('COMMIT')
    } catch (error) {
      // 回滚事务
      db.exec('ROLLBACK')
      throw error
    }
  })
}