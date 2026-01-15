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
      CREATE TABLE IF NOT EXISTS user_position (
        id INTEGER PRIMARY KEY AUTOINCREMENT, -- 主键ID
        user_id INTEGER NOT NULL, -- 用户ID
        stock_code TEXT NOT NULL, -- 股票代码
        stock_name TEXT NOT NULL, -- 股票名称
        quantity INTEGER NOT NULL, -- 持仓数量
        avg_cost REAL NOT NULL, -- 平均成本
        market_value REAL NOT NULL, -- 市值
        profit REAL NOT NULL, -- 盈亏金额
        profit_percent REAL NOT NULL, -- 盈亏百分比
        notes TEXT, -- 备注
        position_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 持仓日期
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE -- 外键关联用户表
      )
    `)
    
    // 创建股票最新价格表
    db.exec(`
      CREATE TABLE IF NOT EXISTS stock_price (
        id INTEGER PRIMARY KEY AUTOINCREMENT, -- 主键ID
        stock_code TEXT NOT NULL, -- 股票代码
        stock_name TEXT NOT NULL, -- 股票名称
        latest_price REAL NOT NULL, -- 最新价格
        pre_close REAL NOT NULL, -- 前收盘价
        open REAL NOT NULL, -- 今日开盘价
        high REAL NOT NULL, -- 今日最高价
        low REAL NOT NULL, -- 今日最低价
        change REAL NOT NULL, -- 涨跌额
        change_percent REAL NOT NULL, -- 涨跌幅
        volume INTEGER NOT NULL, -- 成交量
        amount REAL NOT NULL, -- 成交额
        update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 更新时间
        exchange TEXT NOT NULL -- 交易所
      )
    `)
    
    // 创建股票代码唯一索引
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_price_code ON stock_price(stock_code)
    `)
    
    // 创建股票基本信息表
    db.exec(`
      CREATE TABLE IF NOT EXISTS stock_basic (
        id INTEGER PRIMARY KEY AUTOINCREMENT, -- 主键ID
        stock_code TEXT NOT NULL, -- 股票代码
        stock_name TEXT NOT NULL, -- 股票名称
        exchange TEXT NOT NULL, -- 交易所
        market_type TEXT NOT NULL, -- 市场类型（主板、创业板、科创板等）
        industry TEXT, -- 所属行业
        sector TEXT, -- 所属板块
        list_date DATE NOT NULL, -- 上市日期
        delist_date DATE, -- 退市日期
        total_share REAL NOT NULL, -- 总股本
        float_share REAL NOT NULL, -- 流通股本
        company_name TEXT NOT NULL, -- 公司名称
        company_desc TEXT -- 公司简介
      )
    `)
    
    // 创建股票基本信息表索引
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_basic_code ON stock_basic(stock_code)
    `)
    
    // 创建K线数据表
    db.exec(`
      CREATE TABLE IF NOT EXISTS stock_kline (
        id INTEGER PRIMARY KEY AUTOINCREMENT, -- 主键ID
        stock_code TEXT NOT NULL, -- 股票代码
        date DATE NOT NULL, -- 日期
        open REAL NOT NULL, -- 开盘价
        high REAL NOT NULL, -- 最高价
        low REAL NOT NULL, -- 最低价
        close REAL NOT NULL, -- 收盘价
        volume INTEGER NOT NULL, -- 成交量
        amount REAL NOT NULL, -- 成交额
        adj_factor REAL NOT NULL, -- 复权因子
        kline_type TEXT NOT NULL -- K线类型（日线、周线、月线、60分钟线等）
      )
    `)
    
    // 创建K线数据表索引
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_stock_kline_code_date ON stock_kline(stock_code, date)
    `)
    
    // 创建分时数据表
    db.exec(`
      CREATE TABLE IF NOT EXISTS stock_minute (
        id INTEGER PRIMARY KEY AUTOINCREMENT, -- 主键ID
        stock_code TEXT NOT NULL, -- 股票代码
        datetime DATETIME NOT NULL, -- 时间（精确到分钟）
        price REAL NOT NULL, -- 价格
        volume INTEGER NOT NULL, -- 成交量
        amount REAL NOT NULL -- 成交额
      )
    `)
    
    // 创建分时数据表索引
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_stock_minute_code_datetime ON stock_minute(stock_code, datetime)
    `)
    
    // 创建指标数据表
    db.exec(`
      CREATE TABLE IF NOT EXISTS stock_indicator (
        id INTEGER PRIMARY KEY AUTOINCREMENT, -- 主键ID
        stock_code TEXT NOT NULL, -- 股票代码
        date DATE NOT NULL, -- 日期
        ma5 REAL, -- 5日均线
        ma10 REAL, -- 10日均线
        ma20 REAL, -- 20日均线
        macd REAL, -- MACD指标值
        macd_signal REAL, -- MACD信号线
        macd_hist REAL, -- MACD柱状图
        rsi REAL, -- RSI指标值
        kdj_k REAL, -- KDJ指标K值
        kdj_d REAL, -- KDJ指标D值
        kdj_j REAL, -- KDJ指标J值
        boll_upper REAL, -- 布林带上轨
        boll_mid REAL, -- 布林带中轨
        boll_lower REAL -- 布林带下轨
      )
    `)
    
    // 创建指标数据表索引
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_stock_indicator_code_date ON stock_indicator(stock_code, date)
    `)
    
    // 创建交易数据表
    db.exec(`
      CREATE TABLE IF NOT EXISTS stock_transaction (
        id INTEGER PRIMARY KEY AUTOINCREMENT, -- 主键ID
        transaction_id TEXT NOT NULL, -- 交易ID
        user_id INTEGER NOT NULL, -- 用户ID
        stock_code TEXT NOT NULL, -- 股票代码
        transaction_type TEXT NOT NULL, -- 交易类型（买入、卖出）
        price REAL NOT NULL, -- 成交价格
        quantity INTEGER NOT NULL, -- 成交数量
        amount REAL NOT NULL, -- 成交金额
        transaction_time DATETIME NOT NULL, -- 交易时间
        status TEXT NOT NULL -- 交易状态（已成交、待成交、已撤销）
      )
    `)
    
    // 创建交易数据表索引
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_transaction_id ON stock_transaction(transaction_id)
    `)
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_stock_transaction_user ON stock_transaction(user_id)
    `)
    
    // 创建自选股表
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_watchlist (
        id INTEGER PRIMARY KEY AUTOINCREMENT, -- 主键ID
        user_id INTEGER NOT NULL, -- 用户ID
        stock_code TEXT NOT NULL, -- 股票代码
        add_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 添加时间
        remark TEXT -- 备注
      )
    `)
    
    // 创建自选股表索引
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_user_watchlist_user_stock ON user_watchlist(user_id, stock_code)
    `)
    
    // 创建板块信息表
    db.exec(`
      CREATE TABLE IF NOT EXISTS sector_info (
        id INTEGER PRIMARY KEY AUTOINCREMENT, -- 主键ID
        sector_code TEXT NOT NULL, -- 板块代码
        sector_name TEXT NOT NULL, -- 板块名称
        sector_type TEXT NOT NULL -- 板块类型（行业板块、概念板块、地域板块）
      )
    `)
    
    // 创建板块信息表索引
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sector_info_code ON sector_info(sector_code)
    `)
    
    // 创建板块成分股表
    db.exec(`
      CREATE TABLE IF NOT EXISTS sector_component (
        id INTEGER PRIMARY KEY AUTOINCREMENT, -- 主键ID
        sector_code TEXT NOT NULL, -- 板块代码
        stock_code TEXT NOT NULL, -- 股票代码
        weight REAL NOT NULL -- 权重
      )
    `)
    
    // 创建板块成分股表索引
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sector_component_sector_stock ON sector_component(sector_code, stock_code)
    `)
    
    // 创建新闻资讯表
    db.exec(`
      CREATE TABLE IF NOT EXISTS news (
        id INTEGER PRIMARY KEY AUTOINCREMENT, -- 主键ID
        news_id TEXT NOT NULL, -- 新闻ID
        title TEXT NOT NULL, -- 标题
        content TEXT NOT NULL, -- 内容
        publish_time DATETIME NOT NULL, -- 发布时间
        source TEXT NOT NULL, -- 来源
        related_stocks TEXT -- 相关股票（多个股票代码用逗号分隔）
      )
    `)
    
    // 创建新闻资讯表索引
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_news_id ON news(news_id)
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
    
    // 如果stock_price表没有数据，插入一些示例股票价格数据
    const stockCount = (db.prepare('SELECT COUNT(*) as count FROM stock_price').get() as { count: number }).count
    if (stockCount === 0) {
      const stocks = [
        { code: '600000.SH', name: '浦发银行', price: 9.50, exchange: '上交所' },
        { code: '600036.SH', name: '招商银行', price: 38.20, exchange: '上交所' },
        { code: '000001.SZ', name: '平安银行', price: 12.85, exchange: '深交所' },
        { code: '000858.SZ', name: '五粮液', price: 165.50, exchange: '深交所' },
        { code: '000002.SZ', name: '万科A', price: 14.20, exchange: '深交所' },
        { code: '601318.SH', name: '中国平安', price: 45.80, exchange: '上交所' },
        { code: '600519.SH', name: '贵州茅台', price: 1850.00, exchange: '上交所' },
        { code: '002415.SZ', name: '海康威视', price: 35.20, exchange: '深交所' },
        { code: '300750.SZ', name: '宁德时代', price: 285.00, exchange: '深交所' },
        { code: '601888.SH', name: '中国中免', price: 138.50, exchange: '上交所' }
      ]
      
      const stmt = db.prepare(`
        INSERT INTO stock_price (
          stock_code, stock_name, latest_price, pre_close, open, high, low, 
          change, change_percent, volume, amount, exchange
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      
      stocks.forEach(stock => {
        const preClose = stock.price * (0.95 + Math.random() * 0.1) // 前收盘价在当前价格的95%-105%之间
        const open = preClose * (0.98 + Math.random() * 0.04) // 开盘价在前收盘价的98%-102%之间
        const high = open * (1.00 + Math.random() * 0.05) // 最高价在开盘价的100%-105%之间
        const low = open * (0.95 + Math.random() * 0.05) // 最低价在开盘价的95%-100%之间
        const close = low + (high - low) * Math.random() // 收盘价在最高价和最低价之间
        const change = close - preClose
        const changePercent = (change / preClose) * 100
        const volume = Math.floor(1000000 + Math.random() * 9000000) // 成交量在100-1000万之间
        const amount = close * volume
        
        stmt.run(
          stock.code,
          stock.name,
          close,
          preClose,
          open,
          high,
          low,
          change,
          changePercent,
          volume,
          amount,
          stock.exchange
        )
      })
    }
  })
}
