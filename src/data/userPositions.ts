import { withDatabase } from './db'
import { initializeDatabase } from './migrations'

export interface UserPosition {
  id: number
  user_id: number
  stock_id: string
  symbol: string
  stock_name: string
  quantity: number
  avg_cost: number
  market_value: number
  profit: number
  profit_percent: number
  notes: string | null
  position_date: string
}

export async function getUserPositions(userId: number): Promise<UserPosition[]> {
  await initializeDatabase()
  return withDatabase((db) => {
    return db.prepare('SELECT * FROM user_positions WHERE user_id = ? ORDER BY id').all(userId) as UserPosition[]
  })
}

export async function addUserPosition(position: {
  user_id: number
  stock_id: string
  symbol: string
  stock_name: string
  quantity: number
  avg_cost: number
  market_value: number
  profit: number
  profit_percent: number
  notes?: string
}): Promise<UserPosition[]> {
  await initializeDatabase()
  return withDatabase((db) => {
    const stmt = db.prepare(`
      INSERT INTO user_positions (
        user_id, stock_id, symbol, stock_name, quantity, avg_cost, market_value, profit, profit_percent, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      position.user_id,
      position.stock_id,
      position.symbol,
      position.stock_name,
      position.quantity,
      position.avg_cost,
      position.market_value,
      position.profit,
      position.profit_percent,
      position.notes || null
    )
    return db.prepare('SELECT * FROM user_positions WHERE user_id = ? ORDER BY id').all(position.user_id) as UserPosition[]
  })
}

export async function updateUserPosition(id: number, updates: Partial<{
  quantity?: number
  avg_cost?: number
  market_value?: number
  profit?: number
  profit_percent?: number
  notes?: string
}>): Promise<void> {
  await initializeDatabase()
  return withDatabase((db) => {
    // 构建动态更新语句
    const updateFields = Object.entries(updates)
      .filter(([_, value]) => value !== undefined)
      .map(([key]) => `${key} = ?`)
      .join(', ')
    
    if (updateFields) {
      const values = Object.values(updates).filter(value => value !== undefined)
      values.push(id)
      
      const stmt = db.prepare(`
        UPDATE user_positions
        SET ${updateFields}
        WHERE id = ?
      `)
      stmt.run(...values)
    }
  })
}

export async function deleteUserPosition(id: number): Promise<void> {
  await initializeDatabase()
  return withDatabase((db) => {
    const stmt = db.prepare('DELETE FROM user_positions WHERE id = ?')
    stmt.run(id)
  })
}
