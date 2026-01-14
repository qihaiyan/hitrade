import React, { useCallback, useState } from 'react'
import { useRouter } from '@tanstack/react-router'

export interface Position {
  id: number
  symbol: string
  stock_name: string
  quantity: number
  avg_cost: number
  market_value: number
  profit: number
  profit_percent: number
  notes: string | null
}

// 交易记录接口
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

interface PositionTableProps {
  positions: Position[]
  onDelete: (id: number) => Promise<void>
  onUpdate: (id: number, updates: { quantity?: number, avg_cost?: number, notes?: string }) => Promise<void>
  onGetTransactions?: (symbol: string) => Promise<StockTransaction[]>
}

export function PositionTable({ positions, onDelete, onUpdate, onGetTransactions }: PositionTableProps) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValues, setEditValues] = useState<{ quantity?: number, avg_cost?: number, notes?: string }>({})
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  const [transactions, setTransactions] = useState<Map<string, StockTransaction[]>>(new Map())
  const [loadingTransactions, setLoadingTransactions] = useState<Set<string>>(new Set())

  // 删除持仓
  const handleDelete = useCallback(async (id: number) => {
    await onDelete(id)
    router.invalidate()
  }, [onDelete])

  // 开始编辑
  const startEditing = useCallback((position: Position) => {
    setEditingId(position.id)
    setEditValues({
      quantity: position.quantity,
      avg_cost: position.avg_cost,
      notes: position.notes || ''
    })
  }, [])

  // 保存编辑
  const saveEdit = useCallback(async (id: number) => {
    await onUpdate(id, editValues)
    setEditingId(null)
    setEditValues({})
    router.invalidate()
  }, [onUpdate, editValues])

  // 取消编辑
  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditValues({})
  }, [])

  // 切换行展开状态
  const toggleRowExpand = useCallback(async (positionId: number, symbol: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(positionId)) {
        newSet.delete(positionId)
      } else {
        newSet.add(positionId)
        // 如果有获取交易记录的函数，且还没有该股票的交易记录，则获取
        if (onGetTransactions && !transactions.has(symbol) && !loadingTransactions.has(symbol)) {
          fetchTransactions(symbol)
        }
      }
      return newSet
    })
  }, [onGetTransactions, transactions, loadingTransactions])

  // 获取交易记录
  const fetchTransactions = useCallback(async (symbol: string) => {
    if (!onGetTransactions) return
    
    setLoadingTransactions(prev => new Set(prev).add(symbol))
    try {
      const data = await onGetTransactions(symbol)
      setTransactions(prev => new Map(prev).set(symbol, data))
    } catch (error) {
      console.error('获取交易记录失败:', error)
      // 设置空数组，避免重复尝试
      setTransactions(prev => new Map(prev).set(symbol, []))
    } finally {
      setLoadingTransactions(prev => {
        const newSet = new Set(prev)
        newSet.delete(symbol)
        return newSet
      })
    }
  }, [onGetTransactions])

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead><tr className="bg-white/5">
              <th className="px-4 py-3 text-left border-b border-white/20 w-12"></th>
              <th className="px-4 py-3 text-left border-b border-white/20">代码</th>
              <th className="px-4 py-3 text-left border-b border-white/20">名称</th>
              <th className="px-4 py-3 text-left border-b border-white/20">数量</th>
              <th className="px-4 py-3 text-left border-b border-white/20">成本</th>
              <th className="px-4 py-3 text-left border-b border-white/20">市值</th>
              <th className="px-4 py-3 text-left border-b border-white/20">盈亏</th>
              <th className="px-4 py-3 text-left border-b border-white/20">盈亏率</th>
              <th className="px-4 py-3 text-left border-b border-white/20">备注</th>
              <th className="px-4 py-3 text-left border-b border-white/20">操作</th>
            </tr></thead>
          <tbody>{positions?.map((pos) => (<React.Fragment key={pos.id}>
                <tr key={pos.id} className="hover:bg-white/5">
                  <td className="px-4 py-3 border-b border-white/10 cursor-pointer">
                    <button
                      onClick={() => toggleRowExpand(pos.id, pos.symbol)}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      {expandedRows.has(pos.id) ? '▼' : '▶'}
                    </button>
                  </td>
                  <td className="px-4 py-3 border-b border-white/10">{pos.symbol}</td>
                  <td className="px-4 py-3 border-b border-white/10">{pos.stock_name}</td>{editingId === pos.id ? (
                  <>
                    <td className="px-4 py-3 border-b border-white/10">
                      <input
                        type="number"
                        value={editValues.quantity || 0}
                        onChange={(e) => setEditValues({...editValues, quantity: parseInt(e.target.value) || 0})}
                        className="w-full px-2 py-1 rounded bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </td>
                    <td className="px-4 py-3 border-b border-white/10">
                      <input
                        type="number"
                        value={editValues.avg_cost || 0}
                        onChange={(e) => setEditValues({...editValues, avg_cost: parseFloat(e.target.value) || 0})}
                        className="w-full px-2 py-1 rounded bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </td>
                  </>) : (
                  <>
                    <td className="px-4 py-3 border-b border-white/10">{pos.quantity}</td>
                    <td className="px-4 py-3 border-b border-white/10">{pos.avg_cost.toFixed(2)}</td>
                  </>)}
                
                <td className="px-4 py-3 border-b border-white/10">{pos.market_value.toFixed(2)}</td>
                <td className={`px-4 py-3 border-b border-white/10 ${pos.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {pos.profit.toFixed(2)}
                </td>
                <td className={`px-4 py-3 border-b border-white/10 ${pos.profit_percent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {pos.profit_percent.toFixed(2)}%
                </td>
                
                {editingId === pos.id ? (
                  <td className="px-4 py-3 border-b border-white/10">
                    <textarea
                      value={editValues.notes || ''}
                      onChange={(e) => setEditValues({...editValues, notes: e.target.value})}
                      rows={2}
                      className="w-full px-2 py-1 rounded bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </td>
                ) : (
                  <td className="px-4 py-3 border-b border-white/10">{pos.notes || '-'}</td>
                )}<td className="px-4 py-3 border-b border-white/10">
                  {editingId === pos.id ? (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => saveEdit(pos.id)}
                        className="bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded transition-colors"
                      >
                        保存
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="bg-gray-500 hover:bg-gray-600 text-white py-1 px-3 rounded transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => startEditing(pos)}
                        className="bg-yellow-500 hover:bg-yellow-600 text-white py-1 px-3 rounded transition-colors"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDelete(pos.id)}
                        className="bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded transition-colors"
                      >
                        删除
                      </button>
                    </div>
                  )}
                </td>
              </tr>
              {expandedRows.has(pos.id) && (
                <tr>
                  <td colSpan={10} className="px-4 py-3 bg-white/5">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead><tr className="bg-white/10">
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">交易ID</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">类型</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">价格</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">数量</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">金额</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">时间</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">状态</th>
                          </tr></thead>
                        <tbody>{loadingTransactions.has(pos.symbol) ? (
                            <tr>
                              <td colSpan={7} className="px-4 py-4 text-center text-gray-400">
                                加载中...
                              </td>
                            </tr>
                          ) : !transactions.has(pos.symbol) || transactions.get(pos.symbol)?.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-4 py-4 text-center text-gray-400">
                                暂无交易记录
                              </td>
                            </tr>
                          ) : (
                            transactions.get(pos.symbol)?.map(transaction => (
                              <tr key={transaction.id} className="border-b border-white/5 hover:bg-white/5">
                                <td className="px-4 py-2 text-sm">{transaction.transaction_id}</td>
                                <td className={`px-4 py-2 text-sm font-medium ${transaction.transaction_type === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                                  {transaction.transaction_type === 'buy' ? '买入' : '卖出'}
                                </td>
                                <td className="px-4 py-2 text-sm">{transaction.price.toFixed(2)}</td>
                                <td className="px-4 py-2 text-sm">{transaction.quantity}</td>
                                <td className="px-4 py-2 text-sm">{transaction.amount.toFixed(2)}</td>
                                <td className="px-4 py-2 text-sm text-gray-400">
                                  {new Date(transaction.transaction_time).toLocaleString()}
                                </td>
                                <td className="px-4 py-2 text-sm">
                                  {transaction.status === 'completed' ? '已成交' : 
                                   transaction.status === 'pending' ? '待成交' : '已撤销'}
                                </td>
                              </tr>
                            ))
                          )}</tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              )}</React.Fragment>))}</tbody>
        </table>
      </div>
    </div>
  )
}
