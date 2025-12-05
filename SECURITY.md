# Security Policy

## Supported Versions

We actively support the latest version of this project. Security updates are applied to:

| Version | Supported          |
| ------- | ------------------ |
| 3.x     | ✅ Active Support  |
| < 3.0   | ❌ No Support      |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please follow these steps:

### 🔒 Private Disclosure (Recommended)

1. **DO NOT** create a public GitHub issue
2. Use GitHub's [Private Security Advisory](https://github.com/TheLastDruid/mediaIngest/security/advisories/new) feature
3. Or email: [Create private advisory link above]

### 📋 What to Include

Please provide the following details:

- **Description**: A clear explanation of the vulnerability
- **Impact**: What could an attacker achieve?
- **Steps to Reproduce**: Detailed instructions to replicate the issue
- **Affected Versions**: Which versions are vulnerable?
- **Proof of Concept**: Code or screenshots (if applicable)
- **Suggested Fix**: Optional, but appreciated

### ⏱️ Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity
  - 🔴 Critical: 1-3 days
  - 🟠 High: 1-2 weeks
  - 🟡 Medium: 2-4 weeks
  - 🟢 Low: Best effort

### 🏆 Recognition

We believe in responsible disclosure. Contributors who report valid security issues will be:

- Listed in our Hall of Fame (with permission)
- Credited in release notes
- Thanked publicly on social media (optional)

## Security Best Practices

### For Users

1. **Keep Updated**: Always use the latest version
   ```bash
   pct stop [CT_ID]
   bash -c "$(wget -qLO - https://raw.githubusercontent.com/TheLastDruid/mediaIngest/main/install.sh)"
   ```

2. **Privileged Containers**: Understand the risks
   - This project requires privileged LXC containers for bind mounts
   - Only run on trusted networks
   - Do not expose the dashboard (port 3000) to the internet

3. **Network Isolation**: 
   - Use Proxmox firewall rules
   - Keep dashboard on private VLAN
   - Consider reverse proxy with authentication (e.g., nginx + basic auth)

4. **USB Trust**: 
   - Only insert USB drives from trusted sources
   - The system auto-mounts and executes—treat it like running code

5. **Log Monitoring**:
   ```bash
   # Check for suspicious activity
   tail -f /var/log/usb-ingest.log
   pct exec [CT_ID] -- journalctl -u mediaingest-dashboard -f
   ```

### For Developers

1. **Code Review**: All PRs require maintainer approval
2. **Dependency Scanning**: Run `npm audit` before committing
   ```bash
   npm audit fix --force
   cd client && npm audit fix --force
   ```

3. **No Secrets in Code**: Never commit:
   - API keys
   - Passwords
   - Private SSH keys
   - IP addresses (use examples: 192.168.1.x)

4. **Input Validation**: All user input must be sanitized
5. **Shell Escaping**: Use `printf %q` or proper quoting in bash scripts

## Known Security Considerations

### By Design

This project intentionally uses:

- **Privileged LXC containers** - Required for bind mounts and udev rules
- **Auto-mounting USB drives** - Core functionality (trust model: user inserts drive)
- **systemd execution** - Runs scripts as root inside container

### Mitigations

- Container isolation limits blast radius
- Read-only rsync prevents USB malware
- Comprehensive logging for auditing
- No network services exposed to internet by default
- Dashboard runs as non-root `node` user (planned for v3.1)

## Security Audits

We welcome security audits from the community. If you're conducting research:

- ✅ Automated scanning (SAST/DAST)
- ✅ Dependency vulnerability checks
- ✅ Code review for common patterns (injection, XSS, etc.)
- ❌ Do not test on production Proxmox systems without permission

## Contact

For non-security issues, use:
- 🐛 [Bug Reports](https://github.com/TheLastDruid/mediaIngest/issues)
- 💬 [General Discussion](https://github.com/TheLastDruid/mediaIngest/discussions)

For security issues **only**:
- 🔒 [Private Security Advisory](https://github.com/TheLastDruid/mediaIngest/security/advisories/new)

---

**Last Updated**: December 5, 2025  
**Policy Version**: 1.0
