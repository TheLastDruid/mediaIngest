import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HardDrive, Activity, CheckCircle, Film, Tv, Database, Zap, XCircle, Server, Power, Clapperboard, Download, X } from 'lucide-react'

// Update Notification Banner
function UpdateBanner({ version, onDismiss }) {
  const [copied, setCopied] = useState(false)
  
  const installCommand = 'bash -c "$(wget -qLO - https://raw.githubusercontent.com/TheLastDruid/mediaIngest/main/install.sh)"'
  
  const copyCommand = () => {
    navigator.clipboard.writeText(installCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-blue-600/20 border border-blue-500/50 rounded-xl p-4 mb-4 flex items-start justify-between"
    >
      <div className="flex items-start gap-3 flex-1">
        <Download className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <div className="font-semibold text-white mb-1">Update Available</div>
          <div className="text-sm text-slate-300 mb-3">
            Version {version.latest.version} is now available. You're currently running {version.current.version}.
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3 mb-3">
            <div className="text-xs text-slate-400 mb-2 font-medium">To update, recreate the LXC container:</div>
            <div className="space-y-2">
              <div className="font-mono text-xs text-slate-300">
                <span className="text-slate-500"># 1. Destroy existing container (no data loss - media is on NAS)</span><br/>
                <span className="text-red-400">pct stop 110 && pct destroy 110</span>
              </div>
              <div className="font-mono text-xs text-slate-300 flex items-center justify-between gap-2">
                <div className="flex-1">
                  <span className="text-slate-500"># 2. Run installer to create updated container</span><br/>
                  <span className="text-green-400">{installCommand}</span>
                </div>
                <button
                  onClick={copyCommand}
                  className="px-2 py-1 bg-blue-600/30 hover:bg-blue-600/50 rounded text-blue-400 transition-colors flex-shrink-0 text-xs"
                >
                  {copied ? '✓' : 'Copy'}
                </button>
              </div>
            </div>
            <div className="text-xs text-amber-400 mt-2">
              ⚠️ Note: Container ID may differ on recreation
            </div>
          </div>
          <a 
            href={version.latest.downloadUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-block text-blue-400 hover:text-blue-300 text-sm font-medium underline"
          >
            View Release Notes →
          </a>
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="text-slate-400 hover:text-white transition-colors p-1 ml-2"
        title="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  )
}

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

// Compact Status Bar for Idle State
function CompactStatusBar() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-xl h-16 px-6 flex items-center justify-between transition-all duration-500"
    >
      <div className="flex items-center gap-4">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-lg font-semibold text-white">System Ready</span>
        <span className="text-sm text-slate-500 hidden sm:inline">Waiting for USB Drive...</span>
      </div>
      <HardDrive className="w-5 h-5 text-slate-600" />
    </motion.div>
  )
}

// Expanded Hero Card for Active State
function ActiveTransferCard({ current, onAbort }) {
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
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.5 }}
      className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-xl p-5 sm:p-6 transition-all duration-500"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Active Transfer
        </h2>
        <Activity className="w-4 h-4 text-blue-400 animate-pulse" />
      </div>

      <div>
        <div className="mb-4 sm:mb-5">
          <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-2 truncate">
            {current.filename || 'Preparing transfer...'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500">Media file transfer in progress</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-5 sm:mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs uppercase tracking-wide text-slate-500">Progress</span>
            <span className="text-base sm:text-lg font-bold text-blue-400">{current.progress || 0}%</span>
          </div>
          <div className="h-4 sm:h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800 touch-manipulation">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-600 to-blue-500"
              animate={{ width: `${current.progress || 0}%` }}
              transition={{ duration: 0.1, ease: "linear" }}
            />
          </div>
        </div>

        {/* Stats Grid */}
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
    </motion.div>
  )
}

function DeviceCard({ onAction, deviceName }) {
  const [loading, setLoading] = useState(null)

  const handleAction = async (action, endpoint) => {
    setLoading(action)
    try {
      const res = await fetch(endpoint, { method: 'POST' })
      const data = await res.json()
      
      if (data.ok) {
        onAction(data.message || `${action} completed`)
      } else {
        onAction(data.error || `${action} failed`, true)
      }
    } catch (e) {
      onAction('Network error', true)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-xl p-5 sm:p-6 transition-all duration-500">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Device & Controls
        </h2>
        <Database className="w-4 h-4 text-slate-700" />
      </div>

      <div className="space-y-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-600 mb-1">Device</div>
          <div className="text-sm font-medium text-white">{deviceName || 'No device connected'}</div>
        </div>
        
        {/* Hide on mobile to save space */}
        <div className="hidden sm:block">
          <div className="text-xs uppercase tracking-wide text-slate-600 mb-1">Mount</div>
          <div className="text-xs font-mono text-slate-400">/media/usb-ingest</div>
        </div>

        <div className="pt-3 border-t border-slate-800">
          <div className="text-xs uppercase tracking-wide text-slate-600 mb-3">Actions</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={() => handleAction('Unmount', '/api/eject')}
              disabled={loading === 'Unmount'}
              className="bg-slate-950/50 hover:bg-slate-800/50 border border-slate-700 text-slate-300 font-medium py-2 px-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm touch-manipulation active:scale-95 disabled:opacity-50"
            >
              <Power className="w-4 h-4" />
              <span>{loading === 'Unmount' ? '...' : 'Eject'}</span>
            </button>

            <button
              onClick={() => handleAction('Scan', '/api/scan')}
              disabled={loading === 'Scan'}
              className="bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600 text-blue-400 font-medium py-2 px-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm touch-manipulation active:scale-95 disabled:opacity-50"
            >
              <Clapperboard className="w-4 h-4" />
              <span>{loading === 'Scan' ? '...' : 'Scan'}</span>
            </button>
          </div>
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

function SettingsCard({ onAction }) {
  const [tmdbEnabled, setTmdbEnabled] = useState(false);
  const [tmdbHasApiKey, setTmdbHasApiKey] = useState(false);
  const [tmdbApiKey, setTmdbApiKey] = useState('');
  const [showTmdbApiKey, setShowTmdbApiKey] = useState(false);
  
  const [anilistEnabled, setAnilistEnabled] = useState(false);
  const [anilistHasApiKey, setAnilistHasApiKey] = useState(false);
  const [anilistApiKey, setAnilistApiKey] = useState('');
  const [showAnilistApiKey, setShowAnilistApiKey] = useState(false);
  
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Load TMDB config
    fetch('/api/tmdb/config', {
      headers: { 'Authorization': 'Basic ' + btoa('admin:' + localStorage.getItem('password')) }
    })
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          setTmdbEnabled(data.enabled);
          setTmdbHasApiKey(data.hasApiKey);
        }
      })
      .catch(err => console.error('Failed to load TMDB config:', err));
    
    // Load AniList config
    fetch('/api/anilist/config', {
      headers: { 'Authorization': 'Basic ' + btoa('admin:' + localStorage.getItem('password')) }
    })
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          setAnilistEnabled(data.enabled);
          setAnilistHasApiKey(data.hasApiKey);
        }
      })
      .catch(err => console.error('Failed to load AniList config:', err));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save TMDB config
      const tmdbRes = await fetch('/api/tmdb/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + btoa('admin:' + localStorage.getItem('password'))
        },
        body: JSON.stringify({
          enabled: tmdbEnabled,
          apiKey: tmdbApiKey || undefined
        })
      });
      
      const tmdbData = await tmdbRes.json();
      if (tmdbData.ok) {
        setTmdbHasApiKey(tmdbData.hasApiKey);
        setTmdbApiKey('');
        setShowTmdbApiKey(false);
      }
      
      // Save AniList config
      const anilistRes = await fetch('/api/anilist/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + btoa('admin:' + localStorage.getItem('password'))
        },
        body: JSON.stringify({
          enabled: anilistEnabled,
          apiKey: anilistApiKey || undefined
        })
      });
      
      const anilistData = await anilistRes.json();
      if (anilistData.ok) {
        setAnilistHasApiKey(anilistData.hasApiKey);
        setAnilistApiKey('');
        setShowAnilistApiKey(false);
      }
      
      if (tmdbData.ok && anilistData.ok) {
        onAction({ type: 'success', message: 'Settings saved successfully' });
      } else {
        onAction({ type: 'error', message: 'Failed to save some settings' });
      }
    } catch (error) {
      onAction({ type: 'error', message: 'Error saving settings' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-6 border border-slate-800/50">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-violet-500/10 rounded-lg">
          <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white">Settings</h3>
      </div>

      <div className="space-y-6">
        {/* TMDB Integration */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-white">TMDB Integration</h4>
              <p className="text-xs text-slate-400 mt-1">
                Enable movie metadata lookup and duplicate detection
              </p>
            </div>
            <button
              onClick={() => setTmdbEnabled(!tmdbEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                tmdbEnabled ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                tmdbEnabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {tmdbEnabled && (
            <div className="mt-3 space-y-2 pt-3 border-t border-slate-800">
              <label className="block text-sm text-slate-300">
                TMDB API Key
                {!tmdbHasApiKey && <span className="text-red-400 ml-1">*</span>}
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showTmdbApiKey ? 'text' : 'password'}
                    value={tmdbApiKey}
                    onChange={(e) => setTmdbApiKey(e.target.value)}
                    placeholder={tmdbHasApiKey ? '••••••••••••••••' : 'Enter your TMDB API key'}
                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTmdbApiKey(!showTmdbApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showTmdbApiKey ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Get your free API key at{' '}
                <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline">
                  themoviedb.org/settings/api
                </a>
              </p>
            </div>
          )}
        </div>

        {/* AniList Integration */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-white">AniList Integration</h4>
              <p className="text-xs text-slate-400 mt-1">
                Enable anime metadata lookup and proper naming
              </p>
            </div>
            <button
              onClick={() => setAnilistEnabled(!anilistEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                anilistEnabled ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                anilistEnabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {anilistEnabled && (
            <div className="mt-3 space-y-2 pt-3 border-t border-slate-800">
              <label className="block text-sm text-slate-300">
                AniList API Key
                {!anilistHasApiKey && <span className="text-red-400 ml-1">*</span>}
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showAnilistApiKey ? 'text' : 'password'}
                    value={anilistApiKey}
                    onChange={(e) => setAnilistApiKey(e.target.value)}
                    placeholder={anilistHasApiKey ? '••••••••••••••••' : 'Enter your AniList API key'}
                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAnilistApiKey(!showAnilistApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showAnilistApiKey ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Get your free API key at{' '}
                <a href="https://anilist.co/settings/developer" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline">
                  anilist.co/settings/developer
                </a>
              </p>
            </div>
          )}
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving || (tmdbEnabled && !tmdbHasApiKey && !tmdbApiKey) || (anilistEnabled && !anilistHasApiKey && !anilistApiKey)}
          className="w-full px-4 py-2 bg-violet-500 hover:bg-violet-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg font-medium transition-colors"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}

function StatsCard({ stats }) {
  const lastActiveText = stats.lastActive 
    ? new Date(stats.lastActive).toLocaleString()
    : 'Never';
    
  return (
    <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-xl p-5 sm:p-6 transition-all duration-500">
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
    <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-xl p-5 sm:p-6 transition-all duration-500">
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

function HistoryCard({ history, isExpanded }) {
  return (
    <motion.div
      layout
      transition={{ duration: 0.5 }}
      className={`bg-slate-900/50 backdrop-blur border border-slate-800 rounded-xl p-5 sm:p-6 transition-all duration-500 ${isExpanded ? 'flex-grow' : ''}`}
    >
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
          <div className="hidden md:block overflow-x-auto">
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

          {/* Mobile Stacked List View */}
          <div className="md:hidden space-y-2">
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
    </motion.div>
  )
}

export default function App() {
  const [active, setActive] = useState(false)
  const [current, setCurrent] = useState({ filename: null, progress: 0, speed: null, timeRemaining: null, size: null })
  const [deviceName, setDeviceName] = useState(null)
  const [history, setHistory] = useState([])
  const [stats, setStats] = useState({ totalFiles: 0, totalGB: '0.00', lastActive: null })
  const [storage, setStorage] = useState({ nas: null, usb: null })
  const [toast, setToast] = useState(null)
  const [updateInfo, setUpdateInfo] = useState(null)
  const [showUpdateBanner, setShowUpdateBanner] = useState(false)

  const showToast = (message, isError = false) => {
    setToast({ message, isError })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    let mounted = true
    let eventSource = null

    // Initial data fetch
    async function fetchInitialData() {
      try {
        const [historyRes, statsRes, storageRes, versionRes, statusRes] = await Promise.all([
          fetch('/api/history'),
          fetch('/api/stats'),
          fetch('/api/storage'),
          fetch('/api/version'),
          fetch('/api/status')
        ])
        
        const historyData = await historyRes.json()
        const statsData = await statsRes.json()
        const storageData = await storageRes.json()
        const versionData = await versionRes.json()
        const statusData = await statusRes.json()
        
        if (!mounted) return
        
        if (historyData.ok) {
          setHistory(historyData.history || [])
        }
        
        if (statsData.ok) {
          setStats(statsData.stats)
        }
        
        if (storageData.ok) {
          setStorage(storageData.storage)
        }
        
        if (statusData.ok && statusData.deviceName) {
          setDeviceName(statusData.deviceName)
        }
        
        if (versionData.ok && versionData.updateAvailable) {
          setUpdateInfo(versionData)
          setShowUpdateBanner(true)
        }
      } catch (e) {
        console.error('Initial fetch error:', e)
      }
    }

    // Setup Server-Sent Events for real-time updates
    function setupSSE() {
      eventSource = new EventSource('/api/stream')
      
      eventSource.onmessage = (event) => {
        if (!mounted) return
        
        try {
          const message = JSON.parse(event.data)
          
          if (message.type === 'status') {
            const current = message.data || { filename: null, progress: 0, speed: null, timeRemaining: null, size: null }
            setActive(current.filename !== null || current.progress > 0)
            setCurrent(current)
            // Device name comes from separate API call
            fetch('/api/status').then(r => r.json()).then(data => {
              if (data.ok && data.deviceName && mounted) {
                setDeviceName(data.deviceName)
              }
            }).catch(() => {})
          } else if (message.type === 'update') {
            // Refresh history and stats when new transfers complete
            fetch('/api/history').then(r => r.json()).then(data => {
              if (data.ok && mounted) setHistory(data.history || [])
            })
            fetch('/api/stats').then(r => r.json()).then(data => {
              if (data.ok && mounted) setStats(data.stats)
            })
          }
        } catch (e) {
          console.error('SSE parse error:', e)
        }
      }
      
      eventSource.onerror = () => {
        console.log('SSE connection lost, reconnecting...')
        eventSource.close()
        // Reconnect after 2 seconds
        if (mounted) {
          setTimeout(() => {
            if (mounted) setupSSE()
          }, 2000)
        }
      }
    }

    // Periodic refresh for storage stats (less frequent)
    const storageInterval = setInterval(() => {
      if (mounted) {
        fetch('/api/storage').then(r => r.json()).then(data => {
          if (data.ok && mounted) setStorage(data.storage)
        }).catch(e => console.error('Storage fetch error:', e))
      }
    }, 5000) // Every 5 seconds

    fetchInitialData()
    setupSSE()
    
    return () => { 
      mounted = false
      if (eventSource) eventSource.close()
      clearInterval(storageInterval)
    }
  }, [])

  // Show active transfer card if sync is active, even if filename isn't available yet
  const hasTransfer = active

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Toast Notification */}
        <AnimatePresence>
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
        </AnimatePresence>

        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-2.5 rounded-xl">
                <HardDrive className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">Media Ingest</h1>
                <p className="text-slate-400 text-sm">USB Auto-Sync Dashboard</p>
              </div>
            </div>
            <StatusBadge active={active} />
          </div>
        </motion.header>

        {/* Update Banner */}
        <AnimatePresence>
          {showUpdateBanner && updateInfo && (
            <UpdateBanner 
              version={updateInfo} 
              onDismiss={() => setShowUpdateBanner(false)} 
            />
          )}
        </AnimatePresence>

        {/* Dynamic Layout Based on State */}
        <div className="flex flex-col gap-3 sm:gap-4 transition-all duration-500">
          {/* Transfer Section - Compact when idle, expanded when active */}
          <AnimatePresence mode="wait">
            {hasTransfer ? (
              <ActiveTransferCard key="active" current={current} onAbort={showToast} />
            ) : (
              <CompactStatusBar key="compact" />
            )}
          </AnimatePresence>

          {/* Grid for Cards */}
          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 transition-all duration-500`}>
            <StatsCard stats={stats} />
            <StorageCard storage={storage} />
            <DeviceCard onAction={showToast} deviceName={deviceName} />
            <SettingsCard onAction={showToast} />
          </div>

          {/* History - Expands to fill space when idle */}
          <HistoryCard history={history} isExpanded={!hasTransfer} />
        </div>
      </div>
    </div>
  )
}
