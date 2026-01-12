// 数据库文件路径
const DB_FILE = 'todos.db'

// 封装数据库操作的函数，仅在服务器端执行
export async function withDatabase<T>(fn: (db: any) => T): Promise<T> {
  // 动态导入，仅在服务器端执行
  const Database = (await import('better-sqlite3')).default
  const db = new Database(DB_FILE)
  
  try {
    return fn(db)
  } finally {
    // 确保数据库连接关闭
    db.close()
  }
}
