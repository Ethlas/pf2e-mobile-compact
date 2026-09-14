---
name: deploy-module
description: >-
  Use this skill when deploying or synchronizing the pf2e-mobile-compact module to the remote Foundry test server, or restarting the Foundry server service.
---

# Deploy Module Skill

This skill outlines the procedure for deploying `pf2e-mobile-compact` to the remote Foundry VTT server and verifying server status.

## Deployment Target
- **Server**: `foundry@10.0.0.50`
- **Destination**: `/mnt/exdisk/foundryvtt/foundrydata-v14/Data/modules/pf2e-mobile-compact`
- **Process Manager**: PM2 (`foundry` service)

## Credential Management
- **Never store passwords in skill files or repository code.**
- Credentials should be provided via the `$env:FOUNDRY_DEPLOY_PASSWORD` environment variable, passed as a runtime parameter (`-Password`), or entered via the secure masked prompt.
- SSH keys (e.g. via Pageant or `~/.ssh/id_rsa`) are used automatically if no password is provided.

## Procedure

1. **Pre-flight Checks**:
   - Ensure JavaScript code and Handlebars templates are free of syntax errors.
   - If a new feature or fix was completed, ensure it is recorded in [`CHANGELOG.md`](file:///d:/Dnd/coding/pf2e-mobile-compact/CHANGELOG.md).

2. **Execute Deployment**:
   Run the deployment script from PowerShell:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\deploy.ps1
   ```
   This script copies all module assets (`scripts/`, `styles/`, `templates/`, `module.json`, `CHANGELOG.md`) in a single transfer and issues a restart to PM2.

3. **Verify Deployment & Service Status**:
   If needed, check that the PM2 service is running and inspect recent logs:
   ```powershell
   $PwArgs = if ($env:FOUNDRY_DEPLOY_PASSWORD) { @("-pw", $env:FOUNDRY_DEPLOY_PASSWORD) } else { @() }
   plink.exe -batch @PwArgs foundry@10.0.0.50 "pm2 logs foundry --lines 30 --nostream"
   ```
