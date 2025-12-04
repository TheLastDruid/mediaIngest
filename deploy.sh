#!/bin/bash
# Local deployment script for Media Ingest Dashboard
# Run this after pulling from git on the server

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="mediaingest-dashboard"

echo "🚀 Building Media Ingest Dashboard..."

# Build the frontend
echo "📦 Building frontend..."
cd "$SCRIPT_DIR/client"
npm install
npm run build
cd "$SCRIPT_DIR"

# Install backend dependencies
echo "📥 Installing backend dependencies..."
npm install --production

# Create systemd service if it doesn't exist
if [ ! -f "/etc/systemd/system/$SERVICE_NAME.service" ]; then
  echo "⚙️  Creating systemd service..."
  sudo tee /etc/systemd/system/$SERVICE_NAME.service > /dev/null << EOF
[Unit]
Description=Media Ingest Dashboard
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$SCRIPT_DIR
ExecStart=$(which node) $SCRIPT_DIR/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF

  sudo systemctl daemon-reload
  sudo systemctl enable $SERVICE_NAME
fi

# Restart service
echo "🔄 Restarting service..."
sudo systemctl restart $SERVICE_NAME

# Check status
sleep 2
if sudo systemctl is-active --quiet $SERVICE_NAME; then
  echo ""
  echo "✅ Dashboard successfully deployed and running!"
  echo "📍 Access at: http://$(hostname -I | awk '{print $1}'):3000"
  echo ""
  echo "📊 Service status:"
  sudo systemctl status $SERVICE_NAME --no-pager -l
else
  echo ""
  echo "❌ Service failed to start. Check logs:"
  echo "   sudo journalctl -u $SERVICE_NAME -n 50"
  exit 1
fi
