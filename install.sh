#!/bin/bash

################################################################################
# Media Ingest System - Zero-Touch Installer
# 
# Completely automated deployment with NO user prompts
# Just run and walk away!
#
# Features:
# - Auto-detects next available container ID
# - Auto-selects storage pool
# - Auto-downloads templates if needed
# - Configures everything silently
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
CT_PASSWORD="mediaingest123"  # Change this if needed
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
        TEMPLATE=$(pveam list local | grep "debian-12" | head -1 | awk '{print $2}')
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
    TEMPLATE=$(pveam available | grep "debian-12-standard" | grep "amd64" | tail -1 | awk '{print $2}')
    
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

prepare_nas_path() {
    msg_info "Checking NAS mount path"
    
    if [ -d "$NAS_HOST_PATH" ]; then
        msg_ok "NAS path exists: $NAS_HOST_PATH"
    else
        msg_warn "NAS path not found, creating placeholder"
        mkdir -p "$NAS_HOST_PATH"
        msg_ok "Created: $NAS_HOST_PATH"
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

DEVICE=$1
HOST_MOUNT="/mnt/usb-pass"
LXC_ID="__LXC_ID__"

# Safety Check
if [ -z "$DEVICE" ]; then 
    echo "$(date): ERROR - No device specified" >> /var/log/usb-trigger.log
    exit 1
fi

echo "$(date): USB Device Detected: $DEVICE" >> /var/log/usb-trigger.log

# Create mount point if needed
mkdir -p "$HOST_MOUNT"

# Mount on Proxmox host
mount -t ntfs3 -o noatime "$DEVICE" "$HOST_MOUNT" 2>/dev/null

# Fallback to standard mount if ntfs3 fails
if [ $? -ne 0 ]; then
    echo "$(date): ntfs3 failed, trying standard mount..." >> /var/log/usb-trigger.log
    mount "$DEVICE" "$HOST_MOUNT" 2>/dev/null
fi

# Verify Mount
if ! mount | grep -q "$HOST_MOUNT"; then
    echo "$(date): ERROR - Failed to mount $DEVICE" >> /var/log/usb-trigger.log
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

echo "$(date): Complete. Drive unmounted." >> /var/log/usb-trigger.log
EOFSCRIPT
    
    chmod +x /usr/local/bin/usb-trigger.sh
    msg_ok "USB trigger script created"
    
    msg_info "Creating mount point"
    mkdir -p /mnt/usb-pass
    msg_ok "Mount point /mnt/usb-pass created"
    
    msg_info "Setting up udev rules"
    cat > /etc/udev/rules.d/99-ingest.rules << 'EOF'
ACTION=="add", SUBSYSTEMS=="usb", KERNEL=="sd[a-z]", SUBSYSTEM=="block", ENV{DEVTYPE}=="disk", RUN+="/usr/bin/systemd-run --no-block --unit=media-ingest-%k /usr/local/bin/usb-trigger.sh /dev/%k"
EOF
    
    udevadm control --reload-rules
    udevadm trigger
    msg_ok "udev rules configured"
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
    
    # Create container with DHCP network (using auto-detected template)
    pct create $CTID local:vztmpl/$TEMPLATE \
        --hostname $CT_NAME \
        --password "$CT_PASSWORD" \
        --cores $CT_CORES \
        --memory $CT_MEMORY \
        --swap $CT_SWAP \
        --rootfs $STORAGE:$CT_DISK \
        --net0 name=eth0,bridge=vmbr0,firewall=1,ip=dhcp \
        --features nesting=1,fuse=1 \
        --unprivileged 0 \
        --onboot 1 \
        --start 0 >/dev/null 2>&1
    
    msg_ok "Container $CTID created"
    
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
    
    msg_info "Installing Node.js 18.x"
    pct exec $CTID -- bash -c "curl -fsSL https://deb.nodesource.com/setup_18.x | bash - >/dev/null 2>&1"
    pct exec $CTID -- bash -c "apt-get install -y -qq nodejs" >/dev/null 2>&1
    msg_ok "Node.js installed"
    
    msg_info "Creating log file"
    pct exec $CTID -- bash -c "touch /var/log/media-ingest.log && chmod 644 /var/log/media-ingest.log"
    msg_ok "Log file created"
    
    msg_info "Deploying ingest script"
    pct push $CTID "$(dirname "$0")/scripts/ingest-media.sh" /usr/local/bin/ingest-media.sh 2>/dev/null || \
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

sync_folder() {
    FOLDER_NAME=$1
    SRC_SUB=$(find "$FOUND_SRC" -maxdepth 1 -type d -iname "$FOLDER_NAME" 2>/dev/null | head -n 1)
    DST_PATH="$DEST_ROOT/$FOLDER_NAME"

    if [ -n "$SRC_SUB" ]; then
        echo "Syncing $SRC_SUB -> $DST_PATH" >> "$LOG"
        echo "SYNC_START:$FOLDER_NAME" >> "$LOG"

        stdbuf -oL rsync -rvh -W --inplace --progress --ignore-existing "$SRC_SUB/" "$DST_PATH/" 2>&1 | tr '\''\r'\'' '\''\n'\'' >> "$LOG"

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
    
    msg_info "Building frontend"
    pct exec $CTID -- bash -c "cd /opt/dashboard/client && npm install --silent && npm run build" >/dev/null 2>&1
    msg_ok "Frontend built"
    
    msg_info "Creating systemd service"
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
    echo -e "${GN}════════════════════════════════════════════════════════════════${CL}\n"
    
    echo -e "${BL}Container Information:${CL}"
    echo -e "  ID: ${GN}$CTID${CL}"
    echo -e "  Name: ${GN}$CT_NAME${CL}"
    echo -e "  IP: ${GN}$CT_IP${CL}"
    
    echo -e "\n${BL}Dashboard Access:${CL}"
    echo -e "  ${GN}http://$CT_IP:3000${CL}"
    
    echo -e "\n${BL}Mount Points:${CL}"
    echo -e "  USB: ${GN}/media/usb-ingest${CL}"
    echo -e "  NAS: ${GN}/media/nas${CL}"
    
    echo -e "\n${BL}Useful Commands:${CL}"
    echo -e "  Access container:  ${YW}pct enter $CTID${CL}"
    echo -e "  View logs:         ${YW}pct exec $CTID -- tail -f /var/log/media-ingest.log${CL}"
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
    echo -e "${GN}        Zero-Touch Installation - No User Input Required        ${CL}"
    echo -e "${GN}═══════════════════════════════════════════════════════════════${CL}\n"
    sleep 2
    
    # Validation
    check_root
    check_proxmox
    
    # Auto-Detection
    get_next_ctid
    detect_storage
    ensure_template
    prepare_nas_path
    
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

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Banner
show_banner() {
    clear
    echo -e "${BLUE}"
    cat << "EOF"
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║      Media Ingest System - Automated Installer       ║
║                                                       ║
║      USB → Proxmox → LXC → NAS Automation            ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

# Detect system type
detect_system() {
    log_info "Detecting system type..."
    
    if [ -f /etc/pve/.version ]; then
        SYSTEM_TYPE="proxmox"
        log_success "Detected: Proxmox VE Host"
    elif [ -f /etc/debian_version ] && ! [ -f /etc/pve/.version ]; then
        if systemd-detect-virt -c &>/dev/null; then
            SYSTEM_TYPE="lxc"
            log_success "Detected: LXC Container"
        else
            SYSTEM_TYPE="debian"
            log_success "Detected: Debian/Ubuntu System"
        fi
    else
        log_error "Unsupported system. This installer requires Proxmox VE or Debian/Ubuntu."
        exit 1
    fi
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    apt-get update -qq
    
    if [ "$SYSTEM_TYPE" = "proxmox" ]; then
        apt-get install -y -qq curl wget ntfs-3g
        log_success "Proxmox dependencies installed"
    elif [ "$SYSTEM_TYPE" = "lxc" ]; then
        apt-get install -y -qq curl wget git rsync ntfs-3g nodejs npm
        log_success "LXC dependencies installed"
    fi
}

# Proxmox Host Setup
setup_proxmox_host() {
    log_info "Setting up Proxmox host..."
    
    # Get LXC container ID
    echo ""
    read -p "Enter LXC Container ID (e.g., 105): " LXC_ID
    
    if [ -z "$LXC_ID" ]; then
        log_error "LXC ID cannot be empty"
        exit 1
    fi
    
    # Verify container exists
    if ! pct status "$LXC_ID" &>/dev/null; then
        log_error "LXC container $LXC_ID does not exist"
        exit 1
    fi
    
    log_info "Using LXC Container ID: $LXC_ID"
    
    # Create mount point
    mkdir -p /mnt/usb-pass
    log_success "Created USB mount point: /mnt/usb-pass"
    
    # Download usb-trigger.sh
    log_info "Downloading usb-trigger.sh script..."
    curl -sL "$REPO_URL/scripts/usb-trigger.sh" -o "$SCRIPTS_DIR/usb-trigger.sh"
    
    # Update LXC_ID in script
    sed -i "s/LXC_ID=\"105\"/LXC_ID=\"$LXC_ID\"/g" "$SCRIPTS_DIR/usb-trigger.sh"
    chmod +x "$SCRIPTS_DIR/usb-trigger.sh"
    log_success "Installed: $SCRIPTS_DIR/usb-trigger.sh"
    
    # Create udev rule
    log_info "Creating udev rule for USB detection..."
    cat > /etc/udev/rules.d/99-usb-media-ingest.rules << 'EOF'
# USB Media Ingest Trigger
ACTION=="add", KERNEL=="sd[a-z]", SUBSYSTEM=="block", ENV{DEVTYPE}=="disk", ENV{ID_BUS}=="usb", RUN+="/bin/bash -c \"/usr/bin/systemd-run --no-block --unit=media-ingest-$kernel-$(date +%%s) /usr/local/bin/usb-trigger.sh /dev/$kernel\""
EOF
    
    udevadm control --reload-rules
    udevadm trigger
    log_success "udev rule installed and activated"
    
    # Configure LXC bind mount
    log_info "Configuring LXC bind mount..."
    if ! grep -q "mp1.*usb-pass" /etc/pve/lxc/$LXC_ID.conf; then
        echo "mp1: /mnt/usb-pass,mp=/media/usb-ingest" >> /etc/pve/lxc/$LXC_ID.conf
        log_success "Added bind mount to LXC configuration"
    else
        log_warning "Bind mount already exists in LXC configuration"
    fi
    
    echo ""
    log_success "Proxmox host setup complete!"
    echo ""
    log_info "Next steps:"
    echo "  1. Run this installer inside LXC container $LXC_ID"
    echo "  2. Command: pct enter $LXC_ID"
    echo "  3. Then run: bash <(wget -qO- $REPO_URL/install.sh)"
    echo ""
}

# LXC Container Setup
setup_lxc_container() {
    log_info "Setting up LXC container..."
    
    # Create directories
    mkdir -p /root/ingestMonitor
    mkdir -p /media/usb-ingest
    mkdir -p /media/nas
    log_success "Created directories"
    
    # Install Node.js if not present
    if ! command -v node &>/dev/null; then
        log_info "Installing Node.js 18.x..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
        log_success "Node.js installed: $(node --version)"
    else
        log_success "Node.js already installed: $(node --version)"
    fi
    
    # Download ingest-media.sh
    log_info "Downloading ingest-media.sh script..."
    curl -sL "$REPO_URL/scripts/ingest-media.sh" -o "$SCRIPTS_DIR/ingest-media.sh"
    chmod +x "$SCRIPTS_DIR/ingest-media.sh"
    log_success "Installed: $SCRIPTS_DIR/ingest-media.sh"
    
    # Create log file
    touch /var/log/media-ingest.log
    log_success "Created log file: /var/log/media-ingest.log"
    
    # Clone or download dashboard
    log_info "Setting up dashboard application..."
    cd /root/ingestMonitor
    
    if [ -d "mediaingestDashboard" ]; then
        log_warning "Dashboard directory exists, updating..."
        cd mediaingestDashboard
        if [ -d ".git" ]; then
            git pull
        fi
    else
        log_info "Cloning dashboard repository..."
        # Try git clone first, fall back to downloading files
        if git clone https://github.com/YOUR_USERNAME/mediaingestDashboard.git 2>/dev/null; then
            cd mediaingestDashboard
        else
            log_warning "Git clone failed, downloading files manually..."
            mkdir -p mediaingestDashboard
            cd mediaingestDashboard
            
            # Download essential files
            curl -sL "$REPO_URL/server.js" -o server.js
            curl -sL "$REPO_URL/package.json" -o package.json
            
            mkdir -p client/src
            curl -sL "$REPO_URL/client/package.json" -o client/package.json
            curl -sL "$REPO_URL/client/index.html" -o client/index.html
            curl -sL "$REPO_URL/client/vite.config.js" -o client/vite.config.js
            curl -sL "$REPO_URL/client/tailwind.config.js" -o client/tailwind.config.js
            curl -sL "$REPO_URL/client/postcss.config.js" -o client/postcss.config.js
            curl -sL "$REPO_URL/client/src/App.jsx" -o client/src/App.jsx
            curl -sL "$REPO_URL/client/src/main.jsx" -o client/src/main.jsx
            curl -sL "$REPO_URL/client/src/index.css" -o client/src/index.css
        fi
    fi
    
    # Install backend dependencies
    log_info "Installing backend dependencies..."
    npm install --silent
    log_success "Backend dependencies installed"
    
    # Build frontend
    log_info "Building frontend..."
    cd client
    npm install --silent
    npm run build
    log_success "Frontend built successfully"
    cd ..
    
    # Create systemd service
    log_info "Creating systemd service..."
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
    
    systemctl daemon-reload
    systemctl enable mediaingest-dashboard.service
    systemctl start mediaingest-dashboard.service
    log_success "Dashboard service installed and started"
    
    # Check service status
    sleep 2
    if systemctl is-active --quiet mediaingest-dashboard.service; then
        log_success "Dashboard service is running!"
    else
        log_error "Dashboard service failed to start"
        log_info "Check logs with: journalctl -u mediaingest-dashboard.service -n 50"
    fi
    
    # Get IP address
    IP_ADDR=$(hostname -I | awk '{print $1}')
    
    echo ""
    log_success "LXC container setup complete!"
    echo ""
    log_info "Access your dashboard at:"
    echo -e "  ${GREEN}http://$IP_ADDR:3000${NC}"
    echo ""
    log_info "Useful commands:"
    echo "  - View logs: tail -f /var/log/media-ingest.log"
    echo "  - Service status: systemctl status mediaingest-dashboard.service"
    echo "  - Restart service: systemctl restart mediaingest-dashboard.service"
    echo ""
}

# Configuration wizard
configuration_wizard() {
    echo ""
    log_info "Would you like to configure mount points? (NAS path, USB path, folder names)"
    read -p "Configure now? [y/N]: " configure
    
    if [[ "$configure" =~ ^[Yy]$ ]]; then
        echo ""
        read -p "NAS mount path [/media/nas]: " nas_path
        nas_path=${nas_path:-/media/nas}
        
        read -p "USB mount path [/media/usb-ingest]: " usb_path
        usb_path=${usb_path:-/media/usb-ingest}
        
        log_info "Updating paths in ingest-media.sh..."
        sed -i "s|DEST_ROOT=\"/media/nas\"|DEST_ROOT=\"$nas_path\"|g" "$SCRIPTS_DIR/ingest-media.sh"
        sed -i "s|SEARCH_ROOT=\"/media/usb-ingest\"|SEARCH_ROOT=\"$usb_path\"|g" "$SCRIPTS_DIR/ingest-media.sh"
        
        log_success "Configuration updated"
        
        echo ""
        log_info "Default folder sync: Movies, Series, Anime"
        read -p "Add custom folders? (comma-separated, e.g., Documentaries,Music): " custom_folders
        
        if [ -n "$custom_folders" ]; then
            IFS=',' read -ra FOLDERS <<< "$custom_folders"
            for folder in "${FOLDERS[@]}"; do
                folder=$(echo "$folder" | xargs) # trim whitespace
                echo "sync_folder \"$folder\"" >> "$SCRIPTS_DIR/ingest-media.sh"
                log_success "Added folder: $folder"
            done
        fi
    fi
}

# Main installation
main() {
    show_banner
    
    # Check if running as root
    if [ "$EUID" -ne 0 ]; then
        log_error "This installer must be run as root"
        exit 1
    fi
    
    detect_system
    install_dependencies
    
    if [ "$SYSTEM_TYPE" = "proxmox" ]; then
        setup_proxmox_host
    elif [ "$SYSTEM_TYPE" = "lxc" ] || [ "$SYSTEM_TYPE" = "debian" ]; then
        setup_lxc_container
        configuration_wizard
    fi
    
    echo ""
    log_success "═══════════════════════════════════════════════════════"
    log_success "  Media Ingest System installation complete!"
    log_success "═══════════════════════════════════════════════════════"
    echo ""
}

# Run main function
main "$@"
