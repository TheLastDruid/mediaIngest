# 🚀 GitHub Launch Kit for Proxmox USB Media Ingest Station

## 📋 Pre-Launch Checklist

### ✅ Step 1: Update Repository Settings

**Repository Description** (GitHub sidebar, max 300 chars):
```
Zero-touch USB media ingest for Proxmox. Auto-mount, sync to NAS, monitor via React dashboard. Built for Jellyfin/Plex home labs. One-line install.
```

**Website URL** (optional):
```
https://github.com/TheLastDruid/mediaIngest
```

**Topics/Tags** (15-20 keywords for SEO):
```
homelab
proxmox
proxmox-ve
automation
usb-automation
media-server
jellyfin
plex
emby
nas
lxc
lxc-containers
dashboard
react
rsync
self-hosted
home-automation
media-management
vite
tailwind
```

### ✅ Step 2: Replace Files

1. **Backup current README**:
   ```bash
   mv README.md README-OLD.md
   mv README-FINAL.md README.md
   ```

2. **Verify new files exist**:
   ```bash
   ls -lah README.md SECURITY.md CONTRIBUTING.md
   ```

3. **Add LICENSE** (if not exists):
   ```bash
   cat > LICENSE << 'EOF'
   MIT License

   Copyright (c) 2025 Spookyfunck

   Permission is hereby granted, free of charge, to any person obtaining a copy
   of this software and associated documentation files (the "Software"), to deal
   in the Software without restriction, including without limitation the rights
   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   copies of the Software, and to permit persons to whom the Software is
   furnished to do so, subject to the following conditions:

   The above copyright notice and this permission notice shall be included in all
   copies or substantial portions of the Software.

   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
   SOFTWARE.
   EOF
   ```

### ✅ Step 3: Add Screenshots

**Priority**: Replace placeholder images in README.md

1. **Take desktop screenshot**:
   - Open dashboard at `http://[CT_IP]:3000`
   - Ensure dark mode is active
   - Start a USB transfer to show live progress
   - Screenshot at 1920x1080 resolution
   - Save as `screenshots/dashboard-desktop.png`

2. **Take mobile screenshot**:
   - Open DevTools (F12) → Toggle device toolbar
   - Select iPhone 12 Pro or similar
   - Screenshot at 390x844 resolution
   - Save as `screenshots/dashboard-mobile.png`

3. **Take live transfer screenshot**:
   - Capture during active rsync with progress bar
   - Show speed, percentage, file name
   - Save as `screenshots/live-transfer.png`

4. **Upload to GitHub**:
   ```bash
   mkdir -p screenshots
   # Copy your PNG files to screenshots/
   git add screenshots/
   git commit -m "docs: Add dashboard screenshots"
   git push origin main
   ```

5. **Update README.md**:
   Replace placeholders:
   ```markdown
   # Change this:
   ![Dashboard Preview](https://via.placeholder.com/1200x600/...)
   
   # To this:
   ![Dashboard Preview](screenshots/dashboard-desktop.png)
   
   # And update all three screenshot sections
   ```

### ✅ Step 4: Commit Everything

```bash
git add README.md SECURITY.md CONTRIBUTING.md LICENSE
git commit -m "docs: Prepare repository for public launch

- Add professional README with hero section, badges, and detailed docs
- Add SECURITY.md with vulnerability reporting process
- Add CONTRIBUTING.md with development workflow
- Add MIT LICENSE

Ready for community contributions."

git push origin main
git push github main  # If dual-syncing
```

### ✅ Step 5: GitHub Settings

1. **Go to Settings → General**:
   - ☑️ Issues enabled
   - ☑️ Discussions enabled
   - ☑️ Wiki disabled (use GitHub Pages instead, optional)

2. **Go to Settings → Features**:
   - ☑️ Enable Discussions
   - Create categories:
     - 💬 General
     - 💡 Ideas (feature requests)
     - 🙏 Q&A
     - 📣 Show and Tell

3. **Go to Settings → Security**:
   - ☑️ Enable "Private vulnerability reporting"
   - ☑️ Enable Dependabot alerts
   - ☑️ Enable Dependabot security updates

4. **Go to Settings → Pages** (optional):
   - Source: Deploy from a branch
   - Branch: `main` → `/docs` folder
   - Create `docs/index.html` with redirect to README

### ✅ Step 6: Create GitHub Release

1. **Tag your current version**:
   ```bash
   git tag -a v3.0.0 -m "Release v3.0.0 - Public Launch

   Features:
   - Zero-touch USB automation
   - Real-time React dashboard
   - Intelligent NAS detection
   - Jellyfin/Plex integration
   - Mobile responsive UI
   - One-line installer
   
   This is the first public release ready for community use."
   
   git push origin v3.0.0
   git push github v3.0.0
   ```

2. **Create GitHub Release**:
   - Go to https://github.com/TheLastDruid/mediaIngest/releases/new
   - Choose tag: `v3.0.0`
   - Release title: `🚀 v3.0.0 - Public Launch`
   - Description:
   ```markdown
   ## 🎉 First Public Release!
   
   Proxmox USB Media Ingest Station is now open source and ready for the community.
   
   ### ✨ What's Included
   
   - **Zero-Touch Automation** - Plug USB → Auto-sync → Done
   - **Real-Time Dashboard** - Monitor transfers with beautiful Bento Grid UI
   - **Intelligent NAS Detection** - Scans `/mnt/pve/*` and `/mnt/*`
   - **Jellyfin/Plex Ready** - Organizes Movies, Series, Anime automatically
   - **Mobile Responsive** - Monitor from your phone
   - **One-Line Install** - Production-ready in 5-10 minutes
   
   ### 🚀 Quick Start
   
   ```bash
   bash -c "$(wget -qLO - https://raw.githubusercontent.com/TheLastDruid/mediaIngest/main/install.sh)"
   ```
   
   ### 📚 Documentation
   
   - [README](https://github.com/TheLastDruid/mediaIngest#readme) - Full documentation
   - [Installation Guide](INSTALL.md) - Troubleshooting
   - [Deployment Guide](DEPLOYMENT_GUIDE.md) - Advanced setup
   - [Contributing](CONTRIBUTING.md) - How to help
   
   ### 🙏 Acknowledgments
   
   Built for home lab enthusiasts running Jellyfin on Proxmox. Inspired by tteck's Helper-Scripts.
   
   ### 📬 Feedback
   
   Found a bug? [Open an issue](https://github.com/TheLastDruid/mediaIngest/issues)  
   Have an idea? [Start a discussion](https://github.com/TheLastDruid/mediaIngest/discussions)  
   Want to contribute? [See CONTRIBUTING.md](CONTRIBUTING.md)
   
   **If this project helps you, please ⭐ star the repo!**
   ```
   
   - **Attach files** (optional): None needed (installer downloads from repo)
   - Click **"Publish release"**

### ✅ Step 7: Social Media Announcements

**Template for Reddit** (r/homelab, r/selfhosted, r/proxmox):

```
Title: [Project] Proxmox USB Media Ingest Station - Zero-Touch Automation for Jellyfin/Plex

Body:
I built a zero-touch automation system for my Proxmox home lab that I wanted to share.

**The Problem**: I was manually mounting USB drives every week to add movies/shows to Jellyfin. It was tedious and error-prone.

**The Solution**: Proxmox USB Media Ingest Station
- Plug in ANY USB drive → Auto-mounts → Syncs to NAS → Done
- Real-time React dashboard shows transfer speed and progress
- One-line installer (Proxmox Helper Script style)
- Works with Jellyfin, Plex, Emby, Kodi, etc.

**Tech Stack**: LXC containers, udev rules, React + Vite, Express, systemd

**GitHub**: https://github.com/TheLastDruid/mediaIngest

**Installation**:
bash -c "$(wget -qLO - https://raw.githubusercontent.com/TheLastDruid/mediaIngest/main/install.sh)"

I've been running this in production for 6 months. Hope it helps someone else!

[Screenshot of dashboard]
```

**Template for Twitter/X**:

```
🚀 New open-source project for #homelab enthusiasts!

Proxmox USB Media Ingest Station: Zero-touch automation for #Jellyfin/#Plex

✅ Plug USB → Auto-sync → Monitor via React dashboard
✅ One-line install
✅ Works with any NAS

GitHub: https://github.com/TheLastDruid/mediaIngest

#proxmox #selfhosted #automation
[Screenshot]
```

**Template for Hacker News** (Show HN):

```
Title: Show HN: Zero-Touch USB Ingest for Proxmox Home Labs

Body:
I built a system that automates USB drive management for Proxmox-based home labs running media servers like Jellyfin.

When you plug in a USB drive, it:
1. Auto-mounts (ntfs3 or ntfs-3g)
2. Scans for a /Media folder
3. Syncs Movies/Series/Anime to NAS using rsync
4. Shows real-time progress on a React dashboard

It's designed for the "sneakernet" workflow—someone hands you a drive, you plug it in, and it just works.

The installation is a single bash command, similar to tteck's Proxmox Helper Scripts. It creates an LXC container, sets up udev rules on the host, and deploys the dashboard.

I've been using it for 6 months to manage media for Jellyfin. Open sourced it today in case it helps others.

GitHub: https://github.com/TheLastDruid/mediaIngest

Tech: React 18 + Vite, Express, systemd, LXC, udev

Happy to answer questions!
```

### ✅ Step 8: Community Engagement

**First Week Tasks**:

1. **Monitor Issues**:
   - Respond within 24 hours
   - Add labels: `bug`, `enhancement`, `question`, `good first issue`
   - Close duplicates politely

2. **Respond to PRs**:
   - Review code within 48 hours
   - Provide constructive feedback
   - Merge good contributions quickly

3. **Start Discussions**:
   - Create "Welcome!" pinned discussion
   - Ask for feedback: "What features would you like?"
   - Share roadmap: "Here's what's coming in v3.1"

4. **Update README**:
   - Add real screenshots (replace placeholders)
   - Add "Contributors" section with avatars
   - Add "Stargazers over time" graph (after 100+ stars)

**Engagement Ideas**:

- Create a demo GIF showing USB insertion → dashboard update
- Write a blog post: "How I Built This"
- Create a YouTube tutorial (even 5 min screencast helps)
- Share in Discord/Slack communities (Proxmox, Jellyfin, r/homelab)

---

## 🎯 SEO Optimization Tips

### Keywords to Target

**Primary:**
- proxmox usb automation
- jellyfin media ingest
- plex usb sync
- homelab automation
- lxc media server

**Secondary:**
- proxmox helper scripts alternative
- automate usb mounting linux
- media server workflow
- proxmox nas sync
- self-hosted streaming automation

### README SEO

Your new README is already optimized with:
- ✅ Title includes primary keyword
- ✅ H2/H3 headers with semantic keywords
- ✅ Alt text for images (when you add real screenshots)
- ✅ Internal links (great for GitHub SEO)
- ✅ External links to related projects (backlinks)

### GitHub SEO

- **Star count**: Ask friends to star (organic growth)
- **Watch count**: Encourage users to "watch" for updates
- **Forks**: Make it easy to fork and customize
- **Activity**: Frequent commits signal active project

### External SEO

- Link to your repo from:
  - Personal blog/portfolio
  - Dev.to articles
  - Medium posts
  - YouTube video descriptions
  - Awesome Lists (awesome-homelab, awesome-selfhosted)

---

## 🏆 Success Metrics

**Week 1 Goals**:
- [ ] 50+ stars
- [ ] 5+ forks
- [ ] 10+ watchers
- [ ] 2+ issues reported
- [ ] 1+ PR from community

**Month 1 Goals**:
- [ ] 200+ stars
- [ ] 20+ forks
- [ ] Featured in "Awesome Homelab" list
- [ ] 5+ community PRs merged
- [ ] 1+ blog post from community member

**Year 1 Goals**:
- [ ] 1,000+ stars
- [ ] 100+ forks
- [ ] Active contributor community
- [ ] Mentioned in Proxmox forums
- [ ] Integration with other tools (Jellyfin plugin?)

---

## 🚨 Final Pre-Launch Check

**Before announcing publicly:**

- [ ] README.md is polished (grammar, spelling)
- [ ] Installation command tested on fresh Proxmox node
- [ ] No hardcoded IPs/passwords in code
- [ ] LICENSE file exists
- [ ] SECURITY.md and CONTRIBUTING.md exist
- [ ] GitHub Issues/Discussions enabled
- [ ] All placeholder screenshots replaced (or clearly marked "coming soon")
- [ ] Latest code pushed to both `main` branch and `v3.0.0` tag
- [ ] GitHub release created
- [ ] Social media posts drafted
- [ ] Ready to respond to issues within 24 hours

---

## 🎉 You're Ready to Launch!

**Action Plan:**

1. ✅ Commit new docs (README, SECURITY, CONTRIBUTING)
2. ✅ Take screenshots and replace placeholders
3. ✅ Create v3.0.0 release on GitHub
4. ✅ Post to Reddit (r/homelab, r/selfhosted, r/proxmox)
5. ✅ Post to Hacker News (Show HN)
6. ✅ Post to Twitter/X with hashtags
7. ✅ Share in Discord communities
8. ✅ Monitor feedback and respond quickly

**Remember:**
- First impressions matter—make README shine
- Be responsive to early adopters
- Thank contributors publicly
- Iterate based on feedback

**Good luck with your launch! 🚀**
