const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const basicAuth = require('express-basic-auth');
const rateLimit = require('express-rate-limit');

const LOG_PATH = '/var/log/ingest-media.log'; // Match actual log file from ingest-media.sh
const PROGRESS_LOG_PATH = '/var/log/ingest-media.log'; // Match actual log file from ingest-media.sh
const HISTORY_PATH = path.join(__dirname, 'history.json');
const TMDB_CONFIG_PATH = path.join(__dirname, 'tmdb-config.json');
const ANILIST_CONFIG_PATH = path.join(__dirname, 'anilist-config.json');
const PORT = process.env.PORT || 3000;

const app = express();

// Security: CORS - Allow only local network access
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow localhost and local network (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    const localPatterns = [
      /^http:\/\/localhost(:\d+)?$/,
      /^http:\/\/127\.0\.0\.1(:\d+)?$/,
      /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,
      /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,
      /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}(:\d+)?$/
    ];
    
    if (localPatterns.some(pattern => pattern.test(origin))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Security: HTTP Basic Authentication
const authMiddleware = basicAuth({
  users: { 
    'admin': process.env.DASHBOARD_PASSWORD || 'changeme123'
  },
  challenge: true,
  realm: 'Media Ingest Dashboard'
});

// Apply auth to all routes except version endpoint
app.use((req, res, next) => {
  if (req.path === '/api/version') {
    return next(); // Skip auth for version check
  }
  authMiddleware(req, res, next);
});

// Security: Rate limiting - 100 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Security: Sanitize log lines to prevent injection attacks
function sanitizeLogLine(line) {
  if (typeof line !== 'string') return '';
  
  return line
    .replace(/[<>"'&]/g, '') // Remove HTML entities
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters (keep \n and \r)
    .substring(0, 2000); // Limit length to prevent memory exhaustion
}

// Security: Validate log structure to prevent marker injection
function validateLogLine(line) {
  // Reject lines with multiple SYNC markers (possible injection)
  const markerCount = (line.match(/SYNC_(START|END)/g) || []).length;
  if (markerCount > 1) {
    console.warn('Possible log injection detected:', line.substring(0, 100));
    return null;
  }
  return sanitizeLogLine(line);
}

// Initialize history file if it doesn't exist
function initHistory() {
  if (!fs.existsSync(HISTORY_PATH)) {
    fs.writeFileSync(HISTORY_PATH, JSON.stringify({ transfers: [] }, null, 2));
  }
}

// Read history from JSON file
function readHistory() {
  try {
    const data = fs.readFileSync(HISTORY_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return { transfers: [] };
  }
}

// Write history to JSON file
function writeHistory(history) {
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
}

// Parse log and extract completed transfers from new lines only
function parseNewCompletedTransfers(newLines) {
  const completed = [];
  
  for (let i = 0; i < newLines.length; i++) {
    const line = newLines[i].trim();
    
    // Match rsync summary line: "sent 16.62G bytes  received 739 bytes  47.56M bytes/sec"
    const summaryMatch = line.match(/sent ([\d.]+[KMGT]?) bytes.*?([\d.]+[KMGT]?)\s?bytes\/sec/);
    if (summaryMatch) {
      // Look backwards for all transferred video files in this session
      let syncFolder = 'Media';
      
      // Find which folder was being synced
      for (let j = i - 1; j >= Math.max(0, i - 200); j--) {
        const syncStart = newLines[j].match(/SYNC_START:(\w+)/);
        if (syncStart) {
          syncFolder = syncStart[1];
          break;
        }
      }
      
      // Find all video files that were transferred (had 100% or xfr# markers)
      const transferredFiles = [];
      for (let j = i - 1; j >= Math.max(0, i - 500); j--) {
        const prevLine = newLines[j].trim();
        
        // Match video files that show progress
        if (prevLine.match(/\.(mp4|mkv|avi|mov|m4v|webm|flv|wmv|mpg|mpeg|m2ts)$/i)) {
          // Check if this file had transfer activity (next few lines show progress)
          let hadActivity = false;
          for (let k = j + 1; k <= Math.min(newLines.length - 1, j + 5); k++) {
            if (newLines[k].match(/\d+%/) || newLines[k].match(/xfr#/)) {
              hadActivity = true;
              break;
            }
          }
          
          if (hadActivity) {
            const filename = prevLine.replace(/^.*\//, '');
            if (!transferredFiles.some(f => f === filename)) {
              transferredFiles.push(filename);
            }
          }
        }
      }
      
      // Add all transferred files to history
      const avgSpeed = summaryMatch[2];
      transferredFiles.forEach(filename => {
        let type = 'Movie';
        if (filename.match(/S\d{2}E\d{2}|Season|Episode/i)) {
          type = 'Series';
        }
        
        completed.push({
          filename,
          size: summaryMatch[1],
          speed: avgSpeed + '/s',
          type,
          timestamp: Date.now()
        });
      });
      
      continue;
    }
    
    // Also match individual 100% completion lines for real-time tracking
    const completionMatch = line.match(/([\d.]+[KMGT]?)\s+100%\s+([\d.]+[KMGT]?B\/s)\s+(\d+:\d+:\d+)/);
    
    if (completionMatch) {
      // Look backwards for the filename on previous line(s)
      let filename = null;
      
      for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
        const prevLine = newLines[j].trim();
        
        // Match common video/media file extensions
        const fileMatch = prevLine.match(/([^\/]+\.(mp4|mkv|avi|mov|m4v|webm|flv|wmv|mpg|mpeg|m2ts))$/i);
        
        if (fileMatch) {
          filename = fileMatch[1];
          break;
        }
      }
      
      if (filename) {
        const size = completionMatch[1];
        const speed = completionMatch[2];
        const time = completionMatch[3];
        
        // Determine type (Movie vs Series)
        let type = 'Movie';
        if (filename.match(/S\d{2}E\d{2}|Season|Episode/i)) {
          type = 'Series';
        }
        
        completed.push({
          filename,
          size,
          speed,
          type,
          timestamp: Date.now()
        });
      }
    }
  }
  
  return completed;
}

// Parse progress log for current transfer status (reads progress log for real-time updates)
function parseCurrentTransfer() {
  let currentFilename = null;
  let progress = 0;
  let speed = null;
  let timeRemaining = null;
  let size = null;
  
  // Read progress log if it exists
  if (!fs.existsSync(PROGRESS_LOG_PATH)) {
    return { filename: null, progress: 0, speed: null, timeRemaining: null, size: null };
  }
  
  const progressContent = fs.readFileSync(PROGRESS_LOG_PATH, 'utf8');
  const allLines = progressContent.split('\n')
    .filter(line => line.trim())
    .map(line => validateLogLine(line))
    .filter(line => line !== null);
  
  // Look at last 200 lines to ensure we catch SYNC_START marker
  const progressLines = allLines.slice(-200);
  
  if (progressLines.length === 0) {
    return { filename: null, progress: 0, speed: null, timeRemaining: null, size: null };
  }
  
  // Check if sync is active by looking backwards from the end
  // If we see SYNC_END before SYNC_START, sync is complete
  let inActiveSync = false;
  for (let i = progressLines.length - 1; i >= 0; i--) {
    if (progressLines[i].startsWith('SYNC_END:')) {
      inActiveSync = false;
      break;
    }
    if (progressLines[i].startsWith('SYNC_START:')) {
      inActiveSync = true;
      break;
    }
  }
  
  if (!inActiveSync) {
    return { filename: null, progress: 0, speed: null, timeRemaining: null, size: null };
  }
  
  // Parse from end backwards for most recent transfer
  for (let i = progressLines.length - 1; i >= 0; i--) {
    const line = progressLines[i].trim();
    
    // Match progress line with percentage
    const progressMatch = line.match(/([\d.]+[KMGT]?)\s+(\d+)%\s+([\d.]+[KMGT]?B\/s)\s+(\d+:\d+:\d+)/);
    
    if (progressMatch) {
      const matchedProgress = parseInt(progressMatch[2]);
      
      // Skip if 100% completion
      if (matchedProgress >= 100 && line.includes('to-chk=0/')) continue;
      
      size = progressMatch[1];
      progress = matchedProgress;
      speed = progressMatch[3];
      timeRemaining = progressMatch[4];
      
      // Look backwards for filename (expanded search range)
      for (let j = i - 1; j >= Math.max(0, i - 30); j--) {
        const prevLine = progressLines[j].trim();
        
        if (prevLine && prevLine.match(/\.(mp4|mkv|avi|mov|m4v|webm|flv|wmv|mpg|mpeg|m2ts|srt|ass|sub)$/i)) {
          currentFilename = prevLine.replace(/^.*\//, '');
          break;
        }
      }
      
      if (currentFilename || progress > 0) break;
    }
  }
  
  // If we have progress but no filename, search more broadly
  if (inActiveSync && !currentFilename && progress > 0) {
    for (let i = progressLines.length - 1; i >= Math.max(0, progressLines.length - 100); i--) {
      const line = progressLines[i].trim();
      if (line && line.match(/\.(mp4|mkv|avi|mov|m4v|webm|flv|wmv|mpg|mpeg|m2ts|srt|ass|sub)$/i)) {
        currentFilename = line.replace(/^.*\//, '');
        break;
      }
    }
  }
  
  // If we're in active sync but found no progress, look for most recent filename
  if (inActiveSync && !currentFilename && progress === 0) {
    for (let i = progressLines.length - 1; i >= Math.max(0, progressLines.length - 50); i--) {
      const line = progressLines[i].trim();
      if (line && line.match(/\.(mp4|mkv|avi|mov|m4v|webm|flv|wmv|mpg|mpeg|m2ts|srt|ass|sub)$/i)) {
        currentFilename = line.replace(/^.*\//, '');
        break;
      }
    }
  }
  
  return { filename: currentFilename, progress, speed, timeRemaining, size };
}

// Parse main log for current transfer status (fallback if progress log doesn't exist)
function parseCurrentTransferFromMainLog(logLines) {
  let currentFilename = null;
  let progress = 0;
  let speed = null;
  let timeRemaining = null;
  let size = null;
  
  // Check if last line indicates completion
  const lastLines = logLines.slice(-10).join('\n');
  if (lastLines.includes('Ingest Complete') || lastLines.includes('sent ') && lastLines.includes('bytes/sec')) {
    // Transfer session completed, no active transfer
    return { filename: null, progress: 0, speed: null, timeRemaining: null, size: null };
  }
  
  // Check if we're in an active sync (look for "Syncing" or "sending incremental")
  let inActiveSync = false;
  for (let i = logLines.length - 1; i >= Math.max(0, logLines.length - 50); i--) {
    if (logLines[i].includes('Syncing ') || logLines[i].includes('sending incremental')) {
      inActiveSync = true;
      break;
    }
  }
  
  if (!inActiveSync) {
    return { filename: null, progress: 0, speed: null, timeRemaining: null, size: null };
  }
  
  // Parse from end backwards for most recent transfer
  for (let i = logLines.length - 1; i >= 0; i--) {
    const line = logLines[i].trim();
    
    // Stop if we hit a completion marker
    if (line.includes('Ingest Complete') || (line.includes('sent ') && line.includes('bytes/sec'))) {
      break;
    }
    
    // Match progress line: size percentage speed time (with optional xfr# and to-chk info)
    // Handles both formats:
    // - Per-file: "1.77G 100%   58.48MB/s    0:00:28 (xfr#2, to-chk=0/13)"
    // - Overall (progress2): "1.77G  25%   48.04MB/s    0:00:35 (xfr#2, to-chk=0/13)"
    const progressMatch = line.match(/([\d.]+[KMGT]?)\s+(\d+)%\s+([\d.]+[KMGT]?B\/s)\s+(\d+:\d+:\d+)/);
    
    if (progressMatch) {
      const matchedProgress = parseInt(progressMatch[2]);
      
      // Skip if 100% AND it's a completion summary line
      if (matchedProgress >= 100 && line.includes('to-chk=0/')) continue;
      
      size = progressMatch[1];
      progress = matchedProgress;
      speed = progressMatch[3];
      timeRemaining = progressMatch[4];
      
      // Look backwards for filename (rsync prints filename on previous line)
      for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
        const prevLine = logLines[j].trim();
        
        // Match common video/media file extensions
        if (prevLine && prevLine.match(/\.(mp4|mkv|avi|mov|m4v|webm|flv|wmv|mpg|mpeg|m2ts)$/i)) {
          currentFilename = prevLine.replace(/^.*\//, ''); // Remove path, keep filename only
          break;
        }
      }
      
      // If no filename found nearby but we have progress, it's overall sync progress
      // Look further back for the most recent filename
      if (!currentFilename && progress > 0) {
        for (let j = i - 1; j >= Math.max(0, i - 50); j--) {
          const prevLine = logLines[j].trim();
          if (prevLine && prevLine.match(/\.(mp4|mkv|avi|mov|m4v|webm|flv|wmv|mpg|mpeg|m2ts)$/i)) {
            currentFilename = prevLine.replace(/^.*\//, '');
            break;
          }
        }
      }
      
      if (currentFilename || progress > 0) break;
    }
  }
  
  // If we're in active sync but found no progress, look for most recent filename
  if (inActiveSync && !currentFilename && progress === 0) {
    for (let i = logLines.length - 1; i >= Math.max(0, logLines.length - 100); i--) {
      const line = logLines[i].trim();
      if (line && line.match(/\.(mp4|mkv|avi|mov|m4v|webm|flv|wmv|mpg|mpeg|m2ts)$/i)) {
        currentFilename = line.replace(/^.*\//, '');
        break;
      }
    }
  }
  
  return { filename: currentFilename, progress, speed, timeRemaining, size };
}

// Watch log file and update history (only process new lines)
let lastFileSize = 0;
let lastPosition = 0;
let sseClients = []; // Store SSE connections

function watchLogFile() {
  setInterval(() => {
    fs.stat(LOG_PATH, (err, stats) => {
      if (err) return;
      
      // Only process if file has grown
      if (stats.size > lastFileSize) {
        const stream = fs.createReadStream(LOG_PATH, {
          start: lastPosition,
          encoding: 'utf8'
        });
        
        let buffer = '';
        
        stream.on('data', (chunk) => {
          buffer += chunk;
        });
        
        stream.on('end', () => {
          const newLines = buffer.split(/\r?\n/)
            .filter(line => line.trim())
            .map(line => validateLogLine(line))
            .filter(line => line !== null);
          const completed = parseNewCompletedTransfers(newLines);
          
          if (completed.length > 0) {
            const history = readHistory();
            
            completed.forEach(transfer => {
              // Only add if not duplicate (check last 10 entries)
              const isDuplicate = history.transfers.slice(-10).some(t => 
                t.filename === transfer.filename
              );
              
              if (!isDuplicate) {
                history.transfers.push(transfer);
              }
            });
            
            // Keep only last 100 transfers
            if (history.transfers.length > 100) {
              history.transfers = history.transfers.slice(-100);
            }
            
            writeHistory(history);
            
            // Broadcast update to all SSE clients
            broadcastSSE({ type: 'update', data: { completed } });
          }
          
          lastPosition = stats.size;
          lastFileSize = stats.size;
        });
      } else if (stats.size < lastFileSize) {
        // Log was rotated/cleared, reset position
        lastPosition = 0;
        lastFileSize = stats.size;
      }
    });
  }, 1000); // Check every 1 second for faster response
}

// Broadcast to all SSE clients
function broadcastSSE(message) {
  sseClients.forEach(client => {
    client.write(`data: ${JSON.stringify(message)}\n\n`);
  });
}

// API: Get current status
app.get('/api/status', (req, res) => {
  // Use progress log for real-time updates
  const current = parseCurrentTransfer();
  const active = current.filename !== null || current.progress > 0;
  
  // Read device name from ingest status file
  let deviceName = null;
  const ingestStatusPath = '/run/ingest/status.json';
  try {
    if (fs.existsSync(ingestStatusPath)) {
      const statusData = JSON.parse(fs.readFileSync(ingestStatusPath, 'utf8'));
      deviceName = statusData.deviceName || null;
    }
  } catch (e) {
    // Ignore errors reading status file
  }
  
  // Debug logging when active
  if (active && process.env.DEBUG) {
    console.log(`[DEBUG] Active transfer: ${current.filename} - ${current.progress}% - ${current.speed}`);
  }
  
  res.json({ ok: true, active, current, deviceName });
});

// API: Version check endpoint
app.get('/api/version', async (req, res) => {
  try {
    // Read local version
    const versionPath = path.join(__dirname, 'version.json');
    let localVersion = { version: 'unknown', releaseDate: 'unknown' };
    
    if (fs.existsSync(versionPath)) {
      localVersion = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
    }
    
    // Try to fetch latest version from GitHub (with timeout)
    let latestVersion = null;
    let updateAvailable = false;
    
    try {
      const https = require('https');
      const options = {
        hostname: 'api.github.com',
        path: '/repos/TheLastDruid/mediaIngest/releases/latest',
        method: 'GET',
        headers: {
          'User-Agent': 'MediaIngest-Dashboard',
          'Accept': 'application/vnd.github.v3+json'
        },
        timeout: 5000
      };
      
      const githubData = await new Promise((resolve, reject) => {
        const req = https.request(options, (response) => {
          let data = '';
          response.on('data', chunk => data += chunk);
          response.on('end', () => {
            if (response.statusCode === 200) {
              resolve(JSON.parse(data));
            } else {
              reject(new Error(`GitHub API returned ${response.statusCode}`));
            }
          });
        });
        
        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });
        req.end();
      });
      
      latestVersion = {
        version: githubData.tag_name.replace(/^v/, ''),
        releaseDate: githubData.published_at.split('T')[0],
        releaseNotes: githubData.body,
        downloadUrl: githubData.html_url
      };
      
      // Compare versions (simple semantic version comparison)
      const currentVer = localVersion.version.split('.').map(Number);
      const latestVer = latestVersion.version.split('.').map(Number);
      
      for (let i = 0; i < 3; i++) {
        if ((latestVer[i] || 0) > (currentVer[i] || 0)) {
          updateAvailable = true;
          break;
        } else if ((latestVer[i] || 0) < (currentVer[i] || 0)) {
          break;
        }
      }
    } catch (err) {
      // Network error or timeout - silently fail
      console.error('Version check failed:', err.message);
    }
    
    res.json({
      ok: true,
      current: localVersion,
      latest: latestVersion,
      updateAvailable
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Failed to check version' });
  }
});

// API: Server-Sent Events for real-time updates
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
  
  // Add this client to the list
  sseClients.push(res);
  
  // Send current status immediately
  const current = parseCurrentTransfer();
  res.write(`data: ${JSON.stringify({ type: 'status', data: current })}\n\n`);
  
  // Send status updates every 500ms while connected
  const intervalId = setInterval(() => {
    const current = parseCurrentTransfer();
    res.write(`data: ${JSON.stringify({ type: 'status', data: current })}\n\n`);
  }, 500);
  
  // Remove client on disconnect
  req.on('close', () => {
    clearInterval(intervalId);
    sseClients = sseClients.filter(client => client !== res);
  });
});

// API: Get history
app.get('/api/history', (req, res) => {
  const history = readHistory();
  // Return last 10, most recent first
  const recent = history.transfers.slice(-10).reverse();
  res.json({ ok: true, history: recent });
});

// API: Get stats
app.get('/api/stats', (req, res) => {
  const history = readHistory();
  
  // Calculate total size (convert to GB)
  let totalGB = 0;
  history.transfers.forEach(t => {
    const sizeMatch = t.size.match(/([\d.]+)([KMGT]?)/);
    if (sizeMatch) {
      let value = parseFloat(sizeMatch[1]);
      const unit = sizeMatch[2];
      
      // Convert to GB
      if (unit === 'K') value /= (1024 * 1024);
      else if (unit === 'M') value /= 1024;
      else if (unit === 'T') value *= 1024;
      
      totalGB += value;
    }
  });
  
  const lastActive = history.transfers.length > 0 
    ? history.transfers[history.transfers.length - 1].timestamp 
    : null;
  
  res.json({ 
    ok: true, 
    stats: {
      totalFiles: history.transfers.length,
      totalGB: totalGB.toFixed(2),
      lastActive
    }
  });
});

// Check if rsync is active
app.get('/api/active', (req, res) => {
  exec('pgrep -x rsync', (err, stdout) => {
    const running = !!stdout && stdout.toString().trim().length > 0;
    res.json({ ok: true, active: running });
  });
});

// Abort rsync transfer
app.post('/api/abort', (req, res) => {
  exec('pkill rsync', (err) => {
    if (err) {
      return res.json({ ok: false, error: 'Failed to abort sync' });
    }
    res.json({ ok: true, message: 'Sync aborted successfully' });
  });
});

// Get storage stats
app.get('/api/storage', (req, res) => {
  exec('df -h', (err, stdout) => {
    if (err) {
      return res.json({ ok: false, error: 'Failed to get storage info' });
    }
    
    const lines = stdout.split('\n');
    let nasStats = null;
    let usbStats = null;
    
    lines.forEach(line => {
      // Match NAS mount point
      if (line.includes('/media/nas')) {
        const parts = line.split(/\s+/);
        nasStats = {
          total: parts[1],
          used: parts[2],
          free: parts[3],
          usedPercent: parseInt(parts[4]) || 0
        };
      }
      
      // Match USB mount point
      if (line.includes('/media/usb-ingest')) {
        const parts = line.split(/\s+/);
        usbStats = {
          total: parts[1],
          used: parts[2],
          free: parts[3],
          usedPercent: parseInt(parts[4]) || 0
        };
      }
    });
    
    res.json({ 
      ok: true, 
      storage: {
        nas: nasStats,
        usb: usbStats
      }
    });
  });
});

// Eject USB drive
app.post('/api/eject', (req, res) => {
  exec('umount /media/usb-ingest', (err) => {
    if (err) {
      return res.json({ ok: false, error: 'Failed to unmount drive' });
    }
    res.json({ ok: true, message: 'Drive unmounted successfully' });
  });
});

// Scan Jellyfin library
app.post('/api/scan', (req, res) => {
  // Option 1: Create a trigger file that your Jellyfin scan script monitors
  exec('touch /tmp/jellyfin-scan-trigger', (err) => {
    if (err) {
      return res.json({ ok: false, error: 'Failed to trigger library scan' });
    }
    res.json({ ok: true, message: 'Library scan triggered' });
  });
  
  // Option 2: If you have Jellyfin API configured, uncomment this:
  /*
  const JELLYFIN_URL = process.env.JELLYFIN_URL || 'http://localhost:8096';
  const JELLYFIN_API_KEY = process.env.JELLYFIN_API_KEY || '';
  
  if (!JELLYFIN_API_KEY) {
    return res.json({ ok: true, message: 'Scan trigger created (configure JELLYFIN_API_KEY for direct scan)' });
  }
  
  exec(`curl -s -X POST "${JELLYFIN_URL}/Library/Refresh" -H "X-Emby-Token: ${JELLYFIN_API_KEY}"`, (err, stdout, stderr) => {
    if (err) {
      return res.json({ ok: false, error: 'Failed to trigger library scan' });
    }
    res.json({ ok: true, message: 'Library scan initiated' });
  });
  */
});

// TMDB Configuration endpoints
app.get('/api/tmdb/config', authMiddleware, (req, res) => {
  try {
    if (fs.existsSync(TMDB_CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(TMDB_CONFIG_PATH, 'utf8'));
      // Don't send the API key to the client, only the enabled status
      res.json({ ok: true, enabled: config.enabled || false, hasApiKey: !!config.apiKey });
    } else {
      res.json({ ok: true, enabled: false, hasApiKey: false });
    }
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/tmdb/config', authMiddleware, (req, res) => {
  try {
    const { enabled, apiKey } = req.body;
    
    let config = { enabled: false, apiKey: '' };
    if (fs.existsSync(TMDB_CONFIG_PATH)) {
      config = JSON.parse(fs.readFileSync(TMDB_CONFIG_PATH, 'utf8'));
    }
    
    if (typeof enabled === 'boolean') {
      config.enabled = enabled;
    }
    
    if (apiKey && apiKey.trim()) {
      config.apiKey = apiKey.trim();
    }
    
    fs.writeFileSync(TMDB_CONFIG_PATH, JSON.stringify(config, null, 2));
    res.json({ ok: true, enabled: config.enabled, hasApiKey: !!config.apiKey });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// AniList Configuration Endpoints
app.get('/api/anilist/config', authMiddleware, (req, res) => {
  try {
    let config = { enabled: false, apiKey: '' };
    if (fs.existsSync(ANILIST_CONFIG_PATH)) {
      config = JSON.parse(fs.readFileSync(ANILIST_CONFIG_PATH, 'utf8'));
    }
    // Never send the API key to the client
    res.json({ ok: true, enabled: config.enabled, hasApiKey: !!config.apiKey });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/anilist/config', authMiddleware, (req, res) => {
  try {
    const { enabled, apiKey } = req.body;
    let config = { enabled: false, apiKey: '' };
    if (fs.existsSync(ANILIST_CONFIG_PATH)) {
      config = JSON.parse(fs.readFileSync(ANILIST_CONFIG_PATH, 'utf8'));
    }
    config.enabled = enabled !== undefined ? enabled : config.enabled;
    if (apiKey !== undefined) config.apiKey = apiKey;
    fs.writeFileSync(ANILIST_CONFIG_PATH, JSON.stringify(config, null, 2));
    res.json({ ok: true, enabled: config.enabled, hasApiKey: !!config.apiKey });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Serve static files from client/dist
const clientDist = path.join(__dirname, 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

// Initialize and start
initHistory();
watchLogFile();

app.listen(PORT, () => {
  console.log(`Media Ingest Monitor server listening on port ${PORT}`);
  console.log(`History tracking: ${HISTORY_PATH}`);
});
