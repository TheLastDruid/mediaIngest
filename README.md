# 📀 Universal USB Media Ingest System

> **Developed by:** Spookyfunck  
> **Repository:** https://github.com/TheLastDruid/mediaIngest  
> **License:** MIT  
> **Version:** 3.0

A complete automated USB media ingest station for Proxmox VE. Automatically detects USB drives, scans for media folders, and syncs Movies/Series/Anime to your NAS with real-time web dashboard monitoring.

---

## 🎯 Features

- **🔍 Intelligent NAS Detection**: Automatically scans `/mnt/pve/*` and `/mnt/*` for mounted storage
- **📊 Interactive Storage Menu**: Shows available space, used space, and total capacity
- **🚀 One-Click Installation**: Select destination once, then fully automated
- **📁 Auto-Provisioning**: Creates `Media` folder with proper permissions if not exists
- **🔄 Real-Time Monitoring**: Beautiful React dashboard with live sync progress
- **🔌 Plug-and-Play**: Insert USB → Auto-detect → Auto-mount → Auto-sync
- **🎨 Modern UI**: Framer Motion animations, Tailwind CSS styling
- **📝 Comprehensive Logging**: Full audit trail of all ingest operations

---

## ⚡ Quick Start

### One-Line Installation

```bash
bash -c "$(wget -qLO - https://raw.githubusercontent.com/TheLastDruid/mediaIngest/main/install.sh)"
```

### Installation Steps

1. **Run the installer** as root on your Proxmox host
2. **Select your NAS destination** from the interactive menu
3. **Wait 5-10 minutes** for automated installation
4. **Access dashboard** at `http://[container-ip]:3000`
5. **Insert USB drive** with a `Media` folder to test

---

## 🏗️ Architecture

```
┌─────────────────┐
│   USB Drive     │
│   /Media        │
│   ├─ Movies     │
│   ├─ Series     │
│   └─ Anime      │
└────────┬────────┘
         │
    ┌────▼────────────────────┐
    │   Proxmox Host          │
    │   • udev rules          │
    │   • ntfs3/ntfs-3g mount │
    │   • usb-trigger.sh      │
    └────┬────────────────────┘
         │
    ┌────▼─────────────────────┐
    │   LXC Container          │
    │   • Privileged           │
    │   • Bind mounts          │
    │   • ingest-media.sh      │
    │   • React Dashboard      │
    └────┬─────────────────────┘
         │
    ┌────▼────────────────┐
    │   NAS/Storage       │
    │   /Media            │
    │   ├─ Movies         │
    │   ├─ Series         │
    │   └─ Anime          │
    └─────────────────────┘
```

---

## 📋 What Gets Installed

### Container Configuration

- **Container ID**: Auto-detected (next available)
- **Hostname**: `media-ingest`
- **Type**: Privileged (required for bind mounts)
- **Resources**: 2 CPU cores, 2GB RAM, 8GB disk
- **Network**: DHCP (auto-assigned IP)
- **Password**: `mediaingest123`

---

## 🎮 Usage

### Basic Workflow

1. **Prepare USB Drive**
   ```
   USB Drive
   └── Media
       ├── Movies
       ├── Series
       └── Anime
   ```

2. **Insert USB** into Proxmox host
3. **Watch Dashboard** for real-time progress
4. **Remove USB** when sync completes

---

## 🛠️ Troubleshooting

### View Logs

```bash
# Inside container
pct enter [CT_ID]
tail -f /var/log/media-ingest.log
```

### Test USB Trigger

```bash
/usr/local/bin/usb-trigger.sh /dev/sdX
```

---

## 🤝 Contributing

Developed by **Spookyfunck** as part of a home lab media management solution.

### How to Contribute

```bash
git clone https://github.com/TheLastDruid/mediaIngest.git
cd mediaIngest
# Make your changes
git add .
git commit -m "Your changes"
git push origin main
```

---

## 📝 License

MIT License - Copyright (c) 2025 Spookyfunck

---

## 🎨 Vibe Code Philosophy

This project embraces the **Vibe Code** philosophy:

- **It Just Works™**: Install once, forget about it
- **Beautiful UX**: Modern, animated, responsive interface
- **Developer Friendly**: Clean code, comprehensive docs
- **Production Ready**: Battle-tested in real home lab environments

Built with care for the home lab community.

---

**Made with ❤️ by Spookyfunck**

**Repository**: https://github.com/TheLastDruid/mediaIngest

---

*Last Updated: December 5, 2025*
