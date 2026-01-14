// 股票交易服务
import { withDatabase } from './db'
import { initializeDatabase } from './migrations'
import { addUserPosition, getUserPositionByUserAndSymbol, updateUserPosition, deleteUserPositionBySymbol } from './userPositions'
import { getStockPriceByCode } from './stockPrice'

export interface StockTransaction {
  id: number
  transaction_id: string
  user_id: number
  stock_code: string
  transaction_type: 'buy' | 'sell'
  price: number
  quantity: number
  amount: number
  transaction_time: string
  status: 'completed' | 'pending' | 'cancelled'
}

// 创建交易记录
export async function createTransaction(transaction: Omit<StockTransaction, 'id'>): Promise<StockTransaction> {
  await initializeDatabase()
  return withDatabase((db) => {
    const stmt = db.prepare(`
      INSERT INTO stock_transaction (
        transaction_id, user_id, stock_code, transaction_type, price, quantity, amount, transaction_time, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    const result = stmt.run(
      transaction.transaction_id,
      transaction.user_id,
      transaction.stock_code,
      transaction.transaction_type,
      transaction.price,
      transaction.quantity,
      transaction.amount,
      transaction.transaction_time,
      transaction.status
    )
    
    return db.prepare('SELECT * FROM stock_transaction WHERE id = ?').get(result.lastInsertRowid) as StockTransaction
  })
}

// 获取用户的所有交易记录
export async function getUserTransactions(userId: number): Promise<StockTransaction[]> {
  await initializeDatabase()
  return withDatabase((db) => {
    return db.prepare('SELECT * FROM stock_transaction WHERE user_id = ? ORDER BY transaction_time DESC').all(userId) as StockTransaction[]
  })
}

// 获取用户的特定股票交易记录
export async function getUserTransactionsByStock(userId: number, stock_code: string): Promise<StockTransaction[]> {
  await initializeDatabase()
  return withDatabase((db) => {
    return db.prepare(
      'SELECT * FROM stock_transaction WHERE user_id = ? AND stock_code = ? ORDER BY transaction_time DESC'
    ).all(userId, stock_code) as StockTransaction[]
  })
}

// 基于交易记录计算用户持仓
export async function calculatePositionFromTransactions(userId: number, stock_code: string): Promise<{
  quantity: number
  avg_cost: number
  total_cost: number
} | null> {
  const transactions = await getUserTransactionsByStock(userId, stock_code)
  
  let totalQuantity = 0
  let totalCost = 0
  
  // 按时间顺序处理交易记录
  transactions
    .sort((a, b) => new Date(a.transaction_time).getTime() - new Date(b.transaction_time).getTime())
    .forEach(transaction => {
      if (transaction.transaction_type === 'buy') {
        // 买入时增加持仓和成本
        totalQuantity += transaction.quantity
        totalCost += transaction.amount
      } else if (transaction.transaction_type === 'sell' && transaction.status === 'completed') {
        // 卖出时减少持仓和成本
        if (totalQuantity >= transaction.quantity) {
          // 按平均成本计算卖出部分的成本
          const sellCost = (totalCost / totalQuantity) * transaction.quantity
          totalQuantity -= transaction.quantity
          totalCost -= sellCost
        }
      }
    })
  
  // 如果持仓数量为0，返回null
  if (totalQuantity <= 0) {
    return null
  }
  
  // 计算平均成本
  const avgCost = totalCost / totalQuantity
  
  return {
    quantity: totalQuantity,
    avg_cost: avgCost,
    total_cost: totalCost
  }
}

// 根据交易记录更新用户持仓
export async function updatePositionFromTransactions(userId: number, stock_code: string): Promise<void> {
  const position = await calculatePositionFromTransactions(userId, stock_code)
  let stock = await getStockPriceByCode(stock_code)
  
  // 如果股票不存在，创建一个新的股票记录
  if (!stock) {
    const { upsertStockPrice } = await import('./stockPrice')
    
    // 解析股票代码和交易所
    const parts = stock_code.split('.')
    const exchange = parts.length > 1 ? parts[1] : 'SH' // 默认上交所
    
    // 使用一个默认价格（10.00）创建股票记录
    const defaultPrice = 10.00
    const defaultQuantity = position ? position.quantity : 0
    
    // 创建新的股票记录
    await upsertStockPrice({
      stock_code: stock_code,
      stock_name: stock_code, // 使用股票代码作为股票名称
      latest_price: defaultPrice,
      pre_close: defaultPrice, // 使用当前价格作为前收盘价
      open: defaultPrice,
      high: defaultPrice,
      low: defaultPrice,
      change: 0,
      change_percent: 0,
      volume: defaultQuantity,
      amount: defaultPrice * defaultQuantity,
      exchange: exchange
    })
    
    // 重新获取股票记录
    stock = await getStockPriceByCode(stock_code)
    
    // 如果仍然获取不到，抛出错误
    if (!stock) {
      throw new Error(`Failed to create stock ${stock_code}`)
    }
  }
  
  if (!position) {
    // 如果持仓数量为0，删除该股票的持仓记录
    await deleteUserPositionBySymbol(userId, stock_code)
    return
  }
  
  // 计算市值、盈亏和盈亏百分比
  const marketValue = position.quantity * stock.latest_price
  const profit = marketValue - position.total_cost
  const profitPercent = position.total_cost > 0 ? (profit / position.total_cost) * 100 : 0
  
  // 检查是否已存在持仓记录
  const existingPosition = await getUserPositionByUserAndSymbol(userId, stock_code)
  
  if (existingPosition) {
    // 更新现有持仓
    await updateUserPosition(existingPosition.id, {
      quantity: position.quantity,
      avg_cost: position.avg_cost,
      market_value: marketValue,
      profit,
      profit_percent: profitPercent
    })
  } else {
    // 创建新的持仓记录
    await addUserPosition({
      user_id: userId,
      stock_id: stock_code,
      symbol: stock_code,
      stock_name: stock.stock_name,
      quantity: position.quantity,
      avg_cost: position.avg_cost,
      market_value: marketValue,
      profit,
      profit_percent: profitPercent
    })
  }
}

// 添加买入交易并更新持仓
export async function addBuyTransaction(
  userId: number,
  stock_code: string,
  price: number,
  quantity: number,
  transactionId?: string
): Promise<StockTransaction> {
  const amount = price * quantity
  let stock = await getStockPriceByCode(stock_code)
  
  // 如果股票不存在，创建一个新的股票记录
  if (!stock) {
    const { upsertStockPrice } = await import('./stockPrice')
    
    // 解析股票代码和交易所
    const parts = stock_code.split('.')
    const exchange = parts.length > 1 ? parts[1] : 'SH' // 默认上交所
    
    // 创建新的股票记录
    await upsertStockPrice({
      stock_code: stock_code,
      stock_name: stock_code, // 使用股票代码作为股票名称
      latest_price: price,
      pre_close: price, // 使用当前价格作为前收盘价
      open: price,
      high: price,
      low: price,
      change: 0,
      change_percent: 0,
      volume: quantity,
      amount: amount,
      exchange: exchange
    })
    
    // 重新获取股票记录
    stock = await getStockPriceByCode(stock_code)
    
    // 如果仍然获取不到，抛出错误
    if (!stock) {
      throw new Error(`Failed to create stock ${stock_code}`)
    }
  }
  
  const transaction = await createTransaction({
    transaction_id: transactionId || generateTransactionId(),
    user_id: userId,
    stock_code,
    transaction_type: 'buy',
    price,
    quantity,
    amount,
    transaction_time: new Date().toISOString(),
    status: 'completed'
  })
  
  // 更新持仓
  await updatePositionFromTransactions(userId, stock_code)
  
  return transaction
}

// 添加卖出交易并更新持仓
export async function addSellTransaction(
  userId: number,
  stock_code: string,
  price: number,
  quantity: number,
  transactionId?: string
): Promise<StockTransaction> {
  const amount = price * quantity
  let stock = await getStockPriceByCode(stock_code)
  
  // 如果股票不存在，创建一个新的股票记录
  if (!stock) {
    const { upsertStockPrice } = await import('./stockPrice')
    
    // 解析股票代码和交易所
    const parts = stock_code.split('.')
    const exchange = parts.length > 1 ? parts[1] : 'SH' // 默认上交所
    
    // 创建新的股票记录
    await upsertStockPrice({
      stock_code: stock_code,
      stock_name: stock_code, // 使用股票代码作为股票名称
      latest_price: price,
      pre_close: price, // 使用当前价格作为前收盘价
      open: price,
      high: price,
      low: price,
      change: 0,
      change_percent: 0,
      volume: quantity,
      amount: amount,
      exchange: exchange
    })
    
    // 重新获取股票记录
    stock = await getStockPriceByCode(stock_code)
    
    // 如果仍然获取不到，抛出错误
    if (!stock) {
      throw new Error(`Failed to create stock ${stock_code}`)
    }
  }
  
  const transaction = await createTransaction({
    transaction_id: transactionId || generateTransactionId(),
    user_id: userId,
    stock_code,
    transaction_type: 'sell',
    price,
    quantity,
    amount,
    transaction_time: new Date().toISOString(),
    status: 'completed'
  })
  
  // 更新持仓
  await updatePositionFromTransactions(userId, stock_code)
  
  return transaction
}

// 生成交易ID
function generateTransactionId(): string {
  return `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`
}

// 函数结束
