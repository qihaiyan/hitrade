import { withDatabase } from '../data/db'

// 自选股数据类型
export interface WatchlistItem {
  id: number
  userId: number
  stockCode: string
  addTime: string
  remark?: string
  // 额外信息
  stockName?: string
  latestPrice?: number
  change?: number
  changePercent?: number
}

// 自选股服务
export const watchlistService = {
  // 获取用户的自选股列表
  async getUserWatchlist(userId: number): Promise<WatchlistItem[]> {
    return withDatabase((db) => {
      const items = db.prepare(`
        SELECT 
          uw.id, 
          uw.user_id as userId, 
          uw.stock_code as stockCode, 
          uw.add_time as addTime, 
          uw.remark, 
          sp.stock_name as stockName, 
          sp.latest_price as latestPrice, 
          sp.change, 
          sp.change_percent as changePercent
        FROM user_watchlist uw
        LEFT JOIN stock_price sp ON uw.stock_code = sp.stock_code
        WHERE uw.user_id = ?
        ORDER BY uw.add_time DESC
      `).all(userId) as WatchlistItem[]
      return items
    })
  },

  // 添加股票到自选股
  async addToWatchlist(userId: number, stockCode: string, remark?: string): Promise<boolean> {
    return withDatabase((db) => {
      try {
        db.prepare(`
          INSERT INTO user_watchlist (user_id, stock_code, remark)
          VALUES (?, ?, ?)
        `).run(userId, stockCode, remark)
        return true
      } catch (error) {
        // 如果是唯一约束冲突，返回false
        return false
      }
    })
  },

  // 从自选股中移除股票
  async removeFromWatchlist(userId: number, stockCode: string): Promise<boolean> {
    return withDatabase((db) => {
      const result = db.prepare(`
        DELETE FROM user_watchlist
        WHERE user_id = ? AND stock_code = ?
      `).run(userId, stockCode)
      return result.changes > 0
    })
  },

  // 更新自选股备注
  async updateWatchlistRemark(userId: number, stockCode: string, remark?: string): Promise<boolean> {
    return withDatabase((db) => {
      const result = db.prepare(`
        UPDATE user_watchlist
        SET remark = ?
        WHERE user_id = ? AND stock_code = ?
      `).run(remark, userId, stockCode)
      return result.changes > 0
    })
  },

  // 获取可选的股票列表
  async getAvailableStocks(): Promise<Array<{ code: string; name: string }>> {
    return withDatabase((db) => {
      const stocks = db.prepare(`
        SELECT DISTINCT stock_code as code, stock_name as name
        FROM stock_price
        ORDER BY stock_name
      `).all() as Array<{ code: string; name: string }>
      return stocks
    })
  },

  // 搜索股票
  async searchStocks(keyword: string): Promise<Array<{ code: string; name: string }>> {
    return withDatabase((db) => {
      const stocks = db.prepare(`
        SELECT DISTINCT stock_code as code, stock_name as name
        FROM stock_price
        WHERE stock_code LIKE ? OR stock_name LIKE ?
        ORDER BY stock_name
        LIMIT 20
      `).all(`%${keyword}%`, `%${keyword}%`) as Array<{ code: string; name: string }>
      return stocks
    })
  }
}
