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
