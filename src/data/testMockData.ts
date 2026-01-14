// 测试mock数据生成和插入功能
import { generateMockStockPrice, generateMockStockPrices, insertMockStockPrices } from './mockStockPrice'
import { getAllStockPrice } from './stockPrice'

async function testMockData() {
  console.log('=== 测试股票价格Mock数据生成 ===')
  
  // 测试单个股票价格生成
  const singleStock = generateMockStockPrice(1)
  console.log('单个股票价格数据:', JSON.stringify(singleStock, null, 2))
  
  // 测试多个股票价格生成
  const multipleStocks = generateMockStockPrices(5)
  console.log('\n多个股票价格数据:', JSON.stringify(multipleStocks, null, 2))
  
  // 测试插入mock数据到数据库
  console.log('\n=== 测试插入Mock数据到数据库 ===')
  try {
    const insertedCount = await insertMockStockPrices(10)
    console.log(`成功插入 ${insertedCount} 条股票价格数据`)
    
    // 验证数据是否插入成功
    const allStocks = await getAllStockPrice()
    console.log(`\n数据库中共有 ${allStocks.length} 条股票价格数据`)
    console.log('最新的5条数据:', JSON.stringify(allStocks.slice(-5), null, 2))
  } catch (error) {
    console.error('插入数据时出错:', error)
  }
}

// 运行测试
testMockData()
  .then(() => console.log('\n=== 测试完成 ==='))
  .catch(error => console.error('测试失败:', error))