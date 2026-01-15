import { useCallback, useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getUserPositions, updateUserPosition, deleteUserPosition, getUserPositionById } from '../../data/userPositions'
import { addBuyTransaction, getUserTransactionsByStock, deleteUserTransactionsByStock } from '../../data/stockTransaction'
import { ensureDefaultUser } from '../../data/users'
import { getAllStockPrice } from '../../data/stockPrice'
import { PositionTable } from '../../components/PositionTable'
import { AddPositionModal } from '../../components/AddPositionModal'

// 服务器函数
const getPositions = createServerFn({ method: 'GET' })
  .handler(async () => {
    // 确保有默认用户
    const defaultUser = await ensureDefaultUser()
    // 获取持仓列表
    return await getUserPositions(defaultUser.id)
  })

const addPosition = createServerFn({ method: 'POST' })
  .inputValidator((d: any) => {
    // 验证必要字段
    console.log('Input validator received data:', d)
    if (!d.stock_code) throw new Error('Stock code is required')
    if (!d.price || d.price <= 0) throw new Error('Price must be greater than 0')
    if (!d.quantity || d.quantity <= 0) throw new Error('Quantity must be greater than 0')
    return d
  })
  .handler(async ({ data }) => {
    // 确保有默认用户
    const defaultUser = await ensureDefaultUser()
    
    // 转换为买入交易
    await addBuyTransaction(
      defaultUser.id,
      data.stock_code, // 使用stock_code作为股票代码
      data.price, // 使用price作为买入价格
      data.quantity
    )
    
    // 返回更新后的持仓列表
    return await getUserPositions(defaultUser.id)
  })

const updatePosition = createServerFn({ method: 'POST' })
  .inputValidator((d: any) => d)
  .handler(async ({ data }) => {
    // 更新持仓
    return await updateUserPosition(data.id, data.updates)
  })

const deletePosition = createServerFn({ method: 'POST' })
  .inputValidator((d: number) => d)
  .handler(async ({ data }) => {
    // 获取要删除的持仓信息
    const position = await getUserPositionById(data)
    
    // 删除持仓
    await deleteUserPosition(data)
    
    // 如果持仓存在，同时删除相关交易记录
    if (position) {
      const defaultUser = await ensureDefaultUser()
      await deleteUserTransactionsByStock(defaultUser.id, position.stock_code)
    }
    
    // 返回更新后的持仓列表
    const defaultUser = await ensureDefaultUser()
    return await getUserPositions(defaultUser.id)
  })

// 获取交易记录
const getTransactions = createServerFn({ method: 'GET' })
  .inputValidator((d: string) => d)
  .handler(async ({ data: stock_code }) => {
    // 确保有默认用户
    const defaultUser = await ensureDefaultUser()
    // 获取交易记录
    return await getUserTransactionsByStock(defaultUser.id, stock_code)
  })

// 获取所有股票数据
const getAllStocks = createServerFn({ method: 'GET' })
  .handler(async () => {
    // 获取所有股票数据
    return await getAllStockPrice()
  })

// 注释掉未使用的服务器函数
/*
const createUser = createServerFn({ method: 'POST' })
  .inputValidator((d: any) => d)
  .handler(async ({ data }) => {
    return await createUser(data)
  })
*/

export const Route = createFileRoute('/demo/start/server-funcs')({
  component: Home,
  loader: async () => await getPositions(),
})

function Home() {
  const router = useRouter()
  let positions = Route.useLoaderData() as any[]
  const [showModal, setShowModal] = useState(false)

  // 提交新增持仓
  const handleAddPosition = useCallback(async (position: any) => {
    await addPosition({ data: position })
    router.invalidate()
  }, [addPosition, router])

  // 删除持仓
  const handleDelete = useCallback(async (id: number) => {
    await deletePosition({ data: id })
  }, [deletePosition])

  // 更新持仓
  const handleUpdate = useCallback(async (id: number, updates: any) => {
    await updatePosition({ 
      data: { 
        id, 
        updates 
      } 
    })
  }, [updatePosition])

  // 获取交易记录
  const handleGetTransactions = useCallback(async (symbol: string) => {
    return await getTransactions({ data: symbol })
  }, [getTransactions])

  // 获取所有股票数据
  const handleGetAllStocks = useCallback(async () => {
    return await getAllStocks()
  }, [getAllStocks])

  return (
    <div
      className="flex items-center justify-center min-h-screen bg-gradient-to-br from-zinc-800 to-black p-4 text-white"
      style={{
        backgroundImage:
          'radial-gradient(50% 50% at 20% 60%, #23272a 0%, #18181b 50%, #000000 100%)',
      }}
    >
      <div className="w-full max-w-7xl p-8 rounded-xl backdrop-blur-md bg-black/50 shadow-xl border-8 border-black/10">
        <h1 className="text-2xl mb-6">用户持仓管理</h1>
        
        {/* 持仓列表 */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl">持仓列表</h2>
            <button
              onClick={() => setShowModal(true)}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              添加持仓
            </button>
          </div>
          <PositionTable 
            positions={positions} 
            onDelete={handleDelete}
            onUpdate={handleUpdate}
            onGetTransactions={handleGetTransactions}
          />
        </div>
        
        {/* 新增持仓模态框 */}
        <AddPositionModal 
          isOpen={showModal} 
          onClose={() => setShowModal(false)} 
          onAdd={handleAddPosition}
          onGetAllStocks={handleGetAllStocks}
        />
      </div>
    </div>
  )
}
