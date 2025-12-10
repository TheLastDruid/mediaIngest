<div align="center">

# 🚀 Proxmox USB Media Ingest Station

**Transform your Proxmox node into an automated media ingest powerhouse**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub Stars](https://img.shields.io/github/stars/TheLastDruid/mediaIngest?style=social)](https://github.com/TheLastDruid/mediaIngest/stargazers)
[![GitHub Issues](https://img.shields.io/github/issues/TheLastDruid/mediaIngest)](https://github.com/TheLastDruid/mediaIngest/issues)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

**Stop manually mounting drives. Turn your Proxmox node into a dedicated Ingest Station.**

[Features](#-features) • [Quick Start](#-quick-start) • [How It Works](#️-how-it-works) • [Troubleshooting](#-troubleshooting) • [Contributing](#-contributing)

![Dashboard Preview](screenshots/dashboard-desktop.png)

</div>

---

## 🎯 The Problem

Managing media for self-hosted platforms like **Jellyfin**, **Plex**, or **Emby** shouldn't require:
- Manually mounting USB drives
- Navigating terminal commands
- Tracking sync progress with `rsync` flags
- Dealing with NTFS permissions
- Wondering if files transferred successfully

**This project solves all of that.**

---

## ✨ Features

### 🔌 **Universal Drive Support**
- Automatically detects **any** USB storage device
- High-performance **ntfs3** kernel driver (kernel 5.15+)
- Graceful fallback to **ntfs-3g** for older systems
- No manual mounting required—ever

### 📊 **Real-Time Dashboard**
- **Modern Bento Grid UI** with Framer Motion animations
- **Live progress bars** showing rsync transfer speed
- **Dark mode optimized** for home lab aesthetics
- **Mobile responsive** - monitor from your phone
- **Transfer history** with timestamps and status

### ⚡ **Zero-Touch Automation**
- **Plug & Play**: Insert USB → Auto-mount → Auto-sync → Auto-unmount
- **Intelligent NAS detection** - scans `/mnt/pve/*` and `/mnt/*`
- **Auto-provisions** Media folder with proper permissions
- **Concurrent USB support** - multiple drives at once
- **Smart folder detection** - Movies, Series, Anime (case-insensitive)

### 🏗️ **Production-Grade Architecture**
- **LXC containerization** for isolation and security
- **Privileged container** with bind mounts to NAS
- **systemd service** integration for reliability
- **udev rules** for hardware-level USB detection
- **Comprehensive logging** for debugging

### 🎬 **Jellyfin/Plex Ready**
- Designed for **Jellyfin** media servers
- Compatible with **Plex**, **Emby**, **Kodi**, and more
- Organizes content by type (Movies/Series/Anime)
- Preserves metadata and folder structure
- `--ignore-existing` prevents overwrites

### 🔧 **Developer Friendly**
- **React 18** + **Vite 4** frontend
- **Express 4** backend with WebSocket-like polling
- **Tailwind CSS 3** for styling
- **Framer Motion 10** for animations
- **Single-file installer** - no dependencies on host

---

## 🚀 Quick Start

### Prerequisites

- **Proxmox VE 7.0+** (tested on 8.x)
- **NAS mounted** to `/mnt/pve/*` or `/mnt/*`
- **Internet connection** (for initial template download)
- **Root access** to Proxmox host

### Installation on Proxmox

**Step 1:** SSH into your Proxmox host

```bash
ssh root@your-proxmox-ip
```

**Step 2:** Run the installer with one command

```bash
bash -c "$(wget -qLO - https://raw.githubusercontent.com/TheLastDruid/mediaIngest/main/install.sh)"
```

**Step 3:** Follow the interactive prompts

The installer will:
1. ✅ Scan your mounted storage and let you select destination
2. ✅ Auto-detect next available container ID
3. ✅ Download Debian 12 template (if needed)
4. ✅ Create privileged LXC container with bind mounts
5. ✅ Install Node.js 18 and dependencies
6. ✅ Configure udev rules for USB detection
7. ✅ Set up systemd services for auto-start
8. ✅ Deploy React dashboard on port 5173

**Step 4:** Access your dashboard

```
http://your-proxmox-ip:5173
```

### What Gets Installed

The installer creates:
- **LXC Container** (ID: auto-detected, typically 100-999)
- **Name:** `media-ingest`
- **Resources:** 2 CPU cores, 2GB RAM, 8GB disk
- **Bind Mount:** Your chosen NAS path → `/mnt/nas` in container
- **Services:**
  - `media-ingest-monitor.service` - Express backend (port 3000)
  - `media-ingest-frontend.service` - Vite frontend (port 5173)

### Installation Time

- **First run:** ~5-10 minutes (downloads Debian template)
- **Subsequent runs:** ~2-3 minutes (uses cached template)

---

## 🛠️ How It Works

### Architecture Overview

```
Proxmox Host
├── USB Device Inserted
├── udev rule triggers → /opt/media-ingest/scripts/usb-trigger.sh
├── LXC Container (media-ingest)
│   ├── /opt/media-ingest/scripts/ingest-media.sh
│   │   ├── Auto-mount USB to /mnt/usb-*
│   │   ├── Detect media folders (Movies/Series/Anime)
│   │   ├── rsync to /mnt/nas/Media/*
│   │   └── Auto-unmount when complete
│   ├── Backend (server.js) - Monitors logs & serves API
│   └── Frontend (React) - Real-time dashboard
└── NAS mounted at /mnt/pve/* → Bind mounted to container
```

### Transfer Logic

1. **USB Detection:** udev rule on host detects new USB device
2. **Mount:** Script mounts USB to `/mnt/usb-<device>` with ntfs3/ntfs-3g
3. **Scan:** Looks for `/Movies`, `/Series`, `/Anime` folders (case-insensitive)
4. **Sync:** Uses `rsync -avh --progress --ignore-existing` for each folder
5. **Unmount:** Safely unmounts USB after completion
6. **Log:** All actions logged to `/opt/media-ingest/transfer.log`

### Dashboard Features

- **Active Transfers:** Real-time progress bars
- **Transfer Queue:** Pending operations
- **History:** Last 10 transfers with status
- **System Status:** Container health check
- **Mobile Friendly:** Responsive Bento grid layout

---

## 🔧 Configuration

### Changing NAS Destination

Edit the container config on Proxmox host:

```bash
pct set <CTID> -mp0 /mnt/pve/your-nas,mp=/mnt/nas
pct reboot <CTID>
```

### Changing Container Resources

```bash
pct set <CTID> -memory 4096  # Increase to 4GB RAM
pct set <CTID> -cores 4      # Increase to 4 CPU cores
pct reboot <CTID>
```

### Adding Custom Media Types

Edit `/opt/media-ingest/scripts/ingest-media.sh` inside container:

```bash
# Add custom folder detection
if [ -d "$MOUNT_POINT/Documentaries" ]; then
    rsync -avh --progress --ignore-existing "$MOUNT_POINT/Documentaries/" "$NAS_PATH/Documentaries/" 2>&1 | tee -a "$LOG_FILE"
fi
```

### Adjusting Port Numbers

Frontend port (default 5173):
```bash
# Inside container
nano /etc/systemd/system/media-ingest-frontend.service
# Change PORT environment variable
systemctl daemon-reload
systemctl restart media-ingest-frontend
```

Backend port (default 3000):
```bash
# Inside container
nano /opt/media-ingest/server.js
# Change port in app.listen()
systemctl restart media-ingest-monitor
```

---

## 🐛 Troubleshooting

### USB Drive Not Detected

**Symptom:** Plug in USB drive, nothing happens

**Solution:**

1. **Check udev rules on Proxmox host:**
   ```bash
   cat /etc/udev/rules.d/99-usb-media.rules
   ```
   Should contain:
   ```
   ACTION=="add", KERNEL=="sd[a-z][0-9]", RUN+="/usr/bin/lxc-attach -n media-ingest -- /opt/media-ingest/scripts/usb-trigger.sh %k"
   ```

2. **Reload udev rules:**
   ```bash
   udevadm control --reload-rules
   udevadm trigger
   ```

3. **Check if USB is visible on host:**
   ```bash
   lsblk
   dmesg | tail -n 50
   ```

4. **Verify container has passthrough:**
   ```bash
   pct config <CTID> | grep mp0
   ```

5. **Manual test inside container:**
   ```bash
   pct enter <CTID>
   /opt/media-ingest/scripts/usb-trigger.sh sda1
   ```

### NTFS Mount Fails

**Symptom:** Log shows "mount: unknown filesystem type 'ntfs'"

**Solution:**

1. **Check kernel version (requires 5.15+ for ntfs3):**
   ```bash
   uname -r
   ```

2. **Install ntfs-3g fallback:**
   ```bash
   pct enter <CTID>
   apt update && apt install -y ntfs-3g
   ```

3. **Verify mount drivers:**
   ```bash
   lsmod | grep ntfs
   ```

### Dashboard Not Loading

**Symptom:** Cannot access `http://proxmox-ip:5173`

**Solution:**

1. **Check services status inside container:**
   ```bash
   pct enter <CTID>
   systemctl status media-ingest-frontend
   systemctl status media-ingest-monitor
   ```

2. **View service logs:**
   ```bash
   journalctl -u media-ingest-frontend -f
   journalctl -u media-ingest-monitor -f
   ```

3. **Check firewall on Proxmox host:**
   ```bash
   iptables -L -n | grep 5173
   iptables -L -n | grep 3000
   ```

4. **Restart services:**
   ```bash
   systemctl restart media-ingest-frontend
   systemctl restart media-ingest-monitor
   ```

5. **Rebuild frontend (if corrupted):**
   ```bash
   cd /opt/media-ingest/client
   npm install
   npm run build
   systemctl restart media-ingest-frontend
   ```

### Transfers Stuck at 0%

**Symptom:** Dashboard shows transfer but progress never updates

**Solution:**

1. **Check rsync process:**
   ```bash
   pct enter <CTID>
   ps aux | grep rsync
   ```

2. **Check disk space:**
   ```bash
   df -h /mnt/nas
   ```

3. **Check NAS mount:**
   ```bash
   ls -la /mnt/nas
   mount | grep /mnt/nas
   ```

4. **Check permissions:**
   ```bash
   ls -ld /mnt/nas/Media
   # Should show rwxr-xr-x or similar
   ```

5. **Manual transfer test:**
   ```bash
   rsync -avh --dry-run /mnt/usb-sda1/Movies/ /mnt/nas/Media/Movies/
   ```

### Container Won't Start

**Symptom:** `pct start <CTID>` fails

**Solution:**

1. **Check container status:**
   ```bash
   pct status <CTID>
   ```

2. **View container logs:**
   ```bash
   journalctl -u pve-container@<CTID> -n 50
   ```

3. **Check NAS mount exists on host:**
   ```bash
   ls -la /mnt/pve/media-nas
   # If missing, fix your NAS mount first
   ```

4. **Try starting without bind mount:**
   ```bash
   pct set <CTID> -delete mp0
   pct start <CTID>
   # Then re-add mount after debugging
   ```

### Permission Denied on NAS

**Symptom:** rsync fails with "Permission denied" errors

**Solution:**

1. **Check NAS permissions from host:**
   ```bash
   ls -la /mnt/pve/media-nas/Media
   ```

2. **Fix permissions on host:**
   ```bash
   chmod 755 /mnt/pve/media-nas/Media
   chown -R nobody:nogroup /mnt/pve/media-nas/Media
   # Or use your Jellyfin user:group
   ```

3. **Check container UID mapping:**
   ```bash
   pct config <CTID> | grep lxc.idmap
   # Privileged containers use host UIDs directly
   ```

4. **Run installer's permission fix:**
   ```bash
   pct enter <CTID>
   mkdir -p /mnt/nas/Media/{Movies,Series,Anime}
   chmod -R 755 /mnt/nas/Media
   ```

### Log Files Too Large

**Symptom:** `/opt/media-ingest/transfer.log` grows to GB

**Solution:**

1. **Set up log rotation:**
   ```bash
   pct enter <CTID>
   cat > /etc/logrotate.d/media-ingest << 'EOF'
   /opt/media-ingest/transfer.log {
       daily
       rotate 7
       compress
       missingok
       notifempty
   }
   EOF
   ```

2. **Manually truncate log:**
   ```bash
   truncate -s 0 /opt/media-ingest/transfer.log
   ```

### Multiple USB Drives Conflict

**Symptom:** Second USB drive overwrites first transfer

**Solution:**

1. **Check concurrent transfer handling:**
   ```bash
   pct enter <CTID>
   ps aux | grep ingest-media.sh
   # Each drive should have separate process
   ```

2. **Wait for first transfer to complete** before inserting second drive

3. **Enable lockfile mechanism** (edit script):
   ```bash
   nano /opt/media-ingest/scripts/ingest-media.sh
   # Add at top:
   LOCKFILE="/tmp/ingest-$DEVICE.lock"
   if [ -f "$LOCKFILE" ]; then
       echo "Transfer already in progress for $DEVICE"
       exit 0
   fi
   touch "$LOCKFILE"
   # Add at end:
   rm -f "$LOCKFILE"
   ```

---

## 📊 Advanced Usage

### Monitoring from Command Line

```bash
# Watch active transfers
pct enter <CTID>
tail -f /opt/media-ingest/transfer.log

# Check service health
systemctl status media-ingest-*

# View resource usage
htop
```

### Integrating with Home Assistant

Use the REST API endpoint to monitor transfers:

```yaml
# configuration.yaml
sensor:
  - platform: rest
    resource: http://proxmox-ip:3000/api/status
    name: Media Ingest Status
    value_template: '{{ value_json.active_transfers }}'
```

### Backup & Restore

**Backup container:**
```bash
vzdump <CTID> --storage local --compress zstd
```

**Restore container:**
```bash
pct restore <NEW_CTID> /var/lib/vz/dump/vzdump-lxc-<CTID>-*.tar.zst
```

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Quick Links

- [Report a Bug](https://github.com/TheLastDruid/mediaIngest/issues/new?template=bug_report.md)
- [Request a Feature](https://github.com/TheLastDruid/mediaIngest/issues/new?template=feature_request.md)
- [Submit a Pull Request](https://github.com/TheLastDruid/mediaIngest/pulls)

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

Built with:
- [React](https://react.dev/) - UI framework
- [Vite](https://vitejs.dev/) - Build tool
- [Express](https://expressjs.com/) - Backend framework
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Framer Motion](https://www.framer.com/motion/) - Animations
- [Lucide](https://lucide.dev/) - Icons

Special thanks to the Proxmox and Jellyfin communities!

---

## 💬 Support

- **Issues:** [GitHub Issues](https://github.com/TheLastDruid/mediaIngest/issues)
- **Discussions:** [GitHub Discussions](https://github.com/TheLastDruid/mediaIngest/discussions)
- **Security:** See [SECURITY.md](SECURITY.md)

---

<div align="center">

**⭐ Star this repo if it helped automate your media workflow! ⭐**

Made with ❤️ for the self-hosted community

</div>
