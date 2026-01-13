import { useCallback, useState } from 'react'
import { useRouter } from '@tanstack/react-router'

export interface NewPosition {
  stock_id: string
  symbol: string
  stock_name: string
  quantity: number
  avg_cost: number
  market_value: number
  profit: number
  profit_percent: number
  notes: string
}

interface AddPositionModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (position: NewPosition) => Promise<void>
}

export function AddPositionModal({ isOpen, onClose, onAdd }: AddPositionModalProps) {
  const router = useRouter()
  const [newPosition, setNewPosition] = useState<NewPosition>({
    stock_id: '',
    symbol: '',
    stock_name: '',
    quantity: 0,
    avg_cost: 0,
    market_value: 0,
    profit: 0,
    profit_percent: 0,
    notes: ''
  })

  // 提交新增持仓
  const submitNewPosition = useCallback(async () => {
    if (!newPosition.symbol || !newPosition.stock_name) return
    
    await onAdd(newPosition)
    setNewPosition({
      stock_id: '',
      symbol: '',
      stock_name: '',
      quantity: 0,
      avg_cost: 0,
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
            <input
              type="text"
              placeholder="股票代码"
              value={newPosition.symbol}
              onChange={(e) => setNewPosition({...newPosition, symbol: e.target.value})}
              className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
            <input
              type="text"
              placeholder="股票名称"
              value={newPosition.stock_name}
              onChange={(e) => setNewPosition({...newPosition, stock_name: e.target.value})}
              className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
            <input
              type="number"
              placeholder="持仓数量"
              value={newPosition.quantity}
              onChange={(e) => setNewPosition({...newPosition, quantity: parseInt(e.target.value) || 0})}
              className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
            <input
              type="number"
              placeholder="平均成本"
              value={newPosition.avg_cost}
              onChange={(e) => setNewPosition({...newPosition, avg_cost: parseFloat(e.target.value) || 0})}
              className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
            <input
              type="number"
              placeholder="市值"
              value={newPosition.market_value}
              onChange={(e) => setNewPosition({...newPosition, market_value: parseFloat(e.target.value) || 0})}
              className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
            <input
              type="number"
              placeholder="盈亏金额"
              value={newPosition.profit}
              onChange={(e) => setNewPosition({...newPosition, profit: parseFloat(e.target.value) || 0})}
              className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
            <textarea
              placeholder="备注信息"
              value={newPosition.notes}
              onChange={(e) => setNewPosition({...newPosition, notes: e.target.value})}
              rows={3}
              className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={submitNewPosition}
              disabled={!newPosition.symbol || !newPosition.stock_name}
              className="bg-green-500 hover:bg-green-600 disabled:bg-green-500/50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              添加持仓
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
