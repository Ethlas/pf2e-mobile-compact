---
name: foundry-debug
description: >-
  Use this skill when diagnosing errors, checking Foundry server PM2 logs, verifying remote module file status, or debugging ApplicationV2 runtime issues.
---

# Foundry VTT Debugging Skill

This runbook guides debugging issues on the remote Foundry VTT server and diagnosing module runtime errors.

## Remote Server Diagnostics

> [!NOTE]
> Authentication and server address are handled via `$env:FOUNDRY_DEPLOY_SERVER` and `$env:FOUNDRY_DEPLOY_PASSWORD` or SSH keys. Never hardcode IP addresses or plaintext passwords in repository files or skill runbooks. If `$env:FOUNDRY_DEPLOY_SERVER` is empty, ask the user before running remote commands.

Prepare credential arguments if using password authentication:
```powershell
$PwArgs = if ($env:FOUNDRY_DEPLOY_PASSWORD) { @("-pw", $env:FOUNDRY_DEPLOY_PASSWORD) } else { @() }
```

### 1. Check Service Status & Logs
Run plink commands to check PM2 status and recent output logs:
```powershell
plink.exe -batch @PwArgs $env:FOUNDRY_DEPLOY_SERVER "pm2 status"
plink.exe -batch @PwArgs $env:FOUNDRY_DEPLOY_SERVER "pm2 logs foundry --lines 50 --nostream"
```

### 2. Inspect Deployed Module Files
Verify file contents or permissions on the remote filesystem:
```powershell
plink.exe -batch @PwArgs $env:FOUNDRY_DEPLOY_SERVER "ls -la /mnt/exdisk/foundryvtt/foundrydata-v14/Data/modules/pf2e-mobile-compact"
```

### 3. Check for Module JSON Integrity
Verify `module.json` is valid JSON on remote:
```powershell
plink.exe -batch @PwArgs $env:FOUNDRY_DEPLOY_SERVER "cat /mnt/exdisk/foundryvtt/foundrydata-v14/Data/modules/pf2e-mobile-compact/module.json | jq ."
```

## Common Issues & Fixes
- **Select Dropdowns Not Opening on Mobile**: Check if `data-action` is present on `<select>` elements. Replace with `data-change-action` and stop click propagation.
- **"No Token Selected" during Damage Application**: Check if `User.prototype.getActiveTokens` fallback is active in `scripts/pf2e-mobile.js`.
- **ReferenceError / TypeError in Sheet Rendering**: Inspect `_prepareContext` in `scripts/apps/mobile-sheet.js` for missing variables or uninitialized system properties.
