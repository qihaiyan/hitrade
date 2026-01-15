import { useCallback, useState, useEffect } from 'react'
import { useRouter } from '@tanstack/react-router'
import type { StockPrice } from '../data/stockPrice'

export interface NewPosition {
  stock_id: string
  symbol: string
  stock_name: string
  buy_quantity: number
  buy_price: number
  market_value: number
  profit: number
  profit_percent: number
  notes: string
}

interface AddPositionModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (position: NewPosition) => Promise<void>
  onGetAllStocks: () => Promise<StockPrice[]>
}

export function AddPositionModal({ isOpen, onClose, onAdd, onGetAllStocks }: AddPositionModalProps) {
  const router = useRouter()
  const [newPosition, setNewPosition] = useState<NewPosition>({
    stock_id: '',
    symbol: '',
    stock_name: '',
    buy_quantity: 0,
    buy_price: 0,
    market_value: 0,
    profit: 0,
    profit_percent: 0,
    notes: ''
  })
  
  const [stocks, setStocks] = useState<StockPrice[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [selectedStock, setSelectedStock] = useState<StockPrice | null>(null)
  
  // 加载股票数据
  const loadStocks = useCallback(async () => {
    if (!isOpen) return
    
    setIsLoading(true)
    try {
      const stockList = await onGetAllStocks()
      setStocks(stockList)
    } catch (error) {
      console.error('加载股票数据失败:', error)
    } finally {
      setIsLoading(false)
    }
  }, [isOpen, onGetAllStocks])
  
  // 当模态框打开时加载股票数据
  useEffect(() => {
    if (isOpen) {
      loadStocks()
    }
  }, [isOpen, loadStocks])
  
  // 筛选股票数据
  const filteredStocks = stocks.filter(stock => 
    stock.stock_code.toLowerCase().includes(searchTerm.toLowerCase()) || 
    stock.stock_name.toLowerCase().includes(searchTerm.toLowerCase())
  )
  
  // 选择股票
  const selectStock = useCallback((stock: StockPrice) => {
    const latestPrice = Math.round(stock.latest_price * 100) / 100 // 四舍五入到两位小数
    
    setNewPosition(prev => ({
      ...prev,
      stock_id: stock.stock_code,
      symbol: stock.stock_code,
      stock_name: stock.stock_name,
      buy_price: latestPrice, // 自动填写最新价作为买入价格
      market_value: latestPrice * prev.buy_quantity,
      profit: (latestPrice - latestPrice) * prev.buy_quantity, // 盈亏为0，因为买入价格等于最新价
      profit_percent: 0 // 盈亏百分比为0
    }))
    
    // 存储当前选择的股票信息
    setSelectedStock(stock)
    
    setIsDropdownOpen(false)
    setSearchTerm('')
  }, [])
  
  // 当数量或买入价格变化时更新市值和盈亏
  const updatePositionMetrics = useCallback(() => {
    setNewPosition(prev => {
      const selectedStock = stocks.find(stock => stock.stock_code === prev.symbol)
      const marketValue = selectedStock ? selectedStock.latest_price * prev.buy_quantity : 0
      const profit = selectedStock ? (selectedStock.latest_price - prev.buy_price) * prev.buy_quantity : 0
      const profitPercent = prev.buy_price > 0 ? ((marketValue / prev.buy_quantity - prev.buy_price) / prev.buy_price) * 100 : 0
      
      return {
        ...prev,
        market_value: marketValue,
        profit,
        profit_percent: profitPercent
      }
    })
  }, [stocks])

  // 提交新增持仓
  const submitNewPosition = useCallback(async () => {
    if (!newPosition.symbol || !newPosition.stock_name || newPosition.buy_quantity <= 0) return
    
    // 转换为兼容父组件的格式
    const positionData = {
      ...newPosition,
      price: newPosition.buy_price,
      quantity: newPosition.buy_quantity // 将buy_quantity转换为quantity，因为服务器函数期望的是quantity字段
    }
    
    // 添加调试信息
    console.log('Submitting position data:', positionData)
    
    await onAdd(positionData)
    setNewPosition({
      stock_id: '',
      symbol: '',
      stock_name: '',
      buy_quantity: 0,
      buy_price: 0,
      market_value: 0,
      profit: 0,
      profit_percent: 0,
      notes: ''
    })
    onClose()
    router.invalidate()
  }, [newPosition, onAdd, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl shadow-2xl border border-white/20 w-full max-w-2xl">
        <div className="flex justify-between items-center p-6 border-b border-white/20">
          <h2 className="text-xl font-bold">新增持仓</h2>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 股票选择组合框 */}
          <div className="relative col-span-2 md:col-span-1">
            <label className="block text-sm font-medium text-white mb-2">搜索股票代码或名称</label>
            <input
              type="text"
              placeholder="搜索股票代码或名称"
              value={searchTerm || newPosition.symbol}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setIsDropdownOpen(true)}
              className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
            
            {/* 下拉列表 */}
            {isDropdownOpen && (
              <div className="absolute z-10 w-full mt-1 max-h-60 overflow-y-auto bg-gray-900 border border-white/20 rounded-lg shadow-lg">
                {isLoading ? (
                  <div className="px-4 py-3 text-gray-400">加载中...</div>
                ) : filteredStocks.length === 0 ? (
                  <div className="px-4 py-3 text-gray-400">未找到匹配的股票</div>
                ) : (
                  filteredStocks.map(stock => (
                    <div
                      key={stock.id}
                      onClick={() => selectStock(stock)}
                      className="px-4 py-3 hover:bg-white/10 cursor-pointer transition-colors"
                    >
                      <div className="font-medium">{stock.stock_code}</div>
                      <div className="text-sm text-gray-400">{stock.stock_name}</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          
          {/* 股票价格信息 */}
          {selectedStock && (
            <div className="col-span-2 md:col-span-1 grid grid-cols-3 gap-2">
              {/* 最新价 */}
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">最新价</div>
                <div className="text-lg font-medium text-white">{selectedStock.latest_price.toFixed(2)}</div>
              </div>
              {/* 涨停价 */}
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">涨停价</div>
                <div className="text-lg font-medium text-red-500">{Math.round(selectedStock.pre_close * 1.1 * 100) / 100}</div>
              </div>
              {/* 跌停价 */}
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">跌停价</div>
                <div className="text-lg font-medium text-green-500">{Math.round(selectedStock.pre_close * 0.9 * 100) / 100}</div>
              </div>
            </div>
          )}
          
          {/* 股票名称显示 */}
          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-medium text-white mb-2">股票名称</label>
            <input
              type="text"
              placeholder="股票名称"
              value={newPosition.stock_name}
              readOnly
              className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/5 backdrop-blur-sm text-white placeholder-white/60"
            />
          </div>
          
          {/* 持仓数量 */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">买入数量</label>
            <input
              type="number"
              placeholder="买入数量"
              value={newPosition.buy_quantity}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 0
                setNewPosition({...newPosition, buy_quantity: value > 0 ? value : 0})
                updatePositionMetrics()
              }}
              min="1"
              step="1"
              className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
          </div>
          
          {/* 买入价格 */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">买入价格</label>
            <input
              type="number"
              placeholder="买入价格"
              value={newPosition.buy_price}
              onChange={(e) => {
                const price = parseFloat(e.target.value) || 0
                const formattedPrice = Math.round(price * 100) / 100 // 四舍五入到两位小数
                setNewPosition({...newPosition, buy_price: formattedPrice})
                updatePositionMetrics()
              }}
              className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
          </div>
            {/* 市值 */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">市值</label>
              <input
                type="number"
                placeholder="市值"
                value={isNaN(newPosition.market_value) ? '0' : newPosition.market_value.toFixed(2)}
                readOnly
                className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/5 backdrop-blur-sm text-white placeholder-white/60"
              />
            </div>
            
            {/* 盈亏金额 */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">盈亏金额</label>
              <input
                type="number"
                placeholder="盈亏金额"
                value={isNaN(newPosition.profit) ? '0' : newPosition.profit.toFixed(2)}
                readOnly
                className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/5 backdrop-blur-sm text-white placeholder-white/60"
              />
            </div>
            
            {/* 备注信息 */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-white mb-2">备注信息</label>
              <textarea
                placeholder="备注信息"
                value={newPosition.notes}
                onChange={(e) => setNewPosition({...newPosition, notes: e.target.value})}
                rows={3}
                className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={submitNewPosition}
              disabled={!newPosition.symbol || !newPosition.stock_name}
              className="bg-green-500 hover:bg-green-600 disabled:bg-green-500/50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              确定
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
