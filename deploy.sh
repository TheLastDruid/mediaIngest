#!/bin/bash
# Deployment script for Media Ingest Dashboard on Debian server

set -e

SERVER_USER="root"
SERVER_HOST="192.168.1.24"
DEPLOY_PATH="/opt/mediaingest-dashboard"
SERVICE_NAME="mediaingest-dashboard"

echo "🚀 Deploying Media Ingest Dashboard to $SERVER_HOST..."

# Build the frontend
echo "📦 Building frontend..."
cd client
npm run build
cd ..

# Create deployment directory on server
echo "📁 Creating deployment directory..."
ssh $SERVER_USER@$SERVER_HOST "mkdir -p $DEPLOY_PATH"

# Copy files to server
echo "📤 Copying files to server..."
rsync -avz --exclude 'node_modules' --exclude 'client/node_modules' --exclude '.git' \
  --exclude 'client/src' --exclude 'client/public' \
  ./ $SERVER_USER@$SERVER_HOST:$DEPLOY_PATH/

# Install dependencies on server
echo "📥 Installing dependencies on server..."
ssh $SERVER_USER@$SERVER_HOST "cd $DEPLOY_PATH && npm install --production"

# Create systemd service
echo "⚙️  Creating systemd service..."
ssh $SERVER_USER@$SERVER_HOST "cat > /etc/systemd/system/$SERVICE_NAME.service" << 'EOF'
[Unit]
Description=Media Ingest Dashboard
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/mediaingest-dashboard
ExecStart=/usr/bin/node /opt/mediaingest-dashboard/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and start service
echo "🔄 Reloading systemd and starting service..."
ssh $SERVER_USER@$SERVER_HOST "systemctl daemon-reload && systemctl enable $SERVICE_NAME && systemctl restart $SERVICE_NAME"

# Check status
echo "✅ Deployment complete! Checking service status..."
ssh $SERVER_USER@$SERVER_HOST "systemctl status $SERVICE_NAME --no-pager"

echo ""
echo "🎉 Dashboard should be accessible at http://$SERVER_HOST:3000"
echo ""
echo "Useful commands:"
echo "  View logs: ssh $SERVER_USER@$SERVER_HOST 'journalctl -u $SERVICE_NAME -f'"
echo "  Restart: ssh $SERVER_USER@$SERVER_HOST 'systemctl restart $SERVICE_NAME'"
echo "  Stop: ssh $SERVER_USER@$SERVER_HOST 'systemctl stop $SERVICE_NAME'"
