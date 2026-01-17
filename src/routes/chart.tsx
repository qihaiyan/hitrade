import { createFileRoute } from '@tanstack/react-router'
import Navbar from '../components/Navbar'
import Chart from '../components/Chart'

// Main chart page component
function ChartPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Navbar />
      <div className="p-4 sm:p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <header className="mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">Financial Chart</h1>
            <p className="text-gray-400">Interactive chart with technical indicators</p>
          </header>
          
          <Chart initialTimeframe="1m" />
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/chart')({
  component: ChartPage,
})
