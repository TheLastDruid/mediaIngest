# 📁 Recommended GitHub Repository Structure

This document outlines the ideal file structure for packaging the Media Ingest System for public GitHub distribution.

## 🎯 Clean Repository Structure

```
mediaIngest/
├── .github/
│   └── workflows/
│       └── release.yml              # Automated release builds
├── client/                          # React Frontend
│   ├── public/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── postcss.config.cjs
├── scripts/                         # Automation Scripts
│   ├── ingest-media.sh             # Main USB detection script
│   ├── usb-trigger.sh              # udev trigger script
│   └── README.md                    # Scripts documentation
├── screenshots/                     # UI Screenshots
│   └── (keep existing screenshots)
├── docs/                            # Additional Documentation
│   ├── DEPLOYMENT_GUIDE.md
│   ├── SECURITY_HARDENING.md
│   ├── MODERNIZATION_CHANGES.md
│   ├── FRONTEND_UPDATES.md
│   ├── GITHUB_LAUNCH_KIT.md
│   └── GITHUB_RELEASE.md
├── .gitignore                       # Git ignore rules
├── install.sh                       # Main installer script
├── server.js                        # Express backend
├── package.json                     # Backend dependencies
├── version.json                     # Version tracking
├── README.md                        # Main documentation
├── LICENSE                          # MIT License
├── CONTRIBUTING.md                  # Contribution guidelines
├── SECURITY.md                      # Security policy
└── CHANGELOG.md                     # Version history

# Files to EXCLUDE from repository:
- node_modules/
- client/node_modules/
- client/dist/
- *.log
- .DS_Store
- *.env
- .vscode/ (optional)
```

## 📦 Release Artifact Structure

When GitHub Actions creates `release.zip`, it should contain:

```
release.zip
├── install.sh
├── server.js
├── package.json
├── version.json
├── client/
│   ├── dist/              # Pre-built React app
│   ├── package.json
│   └── (other client files)
├── scripts/
│   ├── ingest-media.sh
│   ├── usb-trigger.sh
│   └── README.md
└── README.md
```

## 🔧 Key Changes from Current Structure

### Files to Move:
- Move `DEPLOYMENT_GUIDE.md`, `SECURITY_HARDENING.md`, etc. → `docs/`
- Keep `README.md` at root (it's already excellent)
- Remove `README-OLD-BACKUP.md` (archive only)
- Remove `App_old.jsx` (old backup)

### Files to Create:
- `.github/workflows/release.yml` - Automated releases
- `.gitignore` - Exclude build artifacts
- `CHANGELOG.md` - Track version history
- `LICENSE` - MIT License file

### Files to Keep at Root:
- `install.sh` - Main entry point
- `server.js` - Backend server
- `package.json` - Backend dependencies
- `version.json` - Version tracking
- `README.md` - Main documentation
- `CONTRIBUTING.md` - Already exists
- `SECURITY.md` - Already exists

## 🚀 Installer Integration

The `install.sh` should be updated to:

1. **Download release artifact from GitHub**:
   ```bash
   RELEASE_URL="https://github.com/TheLastDruid/mediaIngest/releases/latest/download/release.zip"
   wget -O /tmp/media-ingest.zip "$RELEASE_URL"
   ```

2. **Extract to container**:
   ```bash
   unzip /tmp/media-ingest.zip -d /opt/media-ingest/
   ```

3. **No git clone needed** - use stable releases only

## 📋 Migration Steps

1. Create `.github/workflows/release.yml` 
2. Create `.gitignore`
3. Organize docs into `docs/` folder
4. Remove backup/old files
5. Update `install.sh` to use release artifacts
6. Test release workflow
7. Create first GitHub release (v3.2.2)

## ✅ Benefits

- **Clean root directory** - easy to navigate
- **Stable releases** - users download tested artifacts
- **Automated builds** - no manual bundling
- **Professional structure** - follows GitHub best practices
- **Easy contribution** - clear organization
