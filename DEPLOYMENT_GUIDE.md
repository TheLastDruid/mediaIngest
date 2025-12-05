# Media Ingest System - Complete Deployment Guide

A modern, real-time monitoring dashboard for automated USB-to-NAS media transfers using Proxmox, LXC containers, and rsync.

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Prerequisites](#prerequisites)
3. [Proxmox Host Setup](#proxmox-host-setup)
4. [LXC Container Setup](#lxc-container-setup)
5. [Backend Server Installation](#backend-server-installation)
6. [Frontend Dashboard Setup](#frontend-dashboard-setup)
7. [Testing & Verification](#testing--verification)
8. [Troubleshooting](#troubleshooting)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Proxmox Host (192.168.1.200)             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  USB Drive Detection (udev rules)                     │  │
│  │  └─→ /usr/local/bin/usb-trigger.sh                   │  │
│  │      └─→ Mount USB to /mnt/usb-pass                  │  │
│  │      └─→ Bind mount into LXC container                │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         LXC Container 105 (192.168.1.7)              │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  /usr/local/bin/ingest-media.sh                │  │  │
│  │  │  └─→ Rsync files from USB to NAS              │  │  │
│  │  │  └─→ Log progress to /var/log/media-ingest.log│  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │                                                        │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  Node.js Backend Server (Port 3000)            │  │  │
│  │  │  └─→ Parses logs for real-time progress       │  │  │
│  │  │  └─→ REST API for frontend                    │  │  │
│  │  │  └─→ Persistent history tracking              │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │                                                        │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  React Frontend Dashboard                      │  │  │
│  │  │  └─→ Real-time progress visualization         │  │  │
│  │  │  └─→ Transfer history                          │  │  │
│  │  │  └─→ System controls (Eject, Scan, Abort)     │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Flow:**
1. USB drive plugged into Proxmox host
2. udev rule triggers `usb-trigger.sh`
3. Script mounts USB and bind-mounts into LXC
4. `ingest-media.sh` runs inside LXC, syncing files
5. Progress logged to `/var/log/media-ingest.log`
6. Node.js backend parses log in real-time
7. React dashboard displays live progress via REST API

---

## Prerequisites

### Hardware Requirements
- Proxmox VE server (tested on Proxmox 8.x)
- USB drive formatted as NTFS/exFAT
- NAS or network storage mounted on LXC container

### Network Configuration
- Proxmox host: `192.168.1.200` (adjust as needed)
- LXC container: `192.168.1.7` (adjust as needed)
- Firewall: Allow port 3000 for dashboard access

### Software Requirements
- Debian-based LXC container (Debian 11/12 or Ubuntu 22.04)
- Node.js 18.x or higher
- Git
- npm

---

## Proxmox Host Setup

### Step 1: Create USB Trigger Script (Proxmox Host)

SSH into your Proxmox host and create the USB detection script:

```bash
ssh root@192.168.1.200

cat > /usr/local/bin/usb-trigger.sh << 'EOF'
#!/bin/bash

DEVICE=$1
HOST_MOUNT="/mnt/usb-pass"
LXC_ID="105"

# Safety Check
if [ -z "$DEVICE" ]; then 
    echo "No device specified."
    exit 1
fi

echo "=== USB Device Detected: $DEVICE ==="

# 1. Mount on Proxmox host
mount -t ntfs3 -o noatime "$DEVICE" "$HOST_MOUNT"

# Fallback if ntfs3 fails
if [ $? -ne 0 ]; then
    echo "ntfs3 failed, trying standard mount..."
    mount "$DEVICE" "$HOST_MOUNT"
fi

# Verify Mount
if ! mount | grep -q "$HOST_MOUNT"; then
    echo "Failed to mount $DEVICE"
    exit 1
fi

echo "Mounted successfully. Triggering LXC Ingest..."

# 2. Run ingest script inside LXC
pct exec $LXC_ID -- /usr/local/bin/ingest-media.sh

# 3. Cleanup
echo "Ingest finished. Cleaning up..."
sync
umount "$HOST_MOUNT"

echo "Complete. Drive unmounted."
EOF

chmod +x /usr/local/bin/usb-trigger.sh
```

**Important:** Replace `LXC_ID="105"` with your actual LXC container ID.

**Complete Script File:** You can also download `usb-trigger.sh` from the repository and place it directly:

```bash
# If cloning from git:
cd /tmp
git clone https://your-git-server/mediaingestDashboard.git
cp mediaingestDashboard/scripts/usb-trigger.sh /usr/local/bin/
chmod +x /usr/local/bin/usb-trigger.sh

# Or manually create the file using nano/vi:
nano /usr/local/bin/usb-trigger.sh
# Paste the script content, then save
chmod +x /usr/local/bin/usb-trigger.sh
```

### Step 2: Create Mount Point Directory

```bash
mkdir -p /mnt/usb-pass
```

### Step 3: Configure udev Rules for Automatic USB Detection

Create a udev rule to automatically trigger the sync when a USB drive is inserted:

```bash
cat > /etc/udev/rules.d/99-usb-media-ingest.rules << 'EOF'
# USB Media Ingest Trigger
# Triggers when any USB storage device is added (uses timestamp to avoid unit name conflicts)
ACTION=="add", KERNEL=="sd[a-z]", SUBSYSTEM=="block", ENV{DEVTYPE}=="disk", ENV{ID_BUS}=="usb", RUN+="/bin/bash -c \"/usr/bin/systemd-run --no-block --unit=media-ingest-$kernel-$(date +%%s) /usr/local/bin/usb-trigger.sh /dev/$kernel\""
EOF

# Reload udev rules
udevadm control --reload-rules
udevadm trigger
```

### Step 4: Verify udev Rule

Check that the rule is properly formatted:

```bash
cat /etc/udev/rules.d/99-usb-media-ingest.rules
```

---

## LXC Container Setup

### Step 1: Create LXC Container

In the Proxmox web UI:
1. Create a new LXC container (ID: 105 or your choice)
2. Template: Debian 12 or Ubuntu 22.04
3. Resources: 2GB RAM, 2 CPU cores minimum
4. Network: Static IP `192.168.1.7` (or your choice)
5. **Important:** Enable "Nesting" and "FUSE" in container options

Or via CLI:

```bash
pct create 105 local:vztmpl/debian-12-standard_12.2-1_amd64.tar.zst \
  --hostname ingestsync \
  --memory 2048 \
  --cores 2 \
  --net0 name=eth0,bridge=vmbr0,ip=192.168.1.7/24,gw=192.168.1.1 \
  --features nesting=1,fuse=1 \
  --unprivileged 1
```

### Step 2: Mount NAS Storage into Container

Add your NAS mount point to the container configuration:

```bash
# On Proxmox host
pct set 105 -mp0 /mnt/nas,mp=/media/nas

# Or edit /etc/pve/lxc/105.conf directly:
# mp0: /mnt/nas,mp=/media/nas
```

**Note:** Ensure your NAS is mounted on the Proxmox host at `/mnt/nas` first.

### Step 3: Configure Bind Mount for USB

Edit the LXC config to allow bind mounting:

```bash
nano /etc/pve/lxc/105.conf

# Add this line:
mp1: /mnt/usb-pass,mp=/media/usb-ingest
```

Or use the command:

```bash
pct set 105 -mp1 /mnt/usb-pass,mp=/media/usb-ingest
```

### Step 4: Start the Container

```bash
pct start 105
```

---

## Backend Server Installation

### Step 1: Access LXC Container

```bash
pct enter 105
# or
ssh root@192.168.1.7
```

### Step 2: Install Dependencies

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs git rsync ntfs-3g

# Verify installation
node --version  # Should be v18.x or higher
npm --version
```

### Step 3: Create Directory Structure

```bash
mkdir -p /root/ingestMonitor
cd /root/ingestMonitor

# Create log directory
mkdir -p /var/log
touch /var/log/media-ingest.log
```

### Step 4: Clone Repository (or create manually)

**Option A: Clone from Git**

```bash
cd /root/ingestMonitor
git clone https://your-git-server/mediaingestDashboard.git
cd mediaingestDashboard
```

**Option B: Create Files Manually**

```bash
cd /root/ingestMonitor
mkdir mediaingestDashboard
cd mediaingestDashboard
```

Create `package.json`:

```json
{
  "name": "media-ingest-monitor",
  "version": "1.0.0",
  "description": "Media Ingest Dashboard Backend",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5"
  }
}
```

Create `server.js`:

```javascript
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const LOG_PATH = '/var/log/media-ingest.log';
const PROGRESS_LOG_PATH = '/var/log/media-ingest.log';
const HISTORY_PATH = path.join(__dirname, 'history.json');
const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client/dist')));

// Initialize history
function initHistory() {
  if (!fs.existsSync(HISTORY_PATH)) {
    fs.writeFileSync(HISTORY_PATH, JSON.stringify({ transfers: [] }, null, 2));
  }
}

function readHistory() {
  try {
    const data = fs.readFileSync(HISTORY_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return { transfers: [] };
  }
}

function writeHistory(history) {
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
}

function parseCurrentTransfer() {
  let currentFilename = null;
  let progress = 0;
  let speed = null;
  let timeRemaining = null;
  let size = null;
  
  if (!fs.existsSync(PROGRESS_LOG_PATH)) {
    return { filename: null, progress: 0, speed: null, timeRemaining: null, size: null };
  }
  
  const progressContent = fs.readFileSync(PROGRESS_LOG_PATH, 'utf8');
  const allLines = progressContent.split('\n').filter(line => line.trim());
  const progressLines = allLines.slice(-200);
  
  if (progressLines.length === 0) {
    return { filename: null, progress: 0, speed: null, timeRemaining: null, size: null };
  }
  
  // Check if sync is active
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
  
  // Parse progress
  for (let i = progressLines.length - 1; i >= 0; i--) {
    const line = progressLines[i].trim();
    const progressMatch = line.match(/([\d.]+[KMGT]?)\s+(\d+)%\s+([\d.]+[KMGT]?B\/s)\s+(\d+:\d+:\d+)/);
    
    if (progressMatch) {
      const matchedProgress = parseInt(progressMatch[2]);
      if (matchedProgress >= 100 && line.includes('to-chk=0/')) continue;
      
      size = progressMatch[1];
      progress = matchedProgress;
      speed = progressMatch[3];
      timeRemaining = progressMatch[4];
      
      // Look for filename
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
  
  // Fallback filename search
  if (inActiveSync && !currentFilename && progress > 0) {
    for (let i = progressLines.length - 1; i >= Math.max(0, progressLines.length - 100); i--) {
      const line = progressLines[i].trim();
      if (line && line.match(/\.(mp4|mkv|avi|mov|m4v|webm|flv|wmv|mpg|mpeg|m2ts)$/i)) {
        currentFilename = line.replace(/^.*\//, '');
        break;
      }
    }
  }
  
  return { filename: currentFilename, progress, speed, timeRemaining, size };
}

// API Endpoints
app.get('/api/status', (req, res) => {
  const current = parseCurrentTransfer();
  const active = current.filename !== null || current.progress > 0;
  res.json({ ok: true, active, current });
});

app.get('/api/history', (req, res) => {
  const history = readHistory();
  res.json({ ok: true, history: history.transfers.slice(-10).reverse() });
});

app.get('/api/stats', (req, res) => {
  const history = readHistory();
  const stats = {
    totalFiles: history.transfers.length,
    totalSize: history.transfers.reduce((sum, t) => {
      const sizeMatch = t.size.match(/([\d.]+)([KMGT]?)/);
      if (sizeMatch) {
        const num = parseFloat(sizeMatch[1]);
        const unit = sizeMatch[2];
        const multipliers = { K: 0.001, M: 1, G: 1000, T: 1000000 };
        return sum + (num * (multipliers[unit] || 1));
      }
      return sum;
    }, 0).toFixed(2) + 'G',
    lastActive: history.transfers.length > 0 ? new Date(history.transfers[history.transfers.length - 1].timestamp).toLocaleString() : 'Never'
  };
  res.json({ ok: true, stats });
});

app.get('/api/storage', (req, res) => {
  exec('df -h', (err, stdout) => {
    if (err) return res.json({ ok: false, error: err.message });
    
    const lines = stdout.split('\n');
    const storage = { nas: null, usb: null };
    
    lines.forEach(line => {
      if (line.includes('/media/nas')) {
        const parts = line.split(/\s+/);
        storage.nas = { total: parts[1], used: parts[2], available: parts[3], percent: parts[4] };
      }
      if (line.includes('/media/usb-ingest')) {
        const parts = line.split(/\s+/);
        storage.usb = { total: parts[1], used: parts[2], available: parts[3], percent: parts[4] };
      }
    });
    
    res.json({ ok: true, storage });
  });
});

app.post('/api/abort', (req, res) => {
  exec('pkill rsync', (err) => {
    if (err) return res.json({ ok: false, error: 'No sync process found' });
    res.json({ ok: true, message: 'Sync aborted' });
  });
});

app.post('/api/eject', (req, res) => {
  exec('umount /media/usb-ingest', (err) => {
    if (err) return res.json({ ok: false, error: err.message });
    res.json({ ok: true, message: 'Drive ejected' });
  });
});

app.post('/api/scan', (req, res) => {
  exec('touch /tmp/jellyfin-scan-trigger', (err) => {
    if (err) return res.json({ ok: false, error: err.message });
    res.json({ ok: true, message: 'Library scan triggered' });
  });
});

// Watch log file
let lastFileSize = 0;
let lastPosition = 0;

function parseNewCompletedTransfers(newLines) {
  const completed = [];
  
  for (let i = 0; i < newLines.length; i++) {
    const line = newLines[i].trim();
    const completionMatch = line.match(/([\d.]+[KMGT]?)\s+100%\s+([\d.]+[KMGT]?B\/s)\s+(\d+:\d+:\d+)/);
    
    if (completionMatch) {
      let filename = null;
      for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
        const prevLine = newLines[j].trim();
        const fileMatch = prevLine.match(/([^\/]+\.(mp4|mkv|avi|mov|m4v|webm|flv|wmv|mpg|mpeg|m2ts))$/i);
        if (fileMatch) {
          filename = fileMatch[1];
          break;
        }
      }
      
      if (filename) {
        const size = completionMatch[1];
        const speed = completionMatch[2];
        let type = 'Movie';
        if (filename.match(/S\d{2}E\d{2}|Season|Episode/i)) type = 'Series';
        
        completed.push({ filename, size, speed, type, timestamp: Date.now() });
      }
    }
  }
  
  return completed;
}

function watchLogFile() {
  setInterval(() => {
    fs.stat(LOG_PATH, (err, stats) => {
      if (err) return;
      
      if (stats.size > lastFileSize) {
        const stream = fs.createReadStream(LOG_PATH, {
          start: lastPosition,
          encoding: 'utf8'
        });
        
        let buffer = '';
        stream.on('data', (chunk) => { buffer += chunk; });
        stream.on('end', () => {
          const newLines = buffer.split(/\r?\n/).filter(line => line.trim());
          const completed = parseNewCompletedTransfers(newLines);
          
          if (completed.length > 0) {
            const history = readHistory();
            completed.forEach(transfer => {
              const isDuplicate = history.transfers.slice(-10).some(t => 
                t.filename === transfer.filename && (Date.now() - t.timestamp) < 60000
              );
              if (!isDuplicate) {
                history.transfers.push(transfer);
                if (history.transfers.length > 100) {
                  history.transfers = history.transfers.slice(-100);
                }
              }
            });
            writeHistory(history);
          }
          
          lastPosition = stats.size;
          lastFileSize = stats.size;
        });
      } else if (stats.size < lastFileSize) {
        lastPosition = 0;
        lastFileSize = stats.size;
      }
    });
  }, 2000);
}

initHistory();
watchLogFile();

app.listen(PORT, () => {
  console.log(`Media Ingest Monitor server listening on port ${PORT}`);
  console.log(`History tracking: ${HISTORY_PATH}`);
});
```

### Step 5: Install Node.js Dependencies

```bash
cd /root/ingestMonitor/mediaingestDashboard
npm install
```

### Step 6: Create Ingest Script (LXC Container)

Create the rsync script that will run when USB is detected:

```bash
cat > /usr/local/bin/ingest-media.sh << 'EOF'
#!/bin/bash

SEARCH_ROOT="/media/usb-ingest"
DEST_ROOT="/media/nas"
LOG="/var/log/media-ingest.log"

echo "========================================" >> "$LOG"
echo "$(date): New Drive Detected. Scanning for Media folder..." >> "$LOG"

FOUND_SRC=$(find "$SEARCH_ROOT" -maxdepth 3 -type d -iname "Media" | head -n 1)

if [ -z "$FOUND_SRC" ]; then
    echo "Analysis: No Media folder found on this drive. Exiting." >> "$LOG"
    ls -F "$SEARCH_ROOT" >> "$LOG" 2>&1
    exit 0
fi

echo "Target Found: $FOUND_SRC" >> "$LOG"

sync_folder() {
    FOLDER_NAME=$1
    SRC_SUB=$(find "$FOUND_SRC" -maxdepth 1 -type d -iname "$FOLDER_NAME" | head -n 1)
    DST_PATH="$DEST_ROOT/$FOLDER_NAME"

    if [ -n "$SRC_SUB" ]; then
        echo "Syncing $SRC_SUB -> $DST_PATH" >> "$LOG"
        echo "SYNC_START:$FOLDER_NAME" >> "$LOG"

        stdbuf -oL rsync -rvh -W --inplace --progress --ignore-existing "$SRC_SUB/" "$DST_PATH/" 2>&1 | tr '\r' '\n' >> "$LOG"

        echo "SYNC_END:$FOLDER_NAME" >> "$LOG"
    else
        echo "Skipped: $FOLDER_NAME not found inside Media folder." >> "$LOG"
    fi
}

sync_folder "Movies"
sync_folder "Series"
sync_folder "Anime"

echo "$(date): Ingest Complete." >> "$LOG"
EOF

chmod +x /usr/local/bin/ingest-media.sh
```

**Note:** Adjust folder names (`Movies`, `Series`, `Anime`) to match your directory structure.

**Complete Script File:** You can also download `ingest-media.sh` from the repository and place it directly:

```bash
# If cloning from git:
cd /tmp
git clone https://your-git-server/mediaingestDashboard.git
cp mediaingestDashboard/scripts/ingest-media.sh /usr/local/bin/
chmod +x /usr/local/bin/ingest-media.sh
```

### Step 7: Create Systemd Service

Create a systemd service to run the dashboard on boot:

```bash
cat > /etc/systemd/system/mediaingest-dashboard.service << 'EOF'
[Unit]
Description=Media Ingest Dashboard
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/ingestMonitor/mediaingestDashboard
ExecStart=/usr/bin/node /root/ingestMonitor/mediaingestDashboard/server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
systemctl daemon-reload
systemctl enable mediaingest-dashboard.service
systemctl start mediaingest-dashboard.service
systemctl status mediaingest-dashboard.service
```

---

## Frontend Dashboard Setup

### Step 1: Create Frontend Structure

On your LXC container:

```bash
cd /root/ingestMonitor/mediaingestDashboard
mkdir -p client/src
```

### Step 2: Create package.json for Frontend

```bash
cd client

cat > package.json << 'EOF'
{
  "name": "media-ingest-client",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "framer-motion": "^10.16.0",
    "lucide-react": "^0.280.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.3.0",
    "vite": "^4.5.0"
  }
}
EOF
```

### Step 3: Install Frontend Dependencies

```bash
npm install
```

### Step 4: Create Vite Config

```bash
cat > vite.config.js << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
})
EOF
```

### Step 5: Create Tailwind Config

```bash
cat > tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
EOF
```

### Step 6: Create PostCSS Config

```bash
cat > postcss.config.js << 'EOF'
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF
```

### Step 7: Create HTML Entry Point

```bash
cat > index.html << 'EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Media Ingest System</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
EOF
```

### Step 8: Create CSS File

```bash
cat > src/index.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;
EOF
```

### Step 9: Create React Entry Point

```bash
cat > src/main.jsx << 'EOF'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
EOF
```

### Step 10: Create Main App Component

The `App.jsx` file contains the complete React dashboard. Due to length, please refer to the repository or create it based on the existing codebase.

Key features in `App.jsx`:
- Real-time status polling (500ms interval)
- Active transfer card with progress bar
- Transfer history table
- Storage health monitoring
- Control actions (Abort, Eject, Scan)
- Responsive design (mobile-first)
- AnimatePresence for smooth transitions

### Step 11: Build Frontend

```bash
cd /root/ingestMonitor/mediaingestDashboard/client
npm run build
```

This creates a `dist/` folder with optimized production files.

### Step 12: Restart Dashboard Service

```bash
systemctl restart mediaingest-dashboard.service
```

---

## Testing & Verification

### Step 1: Test USB Detection on Proxmox

```bash
# On Proxmox host
ssh root@192.168.1.200

# Manually trigger the script with your USB device
bash /usr/local/bin/usb-trigger.sh /dev/sdb

# Check logs
tail -f /var/log/syslog | grep media-ingest
```

### Step 2: Test Ingest Script in LXC

```bash
# SSH into LXC
ssh root@192.168.1.7

# Manually run ingest script (ensure USB is mounted first)
bash /usr/local/bin/ingest-media.sh

# Check logs
tail -f /var/log/media-ingest.log
```

### Step 3: Test Backend API

```bash
# Check if server is running
systemctl status mediaingest-dashboard.service

# Test API endpoints
curl http://localhost:3000/api/status | jq
curl http://localhost:3000/api/history | jq
curl http://localhost:3000/api/stats | jq
curl http://localhost:3000/api/storage | jq
```

### Step 4: Access Dashboard

Open your browser and navigate to:
```
http://192.168.1.7:3000
```

You should see:
- System Ready status (green dot)
- Statistics card
- Storage Health card
- Device & Controls card
- Transfer History table

### Step 5: Test Live Transfer

1. Plug in a USB drive with media files in a `Media/` folder
2. The dashboard should:
   - Status changes to "Syncing" (blue pulsing dot)
   - Active Transfer Card appears
   - Progress bar updates in real-time
   - Speed, size, and ETA display
   - History updates when complete

---

## Troubleshooting

### Issue: USB Not Detected

**Symptoms:** Nothing happens when USB is plugged in

**Solutions:**

1. Check udev rules:
```bash
cat /etc/udev/rules.d/99-usb-media-ingest.rules
udevadm control --reload-rules
```

2. Check USB device name:
```bash
lsblk
dmesg | tail
```

3. Test manually:
```bash
bash /usr/local/bin/usb-trigger.sh /dev/sdb
```

4. Check systemd unit logs:
```bash
journalctl -u 'media-ingest*' -n 50 --no-pager
```

### Issue: Dashboard Not Showing Live Progress

**Symptoms:** Status shows "Syncing" but no progress bar

**Solutions:**

1. Check if backend is reading logs:
```bash
tail -f /var/log/media-ingest.log
```

2. Verify log markers exist:
```bash
grep "SYNC_START\|SYNC_END" /var/log/media-ingest.log | tail -10
```

3. Check API response:
```bash
curl http://localhost:3000/api/status | jq
```

4. Restart dashboard service:
```bash
systemctl restart mediaingest-dashboard.service
```

### Issue: Files Not Syncing

**Symptoms:** Logs show sync started but files don't appear on NAS

**Solutions:**

1. Check NAS mount:
```bash
df -h | grep /media/nas
ls -la /media/nas
```

2. Verify USB mount in LXC:
```bash
ls -la /media/usb-ingest
mount | grep usb-ingest
```

3. Check rsync command manually:
```bash
rsync -rvh --progress /media/usb-ingest/Media/Movies/ /media/nas/Movies/
```

4. Check permissions:
```bash
ls -ld /media/nas/Movies
```

### Issue: Dashboard Shows Old Progress (Stuck at 87%)

**Symptoms:** Progress bar doesn't update or shows stale data

**Cause:** Parser reading too many old lines

**Solution:** Ensure `server.js` slices to last 200 lines:
```javascript
const progressLines = allLines.slice(-200);
```

### Issue: Permission Denied Errors

**Symptoms:** `mount: permission denied` or `rsync: permission denied`

**Solutions:**

1. Check LXC container is privileged or has proper permissions
2. Verify mount points in `/etc/pve/lxc/105.conf`
3. Check NAS permissions match LXC user/group

### Issue: Service Won't Start

**Symptoms:** `systemctl status mediaingest-dashboard.service` shows failed

**Solutions:**

1. Check Node.js installation:
```bash
node --version
which node
```

2. Check file paths in service file:
```bash
cat /etc/systemd/system/mediaingest-dashboard.service
ls /root/ingestMonitor/mediaingestDashboard/server.js
```

3. Check logs:
```bash
journalctl -u mediaingest-dashboard.service -n 50 --no-pager
```

4. Test manually:
```bash
cd /root/ingestMonitor/mediaingestDashboard
node server.js
```

---

## Advanced Configuration

### Custom Polling Interval

Edit `client/src/App.jsx`:
```javascript
const interval = setInterval(poll, 500) // Change to 1000 for 1 second
```

### Add More Folder Types

Edit `/usr/local/bin/ingest-media.sh`:
```bash
sync_folder "Movies"
sync_folder "Series"
sync_folder "Anime"
sync_folder "Documentaries"  # Add new folder
```

### Change Port

Edit `server.js`:
```javascript
const PORT = process.env.PORT || 3000; // Change to 8080
```

And update systemd service:
```bash
systemctl edit mediaingest-dashboard.service

# Add:
[Service]
Environment="PORT=8080"
```

### Enable HTTPS

Use a reverse proxy like Nginx or Caddy:

```bash
apt install nginx

cat > /etc/nginx/sites-available/mediaingest << 'EOF'
server {
    listen 80;
    server_name mediaingest.local;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

ln -s /etc/nginx/sites-available/mediaingest /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

---

## Maintenance

### View Logs

```bash
# Backend logs
journalctl -u mediaingest-dashboard.service -f

# Ingest logs
tail -f /var/log/media-ingest.log

# System logs
tail -f /var/log/syslog | grep media-ingest
```

### Clear History

```bash
rm /root/ingestMonitor/mediaingestDashboard/history.json
systemctl restart mediaingest-dashboard.service
```

### Update Dashboard

```bash
cd /root/ingestMonitor/mediaingestDashboard
git pull
cd client
npm run build
systemctl restart mediaingest-dashboard.service
```

### Backup Configuration

```bash
# Backup entire setup
tar -czf mediaingest-backup.tar.gz \
  /usr/local/bin/usb-trigger.sh \
  /usr/local/bin/ingest-media.sh \
  /etc/udev/rules.d/99-usb-media-ingest.rules \
  /etc/systemd/system/mediaingest-dashboard.service \
  /root/ingestMonitor/mediaingestDashboard
```

---

## Performance Tuning

### Optimize rsync Speed

Add bandwidth limit for slower networks:
```bash
rsync -rvh -W --inplace --progress --bwlimit=10000 ...
```

Remove for maximum speed:
```bash
rsync -rvh -W --inplace --progress --ignore-existing ...
```

### Reduce Dashboard Polling

Edit `App.jsx` to poll less frequently:
```javascript
const interval = setInterval(poll, 2000) // 2 seconds instead of 500ms
```

### Limit Log File Size

Create logrotate config:
```bash
cat > /etc/logrotate.d/media-ingest << 'EOF'
/var/log/media-ingest.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
}
EOF
```

---

## Security Considerations

1. **Firewall**: Only expose port 3000 to trusted networks
```bash
ufw allow from 192.168.1.0/24 to any port 3000
```

2. **Authentication**: Add basic auth to Nginx reverse proxy

3. **HTTPS**: Use Let's Encrypt for production deployments

4. **Container Security**: Keep LXC container unprivileged when possible

5. **Regular Updates**: 
```bash
apt update && apt upgrade -y
npm audit fix
```

---

## Credits & License

**Built with:**
- React 18 + Vite 4
- Tailwind CSS 3
- Framer Motion 10
- Node.js + Express
- Proxmox VE
- rsync

**License:** MIT (adjust as needed)

---

## Support

For issues, questions, or contributions, please refer to the project repository or contact the maintainer.

**Project Repository:** [Your Git URL]

---

**End of Deployment Guide**
