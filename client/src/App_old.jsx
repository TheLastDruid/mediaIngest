import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { HardDrive, Activity, CheckCircle, Film, Tv, Database, Zap, XCircle, Server } from 'lucide-react'

function StatusBadge({ active }) {
  return (
    <div className="flex items-center gap-2">
      <motion.div 
        className={`w-2.5 h-2.5 rounded-full ${active ? 'bg-blue-500' : 'bg-emerald-500'}`}
        animate={active ? { 
          scale: [1, 1.3, 1],
          opacity: [1, 0.7, 1]
        } : {
          scale: [1, 1.2, 1],
          opacity: [1, 0.8, 1]
        }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <span className="text-sm font-medium text-slate-300">
        {active ? 'Syncing' : 'Ready'}
      </span>
    </div>
  )
}

function HeroCard({ active, current, onAbort }) {
  const hasTransfer = active && current.filename
  const [aborting, setAborting] = useState(false)

  const handleAbort = async () => {
    if (!confirm('Are you sure you want to abort the current sync?')) return
    
    setAborting(true)
    try {
      const res = await fetch('/api/abort', { method: 'POST' })
      const data = await res.json()
      
      if (data.ok) {
        onAbort('Sync cancelled successfully')
      } else {
        onAbort('Failed to abort sync', true)
      }
    } catch (e) {
      onAbort('Network error', true)
    } finally {
      setAborting(false)
    }
  }
  
  return (
    <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-xl p-5 sm:p-6 md:col-span-2 lg:col-span-2 order-1">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Active Transfer
        </h2>
        <Activity className={`w-4 h-4 ${active ? 'text-blue-400 animate-pulse' : 'text-slate-700'}`} />
      </div>

      {hasTransfer ? (
        <div>
          <div className="mb-4 sm:mb-5">
            <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-2 truncate">
              {current.filename}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500">Media file transfer in progress</p>
          </div>

          {/* Progress Bar */}
          <div className="mb-5 sm:mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs uppercase tracking-wide text-slate-500">Progress</span>
              <span className="text-base sm:text-lg font-bold text-blue-400">{current.progress}%</span>
            </div>
            <div className="h-4 sm:h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800 touch-manipulation">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-600 to-blue-500"
                animate={{ width: `${current.progress}%` }}
                transition={{ duration: 0.1, ease: "linear" }}
              />
            </div>
          </div>

          {/* Stats Grid - Responsive */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
            <div className="bg-slate-950/50 rounded-lg p-3 sm:p-4 border border-slate-800/50">
              <div className="text-xs uppercase tracking-wide text-slate-600 mb-1">Speed</div>
              <div className="text-base sm:text-xl font-bold text-white truncate">{current.speed || '--'}</div>
            </div>
            <div className="bg-slate-950/50 rounded-lg p-3 sm:p-4 border border-slate-800/50">
              <div className="text-xs uppercase tracking-wide text-slate-600 mb-1">Size</div>
              <div className="text-base sm:text-xl font-bold text-white truncate">{current.size || '--'}</div>
            </div>
            <div className="bg-slate-950/50 rounded-lg p-3 sm:p-4 border border-slate-800/50">
              <div className="text-xs uppercase tracking-wide text-slate-600 mb-1">ETA</div>
              <div className="text-base sm:text-xl font-bold text-white truncate">{current.timeRemaining || '--'}</div>
            </div>
          </div>

          {/* Abort Button */}
          <button
            onClick={handleAbort}
            disabled={aborting}
            className="w-full bg-red-600/20 hover:bg-red-600/30 border-2 border-red-600 text-red-400 font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 touch-manipulation active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XCircle className="w-5 h-5" />
            <span>{aborting ? 'Aborting...' : 'ABORT SYNC'}</span>
          </button>
        </div>
      ) : (
        <div className="text-center py-12 sm:py-16">
          <motion.div
            animate={{ 
              scale: [1, 1.05, 1],
              opacity: [0.5, 0.7, 0.5]
            }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <HardDrive className="w-12 h-12 sm:w-16 sm:h-16 text-slate-800 mx-auto mb-4" />
          </motion.div>
          <h3 className="text-lg sm:text-xl font-semibold text-slate-400 mb-2">System Ready</h3>
          <p className="text-xs sm:text-sm text-slate-600">Waiting for USB drive connection...</p>
        </div>
      )}
    </div>
  )
}

function StorageCard({ storage }) {
  const nasPercent = storage.nas?.usedPercent || 0
  const usbPercent = storage.usb?.usedPercent || 0
  
  const getNasColor = () => {
    if (nasPercent > 90) return 'from-red-600 to-red-500'
    return 'from-blue-600 to-blue-500'
  }
  
  const getUsbColor = () => {
    if (usbPercent > 90) return 'from-red-600 to-red-500'
    return 'from-emerald-600 to-emerald-500'
  }
  
  return (
    <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-xl p-5 sm:p-6 order-3 md:order-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Storage Health
        </h2>
        <Server className="w-4 h-4 text-slate-700" />
      </div>

      <div className="space-y-5">
        {/* NAS Storage */}
        {storage.nas ? (
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs uppercase tracking-wide text-slate-500">NAS Space</span>
              <span className={`text-sm font-bold ${nasPercent > 90 ? 'text-red-400' : 'text-blue-400'}`}>
                {nasPercent}% Used
              </span>
            </div>
            <div className="h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800 mb-2">
              <motion.div
                className={`h-full bg-gradient-to-r ${getNasColor()}`}
                initial={{ width: 0 }}
                animate={{ width: `${nasPercent}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>{storage.nas.used} used</span>
              <span>{storage.nas.free} free</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-slate-600 text-xs">
            NAS not mounted
          </div>
        )}

        {/* USB Storage - Hidden on mobile */}
        {storage.usb && (
          <div className="hidden sm:block">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs uppercase tracking-wide text-slate-500">USB Space</span>
              <span className={`text-sm font-bold ${usbPercent > 90 ? 'text-red-400' : 'text-emerald-400'}`}>
                {usbPercent}% Used
              </span>
            </div>
            <div className="h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800 mb-2">
              <motion.div
                className={`h-full bg-gradient-to-r ${getUsbColor()}`}
                initial={{ width: 0 }}
                animate={{ width: `${usbPercent}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>{storage.usb.used} used</span>
              <span>{storage.usb.free} free</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function DeviceCard() {
  return (
    <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-xl p-5 sm:p-6 order-4 md:order-3">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          USB Device
        </h2>
        <Database className="w-4 h-4 text-slate-700" />
      </div>

      <div className="space-y-3 sm:space-y-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-600 mb-1">Device</div>
          <div className="text-sm font-medium text-white">Samsung T7 Shield</div>
        </div>
        
        {/* Hide on mobile to save space */}
        <div className="hidden sm:block">
          <div className="text-xs uppercase tracking-wide text-slate-600 mb-1">Mount</div>
          <div className="text-xs font-mono text-slate-400">/media/usb-ingest</div>
        </div>
        
        {/* Hide on mobile to save space */}
        <div className="hidden sm:block">
          <div className="text-xs uppercase tracking-wide text-slate-600 mb-1">FS Type</div>
          <div className="text-sm font-medium text-slate-400">NTFS (ntfs3)</div>
        </div>

        <div className="pt-3 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span className="text-xs text-slate-500">Ready</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatsCard({ stats }) {
  const lastActiveText = stats.lastActive 
    ? new Date(stats.lastActive).toLocaleString()
    : 'Never';
    
  return (
    <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-xl p-5 sm:p-6 order-2">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Statistics
        </h2>
        <Zap className="w-4 h-4 text-slate-700" />
      </div>

      <div className="space-y-3 sm:space-y-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-600 mb-1">Total Files</div>
          <div className="text-2xl sm:text-3xl font-bold text-white">{stats.totalFiles || 0}</div>
        </div>
        
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-600 mb-1">Total Data</div>
          <div className="text-xl sm:text-2xl font-bold text-blue-400">{stats.totalGB || '0.00'} GB</div>
        </div>
        
        <div className="pt-3 border-t border-slate-800">
          <div className="text-xs uppercase tracking-wide text-slate-600 mb-1">Last Active</div>
          <div className="text-xs text-slate-400 truncate">{lastActiveText}</div>
        </div>
      </div>
    </div>
  )
}

function HistoryCard({ history }) {
  return (
    <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-xl p-5 sm:p-6 md:col-span-2 lg:col-span-3 order-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Transfer History
        </h2>
        <span className="text-xs text-slate-600">{history.length} recent</span>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-12 text-slate-600 text-sm">
          No transfer history yet
        </div>
      ) : (
        <>
          {/* Desktop Table View - Hidden on Mobile */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-600">Type</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-600">Filename</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-600">Size</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-600">Time</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item, idx) => (
                  <motion.tr
                    key={item.filename + item.timestamp}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-3 px-4">
                      {item.type === 'Movie' ? (
                        <Film className="w-4 h-4 text-blue-400" />
                      ) : (
                        <Tv className="w-4 h-4 text-purple-400" />
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm font-medium text-white truncate max-w-md">
                        {item.filename}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm text-slate-400">{item.size}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-xs text-slate-500">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View - Visible Only on Mobile */}
          <div className="sm:hidden space-y-2">
            {history.map((item, idx) => (
              <motion.div
                key={item.filename + item.timestamp}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="bg-slate-950/50 border border-slate-800/50 rounded-lg p-4 flex items-center gap-3 touch-manipulation active:bg-slate-800/50 transition-colors"
              >
                {/* Icon */}
                <div className="flex-shrink-0">
                  {item.type === 'Movie' ? (
                    <Film className="w-5 h-5 text-blue-400" />
                  ) : (
                    <Tv className="w-5 h-5 text-purple-400" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate mb-1">
                    {item.filename}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{item.size}</span>
                    <span>•</span>
                    <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>

                {/* Status */}
                <div className="flex-shrink-0">
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function App() {
  const [active, setActive] = useState(false)
  const [current, setCurrent] = useState({ filename: null, progress: 0, speed: null, timeRemaining: null, size: null })
  const [history, setHistory] = useState([])
  const [stats, setStats] = useState({ totalFiles: 0, totalGB: '0.00', lastActive: null })
  const [storage, setStorage] = useState({ nas: null, usb: null })
  const [toast, setToast] = useState(null)

  const showToast = (message, isError = false) => {
    setToast({ message, isError })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    let mounted = true

    async function poll() {
      try {
        const [statusRes, historyRes, statsRes, storageRes] = await Promise.all([
          fetch('/api/status'),
          fetch('/api/history'),
          fetch('/api/stats'),
          fetch('/api/storage')
        ])
        
        const statusData = await statusRes.json()
        const historyData = await historyRes.json()
        const statsData = await statsRes.json()
        const storageData = await storageRes.json()
        
        if (!mounted) return
        
        if (statusData.ok) {
          setActive(statusData.active)
          setCurrent(statusData.current || { filename: null, progress: 0, speed: null, timeRemaining: null, size: null })
        }
        
        if (historyData.ok) {
          setHistory(historyData.history || [])
        }
        
        if (statsData.ok) {
          setStats(statsData.stats)
        }
        
        if (storageData.ok) {
          setStorage(storageData.storage)
        }
      } catch (e) {
        console.error('Polling error:', e)
      }
    }

    poll()
    const interval = setInterval(poll, 500) // Poll every 500ms for faster updates
    
    return () => { 
      mounted = false
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Toast Notification */}
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg border-2 shadow-xl backdrop-blur ${
              toast.isError 
                ? 'bg-red-900/90 border-red-600 text-red-200' 
                : 'bg-emerald-900/90 border-emerald-600 text-emerald-200'
            }`}
          >
            <div className="flex items-center gap-3">
              {toast.isError ? (
                <XCircle className="w-5 h-5" />
              ) : (
                <CheckCircle className="w-5 h-5" />
              )}
              <span className="font-medium">{toast.message}</span>
            </div>
          </motion.div>
        )}

        {/* Header - Responsive */}
        <header className="mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-center flex-shrink-0">
              <HardDrive className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">Media Ingest System</h1>
              <p className="text-xs text-slate-600">Real-time monitoring & history</p>
            </div>
          </div>
          <StatusBadge active={active} />
        </header>

        {/* Responsive Bento Grid */}
        {/* Mobile: 1 column, Tablet: 2 columns, Desktop: 3 columns (with spans) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {/* Hero Card - Always appears first on mobile, spans 2 cols on tablet/desktop */}
          <HeroCard active={active} current={current} onAbort={showToast} />

          {/* Stats Card - Second on mobile */}
          <StatsCard stats={stats} />

          {/* Storage Card - Third on mobile */}
          <StorageCard storage={storage} />

          {/* Device Card - Fourth on mobile */}
          <DeviceCard />

          {/* History Card - Last on mobile, spans full width */}
          <HistoryCard history={history} />
        </div>
      </div>
    </div>
  )
}
