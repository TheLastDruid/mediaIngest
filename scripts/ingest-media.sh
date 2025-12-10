#!/bin/bash

SEARCH_ROOT="/media/usb-ingest"
DEST_ROOT="/media/nas"
LOG="/var/log/media-ingest.log"
STATUS_FILE="/run/ingest/status.json"

# Ensure status directory exists
mkdir -p /run/ingest

# Error trap function - catches script crashes and logs failure
error_trap() {
    local exit_code=$?
    local line_number=$1
    echo "$(date): ERROR - Script crashed at line $line_number with exit code $exit_code" >> "$LOG"
    
    # Write error status to JSON file for dashboard
    cat > "$STATUS_FILE" << EOF
{
  "status": "error",
  "timestamp": "$(date -Iseconds)",
  "error_code": $exit_code,
  "error_line": $line_number,
  "message": "Script crashed unexpectedly"
}
EOF
    exit $exit_code
}

# Set up trap to catch errors
trap 'error_trap $LINENO' ERR
set -E  # Inherit ERR trap in functions
set -o pipefail  # Catch errors in pipelines

# Write initial status - script is running
cat > "$STATUS_FILE" << EOF
{
  "status": "running",
  "timestamp": "$(date -Iseconds)",
  "message": "Scanning for Media folder"
}
EOF

echo "========================================" >> "$LOG"
echo "$(date): New Drive Detected. Scanning for Media folder..." >> "$LOG"

FOUND_SRC=$(find "$SEARCH_ROOT" -maxdepth 3 -type d -iname "Media" | head -n 1)

if [ -z "$FOUND_SRC" ]; then
    echo "Analysis: No Media folder found on this drive. Exiting." >> "$LOG"
    ls -F "$SEARCH_ROOT" >> "$LOG" 2>&1
    
    # Write completed status - no media found
    cat > "$STATUS_FILE" << EOF
{
  "status": "completed",
  "timestamp": "$(date -Iseconds)",
  "message": "No Media folder found on drive"
}
EOF
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
        
        # Update status for current folder
        cat > "$STATUS_FILE" << EOF
{
  "status": "running",
  "timestamp": "$(date -Iseconds)",
  "current_folder": "$FOLDER_NAME",
  "message": "Syncing $FOLDER_NAME"
}
EOF

        # Use stdbuf -oL to force line-buffered output for real-time logging
        stdbuf -oL rsync -rvh -W --inplace --progress --ignore-existing "$SRC_SUB/" "$DST_PATH/" 2>&1 | stdbuf -oL tr '\r' '\n' >> "$LOG"

        echo "SYNC_END:$FOLDER_NAME" >> "$LOG"
    else
        echo "Skipped: $FOLDER_NAME not found inside Media folder." >> "$LOG"
    fi
}

sync_folder "Movies"
sync_folder "Series"
sync_folder "Anime"

echo "$(date): Ingest Complete." >> "$LOG"

# Write success status
cat > "$STATUS_FILE" << EOF
{
  "status": "completed",
  "timestamp": "$(date -Iseconds)",
  "message": "Ingest completed successfully"
}
EOF
