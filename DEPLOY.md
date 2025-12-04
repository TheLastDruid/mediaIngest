# Deployment Guide - Media Ingest Dashboard

## Quick Deploy to Debian Server

### Prerequisites on Server
- Node.js installed (v18+ recommended)
- systemd for service management
- Read access to `/var/log/media-ingest.log`

### Option 1: Automated Deployment (Recommended)

1. Build the frontend locally:
```bash
cd /home/spooky/Desktop/copyMontior/client
npm install
npm run build
```

2. Run the deployment script:
```bash
cd /home/spooky/Desktop/copyMontior
chmod +x deploy.sh
./deploy.sh
```

The script will:
- Build the frontend
- Copy files to `/opt/mediaingest-dashboard` on server
- Install dependencies
- Create systemd service
- Start the dashboard

### Option 2: Manual Deployment

1. **Build frontend locally:**
```bash
cd client
npm install
npm run build
cd ..
```

2. **Copy files to server:**
```bash
rsync -avz --exclude 'node_modules' --exclude 'client/node_modules' --exclude '.git' \
  ./ root@192.168.1.24:/opt/mediaingest-dashboard/
```

3. **SSH into server and install:**
```bash
ssh root@192.168.1.24
cd /opt/mediaingest-dashboard
npm install --production
```

4. **Create systemd service:**
```bash
sudo nano /etc/systemd/system/mediaingest-dashboard.service
```

Paste this content:
```ini
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
```

5. **Enable and start service:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable mediaingest-dashboard
sudo systemctl start mediaingest-dashboard
```

6. **Check status:**
```bash
sudo systemctl status mediaingest-dashboard
```

### Access Dashboard
Open browser to: `http://192.168.1.24:3000`

### Management Commands

**View logs:**
```bash
journalctl -u mediaingest-dashboard -f
```

**Restart service:**
```bash
systemctl restart mediaingest-dashboard
```

**Stop service:**
```bash
systemctl stop mediaingest-dashboard
```

**Check status:**
```bash
systemctl status mediaingest-dashboard
```

### Updating the Application

Run the deployment script again:
```bash
./deploy.sh
```

Or manually:
```bash
# On local machine
cd client && npm run build && cd ..
rsync -avz --exclude 'node_modules' ./ root@192.168.1.24:/opt/mediaingest-dashboard/

# On server
ssh root@192.168.1.24
systemctl restart mediaingest-dashboard
```

### Nginx Reverse Proxy (Optional)

If you want to serve on port 80 with a domain:

```nginx
server {
    listen 80;
    server_name mediaingest.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### Troubleshooting

**Service won't start:**
```bash
journalctl -u mediaingest-dashboard -n 50
```

**Log file permissions:**
```bash
# Ensure Node process can read the log file
chmod 644 /var/log/media-ingest.log
```

**Port already in use:**
```bash
# Change PORT in systemd service file
sudo nano /etc/systemd/system/mediaingest-dashboard.service
# Add: Environment=PORT=3001
sudo systemctl daemon-reload
sudo systemctl restart mediaingest-dashboard
```
