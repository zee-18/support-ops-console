import { useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import EscalationPage from './pages/EscalationPage'
import QueuePage from './pages/QueuePage'

function Navbar() {
  const [time, setTime] = useState(() => new Date())

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTime(new Date())
    }, 1000)

    return () => clearInterval(intervalId)
  }, [])

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-900">
          Support Ops Console
        </h1>
        <time
          dateTime={time.toISOString()}
          className="font-mono text-sm text-gray-600"
        >
          {time.toLocaleString()}
        </time>
      </div>
    </header>
  )
}

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <Routes>
        <Route path="/" element={<QueuePage />} />
        <Route path="/support-requests/:id" element={<EscalationPage />} />
      </Routes>
    </div>
  )
}
