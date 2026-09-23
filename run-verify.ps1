param(
  [Parameter(Position = 0)]
  [ValidateSet("prepare", "desktop", "staves", "exhausted", "all")]
  [string]$Test = "staves",

  [Parameter(Position = 1)]
  [string]$Url = $env:FOUNDRY_URL,

  [Parameter(Position = 2)]
  [string]$Username = $(if ($env:FOUNDRY_USERNAME) { $env:FOUNDRY_USERNAME } else { "Gamemaster" }),

  [Parameter(Position = 3)]
  [string]$Password = $env:FOUNDRY_PASSWORD
)

# Prompt for Server URL if not provided via parameter or environment variable
if (-not $Url) {
  $Url = Read-Host -Prompt "Enter Foundry Server URL (e.g. http://localhost:30000 or https://your-foundry-host.com)"
}

if (-not $Url) {
  Write-Error "Server URL is required to run automated verification tests."
  exit 1
}

# Prompt for Username if empty
if (-not $Username) {
  $Username = Read-Host -Prompt "Enter Foundry Username"
}

# Securely prompt for password if not supplied
if (-not $Password) {
  $Secure = Read-Host -Prompt "Enter Foundry Password for user '$Username'" -AsSecureString
  $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
  $Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
  [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
}

if (-not $Password) {
  Write-Error "Password is required to run automated verification tests."
  exit 1
}

$env:FOUNDRY_URL = $Url
$env:FOUNDRY_USERNAME = $Username
$env:FOUNDRY_PASSWORD = $Password

if ($Test -eq "staves") {
  Write-Host "Running Activations, Staves & Dailies Verification on $Url..." -ForegroundColor Cyan
  node scratch/test-activations-staves.mjs --url $Url --username $Username --password $Password
} elseif ($Test -eq "prepare") {
  Write-Host "Running Spell Preparation Picker In-Browser Verification on $Url..." -ForegroundColor Cyan
  node scratch/test-valdrin-prepare.mjs --url $Url --username $Username --password $Password
} elseif ($Test -eq "exhausted") {
  Write-Host "Running Exhausted Slots & Expended Spells In-Browser Verification on $Url..." -ForegroundColor Cyan
  node scratch/test-exhausted-slots.mjs --url $Url --username $Username --password $Password
} elseif ($Test -eq "desktop") {
  Write-Host "Running Desktop Dormancy & Expansion In-Browser Verification on $Url..." -ForegroundColor Cyan
  node scratch/verify-foundry-browser.mjs --url $Url --username $Username --password $Password
} elseif ($Test -eq "all") {
  Write-Host "=== Running Desktop Dormancy & Expansion Verification on $Url ===" -ForegroundColor Cyan
  node scratch/verify-foundry-browser.mjs --url $Url --username $Username --password $Password
  Write-Host "`n=== Running Spell Preparation Picker Verification on $Url ===" -ForegroundColor Cyan
  node scratch/test-valdrin-prepare.mjs --url $Url --username $Username --password $Password
  Write-Host "`n=== Running Activations, Staves & Dailies Verification on $Url ===" -ForegroundColor Cyan
  node scratch/test-activations-staves.mjs --url $Url --username $Username --password $Password
}
