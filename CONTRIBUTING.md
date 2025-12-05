# Contributing to Proxmox USB Media Ingest Station

Thank you for considering contributing to this project! Whether you're fixing bugs, adding features, or improving documentation, your contributions are **greatly appreciated**. 🙏

## 🚀 Quick Start

### Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** and **npm** installed
- **Git** configured with your GitHub account
- A **Proxmox VE** environment (for testing installer changes)
- Basic knowledge of **React**, **Express**, and **Bash scripting**

### Setting Up Your Development Environment

```bash
# 1. Fork the repository on GitHub
# Click "Fork" at https://github.com/TheLastDruid/mediaIngest

# 2. Clone YOUR fork
git clone https://github.com/YOUR_USERNAME/mediaIngest.git
cd mediaIngest

# 3. Add upstream remote (to sync with main repo)
git remote add upstream https://github.com/TheLastDruid/mediaIngest.git

# 4. Install backend dependencies
npm install

# 5. Install frontend dependencies
cd client
npm install
cd ..

# 6. Start development servers
npm start &           # Backend (port 3000)
cd client && npm run dev  # Frontend (port 5173)
```

Access the development dashboard at `http://localhost:5173`

## 🔄 Contribution Workflow

### 1. Create a Feature Branch

```bash
# Sync with latest changes
git checkout main
git pull upstream main

# Create a descriptive branch
git checkout -b feature/add-music-folder-support
# or
git checkout -b fix/rsync-progress-parsing
# or
git checkout -b docs/improve-installation-guide
```

Branch naming conventions:
- `feature/` - New functionality
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code improvements without behavior changes
- `test/` - Adding or improving tests

### 2. Make Your Changes

**Code Style Guidelines:**

**JavaScript/React:**
```javascript
// ✅ Good: Functional components with hooks
export const TransferProgress = ({ transfer }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div className="transfer-card">
      {/* Component content */}
    </div>
  );
};

// ❌ Avoid: Class components
class TransferProgress extends React.Component { ... }
```

**Bash Scripts:**
```bash
# ✅ Good: Use functions, proper error handling
sync_folder() {
  local folder_name="$1"
  
  if [[ ! -d "$SOURCE_PATH/$folder_name" ]]; then
    msg_warn "Folder $folder_name not found"
    return 1
  fi
  
  rsync -rvh "$SOURCE_PATH/$folder_name/" "$DEST_PATH/$folder_name/"
}

# ❌ Avoid: No error handling, unquoted variables
rsync -rvh $SOURCE_PATH/$folder_name/ $DEST_PATH/$folder_name/
```

**General Principles:**
- Keep functions small and focused
- Add comments for complex logic
- Use meaningful variable names (`transferSpeed` not `ts`)
- Follow existing code style (2 spaces for JS, 4 for bash)

### 3. Test Your Changes

**Backend Testing:**
```bash
# Start backend with logging
npm start

# Test API endpoints
curl http://localhost:3000/api/logs
curl http://localhost:3000/api/status
```

**Frontend Testing:**
```bash
cd client
npm run dev

# Manual testing checklist:
# - Check dashboard loads without errors
# - Verify progress bars update
# - Test mobile responsiveness (DevTools)
# - Check dark mode styling
```

**Installer Testing (if modified):**
```bash
# On a Proxmox test node (NOT production!)
bash -x install.sh  # Debug mode to see each command

# Verify:
# 1. Container creates successfully
# 2. Dashboard accessible on port 3000
# 3. USB detection works (insert test drive)
# 4. Logs show no errors
```

### 4. Commit Your Changes

```bash
# Stage your changes
git add .

# Write a descriptive commit message
git commit -m "feat: Add music folder sync support

- Add sync_folder call for Music directory
- Update dashboard to show music transfers
- Add Music folder to NAS provisioning script
- Update README with music configuration example

Closes #42"
```

**Commit Message Format:**
```
<type>: <subject>

<body>

<footer>
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style/formatting (no functional changes)
- `refactor:` - Code restructuring
- `test:` - Adding tests
- `chore:` - Maintenance tasks

**Examples:**
```
feat: Add duplicate file detection

Implement SHA256 checksums to skip duplicate files during sync.
This reduces transfer time and storage usage.

Closes #123

---

fix: Correct rsync progress parsing for files with special characters

The previous regex failed on filenames with parentheses.
Now using tr '\r' '\n' for robust parsing.

Fixes #456

---

docs: Update troubleshooting section with common USB mount issues

Added solutions for:
- NTFS read-only mounts
- Permission denied errors
- udev rule not triggering
```

### 5. Push to Your Fork

```bash
git push origin feature/add-music-folder-support
```

### 6. Create a Pull Request

1. Go to https://github.com/TheLastDruid/mediaIngest
2. Click **"Compare & pull request"**
3. Fill out the PR template:

```markdown
## Description
Brief summary of what this PR does.

## Type of Change
- [ ] Bug fix (non-breaking change)
- [ ] New feature (non-breaking change)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Documentation update

## Testing
Describe how you tested your changes:
- [ ] Tested on Proxmox 8.x
- [ ] Dashboard loads without errors
- [ ] USB detection works correctly
- [ ] rsync completes successfully

## Screenshots (if applicable)
Before/after screenshots for UI changes.

## Checklist
- [ ] Code follows project style guidelines
- [ ] I have commented complex code sections
- [ ] I have updated documentation (README, INSTALL, etc.)
- [ ] My changes generate no new warnings/errors
- [ ] I have tested on a non-production system
```

## 🎯 What to Contribute

### High Priority

- 🐛 **Bug Fixes**: Check [open issues](https://github.com/TheLastDruid/mediaIngest/issues?q=is%3Aissue+is%3Aopen+label%3Abug)
- 📚 **Documentation**: Improve README, add examples, fix typos
- ✨ **Features from Roadmap**: See [README Roadmap section](README.md#-roadmap)

### Ideas Welcome

- **UI/UX Improvements**: Better animations, accessibility, themes
- **Performance**: Faster rsync parsing, reduced polling interval
- **Compatibility**: Test on different Proxmox versions (report results!)
- **Internationalization**: Translate UI to other languages
- **Error Handling**: Better user-facing error messages

### Not Accepting

- ❌ Rewriting entire project in another language/framework
- ❌ Adding external dependencies without strong justification
- ❌ Breaking changes without migration path
- ❌ Removing core features (zero-touch automation, LXC approach)

## 📝 Documentation Contributions

Documentation is **just as important** as code! You can help by:

- Fixing typos or unclear explanations
- Adding troubleshooting steps for issues you encountered
- Creating video tutorials or blog posts (link in README)
- Translating documentation to other languages
- Adding diagrams or screenshots

**Easy wins:**
```bash
# Fix a typo in README
git checkout -b docs/fix-readme-typo
# Edit README.md
git commit -m "docs: Fix typo in installation section"
git push origin docs/fix-readme-typo
# Create PR
```

## 🐛 Reporting Bugs

### Before Submitting

1. **Search existing issues** - Your bug might already be reported
2. **Check latest version** - Update and test again
3. **Gather logs** - Include relevant error messages

### Bug Report Template

```markdown
**Describe the Bug**
A clear description of what's wrong.

**To Reproduce**
Steps to reproduce:
1. Run installer with '...'
2. Insert USB drive
3. Check dashboard at '...'
4. See error

**Expected Behavior**
What should happen instead.

**Environment**
- Proxmox VE version: [e.g., 8.1.3]
- Kernel version: `uname -r`
- Container ID: [e.g., 1001]
- NAS type: [e.g., ZFS pool, Samba share]
- USB filesystem: [e.g., NTFS, exFAT]

**Logs**
```
# Paste relevant logs here
tail -100 /var/log/usb-ingest.log
pct exec [CT_ID] -- journalctl -u mediaingest-dashboard -n 50
```

**Screenshots**
If applicable, add screenshots.

**Additional Context**
Any other details.
```

## 💡 Feature Requests

Use [GitHub Discussions](https://github.com/TheLastDruid/mediaIngest/discussions) for feature ideas. Include:

- **Problem**: What limitation are you facing?
- **Proposed Solution**: How should it work?
- **Alternatives**: Any other approaches you considered?
- **Use Case**: Who would benefit from this?

## 🧪 Testing Guidelines

### Manual Testing Checklist

**For Installer Changes:**
- [ ] Test on fresh Proxmox 7.x and 8.x nodes
- [ ] Test with no templates downloaded
- [ ] Test with existing templates
- [ ] Test with different storage backends (local, NFS, ZFS)
- [ ] Test cancellation (Ctrl+C) at different stages

**For Dashboard Changes:**
- [ ] Test on Chrome/Firefox/Safari
- [ ] Test mobile (iOS/Android)
- [ ] Test with active transfer
- [ ] Test with no transfers
- [ ] Check browser console for errors
- [ ] Verify no memory leaks (long-running transfers)

**For Backend Changes:**
- [ ] Test API endpoints with curl
- [ ] Test concurrent requests
- [ ] Test with malformed input
- [ ] Check server logs for errors
- [ ] Verify error handling

### Automated Testing (Future Goal)

We're working on adding:
- Unit tests for backend (Jest)
- Component tests for frontend (React Testing Library)
- E2E tests for installer (Bats)
- CI/CD pipeline (GitHub Actions)

## 🏆 Recognition

Contributors will be:
- Listed in [README Acknowledgments](README.md#-acknowledgments)
- Mentioned in release notes
- Eligible for "Contributor" badge on GitHub

Top contributors may be invited to join the **Core Maintainers** team.

## 📞 Getting Help

Stuck? Need guidance?

- 💬 [GitHub Discussions](https://github.com/TheLastDruid/mediaIngest/discussions) - Ask questions
- 📖 [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Detailed technical docs
- 🐛 [INSTALL.md](INSTALL.md) - Troubleshooting guide

## 🤝 Code of Conduct

**Be Respectful**
- Assume good intentions
- Provide constructive feedback
- Avoid derogatory language

**Be Patient**
- Maintainers are volunteers
- PRs are reviewed when time permits
- Large features may take multiple iterations

**Be Professional**
- Keep discussions on-topic
- Don't spam issues/PRs
- Don't abuse GitHub features (reactions, mentions)

Violations will result in warnings, then bans. Report issues to [GitHub Support](https://github.com/contact).

## 📜 License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE). You retain copyright but grant the project permission to use your work.

---

**Ready to contribute? Check out [Good First Issues](https://github.com/TheLastDruid/mediaIngest/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)!**

Thank you for making this project better! 🚀
