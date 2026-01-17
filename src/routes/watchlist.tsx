import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useCallback } from 'react'
import { WatchlistItem } from '../services/watchlistService'
import Navbar from '../components/Navbar'
import { createServerFn } from '@tanstack/react-start'
import { watchlistService } from '../services/watchlistService'
import { ensureDefaultUser } from '../data/users'

// 服务器函数 - 获取用户自选股列表
export const getUserWatchlist = createServerFn({ method: 'GET' })
  .handler(async () => {
    // 确保有默认用户
    const defaultUser = await ensureDefaultUser()
    // 获取自选股列表
    return await watchlistService.getUserWatchlist(defaultUser.id)
  })

// 服务器函数 - 获取可选股票列表
export const getAvailableStocks = createServerFn({ method: 'GET' })
  .handler(async () => {
    return await watchlistService.getAvailableStocks()
  })

// 服务器函数 - 搜索股票
export const searchStocks = createServerFn({ method: 'GET' })
  .inputValidator((d: string) => {
    if (!d || typeof d !== 'string') throw new Error('Keyword is required')
    return d
  })
  .handler(async ({ data: keyword }) => {
    return await watchlistService.searchStocks(keyword)
  })

// 服务器函数 - 添加股票到自选股
export const addToWatchlist = createServerFn({ method: 'POST' })
  .inputValidator((d: any) => {
    if (!d.stockCode) throw new Error('Stock code is required')
    return d
  })
  .handler(async ({ data }) => {
    const defaultUser = await ensureDefaultUser()
    return await watchlistService.addToWatchlist(defaultUser.id, data.stockCode, data.remark)
  })

// 服务器函数 - 从自选股中移除股票
export const removeFromWatchlist = createServerFn({ method: 'POST' })
  .inputValidator((d: string) => {
    if (!d) throw new Error('Stock code is required')
    return d
  })
  .handler(async ({ data: stockCode }) => {
    const defaultUser = await ensureDefaultUser()
    return await watchlistService.removeFromWatchlist(defaultUser.id, stockCode)
  })

// 服务器函数 - 更新自选股备注
export const updateWatchlistRemark = createServerFn({ method: 'POST' })
  .inputValidator((d: any) => {
    if (!d.stockCode) throw new Error('Stock code is required')
    return d
  })
  .handler(async ({ data }) => {
    const defaultUser = await ensureDefaultUser()
    return await watchlistService.updateWatchlistRemark(defaultUser.id, data.stockCode, data.remark)
  })

// 模拟当前用户ID，实际项目中应从认证系统获取
const CURRENT_USER_ID = 1

function WatchlistPage() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [availableStocks, setAvailableStocks] = useState<Array<{ code: string; name: string }>>([])
  const [selectedStock, setSelectedStock] = useState<string>('')
  const [remark, setRemark] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')
  const [searchKeyword, setSearchKeyword] = useState<string>('')
  const [searchResults, setSearchResults] = useState<Array<{ code: string; name: string }>>([])
  const [isSearching, setIsSearching] = useState<boolean>(false)

  // 加载用户的自选股
  const loadWatchlist = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const data = await getUserWatchlist()
      setWatchlist(data)
    } catch (err) {
      setError('加载自选股失败')
      console.error('Failed to load watchlist:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // 加载可选股票列表
  const loadAvailableStocks = useCallback(async () => {
    try {
      const stocks = await getAvailableStocks()
      setAvailableStocks(stocks)
    } catch (err) {
      console.error('Failed to load available stocks:', err)
    }
  }, [])

  // 搜索股票
  const searchStocksClient = useCallback(async (keyword: string) => {
    if (!keyword.trim()) {
      setSearchResults([])
      return
    }

    try {
      setIsSearching(true)
      const results = await searchStocks({ data: keyword })
      setSearchResults(results)
    } catch (err) {
      console.error('Failed to search stocks:', err)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  // 添加股票到自选股
  const handleAddStock = useCallback(async () => {
    if (!selectedStock) {
      setError('请选择股票')
      return
    }

    try {
      setLoading(true)
      setError('')
      const success = await addToWatchlist({ data: { stockCode: selectedStock, remark } })
      if (success) {
        await loadWatchlist()
        setSelectedStock('')
        setRemark('')
      } else {
        setError('该股票已在自选股中')
      }
    } catch (err) {
      setError('添加失败')
      console.error('Failed to add stock:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedStock, remark, loadWatchlist])

  // 从自选股中移除
  const handleRemoveStock = useCallback(async (stockCode: string) => {
    try {
      setLoading(true)
      setError('')
      await removeFromWatchlist({ data: stockCode })
      await loadWatchlist()
    } catch (err) {
      setError('移除失败')
      console.error('Failed to remove stock:', err)
    } finally {
      setLoading(false)
    }
  }, [loadWatchlist])

  // 更新备注
  const handleUpdateRemark = useCallback(async (stockCode: string, newRemark: string) => {
    try {
      await updateWatchlistRemark({ data: { stockCode, remark: newRemark } })
      await loadWatchlist()
    } catch (err) {
      console.error('Failed to update remark:', err)
    }
  }, [loadWatchlist])

  // 搜索输入处理
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const keyword = e.target.value
    setSearchKeyword(keyword)
    searchStocksClient(keyword)
  }, [searchStocksClient])

  // 选择搜索结果
  const handleSelectSearchResult = useCallback((stockCode: string) => {
    setSelectedStock(stockCode)
    setSearchKeyword(availableStocks.find(s => s.code === stockCode)?.name || '')
    setSearchResults([])
  }, [availableStocks])

  // 初始化加载
  useEffect(() => {
    loadWatchlist()
    loadAvailableStocks()
  }, [loadWatchlist, loadAvailableStocks])

  // 格式化价格和涨跌幅
  const formatPrice = (price?: number) => {
    return price ? price.toFixed(2) : '-'
  }

  const formatChange = (change?: number, changePercent?: number) => {
    if (change === undefined || changePercent === undefined) return '-'
    const isPositive = change >= 0
    return (
      <span className={isPositive ? 'text-green-500' : 'text-red-500'}>
        {isPositive ? '+' : ''}{change.toFixed(2)} ({isPositive ? '+' : ''}{changePercent.toFixed(2)}%)
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Navbar />
      <div className="p-4 sm:p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <header className="mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">我的自选股</h1>
            <p className="text-gray-400">查看和管理您关注的股票</p>
          </header>

          {/* 添加自选股表单 */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 shadow-xl mb-6">
            <h2 className="text-xl font-semibold mb-4">添加自选股</h2>

            {error && (
              <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-md p-3 mb-4">
                {error}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4">
              {/* 股票搜索和选择 */}
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="搜索或选择股票..."
                  value={searchKeyword}
                  onChange={handleSearchChange}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                {/* 搜索结果 */}
                {searchResults.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-600 rounded shadow-lg max-h-48 overflow-y-auto">
                    {searchResults.map(stock => (
                      <div
                        key={stock.code}
                        onClick={() => handleSelectSearchResult(stock.code)}
                        className="px-3 py-2 cursor-pointer hover:bg-slate-700 flex justify-between items-center"
                      >
                        <span>{stock.name}</span>
                        <span className="text-sm text-gray-400">{stock.code}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 正在搜索 */}
                {isSearching && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                    搜索中...
                  </div>
                )}
              </div>

              {/* 备注输入 */}
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="备注（可选）"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 添加按钮 */}
              <button
                onClick={handleAddStock}
                disabled={loading || !selectedStock}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded font-medium transition-colors flex-shrink-0"
              >
                {loading ? '添加中...' : '添加'}
              </button>
            </div>
          </div>

          {/* 自选股列表 */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 shadow-xl">
            <h2 className="text-xl font-semibold mb-4">自选股列表</h2>

            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p>加载中...</p>
              </div>
            ) : watchlist.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p>您还没有添加任何自选股</p>
                <p className="text-sm mt-2">使用上方表单添加您关注的股票</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="pb-3 font-semibold text-gray-300">股票代码</th>
                      <th className="pb-3 font-semibold text-gray-300">股票名称</th>
                      <th className="pb-3 font-semibold text-gray-300">最新价格</th>
                      <th className="pb-3 font-semibold text-gray-300">涨跌幅</th>
                      <th className="pb-3 font-semibold text-gray-300">添加时间</th>
                      <th className="pb-3 font-semibold text-gray-300">备注</th>
                      <th className="pb-3 font-semibold text-gray-300 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {watchlist.map((item) => (
                      <tr key={item.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                        <td className="py-4 px-2 font-mono">{item.stockCode}</td>
                        <td className="py-4 px-2">{item.stockName || '未知'}</td>
                        <td className="py-4 px-2">{formatPrice(item.latestPrice)}</td>
                        <td className="py-4 px-2">{formatChange(item.change, item.changePercent)}</td>
                        <td className="py-4 px-2 text-sm text-gray-400">
                          {new Date(item.addTime).toLocaleString()}
                        </td>
                        <td className="py-4 px-2">
                          <input
                            type="text"
                            defaultValue={item.remark || ''}
                            onBlur={(e) => handleUpdateRemark(item.stockCode, e.target.value)}
                            className="bg-slate-700/80 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="添加备注"
                          />
                        </td>
                        <td className="py-4 px-2 text-right">
                          <button
                            onClick={() => handleRemoveStock(item.stockCode)}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition-colors"
                          >
                            移除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/watchlist')({ component: WatchlistPage })
