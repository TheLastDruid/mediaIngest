#!/bin/bash

################################################################################
# Media Ingest Dashboard - Update Script
# Updates an existing installation to the latest version
################################################################################

set -e

# Colors for output
RD='\033[01;31m'
BL='\033[36m'
GN='\033[1;92m'
CL='\033[m'

msg_info() {
    echo -ne " ${BL}[INFO]${CL} $1..."
}

msg_ok() {
    echo -e "${GN} ✓${CL} ${GN}$1${CL}"
}

msg_error() {
    echo -e "${RD} ✗${CL} ${RD}$1${CL}"
}

echo -e "${BL}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${CL}"
echo -e "${BL}    Media Ingest Dashboard - Update${CL}"
echo -e "${BL}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${CL}"
echo ""

# Check if running inside container or on Proxmox host
if [ -f "/.dockerenv" ] || grep -q "lxc" /proc/1/cgroup 2>/dev/null; then
    # Running inside container
    msg_info "Detected container environment"
    msg_ok "Running update inside container"
    
    DASHBOARD_DIR="/opt/dashboard"
    BACKUP_DIR="/opt/dashboard.backup.$(date +%Y%m%d_%H%M%S)"
    
    # Backup current installation
    msg_info "Backing up current installation"
    cp -a "$DASHBOARD_DIR" "$BACKUP_DIR"
    msg_ok "Backup created at $BACKUP_DIR"
    
    # Download latest files
    msg_info "Downloading latest server.js"
    wget -qO /tmp/server.js https://raw.githubusercontent.com/TheLastDruid/mediaIngest/main/server.js
    msg_ok "Downloaded server.js"
    
    msg_info "Downloading latest version.json"
    wget -qO /tmp/version.json https://raw.githubusercontent.com/TheLastDruid/mediaIngest/main/version.json
    msg_ok "Downloaded version.json"
    
    # Update files (preserve node_modules and data files)
    msg_info "Updating server files"
    cp /tmp/server.js "$DASHBOARD_DIR/server.js"
    cp /tmp/version.json "$DASHBOARD_DIR/version.json"
    msg_ok "Server files updated"
    
    # Download and update client build
    msg_info "Downloading latest client build"
    cd /tmp
    wget -q https://github.com/TheLastDruid/mediaIngest/archive/refs/heads/main.zip
    unzip -q main.zip
    msg_ok "Client build downloaded"
    
    msg_info "Building client"
    cd mediaIngest-main/client
    npm install --production --silent
    npm run build --silent
    msg_ok "Client built"
    
    msg_info "Updating client files"
    rm -rf "$DASHBOARD_DIR/client/dist"
    cp -r dist "$DASHBOARD_DIR/client/"
    msg_ok "Client files updated"
    
    # Cleanup
    rm -rf /tmp/mediaIngest-main /tmp/main.zip /tmp/server.js /tmp/version.json
    
    # Restart service
    msg_info "Restarting dashboard service"
    systemctl restart ingest-dashboard
    sleep 2
    msg_ok "Service restarted"
    
    # Verify service is running
    if systemctl is-active --quiet ingest-dashboard; then
        NEW_VERSION=$(cat "$DASHBOARD_DIR/version.json" | grep -oP '"version":\s*"\K[^"]+')
        echo ""
        echo -e "${GN}✓ Update completed successfully!${CL}"
        echo -e "  Version: ${BL}${NEW_VERSION}${CL}"
        echo -e "  Backup: ${BACKUP_DIR}"
        echo ""
        echo -e "To rollback if needed: cp -a ${BACKUP_DIR}/* ${DASHBOARD_DIR}/ && systemctl restart ingest-dashboard"
    else
        msg_error "Service failed to start - rolling back"
        cp -a "$BACKUP_DIR"/* "$DASHBOARD_DIR"/
        systemctl restart ingest-dashboard
        exit 1
    fi
    
else
    # Running on Proxmox host - need to execute inside container
    msg_info "Detected Proxmox host environment"
    msg_ok "Will update container"
    
    # Find the media-ingest container
    CTID=$(pct list | grep -i "media-ingest" | awk '{print $1}')
    
    if [ -z "$CTID" ]; then
        msg_error "Could not find media-ingest container"
        echo "Available containers:"
        pct list
        exit 1
    fi
    
    msg_info "Found container ID: $CTID"
    msg_ok "Container identified"
    
    # Download update script to container and execute it
    msg_info "Downloading update script to container"
    wget -qO /tmp/update-container.sh https://raw.githubusercontent.com/TheLastDruid/mediaIngest/main/update.sh
    pct push "$CTID" /tmp/update-container.sh /tmp/update.sh
    msg_ok "Update script pushed to container"
    
    msg_info "Executing update inside container $CTID"
    echo ""
    pct exec "$CTID" -- bash /tmp/update.sh
    
    # Cleanup
    rm -f /tmp/update-container.sh
    pct exec "$CTID" -- rm -f /tmp/update.sh
fi

echo ""
echo -e "${BL}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${CL}"
