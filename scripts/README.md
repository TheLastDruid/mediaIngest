# Scripts Directory

This directory contains the core automation scripts for the Media Ingest System.

## Files

### 1. `usb-trigger.sh` (Proxmox Host)

**Location:** `/usr/local/bin/usb-trigger.sh` on Proxmox host

**Purpose:** Triggered by udev rules when a USB drive is detected. Handles mounting, bind-mounting into LXC, and cleanup.

**Installation:**
```bash
# On Proxmox host (192.168.1.200)
scp scripts/usb-trigger.sh root@192.168.1.200:/usr/local/bin/
ssh root@192.168.1.200 "chmod +x /usr/local/bin/usb-trigger.sh"
```

**Configuration:**
- Edit `LXC_ID="105"` to match your container ID
- Edit `HOST_MOUNT="/mnt/usb-pass"` if using different mount point

**Dependencies:**
- `pct` command (Proxmox container toolkit)
- `mount` with ntfs3 support
- Target LXC container must exist and be running

---

### 2. `ingest-media.sh` (LXC Container)

**Location:** `/usr/local/bin/ingest-media.sh` on LXC container

**Purpose:** Scans USB drive for media folders, syncs to NAS using rsync, logs all progress.

**Installation:**
```bash
# On LXC container (192.168.1.7)
scp scripts/ingest-media.sh root@192.168.1.7:/usr/local/bin/
ssh root@192.168.1.7 "chmod +x /usr/local/bin/ingest-media.sh"
```

**Configuration:**
- Edit `SEARCH_ROOT="/media/usb-ingest"` for USB mount point
- Edit `DEST_ROOT="/media/nas"` for NAS mount point
- Edit `LOG="/var/log/media-ingest.log"` for log location
- Modify `sync_folder` calls to match your folder structure:
  ```bash
  sync_folder "Movies"
  sync_folder "Series"
  sync_folder "Anime"
  sync_folder "Documentaries"  # Add custom folders
  ```

**Dependencies:**
- `rsync` with progress support
- `stdbuf` (coreutils)
- `find` command
- Write access to log file
- Read access to USB mount
- Write access to NAS mount

---

## Workflow

```
USB Plugged In
     ↓
udev rule triggers
     ↓
systemd-run --no-block --unit=media-ingest-$kernel-$(timestamp)
     ↓
/usr/local/bin/usb-trigger.sh /dev/sdb  ← (Proxmox Host)
     ↓
     1. Mount USB to /mnt/usb-pass
     2. Bind mount into LXC container
     3. Execute: pct exec 105 -- /usr/local/bin/ingest-media.sh
     ↓
/usr/local/bin/ingest-media.sh  ← (LXC Container)
     ↓
     1. Find "Media" folder on USB
     2. For each subfolder (Movies/Series/Anime):
        - Log SYNC_START marker
        - rsync files with progress
        - Log SYNC_END marker
     3. Complete and exit
     ↓
usb-trigger.sh cleanup
     ↓
     1. Unmount USB from Proxmox
     2. Exit
```

---

## Testing

### Test USB Trigger Script (Proxmox)

```bash
ssh root@192.168.1.200

# Manually trigger with USB device
bash /usr/local/bin/usb-trigger.sh /dev/sdb

# Check if USB is mounted
mount | grep /mnt/usb-pass

# Check if bind mount exists in LXC
pct exec 105 -- mount | grep usb-ingest
```

### Test Ingest Script (LXC)

```bash
ssh root@192.168.1.7

# Ensure USB is mounted
ls -la /media/usb-ingest

# Manually run ingest
bash /usr/local/bin/ingest-media.sh

# Watch logs in real-time
tail -f /var/log/media-ingest.log
```

---

## Troubleshooting

### USB Trigger Issues

**Problem:** Script can't mount USB

**Check:**
```bash
# List available devices
lsblk

# Check USB device
dmesg | tail -20

# Try manual mount
mount -t ntfs3 /dev/sdb /mnt/usb-pass
```

**Problem:** Can't execute script in LXC

**Check:**
```bash
# Verify LXC is running
pct status 105

# Test pct exec manually
pct exec 105 -- whoami
pct exec 105 -- ls /usr/local/bin/ingest-media.sh
```

### Ingest Script Issues

**Problem:** No Media folder found

**Check:**
```bash
# List USB contents
ls -R /media/usb-ingest

# Verify mount
mount | grep usb-ingest

# Check logs
grep "Media folder" /var/log/media-ingest.log
```

**Problem:** rsync permission denied

**Check:**
```bash
# Test NAS mount
ls -la /media/nas
touch /media/nas/test.txt

# Check rsync manually
rsync -rvh /media/usb-ingest/Media/Movies/ /media/nas/Movies/
```

---

## Customization

### Add Custom Folder Types

Edit `ingest-media.sh`:

```bash
sync_folder "Movies"
sync_folder "Series"
sync_folder "Anime"
sync_folder "Documentaries"
sync_folder "Music"
sync_folder "Photos"
```

### Change Rsync Options

Current options: `-rvh -W --inplace --progress --ignore-existing`

- `-r`: Recursive
- `-v`: Verbose
- `-h`: Human-readable sizes
- `-W`: Copy whole files (fast for LAN)
- `--inplace`: Update files in-place (no temp files)
- `--progress`: Show progress
- `--ignore-existing`: Skip files already on NAS

**Add bandwidth limit:**
```bash
rsync -rvh -W --inplace --progress --bwlimit=10000 ...
```

**Add checksum verification:**
```bash
rsync -rvhc -W --inplace --progress ...
```

**Delete source after sync:**
```bash
rsync -rvh -W --inplace --progress --remove-source-files ...
```

### Custom Log Location

Edit both scripts to change log path:

```bash
# In usb-trigger.sh (optional logging)
LOG="/var/log/usb-trigger.log"

# In ingest-media.sh (required)
LOG="/var/log/media-ingest.log"
```

**Remember to update `server.js`:**
```javascript
const LOG_PATH = '/var/log/media-ingest.log';
const PROGRESS_LOG_PATH = '/var/log/media-ingest.log';
```

---

## Log Format

The ingest script writes structured logs that the dashboard parses:

```
========================================
Thu Dec  5 14:23:45 UTC 2025: New Drive Detected. Scanning for Media folder...
Target Found: /media/usb-ingest/Media
Syncing /media/usb-ingest/Media/Movies -> /media/nas/Movies
SYNC_START:Movies
Zootopia (2016) [1080p] [YTS.AG].mp4
1.77G  23%  62.45MB/s  0:00:18
1.77G  47%  65.12MB/s  0:00:15
1.77G  73%  67.89MB/s  0:00:07
1.77G  100%  68.54MB/s  0:00:00
SYNC_END:Movies
Thu Dec  5 14:24:12 UTC 2025: Ingest Complete.
```

**Key markers:**
- `SYNC_START:FolderName` - Dashboard detects active sync
- `SYNC_END:FolderName` - Dashboard marks sync complete
- Progress lines with `%` - Dashboard parses for real-time updates
- Filenames ending in video extensions - Dashboard displays current file

---

## Security Notes

1. **Root Execution:** Both scripts run as root - ensure proper permissions
2. **Input Validation:** `usb-trigger.sh` validates device parameter
3. **Mount Safety:** Scripts verify mounts before proceeding
4. **Cleanup:** `usb-trigger.sh` always unmounts USB after completion
5. **Logging:** All operations logged for audit trail

---

## Maintenance

### Check Script Versions

```bash
# On Proxmox
ssh root@192.168.1.200 "md5sum /usr/local/bin/usb-trigger.sh"

# On LXC
ssh root@192.168.1.7 "md5sum /usr/local/bin/ingest-media.sh"
```

### Update Scripts

```bash
# From development machine
cd /home/spooky/Desktop/copyMontior

# Deploy to Proxmox
scp scripts/usb-trigger.sh root@192.168.1.200:/usr/local/bin/

# Deploy to LXC
scp scripts/ingest-media.sh root@192.168.1.7:/usr/local/bin/

# Verify permissions
ssh root@192.168.1.200 "chmod +x /usr/local/bin/usb-trigger.sh"
ssh root@192.168.1.7 "chmod +x /usr/local/bin/ingest-media.sh"
```

### Backup Scripts

```bash
# Backup from servers
scp root@192.168.1.200:/usr/local/bin/usb-trigger.sh ./backups/usb-trigger.sh.$(date +%Y%m%d)
scp root@192.168.1.7:/usr/local/bin/ingest-media.sh ./backups/ingest-media.sh.$(date +%Y%m%d)
```
