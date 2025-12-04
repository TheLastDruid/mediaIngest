const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const LOG_PATH = '/var/log/media-ingest.log';
const HISTORY_PATH = path.join(__dirname, 'history.json');
const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json());

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

// Parse log and extract completed transfers
function parseLogForCompleted(logLines) {
  const completed = [];
  let currentFilename = null;
  
  for (let i = 0; i < logLines.length; i++) {
    const line = logLines[i].trim();
    
    // Match progress line at 100%
    const progressMatch = line.match(/([\d.]+[KMGT]?)\s+100%\s+([\d.]+[KMGT]?B\/s)\s+(\d+:\d+:\d+)/);
    
    if (progressMatch) {
      const size = progressMatch[1];
      const speed = progressMatch[3];
      
      // Look backwards for filename
      for (let j = i - 1; j >= 0; j--) {
        const prevLine = logLines[j].trim();
        if (prevLine && prevLine.match(/\.(mp4|mkv|avi|mov|m4v|webm)$/i)) {
          currentFilename = prevLine.replace(/^.*\//, '');
          break;
        }
      }
      
      if (currentFilename) {
        // Determine type (Movie vs Series)
        let type = 'Movie';
        if (currentFilename.match(/S\d{2}E\d{2}|Season|Episode/i)) {
          type = 'Series';
        }
        
        completed.push({
          filename: currentFilename,
          size,
          speed,
          type,
          timestamp: Date.now()
        });
        currentFilename = null;
      }
    }
  }
  
  return completed;
}

// Parse log for current transfer status
function parseCurrentTransfer(logLines) {
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
  
  // Parse from end backwards for most recent transfer
  for (let i = logLines.length - 1; i >= 0; i--) {
    const line = logLines[i].trim();
    
    // Stop if we hit a completion marker
    if (line.includes('Ingest Complete') || (line.includes('sent ') && line.includes('bytes/sec'))) {
      break;
    }
    
    // Match progress line (not 100%)
    const progressMatch = line.match(/([\d.]+[KMGT]?)\s+(\d+)%\s+([\d.]+[KMGT]?B\/s)\s+(\d+:\d+:\d+)/);
    
    if (progressMatch && parseInt(progressMatch[2]) < 100) {
      size = progressMatch[1];
      progress = parseInt(progressMatch[2]);
      speed = progressMatch[3];
      timeRemaining = progressMatch[4];
      
      // Look backwards for filename
      for (let j = i - 1; j >= 0; j--) {
        const prevLine = logLines[j].trim();
        if (prevLine && prevLine.match(/\.(mp4|mkv|avi|mov|m4v|webm)$/i)) {
          currentFilename = prevLine.replace(/^.*\//, '');
          break;
        }
      }
      
      if (currentFilename) break;
    }
  }
  
  return { filename: currentFilename, progress, speed, timeRemaining, size };
}

// Watch log file and update history
function watchLogFile() {
  let lastKnownFiles = new Set();
  
  setInterval(() => {
    fs.readFile(LOG_PATH, 'utf8', (err, data) => {
      if (err) return;
      
      const lines = data.split(/\r?\n/).filter(line => line.trim());
      const completed = parseLogForCompleted(lines);
      
      if (completed.length > 0) {
        const history = readHistory();
        
        completed.forEach(transfer => {
          const fileKey = `${transfer.filename}_${transfer.timestamp}`;
          
          // Only add if not already recorded (within 10 seconds)
          const exists = history.transfers.some(t => 
            t.filename === transfer.filename && 
            Math.abs(t.timestamp - transfer.timestamp) < 10000
          );
          
          if (!exists && !lastKnownFiles.has(transfer.filename)) {
            history.transfers.push(transfer);
            lastKnownFiles.add(transfer.filename);
            
            // Clean up old entries from Set after 30 seconds
            setTimeout(() => lastKnownFiles.delete(transfer.filename), 30000);
          }
        });
        
        // Keep only last 100 transfers
        if (history.transfers.length > 100) {
          history.transfers = history.transfers.slice(-100);
        }
        
        writeHistory(history);
      }
    });
  }, 2000); // Check every 2 seconds
}

// API: Get current status
app.get('/api/status', (req, res) => {
  fs.readFile(LOG_PATH, 'utf8', (err, data) => {
    if (err) {
      return res.json({ ok: false, active: false, current: null });
    }
    
    const lines = data.split(/\r?\n/).filter(line => line.trim());
    const current = parseCurrentTransfer(lines);
    const active = current.filename !== null;
    
    res.json({ ok: true, active, current });
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
