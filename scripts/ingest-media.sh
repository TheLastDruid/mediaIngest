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
