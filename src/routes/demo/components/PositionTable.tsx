import { useCallback, useState } from 'react'
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

interface PositionTableProps {
  positions: Position[]
  onDelete: (id: number) => Promise<void>
  onUpdate: (id: number, updates: { quantity?: number, avg_cost?: number, notes?: string }) => Promise<void>
}

export function PositionTable({ positions, onDelete, onUpdate }: PositionTableProps) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValues, setEditValues] = useState<{ quantity?: number, avg_cost?: number, notes?: string }>({})

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

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-white/5">
              <th className="px-4 py-3 text-left border-b border-white/20">代码</th>
              <th className="px-4 py-3 text-left border-b border-white/20">名称</th>
              <th className="px-4 py-3 text-left border-b border-white/20">数量</th>
              <th className="px-4 py-3 text-left border-b border-white/20">成本</th>
              <th className="px-4 py-3 text-left border-b border-white/20">市值</th>
              <th className="px-4 py-3 text-left border-b border-white/20">盈亏</th>
              <th className="px-4 py-3 text-left border-b border-white/20">盈亏率</th>
              <th className="px-4 py-3 text-left border-b border-white/20">备注</th>
              <th className="px-4 py-3 text-left border-b border-white/20">操作</th>
            </tr>
          </thead>
          <tbody>
            {positions?.map((pos) => (
              <tr key={pos.id} className="hover:bg-white/5">
                <td className="px-4 py-3 border-b border-white/10">{pos.symbol}</td>
                <td className="px-4 py-3 border-b border-white/10">{pos.stock_name}</td>
                
                {editingId === pos.id ? (
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
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 border-b border-white/10">{pos.quantity}</td>
                    <td className="px-4 py-3 border-b border-white/10">{pos.avg_cost.toFixed(2)}</td>
                  </>
                )}
                
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
                )}
                
                <td className="px-4 py-3 border-b border-white/10">
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
