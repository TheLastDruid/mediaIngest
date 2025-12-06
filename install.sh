#!/bin/bash

################################################################################
# Universal USB Media Ingest Installer for Proxmox VE
# 
# Features:
# - Intelligent destination selection (scans /mnt/pve/* and /mnt/*)
# - Interactive storage menu
# - Auto-provisions Media folder with proper permissions
# - Complete automation: Host + LXC creation + Dashboard
# - Single destination choice, then fully automated
################################################################################

set -e
set -o pipefail

################################################################################
# Color Definitions
################################################################################
BL='\033[36m'    # Blue
GN='\033[1;92m'  # Green
CL='\033[m'      # Clear
RD='\033[01;31m' # Red
YW='\033[1;33m'  # Yellow
MG='\033[35m'    # Magenta
CY='\033[96m'    # Cyan
BFR="\\r\\033[K" # Back to First column and Clear Line
HOLD="-"
CM="${GN}✓${CL}"
CROSS="${RD}✗${CL}"

################################################################################
# Helper Functions
################################################################################
msg_info() {
    local msg="$1"
    echo -ne " ${HOLD} ${YW}${msg}..."
}

msg_ok() {
    local msg="$1"
    echo -e "${BFR} ${CM} ${GN}${msg}${CL}"
}

msg_error() {
    local msg="$1"
    echo -e "${BFR} ${CROSS} ${RD}${msg}${CL}"
}

msg_warn() {
    local msg="$1"
    echo -e " ${YW}⚠${CL} ${msg}"
}

header_info() {
    clear
    cat <<"EOF"
    __  ___          ___         ____                      __     _____            __               
   /  |/  /__  ____/ (_)___ _   /  _/___  ____ ____  _____/ /_   / ___/__  _______/ /____  ____ ___ 
  / /|_/ / _ \/ __  / / __ `/   / // __ \/ __ `/ _ \/ ___/ __/   \__ \/ / / / ___/ __/ _ \/ __ `__ \
 / /  / /  __/ /_/ / / /_/ /  _/ // / / / /_/ /  __(__  ) /_    ___/ / /_/ (__  ) /_/  __/ / / / / /
/_/  /_/\___/\__,_/_/\__,_/  /___/_/ /_/\__, /\___/____/\__/   /____/\__, /____/\__/\___/_/ /_/ /_/ 
                                       /____/                        /____/                          

                          Universal USB Media Ingest System
                          Automated Installer v2.0
                          
EOF
}

################################################################################
# Configuration Variables (Hardcoded - No User Input)
################################################################################
CT_NAME="media-ingest"
CT_CORES=2
CT_MEMORY=2048
CT_SWAP=512
CT_DISK=8
CT_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)  # Random 24-char password
NAS_HOST_PATH="/mnt/pve/media-nas"
CONTAINER_EXISTS=false
TEMPLATE=""  # Will be auto-detected

################################################################################
# Validation Functions
################################################################################
check_root() {
    if [[ $EUID -ne 0 ]]; then
        msg_error "This script must be run as root"
        echo -e "\nPlease run: ${GN}sudo bash install.sh${CL}\n"
        exit 1
    fi
}

check_proxmox() {
    if [ ! -f /etc/pve/.version ]; then
        msg_error "Proxmox VE not detected"
        echo -e "\nThis script must be run on a Proxmox VE host.\n"
        exit 1
    fi
    msg_ok "Proxmox VE detected"
}

################################################################################
# Destination Selection
################################################################################
select_nas_destination() {
    echo -e "\n${BL}═══════════════════════════════════════════════════════════════${CL}"
    echo -e "${BL}           Scanning for NAS/Storage Destinations...             ${CL}"
    echo -e "${BL}═══════════════════════════════════════════════════════════════${CL}\n"
    
    # Find all mounted storage locations
    local destinations=()
    
    # Scan /mnt/pve/*
    if [ -d /mnt/pve ]; then
        while IFS= read -r dir; do
            if mountpoint -q "$dir" 2>/dev/null || [ -d "$dir" ]; then
                destinations+=("$dir")
            fi
        done < <(find /mnt/pve -maxdepth 1 -mindepth 1 -type d 2>/dev/null | sort)
    fi
    
    # Scan /mnt/* (exclude /mnt/pve and /mnt/usb-pass)
    while IFS= read -r dir; do
        if [ "$dir" != "/mnt/pve" ] && [ "$dir" != "/mnt/usb-pass" ]; then
            if mountpoint -q "$dir" 2>/dev/null || [ -d "$dir" ]; then
                destinations+=("$dir")
            fi
        fi
    done < <(find /mnt -maxdepth 1 -mindepth 1 -type d 2>/dev/null | sort)
    
    if [ ${#destinations[@]} -eq 0 ]; then
        msg_error "No NAS/storage destinations found in /mnt/pve or /mnt"
        echo -e "\n${YW}Please ensure your NAS is mounted first.${CL}"
        echo -e "${YW}Using default: /mnt/pve/media-nas${CL}\n"
        NAS_HOST_PATH="/mnt/pve/media-nas"
        return
    fi
    
    # Display menu
    echo -e "${GN}Available Storage Destinations:${CL}\n"
    for i in "${!destinations[@]}"; do
        local path="${destinations[$i]}"
        local size=$(df -h "$path" 2>/dev/null | awk 'NR==2 {print $2}' || echo "N/A")
        local used=$(df -h "$path" 2>/dev/null | awk 'NR==2 {print $3}' || echo "N/A")
        local avail=$(df -h "$path" 2>/dev/null | awk 'NR==2 {print $4}' || echo "N/A")
        printf "${CY}%2d)${CL} %-40s ${MG}Size:${CL} %-8s ${YW}Used:${CL} %-8s ${GN}Avail:${CL} %s\n" \
               "$((i+1))" "$path" "$size" "$used" "$avail"
    done
    
    echo ""
    while true; do
        read -p "$(echo -e ${GN}Select destination [1-${#destinations[@]}]:${CL} )" choice
        
        if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "${#destinations[@]}" ]; then
            NAS_HOST_PATH="${destinations[$((choice-1))]}"
            break
        else
            echo -e "${RD}Invalid choice. Please enter a number between 1 and ${#destinations[@]}${CL}"
        fi
    done
    
    msg_ok "Selected: $NAS_HOST_PATH"
    
    # Check if Media folder exists, create if not
    msg_info "Checking for Media folder"
    local media_path="$NAS_HOST_PATH/Media"
    
    if [ ! -d "$media_path" ]; then
        mkdir -p "$media_path"
        chmod 777 "$media_path"
        msg_ok "Created Media folder: $media_path"
    else
        chmod 777 "$media_path"
        msg_ok "Media folder exists: $media_path"
    fi
}

################################################################################
# Auto-Detection Functions
################################################################################
get_next_ctid() {
    msg_info "Auto-detecting next container ID"
    CTID=$(pvesh get /cluster/nextid)
    msg_ok "Container ID: $CTID"
}

detect_storage() {
    msg_info "Detecting available storage"
    
    # Prefer local-lvm, fallback to local
    if pvesm status | grep -q "local-lvm"; then
        STORAGE="local-lvm"
    elif pvesm status | grep -q "^local"; then
        STORAGE="local"
    else
        # Use first available storage
        STORAGE=$(pvesm status | awk 'NR==2 {print $1}')
    fi
    
    if [ -z "$STORAGE" ]; then
        msg_error "No storage found"
        exit 1
    fi
    
    msg_ok "Using storage: $STORAGE"
}

ensure_template() {
    msg_info "Checking for Debian 12 template"
    
    # Check if any Debian 12 template already exists
    if pveam list local 2>/dev/null | grep -q "debian-12"; then
        # Format: local:vztmpl/debian-12-standard_12.2-1_amd64.tar.zst  SIZE  DATE
        TEMPLATE=$(pveam list local | grep "debian-12" | head -1 | sed 's/.*vztmpl\///' | awk '{print $1}')
        msg_ok "Template found: $TEMPLATE"
        return
    fi
    
    msg_info "Downloading Debian 12 template (this may take a few minutes)"
    msg_info "Updating template list..."
    
    if ! pveam update 2>&1 | tee /tmp/pveam-update.log; then
        msg_warn "Template list update had issues, continuing..."
    fi
    
    # Auto-detect the latest available Debian 12 template
    msg_info "Detecting latest Debian 12 template..."
    # Format: system  debian-12-standard_12.2-1_amd64.tar.zst  SIZE  SECTION
    TEMPLATE=$(pveam available | grep "debian-12-standard" | grep "amd64" | tail -1 | awk '{print $1}')
    
    if [ -z "$TEMPLATE" ]; then
        msg_error "No Debian 12 template found in repository"
        echo -e "\n${YW}Available templates:${CL}"
        pveam available | grep debian | head -10
        echo ""
        echo -e "${YW}Troubleshooting:${CL}"
        echo "1. Check internet connectivity: ping -c 3 download.proxmox.com"
        echo "2. Update template list manually: pveam update"
        echo "3. List all available templates: pveam available"
        echo ""
        exit 1
    fi
    
    msg_info "Downloading template: $TEMPLATE"
    echo -e "${BL}[INFO]${CL} This may take 2-5 minutes depending on your connection..."
    
    if pveam download local "$TEMPLATE" 2>&1 | tee /tmp/pveam-download.log; then
        msg_ok "Template downloaded successfully"
    else
        msg_error "Template download failed"
        echo -e "\n${YW}Debug Information:${CL}"
        echo "Template: $TEMPLATE"
        echo "Storage: local"
        echo ""
        echo "Download log:"
        cat /tmp/pveam-download.log 2>/dev/null || echo "No log available"
        echo ""
        echo -e "${YW}Try manually:${CL}"
        echo "pveam update"
        echo "pveam available | grep debian-12"
        echo "pveam download local <template-name>"
        echo ""
        exit 1
    fi
}

################################################################################
# Phase 1: Proxmox Host Configuration
################################################################################
setup_host_scripts() {
    header_info
    echo -e "\n${BL}[Phase 1]${CL} Proxmox Host Configuration\n"
    
    msg_info "Creating USB trigger script"
    cat > /usr/local/bin/usb-trigger.sh << 'EOFSCRIPT'
#!/bin/bash

KERNEL_DEVICE=$1
DEVICE="/dev/$KERNEL_DEVICE"
HOST_MOUNT="/mnt/usb-pass"
LXC_ID="__LXC_ID__"
LOCKFILE="/var/lock/usb-ingest.lock"

# Safety Check
if [ -z "$KERNEL_DEVICE" ]; then 
    echo "$(date): ERROR - No device specified" >> /var/log/usb-trigger.log
    exit 1
fi

# Security: Acquire exclusive lock to prevent concurrent USB processing
exec 200>"$LOCKFILE"
if ! flock -n 200; then
    echo "$(date): Another USB ingest operation is already in progress, skipping $KERNEL_DEVICE" >> /var/log/usb-trigger.log
    exit 0
fi

# Security: Validate kernel device name (must match sd[a-z] or sd[a-z][0-9])
if ! echo "$KERNEL_DEVICE" | grep -qE '^sd[a-z][0-9]*$'; then
    echo "$(date): ERROR - Invalid device name: $KERNEL_DEVICE (security violation)" >> /var/log/usb-trigger.log
    exit 1
fi

# Security: Prevent path traversal
if echo "$KERNEL_DEVICE" | grep -q '\.\.|/'; then
    echo "$(date): ERROR - Path traversal attempt detected in device name" >> /var/log/usb-trigger.log
    exit 1
fi

echo "$(date): USB Device Detected: $DEVICE (kernel: $KERNEL_DEVICE)" >> /var/log/usb-trigger.log

# Wait for device to be fully ready
sleep 2

# Create mount point if needed
mkdir -p "$HOST_MOUNT"

# Security: Verify mount point is empty (prevent mounting over existing data)
if [ -n "$(ls -A $HOST_MOUNT 2>/dev/null)" ]; then
    echo "$(date): ERROR - Mount point not empty, possible stale mount" >> /var/log/usb-trigger.log
    # Try to clean up
    umount -f "$HOST_MOUNT" 2>/dev/null || true
    sleep 1
fi

# Check if device exists and is readable
if [ ! -b "$DEVICE" ]; then
    echo "$(date): ERROR - Device $DEVICE does not exist or is not a block device" >> /var/log/usb-trigger.log
    exit 1
fi

# Security: Mount with nodev,nosuid,noexec to prevent malicious code execution
mount -t ntfs3 -o noatime,nodev,nosuid,noexec "$DEVICE" "$HOST_MOUNT" 2>> /var/log/usb-trigger.log

# Fallback to standard mount if ntfs3 fails (still with security options)
if [ $? -ne 0 ]; then
    echo "$(date): ntfs3 failed, trying standard mount..." >> /var/log/usb-trigger.log
    mount -o nodev,nosuid,noexec "$DEVICE" "$HOST_MOUNT" 2>> /var/log/usb-trigger.log
fi

# Verify Mount
if ! mount | grep -q "$HOST_MOUNT"; then
    echo "$(date): ERROR - Failed to mount $DEVICE (check filesystem type and errors above)" >> /var/log/usb-trigger.log
    exit 1
fi

echo "$(date): Mounted successfully. Triggering LXC ingest..." >> /var/log/usb-trigger.log

# Execute ingest script inside LXC
pct exec $LXC_ID -- /usr/local/bin/ingest-media.sh

# Cleanup
echo "$(date): Ingest finished. Cleaning up..." >> /var/log/usb-trigger.log
sync
sleep 2
umount "$HOST_MOUNT" 2>/dev/null

# Release lock (automatic on script exit, but explicit for clarity)
flock -u 200 2>/dev/null || true

echo "$(date): Complete. Drive unmounted." >> /var/log/usb-trigger.log
EOFSCRIPT
    
    chmod +x /usr/local/bin/usb-trigger.sh
    msg_ok "USB trigger script created with security hardening"
    
    msg_info "Creating mount point"
    # Clean up any stale mounts that could prevent container startup
    umount -f /mnt/usb-pass 2>/dev/null || true
    mkdir -p /mnt/usb-pass
    chmod 755 /mnt/usb-pass
    msg_ok "Mount point /mnt/usb-pass created"
    
    msg_info "Setting up systemd service for USB trigger"
    
    # Create systemd service for USB handling with proper privileges and sandboxing
    cat > /etc/systemd/system/usb-ingest@.service << 'EOF'
[Unit]
Description=USB Media Ingest for %I
After=local-fs.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/usb-trigger.sh %I
RemainAfterExit=no

# Security hardening
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/mnt/usb-pass /var/log
NoNewPrivileges=yes
PrivateTmp=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictNamespaces=yes
RestrictRealtime=yes
RestrictSUIDSGID=yes
LockPersonality=yes
MemoryDenyWriteExecute=yes
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
SystemCallFilter=@system-service
SystemCallFilter=~@privileged @resources
SystemCallErrorNumber=EPERM
EOF

    systemctl daemon-reload
    msg_ok "Systemd service created with security hardening"
    
    msg_info "Setting up udev rules"
    
    # Remove any old/conflicting udev rules
    rm -f /etc/udev/rules.d/99-usb-media-ingest.rules 2>/dev/null
    rm -f /etc/udev/rules.d/99-ingest.rules 2>/dev/null
    
    # Create the correct udev rule that triggers systemd service
    cat > /etc/udev/rules.d/99-usb-ingest.rules << 'EOF'
# USB Media Ingest - Trigger on USB storage device insertion via systemd
# Triggers on both disk devices (sdb) and partitions (sdb1)
ACTION=="add", KERNEL=="sd[a-z]", SUBSYSTEM=="block", ENV{DEVTYPE}=="disk", TAG+="systemd", ENV{SYSTEMD_WANTS}+="usb-ingest@%k.service"
ACTION=="add", KERNEL=="sd[a-z][0-9]", SUBSYSTEM=="block", ENV{DEVTYPE}=="partition", ENV{ID_FS_USAGE}=="filesystem", TAG+="systemd", ENV{SYSTEMD_WANTS}+="usb-ingest@%k.service"
EOF
    
    # Reload and verify udev rules
    udevadm control --reload-rules
    udevadm trigger
    
    # Verify udev rule was created
    if [ ! -f /etc/udev/rules.d/99-usb-ingest.rules ]; then
        msg_error "Failed to create udev rule"
        exit 1
    fi
    
    msg_ok "udev rules configured and verified"
}

################################################################################
# Phase 2: LXC Container Creation (Zero-Touch)
################################################################################
create_container() {
    echo -e "\n${BL}[Phase 2]${CL} LXC Container Creation\n"
    
    # Check if container already exists
    if pct status $CTID &>/dev/null; then
        msg_warn "Container $CTID already exists, skipping creation"
        CONTAINER_EXISTS=true
        
        # Still update the trigger script
        sed -i "s/__LXC_ID__/$CTID/g" /usr/local/bin/usb-trigger.sh 2>/dev/null || true
        return
    fi
    
    msg_info "Creating LXC container $CTID"
    echo -e "${BL}[INFO]${CL} This may take 30-60 seconds..."
    
    # Create container with DHCP network (using auto-detected template)
    if pct create $CTID local:vztmpl/$TEMPLATE \
        --hostname $CT_NAME \
        --password "$CT_PASSWORD" \
        --cores $CT_CORES \
        --memory $CT_MEMORY \
        --swap $CT_SWAP \
        --rootfs $STORAGE:$CT_DISK \
        --net0 name=eth0,bridge=vmbr0,firewall=1,ip=dhcp \
        --unprivileged 0 \
        --onboot 1 \
        --start 0 2>&1 | tee /tmp/pct-create.log; then
        msg_ok "Container $CTID created"
    else
        msg_error "Container creation failed"
        echo -e "\n${YW}Debug Information:${CL}"
        echo "Container ID: $CTID"
        echo "Template: $TEMPLATE"
        echo "Storage: $STORAGE"
        echo "Hostname: $CT_NAME"
        echo ""
        echo "Creation log:"
        cat /tmp/pct-create.log 2>/dev/null || echo "No log available"
        echo ""
        echo -e "${YW}Troubleshooting:${CL}"
        echo "1. Check if container ID is available: pct status $CTID"
        echo "2. Verify template exists: pveam list local | grep debian-12"
        echo "3. Check storage space: pvesm status"
        echo "4. Manually create: pct create $CTID local:vztmpl/$TEMPLATE --hostname $CT_NAME"
        echo ""
        exit 1
    fi
    
    msg_info "Configuring bind mounts"
    # USB bind mount
    pct set $CTID -mp0 /mnt/usb-pass,mp=/media/usb-ingest
    # NAS bind mount
    pct set $CTID -mp1 $NAS_HOST_PATH,mp=/media/nas
    msg_ok "Bind mounts configured"
    
    # Update usb-trigger.sh with actual container ID
    sed -i "s/__LXC_ID__/$CTID/g" /usr/local/bin/usb-trigger.sh
    
    msg_info "Starting container"
    pct start $CTID
    sleep 8
    msg_ok "Container started"
}

################################################################################
# Phase 3: Container Bootstrap
################################################################################
bootstrap_container() {
    echo -e "\n${BL}[Phase 3]${CL} Container Bootstrap\n"
    
    msg_info "Waiting for container to be ready"
    sleep 3
    msg_ok "Container ready"
    
    msg_info "Updating package lists"
    pct exec $CTID -- bash -c "apt-get update -qq" >/dev/null 2>&1
    msg_ok "Package lists updated"
    
    msg_info "Installing base dependencies"
    pct exec $CTID -- bash -c "DEBIAN_FRONTEND=noninteractive apt-get install -y -qq curl git rsync ntfs-3g python3 sudo" >/dev/null 2>&1
    msg_ok "Base dependencies installed"
    
    msg_info "Installing ClamAV antivirus"
    pct exec $CTID -- bash -c "DEBIAN_FRONTEND=noninteractive apt-get install -y -qq clamav clamav-daemon clamav-freshclam" >/dev/null 2>&1
    msg_ok "ClamAV installed"
    
    msg_info "Updating virus definitions (this may take a few minutes)"
    pct exec $CTID -- bash -c "systemctl stop clamav-freshclam 2>/dev/null || true"
    pct exec $CTID -- bash -c "freshclam --quiet 2>/dev/null || true"
    pct exec $CTID -- bash -c "systemctl enable clamav-daemon --quiet 2>/dev/null || true"
    pct exec $CTID -- bash -c "systemctl start clamav-daemon 2>/dev/null || true"
    msg_ok "Virus definitions updated"
    
    msg_info "Installing Node.js 18.x"
    pct exec $CTID -- bash -c "curl -fsSL https://deb.nodesource.com/setup_18.x | bash - >/dev/null 2>&1"
    pct exec $CTID -- bash -c "apt-get install -y -qq nodejs" >/dev/null 2>&1
    msg_ok "Node.js installed"
    
    msg_info "Creating log file"
    pct exec $CTID -- bash -c "touch /var/log/media-ingest.log && chmod 640 /var/log/media-ingest.log"
    msg_ok "Log file created"
    
    msg_info "Configuring log rotation"
    pct exec $CTID -- bash -c 'cat > /etc/logrotate.d/media-ingest << '\''EOF'\''
/var/log/media-ingest.log {
    size 100M
    rotate 5
    compress
    delaycompress
    notifempty
    missingok
    create 0640 root root
    sharedscripts
}
EOF'
    msg_ok "Log rotation configured"
    
    msg_info "Deploying ingest script"
    
    # Try to push from local scripts directory, or create inline
    if [ -f "$(dirname "$0")/scripts/ingest-media.sh" ]; then
        pct push $CTID "$(dirname "$0")/scripts/ingest-media.sh" /usr/local/bin/ingest-media.sh
    else
        pct exec $CTID -- bash -c 'cat > /usr/local/bin/ingest-media.sh << '\''EOFSCRIPT'\''
#!/bin/bash

SEARCH_ROOT="/media/usb-ingest"
DEST_ROOT="/media/nas"
LOG="/var/log/media-ingest.log"

echo "========================================" >> "$LOG"
echo "$(date): New Drive Detected. Scanning for Media folder..." >> "$LOG"

FOUND_SRC=$(find "$SEARCH_ROOT" -maxdepth 3 -type d -iname "Media" 2>/dev/null | head -n 1)

if [ -z "$FOUND_SRC" ]; then
    echo "Analysis: No Media folder found on this drive. Exiting." >> "$LOG"
    ls -F "$SEARCH_ROOT" >> "$LOG" 2>&1
    exit 0
fi

echo "Target Found: $FOUND_SRC" >> "$LOG"

# Security: Check for suspicious filenames before processing
echo "$(date): Checking for suspicious filenames..." >> "$LOG"
SUSPICIOUS_COUNT=0
while IFS= read -r -d "" file; do
    filename=$(basename "$file")
    # Check for shell metacharacters and dangerous patterns
    if echo "$filename" | grep -qE '[\$\`\;\|\&\<\>\(\)]|^\.|\.\.'; then
        echo "WARNING: Suspicious filename detected: $filename" >> "$LOG"
        SUSPICIOUS_COUNT=$((SUSPICIOUS_COUNT + 1))
    fi
done < <(find "$FOUND_SRC" -type f -print0 2>/dev/null)

if [ "$SUSPICIOUS_COUNT" -gt 0 ]; then
    echo "SECURITY ALERT: Found $SUSPICIOUS_COUNT suspicious filenames. Review log before proceeding." >> "$LOG"
fi

# Security: Scan for malware using ClamAV
echo "$(date): Scanning USB content for malware (this may take a few minutes)..." >> "$LOG"
if command -v clamscan >/dev/null 2>&1; then
    SCAN_OUTPUT=$(clamscan --recursive --infected --max-filesize=500M --max-scansize=1000M "$FOUND_SRC" 2>&1)
    SCAN_EXIT=$?
    
    if [ $SCAN_EXIT -eq 0 ]; then
        echo "$(date): Malware scan complete - No threats detected" >> "$LOG"
    elif [ $SCAN_EXIT -eq 1 ]; then
        echo "$(date): SECURITY ALERT - MALWARE DETECTED! Aborting sync." >> "$LOG"
        echo "$SCAN_OUTPUT" >> "$LOG"
        exit 1
    else
        echo "$(date): WARNING - Malware scan encountered errors but continuing" >> "$LOG"
        echo "$SCAN_OUTPUT" >> "$LOG"
    fi
else
    echo "$(date): WARNING - ClamAV not available, skipping malware scan" >> "$LOG"
fi

# Security: Check available disk space before sync
USB_SIZE=$(du -sb "$FOUND_SRC" 2>/dev/null | cut -f1)
NAS_FREE=$(df -B1 "$DEST_ROOT" 2>/dev/null | tail -1 | awk '\''{print $4}'\'')

if [ -n "$USB_SIZE" ] && [ -n "$NAS_FREE" ]; then
    # Add 10% buffer for safety
    REQUIRED_SPACE=$((USB_SIZE + USB_SIZE / 10))
    if [ "$REQUIRED_SPACE" -gt "$NAS_FREE" ]; then
        echo "$(date): ERROR - Insufficient disk space on NAS" >> "$LOG"
        echo "Required: $(numfmt --to=iec "$REQUIRED_SPACE") | Available: $(numfmt --to=iec "$NAS_FREE")" >> "$LOG"
        exit 1
    fi
    echo "$(date): Disk space check passed - USB: $(numfmt --to=iec "$USB_SIZE") | NAS Free: $(numfmt --to=iec "$NAS_FREE")" >> "$LOG"
fi

# DoS Protection: Check file count and directory depth
MAX_FILES=50000
MAX_DEPTH=10

echo "$(date): Running DoS protection checks..." >> "$LOG"

# Count total files on USB (excluding . and ..)
FILE_COUNT=$(find "$FOUND_SRC" -type f 2>/dev/null | wc -l)
if [ "$FILE_COUNT" -gt "$MAX_FILES" ]; then
    echo "$(date): ERROR - Too many files detected: $FILE_COUNT (max: $MAX_FILES)" >> "$LOG"
    echo "This may be a malicious USB device attempting a DoS attack." >> "$LOG"
    exit 1
fi
echo "$(date): File count check passed: $FILE_COUNT files" >> "$LOG"

# Check maximum directory depth
CURRENT_DEPTH=$(find "$FOUND_SRC" -type d -printf '%d\n' 2>/dev/null | sort -rn | head -n 1)
if [ -n "$CURRENT_DEPTH" ] && [ "$CURRENT_DEPTH" -gt "$MAX_DEPTH" ]; then
    echo "$(date): ERROR - Directory depth too deep: $CURRENT_DEPTH levels (max: $MAX_DEPTH)" >> "$LOG"
    echo "This may be a malicious USB device with deeply nested directories." >> "$LOG"
    exit 1
fi
echo "$(date): Directory depth check passed: ${CURRENT_DEPTH:-0} levels" >> "$LOG"

# Check if NAS already has Anime, Movies, and Series folders at root level
# If all three exist, use NAS root directly (no Media parent folder needed)
HAS_ANIME=$(find "$DEST_ROOT" -maxdepth 1 -type d -iname "Anime" 2>/dev/null | head -n 1)
HAS_MOVIES=$(find "$DEST_ROOT" -maxdepth 1 -type d -iname "Movies" 2>/dev/null | head -n 1)
HAS_SERIES=$(find "$DEST_ROOT" -maxdepth 1 -type d -iname "Series" 2>/dev/null | head -n 1)

if [ -n "$HAS_ANIME" ] && [ -n "$HAS_MOVIES" ] && [ -n "$HAS_SERIES" ]; then
    echo "Detected existing Anime, Movies, Series folders at NAS root. Using direct structure." >> "$LOG"
    DEST_BASE="$DEST_ROOT"
    USE_DIRECT_STRUCTURE=true
else
    # Check if destination NAS has a Media folder (case-insensitive)
    DEST_MEDIA=$(find "$DEST_ROOT" -maxdepth 1 -type d -iname "Media" 2>/dev/null | head -n 1)
    
    if [ -n "$DEST_MEDIA" ]; then
        echo "Using existing Media folder on NAS: $DEST_MEDIA" >> "$LOG"
        DEST_BASE="$DEST_MEDIA"
    else
        echo "Creating new Media folder on NAS: $DEST_ROOT/Media" >> "$LOG"
        mkdir -p "$DEST_ROOT/Media"
        chmod 755 "$DEST_ROOT/Media"
        DEST_BASE="$DEST_ROOT/Media"
    fi
    USE_DIRECT_STRUCTURE=false
fi

sync_folder() {
    FOLDER_NAME=$1
    SRC_SUB=$(find "$FOUND_SRC" -maxdepth 1 -type d -iname "$FOLDER_NAME" 2>/dev/null | head -n 1)
    
    # Use case-insensitive search for destination folder
    if [ "$USE_DIRECT_STRUCTURE" = true ]; then
        DST_FOLDER=$(find "$DEST_BASE" -maxdepth 1 -type d -iname "$FOLDER_NAME" 2>/dev/null | head -n 1)
        DST_PATH="$DST_FOLDER"
    else
        DST_PATH="$DEST_BASE/$FOLDER_NAME"
    fi

    if [ -n "$SRC_SUB" ]; then
        # Check if folder has any content
        if [ -z "$(ls -A "$SRC_SUB" 2>/dev/null)" ]; then
            echo "Skipped: $FOLDER_NAME is empty." >> "$LOG"
            return 0
        fi
        
        echo "Syncing $SRC_SUB -> $DST_PATH" >> "$LOG"
        echo "SYNC_START:$FOLDER_NAME" >> "$LOG"

        # Use verbose mode with progress - shows filenames AND transfer stats
        # Security: --safe-links prevents symlink attacks, --no-specials/--no-devices prevent device file exploits
        # DoS Protection: --timeout=7200 (2 hours) prevents indefinite hangs
        stdbuf -oL rsync -rvh -W --inplace --progress --ignore-existing \
            --safe-links --no-specials --no-devices --timeout=7200 \
            "$SRC_SUB/" "$DST_PATH/" 2>&1 | \
            stdbuf -oL tr '\''\r'\'' '\''\n'\'' | \
            stdbuf -oL grep -v '\''^$'\'' >> "$LOG"

        echo "SYNC_END:$FOLDER_NAME" >> "$LOG"
    else
        echo "Skipped: $FOLDER_NAME not found inside Media folder." >> "$LOG"
    fi
}

sync_folder "Movies"
sync_folder "Series"
sync_folder "Anime"

echo "$(date): Ingest Complete." >> "$LOG"
EOFSCRIPT'
    fi
    
    pct exec $CTID -- chmod +x /usr/local/bin/ingest-media.sh
    msg_ok "Ingest script deployed"
}

################################################################################
# Phase 4: Dashboard Deployment
################################################################################
deploy_dashboard() {
    echo -e "\n${BL}[Phase 4]${CL} Dashboard Deployment\n"
    
    msg_info "Creating application directory"
    pct exec $CTID -- mkdir -p /opt/dashboard
    msg_ok "Directory created"
    
    # Check if we can clone from git
    REPO_URL="http://192.168.1.14:3000/spooky/mediaingestDashboard.git"
    msg_info "Cloning dashboard repository"
    
    if pct exec $CTID -- bash -c "cd /opt/dashboard && git clone http://192.168.1.14:3000/spooky/mediaingestDashboard.git . 2>/dev/null"; then
        msg_ok "Repository cloned"
    else
        msg_warn "Git clone failed, deploying files manually"
        
        # Deploy server.js
        if [ -f "$(dirname "$0")/server.js" ]; then
            pct push $CTID "$(dirname "$0")/server.js" /opt/dashboard/server.js
            pct push $CTID "$(dirname "$0")/package.json" /opt/dashboard/package.json
        fi
        
        # Deploy client files
        if [ -d "$(dirname "$0")/client" ]; then
            pct exec $CTID -- mkdir -p /opt/dashboard/client/src
            pct push $CTID "$(dirname "$0")/client/package.json" /opt/dashboard/client/package.json
            pct push $CTID "$(dirname "$0")/client/index.html" /opt/dashboard/client/index.html
            pct push $CTID "$(dirname "$0")/client/vite.config.js" /opt/dashboard/client/vite.config.js
            pct push $CTID "$(dirname "$0")/client/tailwind.config.js" /opt/dashboard/client/tailwind.config.js
            pct push $CTID "$(dirname "$0")/client/postcss.config.js" /opt/dashboard/client/postcss.config.js
            pct push $CTID "$(dirname "$0")/client/src/App.jsx" /opt/dashboard/client/src/App.jsx
            pct push $CTID "$(dirname "$0")/client/src/main.jsx" /opt/dashboard/client/src/main.jsx
            pct push $CTID "$(dirname "$0")/client/src/index.css" /opt/dashboard/client/src/index.css
        fi
        msg_ok "Files deployed manually"
    fi
    
    msg_info "Installing backend dependencies"
    pct exec $CTID -- bash -c "cd /opt/dashboard && npm install --silent" >/dev/null 2>&1
    msg_ok "Backend dependencies installed"
    
    msg_info "Installing security packages (authentication and rate limiting)"
    pct exec $CTID -- bash -c "cd /opt/dashboard && npm install express-basic-auth express-rate-limit --silent" >/dev/null 2>&1
    msg_ok "Security packages installed"
    
    msg_info "Building frontend"
    pct exec $CTID -- bash -c "cd /opt/dashboard/client && npm install --silent && npm run build" >/dev/null 2>&1
    msg_ok "Frontend built"
    
    msg_info "Creating systemd service"
    
    # Generate secure random password for dashboard
    DASHBOARD_PASSWORD=$(openssl rand -base64 24)
    
    pct exec $CTID -- bash -c 'cat > /etc/systemd/system/ingest-dashboard.service << '\''EOF'\''
[Unit]
Description=Media Ingest Dashboard
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/dashboard
ExecStart=/usr/bin/node /opt/dashboard/server.js
Restart=always
RestartSec=10
Environment="NODE_ENV=production"
Environment="DASHBOARD_PASSWORD='"$DASHBOARD_PASSWORD"'"

[Install]
WantedBy=multi-user.target
EOF'
    msg_ok "Systemd service created"
    
    msg_info "Enabling and starting dashboard service"
    pct exec $CTID -- systemctl daemon-reload
    pct exec $CTID -- systemctl enable ingest-dashboard.service >/dev/null 2>&1
    pct exec $CTID -- systemctl start ingest-dashboard.service
    sleep 3
    msg_ok "Dashboard service started"
}

################################################################################
# Final Summary
################################################################################
show_summary() {
    # Get container IP
    local CT_IP=$(pct exec $CTID -- hostname -I | awk '{print $1}')
    
    clear
    header_info
    
    echo -e "\n${GN}════════════════════════════════════════════════════════════════${CL}"
    echo -e "${GN}               Installation Complete! 🎉${CL}"
    echo -e "${GN}════════════════════════════════════════════════════════════════${CL}"
    echo -e "${BL}                  Developed by Spooky Funck${CL}"
    echo -e "${GN}════════════════════════════════════════════════════════════════${CL}\n"
    
    echo -e "${BL}Container Information:${CL}"
    echo -e "  ID: ${GN}$CTID${CL}"
    echo -e "  Name: ${GN}$CT_NAME${CL}"
    echo -e "  IP: ${GN}$CT_IP${CL}"
    
    echo -e "\n${BL}LXC Login Credentials:${CL}"
    echo -e "  Username: ${GN}root${CL}"
    echo -e "  Password: ${GN}${CT_PASSWORD}${CL}"
    echo -e "  SSH: ${YW}ssh root@$CT_IP${CL}"
    echo -e "  ${YW}⚠ Save this password - it cannot be recovered!${CL}"
    
    echo -e "\n${BL}Dashboard Access:${CL}"
    echo -e "  URL: ${GN}http://$CT_IP:3000${CL}"
    echo -e "  Username: ${GN}admin${CL}"
    echo -e "  Password: ${GN}${DASHBOARD_PASSWORD}${CL}"
    echo -e "  ${YW}⚠ Save these credentials - they cannot be recovered!${CL}"
    
    echo -e "\n${BL}Mount Points:${CL}"
    echo -e "  USB: ${GN}/media/usb-ingest${CL}"
    echo -e "  NAS: ${GN}/media/nas${CL}"
    
    echo -e "\n${BL}System Verification:${CL}"
    # Check udev rule
    if [ -f /etc/udev/rules.d/99-usb-ingest.rules ]; then
        echo -e "  USB Detection: ${GN}✓ Active${CL}"
    else
        echo -e "  USB Detection: ${RD}✗ Missing udev rule${CL}"
    fi
    
    # Check trigger script
    if [ -x /usr/local/bin/usb-trigger.sh ]; then
        echo -e "  USB Trigger:   ${GN}✓ Installed${CL}"
    else
        echo -e "  USB Trigger:   ${RD}✗ Missing script${CL}"
    fi
    
    # Check dashboard service
    if pct exec $CTID -- systemctl is-active --quiet ingest-dashboard 2>/dev/null; then
        echo -e "  Dashboard:     ${GN}✓ Running${CL}"
    else
        echo -e "  Dashboard:     ${YW}⚠ Check service${CL}"
    fi
    
    echo -e "\n${BL}Useful Commands:${CL}"
    echo -e "  Access container:  ${YW}pct enter $CTID${CL}"
    echo -e "  View host logs:    ${YW}tail -f /var/log/usb-trigger.log${CL}"
    echo -e "  View ingest logs:  ${YW}pct exec $CTID -- tail -f /var/log/media-ingest.log${CL}"
    echo -e "  Service status:    ${YW}pct exec $CTID -- systemctl status ingest-dashboard${CL}"
    echo -e "  Restart service:   ${YW}pct exec $CTID -- systemctl restart ingest-dashboard${CL}"
    
    echo -e "\n${BL}Next Steps:${CL}"
    echo -e "  1. Access the dashboard at http://$CT_IP:3000"
    echo -e "  2. Plug in a USB drive with a 'Media' folder"
    echo -e "  3. Watch the magic happen! ✨"
    
    echo -e "\n${GN}════════════════════════════════════════════════════════════════${CL}\n"
}

################################################################################
# Main Execution (Zero-Touch)
################################################################################
main() {
    header_info
    echo -e "\n${GN}═══════════════════════════════════════════════════════════════${CL}"
    echo -e "${GN}          Select Your NAS Destination (One-Time Setup)         ${CL}"
    echo -e "${GN}═══════════════════════════════════════════════════════════════${CL}\n"
    sleep 2
    
    # Validation
    check_root
    check_proxmox
    
    # NAS Destination Selection (ONLY user interaction)
    select_nas_destination
    
    echo -e "\n${GN}Starting automated installation...${CL}\n"
    sleep 2
    
    # Auto-Detection
    get_next_ctid
    detect_storage
    ensure_template
    
    # Phase 1: Host Setup
    setup_host_scripts
    
    # Phase 2: Container Creation
    create_container
    
    # Phase 3: Container Bootstrap
    bootstrap_container
    
    # Phase 4: Dashboard Deployment
    deploy_dashboard
    
    # Show Summary
    show_summary
}

# Cleanup on error
trap 'msg_error "Installation failed! Check the output above for errors."' ERR

# Run main function
main "$@"
