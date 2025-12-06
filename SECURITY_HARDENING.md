# 🔐 Security Hardening Guide

**⚠️ IMPORTANT**: This tool is designed for **trusted home lab environments**. It is NOT recommended for production or internet-facing deployments without implementing the security measures outlined below.

---

## 🚨 Threat Model

This document addresses security concerns for the Proxmox USB Media Ingest Station. The tool runs with elevated privileges to access USB devices and NAS storage, which creates several attack vectors that need mitigation.

### Current Security Posture
- ✅ LXC containerization provides basic isolation
- ✅ Read-only operations on source media (USB drives)
- ❌ No authentication on dashboard
- ❌ Privileged container can escape to host
- ❌ No input validation on USB filesystem content
- ❌ Dashboard runs as root
- ❌ No rate limiting or DoS protection

---

## 🔴 Critical Risks (Immediate Action Required)

### 1. Privileged Container Exploitation

**Risk Level**: Critical (CVSS 9.8)

**Description**: The LXC container runs with `privileged=1`, granting it nearly full access to the host system. If an attacker compromises the dashboard or ingest scripts, they could escape the container and gain root access to the Proxmox host.

**Attack Vectors**:
- Compromise dashboard via unauthenticated API endpoints
- Exploit vulnerabilities in Node.js/Express dependencies
- Leverage bind mounts to access host filesystem
- Abuse kernel syscalls available to privileged containers

**Mitigation Steps**:

```bash
# Option 1: Convert to unprivileged container (RECOMMENDED)
# NOTE: Requires remapping UIDs/GIDs and adjusting NAS permissions
pct stop [CTID]
pct set [CTID] -unprivileged 1
# Configure UID/GID mapping in /etc/pve/lxc/[CTID].conf:
# lxc.idmap: u 0 100000 65536
# lxc.idmap: g 0 100000 65536

# Option 2: Add AppArmor profile for privileged container
cat > /etc/apparmor.d/lxc-media-ingest << 'EOF'
#include <tunables/global>
profile lxc-media-ingest flags=(attach_disconnected,mediate_deleted) {
  #include <abstractions/base>
  
  # Deny access to Proxmox host critical paths
  deny /proc/sysrq-trigger w,
  deny /sys/kernel/debug/** w,
  deny /boot/** rwx,
  deny /etc/shadow r,
  
  # Allow only necessary mounts
  /mnt/usb-pass/** rw,
  /media/nas/** rw,
  /var/log/media-ingest.log w,
  
  # Restrict network
  network inet stream,
  network inet6 stream,
  deny network inet dgram,
}
EOF

apparmor_parser -r /etc/apparmor.d/lxc-media-ingest
pct set [CTID] -features nesting=1,fuse=1,apparmor=lxc-media-ingest
```

**Status**: ⏳ Pending Implementation

---

### 2. Arbitrary Filesystem Access via Bind Mounts

**Risk Level**: Critical (CVSS 8.9)

**Description**: Bind mounts expose the host filesystem to the container. A malicious USB drive containing symlinks or path traversal sequences could read sensitive host files or overwrite system binaries.

**Attack Vectors**:
- USB drive with symlink to [`/etc/shadow`](/etc/shadow ) → read password hashes
- Filename like `../../../../etc/crontab` → overwrite scheduled tasks
- NTFS alternate data streams hiding malicious content
- Race condition in mount/unmount allowing file swap

**Mitigation Steps**:

```bash
# 1. Add path validation to usb-trigger.sh
cat >> /usr/local/bin/usb-trigger.sh << 'EOF'
# Validate device name contains only safe characters
if ! echo "$KERNEL_DEVICE" | grep -qE '^sd[a-z][0-9]*$'; then
    echo "$(date): ERROR - Invalid device name: $KERNEL_DEVICE" >> /var/log/usb-trigger.log
    exit 1
fi

# Verify mount point is empty and owned by root
if [ -n "$(ls -A $HOST_MOUNT 2>/dev/null)" ]; then
    echo "$(date): ERROR - Mount point not empty" >> /var/log/usb-trigger.log
    exit 1
fi
EOF

# 2. Update rsync to use safe options
# In ingest-media.sh, add:
# --safe-links (ignore symlinks pointing outside source tree)
# --no-specials --no-devices (don't copy special files)
sed -i 's/rsync -rvh/rsync -rvh --safe-links --no-specials --no-devices/' /usr/local/bin/ingest-media.sh

# 3. Mount with nodev,nosuid,noexec options
sed -i 's/mount -t ntfs3 -o noatime/mount -t ntfs3 -o noatime,nodev,nosuid,noexec/' /usr/local/bin/usb-trigger.sh
```

**Status**: ⏳ Pending Implementation

---

### 3. USB-Borne Malware Injection

**Risk Level**: High (CVSS 8.1)

**Description**: Auto-mounting USB drives from untrusted sources could introduce malware. While Linux is less vulnerable to Windows autorun exploits, risks still exist.

**Attack Vectors**:
- Malicious filenames executing shell commands (e.g., `$(rm -rf /)`)
- Exploits in ntfs3/ntfs-3g filesystem drivers (buffer overflow)
- Large files causing disk space exhaustion
- Zip bombs or decompression bombs in media files
- Executable files disguised with double extensions

**Mitigation Steps**:

```bash
# 1. Install ClamAV antivirus scanner
pct exec [CTID] -- bash << 'EOF'
apt-get update
apt-get install -y clamav clamav-daemon
freshclam
systemctl enable clamav-daemon
systemctl start clamav-daemon
EOF

# 2. Add virus scanning to ingest-media.sh
cat >> /usr/local/bin/ingest-media.sh << 'EOF'
# Scan USB content before sync
echo "$(date): Scanning for malware..." >> "$LOG"
clamscan --recursive --infected --remove=no "$FOUND_SRC" >> "$LOG" 2>&1
if [ $? -ne 0 ]; then
    echo "$(date): SECURITY ALERT - Malware detected! Aborting sync." >> "$LOG"
    exit 1
fi
EOF

# 3. Add filename sanitization
cat >> /usr/local/bin/ingest-media.sh << 'EOF'
# Check for suspicious filenames
find "$FOUND_SRC" -type f | while read file; do
    if echo "$file" | grep -qE '[\$\`\;\|\&\(\)\<\>]'; then
        echo "$(date): WARNING - Suspicious filename detected: $file" >> "$LOG"
        # Optional: skip file or abort
    fi
done
EOF

# 4. Add disk space check before sync
cat >> /usr/local/bin/ingest-media.sh << 'EOF'
USB_SIZE=$(du -sb "$FOUND_SRC" | cut -f1)
NAS_FREE=$(df -B1 "$DEST_ROOT" | tail -1 | awk '{print $4}')
if [ "$USB_SIZE" -gt "$NAS_FREE" ]; then
    echo "$(date): ERROR - Insufficient disk space on NAS" >> "$LOG"
    exit 1
fi
EOF
```

**Status**: ⏳ Pending Implementation

---

### 4. Remote Code Execution via Dashboard API

**Risk Level**: High (CVSS 7.5)

**Description**: The Express.js dashboard exposes API endpoints without authentication. An attacker on the local network could exploit these endpoints to inject malicious data or trigger unintended operations.

**Attack Vectors**:
- `/api/status` parses log files → log injection attack
- `/api/history` returns unsanitized filenames → XSS in frontend
- `/api/abort` kills rsync → DoS attack
- Server-Sent Events could be flooded → memory exhaustion
- No CSRF protection on POST endpoints

**Mitigation Steps**:

```bash
# 1. Add HTTP Basic Authentication
pct exec [CTID] -- bash << 'EOF'
npm install express-basic-auth
cat >> /opt/media-ingest/server.js << 'EOFJS'
const basicAuth = require('express-basic-auth');

// Add before other routes
app.use(basicAuth({
  users: { 'admin': process.env.DASHBOARD_PASSWORD || 'changeme123' },
  challenge: true,
  realm: 'Media Ingest Dashboard'
}));
EOFJS

# Set secure password in environment
echo "DASHBOARD_PASSWORD=$(openssl rand -base64 32)" >> /etc/environment
EOF

# 2. Add rate limiting
pct exec [CTID] -- bash << 'EOF'
npm install express-rate-limit
cat >> /opt/media-ingest/server.js << 'EOFJS'
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many requests from this IP'
});

app.use('/api/', limiter);
EOFJS
EOF

# 3. Sanitize log parsing in server.js
cat >> /opt/media-ingest/server.js << 'EOFJS'
function sanitizeLogLine(line) {
  // Remove potential injection sequences
  return line
    .replace(/[<>"'&]/g, '') // HTML entities
    .replace(/[\x00-\x1F\x7F]/g, '') // Control characters
    .substring(0, 1000); // Limit length
}
EOFJS

# 4. Add CORS restrictions
cat >> /opt/media-ingest/server.js << 'EOFJS'
app.use(cors({
  origin: ['http://192.168.1.0/24'], // Only allow local network
  credentials: true
}));
EOFJS
```

**Status**: ⏳ Pending Implementation

---

## 🟡 Medium Risks (Should Be Addressed)

### 5. Unauthenticated Dashboard Access

**Risk Level**: Medium (CVSS 6.5)

**Description**: Anyone on the local network can access the dashboard at `http://[IP]:3000` without credentials, exposing transfer history, NAS capacity, and real-time sync progress.

**Privacy Concerns**:
- File names reveal media library content
- Storage stats expose NAS capacity
- Transfer history shows user activity patterns
- Real-time progress leaks USB insertion times

**Mitigation Steps**:

```bash
# Option 1: Implement covered in Risk #4 (HTTP Basic Auth)

# Option 2: Firewall restriction to specific IPs
pvefw set [CTID] --enable 1
pvefw rule add [CTID] --action ACCEPT --dport 3000 --source 192.168.1.10 # Your workstation
pvefw rule add [CTID] --action DROP --dport 3000 # Deny all others

# Option 3: VPN-only access
# Configure WireGuard and only allow dashboard access via VPN subnet
```

**Status**: ⏳ Pending Implementation

---

### 6. Log File Injection

**Risk Level**: Medium (CVSS 5.8)

**Description**: Malicious filenames on USB drives could inject fake data into log files, corrupting the dashboard display or hiding malicious activity.

**Attack Vectors**:
- Filename containing `100%` and `SYNC_END` markers
- Newline injection creating fake transfer entries
- Log truncation via large filenames
- Unicode characters breaking log parser

**Mitigation Steps**:

```bash
# In ingest-media.sh, sanitize rsync output before logging
cat >> /usr/local/bin/ingest-media.sh << 'EOF'
sanitize_output() {
  # Remove ANSI codes, limit line length, escape special markers
  sed -r 's/\x1B\[[0-9;]*[mK]//g' | \
  sed 's/SYNC_END/SYNC-END/g' | \
  sed 's/SYNC_START/SYNC-START/g' | \
  cut -c1-500
}

rsync ... 2>&1 | sanitize_output | tr '\r' '\n' >> "$LOG"
EOF

# In server.js, validate log structure
cat >> /opt/media-ingest/server.js << 'EOFJS'
function validateLogLine(line) {
  // Reject lines with multiple SYNC markers
  const markerCount = (line.match(/SYNC_(START|END)/g) || []).length;
  if (markerCount > 1) {
    console.warn('Possible log injection detected:', line);
    return null;
  }
  return line;
}
EOFJS
```

**Status**: ⏳ Pending Implementation

---

### 7. Systemd Service Privilege Escalation

**Risk Level**: Medium (CVSS 6.2)

**Description**: The `usb-ingest@.service` runs with full root privileges and minimal sandboxing, creating opportunities for privilege escalation if the USB trigger script is compromised.

**Attack Vectors**:
- Malicious device node passed as `%k` parameter
- Environment variable injection
- Race condition in script execution
- Exploit in bash interpreter

**Mitigation Steps**:

```bash
# Update systemd service with security restrictions
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
RestrictRealtime=yes
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
SystemCallFilter=@system-service
SystemCallFilter=~@privileged @resources
CapabilityBoundingSet=CAP_SYS_ADMIN CAP_DAC_OVERRIDE
EOF

systemctl daemon-reload
```

**Status**: ⏳ Pending Implementation

---

### 8. Denial of Service Attacks

**Risk Level**: Medium (CVSS 5.9)

**Description**: A malicious USB drive with millions of tiny files, deeply nested directories, or extremely large files could consume all system resources.

**Attack Vectors**:
- 1 million 1-byte files → rsync CPU exhaustion
- 100GB nested directory depth → stack overflow
- Continuous writes filling up NAS
- Fork bomb in malicious filename
- Slow loris attack on dashboard

**Mitigation Steps**:

```bash
# 1. Add file count limit
cat >> /usr/local/bin/ingest-media.sh << 'EOF'
FILE_COUNT=$(find "$FOUND_SRC" -type f | wc -l)
if [ "$FILE_COUNT" -gt 50000 ]; then
    echo "$(date): ERROR - Too many files ($FILE_COUNT > 50000). Possible DoS." >> "$LOG"
    exit 1
fi
EOF

# 2. Add rsync timeout
sed -i 's/rsync -rvh/rsync -rvh --timeout=7200/' /usr/local/bin/ingest-media.sh

# 3. Limit directory depth
cat >> /usr/local/bin/ingest-media.sh << 'EOF'
MAX_DEPTH=$(find "$FOUND_SRC" -type d -printf '%d\n' | sort -nr | head -1)
if [ "$MAX_DEPTH" -gt 10 ]; then
    echo "$(date): ERROR - Directory depth too large ($MAX_DEPTH > 10)" >> "$LOG"
    exit 1
fi
EOF

# 4. Add disk quota to container
pct set [CTID] -rootfs local-lvm:8,size=20G # Limit container disk
pct set [CTID] -mp1 /mnt/nas,mp=/media/nas,quota=500G # Limit NAS writes

# 5. Log rotation to prevent disk fill
cat > /etc/logrotate.d/media-ingest << 'EOF'
/var/log/media-ingest.log {
    size 100M
    rotate 5
    compress
    delaycompress
    notifempty
    create 0640 root root
}
EOF
```

**Status**: ⏳ Pending Implementation

---

## 🟢 Low Risks (Best Practices)

### 9. Information Disclosure via Logs

**Risk Level**: Low (CVSS 3.1)

**Description**: Log files contain sensitive information about NAS structure, transfer patterns, and file names that could aid an attacker.

**Mitigation**:
- Implement log rotation (shown in Risk #8)
- Restrict log file permissions: `chmod 640 /var/log/media-ingest.log`
- Avoid logging full file paths (log relative paths only)
- Redact sensitive information in dashboard error messages

**Status**: ⏳ Pending Implementation

---

### 10. Race Conditions with Concurrent USB Devices

**Risk Level**: Low (CVSS 2.8)

**Description**: Multiple USB devices inserted simultaneously could cause race conditions in log files or mount points.

**Mitigation**:
```bash
# Add locking mechanism
cat >> /usr/local/bin/usb-trigger.sh << 'EOF'
LOCKFILE="/var/lock/usb-ingest.lock"
exec 200>"$LOCKFILE"
flock -n 200 || { echo "$(date): Another ingest in progress" >> /var/log/usb-trigger.log; exit 1; }
EOF
```

**Status**: ⏳ Pending Implementation

---

### 11. Weak File Permissions

**Risk Level**: Low (CVSS 2.4)

**Description**: Using `chmod 777` on Media folders creates unnecessary write access for all users.

**Mitigation**:
```bash
# Use 755 instead (owner write, others read)
sed -i 's/chmod 777/chmod 755/' /usr/local/bin/ingest-media.sh

# Run dashboard as non-root user
pct exec [CTID] -- bash << 'EOF'
useradd -r -s /bin/false media-ingest
chown -R media-ingest:media-ingest /opt/media-ingest
sed -i 's/User=root/User=media-ingest/' /etc/systemd/system/media-ingest.service
systemctl daemon-reload
systemctl restart media-ingest
EOF
```

**Status**: ⏳ Pending Implementation

---

### 12. Default Password Security

**Risk Level**: Low (CVSS 3.9)

**Description**: The installer sets a default password `mediaingest123` that many users may not change.

**Mitigation**:
```bash
# Generate random password during installation
RANDOM_PASS=$(openssl rand -base64 16)
echo "LXC Password: $RANDOM_PASS" | tee -a /root/media-ingest-credentials.txt

# Force password change on first dashboard login
# (Requires implementing authentication first - see Risk #4)
```

**Status**: ⏳ Pending Implementation

---

## 📊 Security Checklist for Administrators

### Before Deployment
- [ ] Review this entire security hardening guide
- [ ] Decide on privileged vs unprivileged container
- [ ] Plan authentication strategy for dashboard
- [ ] Verify firewall rules are in place
- [ ] Test with disposable data first

### After Installation
- [ ] Change default LXC password immediately
- [ ] Implement at least 3 critical risk mitigations
- [ ] Enable Proxmox firewall on container
- [ ] Configure log rotation
- [ ] Set up automated security updates
- [ ] Document which mitigations are applied

### Ongoing Maintenance
- [ ] Review `/var/log/media-ingest.log` weekly
- [ ] Update Proxmox and Debian packages monthly
- [ ] Audit dashboard access logs
- [ ] Test backup and restore procedures
- [ ] Monitor for CVEs in Node.js/Express
- [ ] Only use trusted USB devices

---

## 🎯 Prioritized Implementation Plan

### Phase 1: Critical (Implement Immediately)
1. Add HTTP Basic Authentication to dashboard
2. Implement path validation for USB devices
3. Use rsync `--safe-links` option
4. Add ClamAV virus scanning

### Phase 2: High Priority (Within 1 Week)
5. Implement rate limiting on API endpoints
6. Add log file sanitization
7. Enable systemd service sandboxing
8. Configure Proxmox firewall rules

### Phase 3: Medium Priority (Within 1 Month)
9. Convert to unprivileged container (if possible)
10. Implement file count and size limits
11. Add locking mechanism for concurrent USBs
12. Configure log rotation

### Phase 4: Hardening (Ongoing)
13. Run dashboard as non-root user
14. Reduce file permissions from 777 to 755
15. Implement automated security scanning
16. Add monitoring and alerting

---

## 🔗 Additional Resources

- **Proxmox Security Best Practices**: https://pve.proxmox.com/wiki/Security
- **LXC Security**: https://linuxcontainers.org/lxc/security/
- **OWASP Top 10**: https://owasp.org/www-project-top-ten/
- **CIS Benchmarks**: https://www.cisecurity.org/cis-benchmarks/
- **Docker Security Cheat Sheet**: https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html

---

## 📝 Reporting Security Issues

If you discover a security vulnerability, please:
1. **DO NOT** open a public GitHub issue
2. Email security concerns to: [your-email@example.com]
3. Provide detailed reproduction steps
4. Allow 48 hours for initial response

See [SECURITY.md](SECURITY.md) for full vulnerability disclosure policy.

---

## ⚖️ Disclaimer

This tool is provided "as-is" without warranty. The security mitigations outlined in this document reduce but do not eliminate risks. Always:
- Use in trusted environments only
- Keep systems updated
- Follow principle of least privilege
- Backup important data
- Monitor system logs

**This is a home lab tool, not enterprise software.**

---

**Last Updated**: December 6, 2025  
**Document Version**: 1.0  
**Contributors**: Spooky Funck, Security Review Team
