---
name: deploy-module
description: >-
  Use this skill when deploying or synchronizing the pf2e-mobile-compact module to the remote Foundry test server, or restarting the Foundry server service.
---

# Deploy Module Skill

This skill outlines the procedure for deploying `pf2e-mobile-compact` to the remote Foundry VTT server and verifying server status.

## Deployment Target (Production / Remote Test Server)
> [!WARNING]
> Deploy to the remote Foundry server only when explicitly authorized by the user.

- **Server**: Configured via `$env:FOUNDRY_DEPLOY_SERVER` (never hardcode IP addresses in repo files)
- **Destination**: `/mnt/exdisk/foundryvtt/foundrydata-v14/Data/modules/pf2e-mobile-compact`
- **Process Manager**: PM2 (`foundry` service)

## Credential Management
- **Never store passwords or server IP addresses in skill files or repository code.**
- Credentials and server host should be provided via `$env:FOUNDRY_DEPLOY_SERVER` and `$env:FOUNDRY_DEPLOY_PASSWORD` environment variables, passed as runtime parameters (`-Server`, `-Password`), or entered via the prompt.
- SSH keys (e.g. via Pageant or `~/.ssh/id_rsa`) are used automatically if no password is provided.

## Procedure

1. **Pre-flight Checks**:
   - Ensure JavaScript code and Handlebars templates are free of syntax errors (`node scripts/verify.mjs`).
   - If a new feature or fix was completed, ensure it is recorded in [`CHANGELOG.md`](file:///d:/Dnd/coding/pf2e-mobile-compact/CHANGELOG.md).
   - **Verify Deployment Parameters**: Before executing `.\deploy.ps1`, check whether `$env:FOUNDRY_DEPLOY_SERVER` and `$env:FOUNDRY_DEPLOY_PASSWORD` are set. If either parameter is empty, **ask the user in chat** for the missing parameter(s) rather than letting `Read-Host` hang in a non-interactive terminal.

2. **Execute Deployment**:
   Run the deployment script directly in the active `pwsh` shell (do NOT spawn a nested `powershell -File` process):
   ```powershell
   .\deploy.ps1 -Server "<user@host>"
   ```
   This script copies all module assets (`scripts/`, `styles/`, `templates/`, `module.json`, `CHANGELOG.md`) in a single transfer and issues a restart to PM2.

3. **Verify Deployment & Service Status**:
   If needed, check that the PM2 service is running and inspect recent logs:
   ```powershell
   $PwArgs = if ($env:FOUNDRY_DEPLOY_PASSWORD) { @("-pw", $env:FOUNDRY_DEPLOY_PASSWORD) } else { @() }
   plink.exe -batch @PwArgs $env:FOUNDRY_DEPLOY_SERVER "pm2 logs foundry --lines 30 --nostream"
   ```
