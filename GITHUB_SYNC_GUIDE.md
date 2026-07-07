# GitHub Sync Guide

This project is already connected to GitHub:

```text
https://github.com/jinsung920/stowgrid.git
```

## Manual One-Click Sync

Use this when you want to upload the current folder to GitHub once.

1. Double-click `github-sync-now.bat`.
2. Wait until the window says `Done`.
3. GitHub Pages usually updates in 1-3 minutes.

This runs:

```powershell
git add -A
git commit -m "Auto sync: yyyy-mm-dd hh:mm:ss"
git push
```

## Auto Sync Mode

Use this only while you are actively editing and want GitHub to update automatically.

1. Double-click `github-auto-sync.bat`.
2. Keep the black PowerShell window open.
3. Edit and save files normally.
4. The script waits about 20 seconds after changes stop, then commits and pushes.
5. Close the window or press `Ctrl+C` to stop auto sync.

## Important Notes

- GitHub Pages updates only after `git push`.
- The Android app in Google Play does not update from GitHub automatically. For the installed app, build a new signed AAB and upload it to Play Console.
- Do not keep private passwords or signing keys in this project folder.
- `.gitignore` blocks common secret files, generated Android builds, `node_modules`, and `www`.

## Check Status Manually

```powershell
git status
```

If it says `nothing to commit, working tree clean`, local files and Git are in sync.
