import { withDatabase } from './db'

// 初始化数据库表
export async function initializeDatabase() {
  return withDatabase((db) => {
    // 创建todos表
    db.exec(`
      CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      )
    `)
    
    // 创建用户持仓表
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_positions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        stock_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        stock_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        avg_cost REAL NOT NULL,
        market_value REAL NOT NULL,
        profit REAL NOT NULL,
        profit_percent REAL NOT NULL,
        notes TEXT,
        position_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)
    
    // 创建用户表
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    // 如果todos表没有数据，插入一些示例数据
    const count = (db.prepare('SELECT COUNT(*) as count FROM todos').get() as { count: number }).count
    if (count === 0) {
      const stmt = db.prepare('INSERT INTO todos (name) VALUES (?)')
      stmt.run('Get groceries')
      stmt.run('Buy a new phone')
    }
  })
}
