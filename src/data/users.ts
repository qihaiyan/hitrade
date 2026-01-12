import { withDatabase } from './db'
import { initializeDatabase } from './migrations'

export interface User {
  id: number
  username: string
  email: string
  created_at: string
}

export async function createUser(user: {
  username: string
  email: string
}): Promise<User> {
  await initializeDatabase()
  return withDatabase((db) => {
    const stmt = db.prepare(`
      INSERT INTO users (username, email)
      VALUES (?, ?)
    `)
    const result = stmt.run(user.username, user.email)
    return db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid) as User
  })
}

export async function getUserById(id: number): Promise<User | null> {
  await initializeDatabase()
  return withDatabase((db) => {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | null
  })
}

export async function getUserByUsername(username: string): Promise<User | null> {
  await initializeDatabase()
  return withDatabase((db) => {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | null
  })
}

// 确保有默认用户，用于演示
export async function ensureDefaultUser(): Promise<User> {
  await initializeDatabase()
  return withDatabase((db) => {
    // 查找默认用户
    let user = db.prepare('SELECT * FROM users WHERE username = ?').get('default_user') as User | undefined
    
    // 如果不存在，创建默认用户
    if (!user) {
      const stmt = db.prepare(`
        INSERT INTO users (username, email)
        VALUES (?, ?)
      `)
      const result = stmt.run('default_user', 'default@example.com')
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid) as User
    }
    
    return user
  })
}
