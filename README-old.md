# Media Ingest System

A modern, real-time monitoring dashboard for automated USB-to-NAS media transfers using Proxmox, LXC containers, and rsync.

![Dashboard Preview](https://img.shields.io/badge/Status-Production%20Ready-success)
![Platform](https://img.shields.io/badge/Platform-Proxmox%20%2B%20LXC-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Features

- 🔄 **Automatic USB Detection** - Plug and play with udev rules
- 📊 **Real-time Progress Monitoring** - Live transfer updates every 500ms
- 📁 **Multi-folder Sync** - Movies, Series, Anime, and custom folders
- 📈 **Transfer History** - Persistent tracking of all completed transfers
- 💾 **Storage Health** - Monitor NAS and USB capacity
- 🎮 **Control Actions** - Abort, Eject, and Scan controls
- 📱 **Responsive Design** - Mobile-first, works on all devices
- 🎨 **Dark Mode UI** - ProxMux-inspired Bento Grid layout
- ⚡ **High Performance** - 50-70 MB/s transfer speeds

## 🚀 Quick Install

### Automated Installation (Recommended)

Run this single command on your **Proxmox host** to deploy everything automatically:

```bash
bash -c "$(wget -qLO - http://192.168.1.14:3000/spooky/mediaingestDashboard/raw/branch/main/install.sh)"
```

Or download and inspect first:

```bash
wget http://192.168.1.14:3000/spooky/mediaingestDashboard/raw/branch/main/install.sh
bash install.sh
```

The installer will:
- ✅ Configure Proxmox host for USB detection
- ✅ Create and configure LXC container
- ✅ Install all dependencies (Node.js, rsync, etc.)
- ✅ Deploy dashboard application
- ✅ Set up systemd services
- ✅ Configure bind mounts for USB and NAS

**Interactive Prompts:**
- Container ID (default: 105)
- Container name (default: media-ingest)
- Root password for container
- NAS mount path on host
- CPU/Memory/Disk allocation
- Network configuration (DHCP or static IP)

### Manual Installation

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for step-by-step manual setup.

## 📖 Documentation

- [Quick Install Guide](INSTALL.md) - One-line installer
- [Full Deployment Guide](DEPLOYMENT_GUIDE.md) - Step-by-step manual setup
- [Scripts Documentation](scripts/README.md) - Script usage and customization

## 🏗️ Architecture

```
Proxmox Host → USB Detection (udev) → LXC Container → Rsync → NAS
                     ↓
            Real-time Dashboard (React + Node.js)
```

## 🔧 Tech Stack

**Frontend:**
- React 18.2 + Vite 4.5
- Tailwind CSS 3.3
- Framer Motion 10.16
- Lucide React Icons

**Backend:**
- Node.js + Express 4.18
- Real-time log parsing
- RESTful API

**Infrastructure:**
- Proxmox VE
- LXC Containers
- rsync with progress tracking
- systemd services
- udev automation

## 📊 API Endpoints

- `GET /api/status` - Current transfer status
- `GET /api/history` - Transfer history (last 10)
- `GET /api/stats` - System statistics
- `GET /api/storage` - Storage health (NAS, USB)
- `POST /api/abort` - Abort current transfer
- `POST /api/eject` - Eject USB drive
- `POST /api/scan` - Trigger media library scan

## 🛠️ Development

### Backend (Node.js + Express)
```bash
cd /home/spooky/Desktop/copyMontior
npm install
npm start  # Runs on port 3000
```

### Frontend (React + Vite)
```bash
cd /home/spooky/Desktop/copyMontior/client
npm install
npm run dev  # Development mode with HMR
npm run build  # Production build
```

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details

---

**Made with ❤️ for Home Lab enthusiasts**
