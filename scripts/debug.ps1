# Zotero GPT Pro - Local Debug & Validation Script
# Run: .\scripts\debug.ps1

param(
    [switch]$install,    # Copy .xpi to Zotero plugins folder
    [switch]$clean       # Clean build artifacts
)

$ErrorActionPreference = "Continue"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BuildDir = "$ProjectRoot\builds"
$AddonDir = "$BuildDir\addon"

Write-Host "`n=== Zotero GPT Pro - Debug Pipeline ===`n" -ForegroundColor Cyan

# Step 1: Clean
if ($clean) {
    Write-Host "[1/6] Cleaning..." -ForegroundColor Yellow
    Remove-Item $BuildDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "       ✅ Cleaned" -ForegroundColor Green
}

# Step 2: Build
Write-Host "[2/6] Building..." -ForegroundColor Yellow
npm --prefix $ProjectRoot run build-prod
if ($LASTEXITCODE -ne 0) {
    Write-Host "       ❌ Build failed" -ForegroundColor Red
    exit 1
}
$XPI = Get-ChildItem "$BuildDir\zotero-gpt-pro-v*.xpi" | Sort-Object LastWriteTime -Desc | Select-Object -First 1
Write-Host "       ✅ Built: $($XPI.Name) ($([math]::Round($XPI.Length/1KB))KB)" -ForegroundColor Green

# Step 3: Validate manifest
Write-Host "[3/6] Validating manifest.json..." -ForegroundColor Yellow
$manifest = Get-Content "$AddonDir\manifest.json" | ConvertFrom-Json
$checks = @{
    "name"           = $manifest.name -ne $null
    "version"        = $manifest.version -ne $null
    "manifest_v"     = ($manifest.manifest_version -eq 2 -or $manifest.manifest_version -eq 3)
    "addon_id"       = $manifest.applications.zotero.id -match "@"
    "min_version"    = $manifest.applications.zotero.strict_min_version -ne $null
    "max_version"    = $manifest.applications.zotero.strict_max_version -ne $null
}
$allOk = $true
foreach ($c in $checks.GetEnumerator()) {
    if ($c.Value) { Write-Host "       ✅ $($c.Key)" -ForegroundColor Green }
    else { Write-Host "       ❌ $($c.Key)" -ForegroundColor Red; $allOk = $false }
}
if ($manifest.applications.zotero.update_url) {
    Write-Host "       ✅ update_url: $($manifest.applications.zotero.update_url)" -ForegroundColor Green
}

# Step 4: Validate key files
Write-Host "[4/6] Validating files..." -ForegroundColor Yellow
$files = @("bootstrap.js","prefs.js","chrome.manifest","install.rdf")
foreach ($f in $files) {
    if (Test-Path "$AddonDir\$f") {
        Write-Host "       ✅ $f" -ForegroundColor Green
    } else {
        Write-Host "       ❌ $f MISSING" -ForegroundColor Red
        $allOk = $false
    }
}
$icons = @("gpt.png","favicon.png")
foreach ($i in $icons) {
    if (Test-Path "$AddonDir\chrome\content\icons\$i") {
        $size = (Get-Item "$AddonDir\chrome\content\icons\$i").Length
        Write-Host "       ✅ $i ($([math]::Round($size/1KB))KB)" -ForegroundColor Green
    } else {
        Write-Host "       ⚠️  $i MISSING" -ForegroundColor Yellow
    }
}

# Step 5: Version compatibility
Write-Host "[5/6] Version coverage..." -ForegroundColor Yellow
$min = [int]$manifest.applications.zotero.strict_min_version.Split('.')[0]
$maxRaw = $manifest.applications.zotero.strict_max_version
$max = if ($maxRaw -eq "*") { 99 } elseif ($maxRaw -match "^(\d+)") { [int]$Matches[1] } else { 7 }
foreach ($v in 6..9) {
    if ($v -ge $min -and $v -le $max) {
        Write-Host "       ✅ Zotero $v" -ForegroundColor Green
    } else {
        Write-Host "       ❌ Zotero $v NOT covered" -ForegroundColor Red
        $allOk = $false
    }
}

# Step 6: Copy to output
Write-Host "[6/6] Finalizing..." -ForegroundColor Yellow
Copy-Item $XPI.FullName "$BuildDir\abt.xpi" -Force
Write-Host "       ✅ abt.xpi ready" -ForegroundColor Green

# Summary
Write-Host "`n===============================" -ForegroundColor Cyan
if ($allOk) {
    Write-Host "  ✅ ALL CHECKS PASSED" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  SOME CHECKS FAILED - Review above" -ForegroundColor Yellow
}
Write-Host "===============================" -ForegroundColor Cyan
Write-Host "  Output: $($XPI.FullName)" -ForegroundColor White
Write-Host "  Install: builds\abt.xpi" -ForegroundColor White
Write-Host ""

# Zotero plugin paths
$zoteroProfiles = @(
    "$env:APPDATA\Zotero\Zotero\Profiles",
    "$env:LOCALAPPDATA\Zotero\Zotero\Profiles"
)
foreach ($zp in $zoteroProfiles) {
    if (Test-Path $zp) {
        Write-Host "  Zotero profile: $zp" -ForegroundColor DarkGray
        $extDir = Get-ChildItem $zp -Directory | ForEach-Object { "$_\extensions" } | Where-Object { Test-Path $_ } | Select-Object -First 1
        if ($extDir) {
            Write-Host "  Extensions dir: $extDir" -ForegroundColor DarkGray
        }
    }
}
