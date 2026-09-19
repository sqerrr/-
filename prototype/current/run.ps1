[CmdletBinding()]
param(
    [ValidateRange(1, 65535)][int]$Port = 8080,
    [int]$Seed = 12345,
    [switch]$SkipBuild,
    [switch]$NoTest,
    [switch]$NoBrowser
)

# Launches the prototype: build, optionally run the checks, serve public/ and dist/, open a browser.
#
# Readiness is decided by a plain TCP connect rather than an HTTP request. Invoke-WebRequest on
# Windows PowerShell drags in proxy discovery and can stall for far longer than its own timeout,
# which left the previous version of this script hanging silently after the server had already
# started. The address is 127.0.0.1 and not localhost for the same reason: the server binds IPv4
# only, and resolving localhost can hand back ::1 first.

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

function Require-Command([string]$Name, [string]$Hint = '') {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        Write-Host "ERROR: '$Name' not found in PATH." -ForegroundColor Red
        if ($Hint) { Write-Host $Hint -ForegroundColor Yellow }
        exit 1
    }
}

function Test-TcpPort([int]$PortToTest, [int]$TimeoutMs = 250) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $async = $client.BeginConnect('127.0.0.1', $PortToTest, $null, $null)
        if (-not $async.AsyncWaitHandle.WaitOne($TimeoutMs)) { return $false }
        $client.EndConnect($async)
        return $true
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

Require-Command node 'Install current Node.js LTS and reopen PowerShell.'
Require-Command npm 'npm ships with Node.js.'

$pkg = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'package.json') -Raw | ConvertFrom-Json

Write-Host ''
Write-Host "Roguelike prototype $($pkg.version) - rival draft slice" -ForegroundColor Cyan
Write-Host "Project: $PSScriptRoot"
Write-Host "Node: $(node --version)   npm: $(npm --version)"
Write-Host ''

if ($SkipBuild) {
    Write-Host '[1/3] Build and checks skipped.' -ForegroundColor DarkGray
    if (-not (Test-Path (Join-Path $PSScriptRoot 'dist/platform/main.js'))) {
        throw 'dist/ is missing, so there is nothing to serve. Run without -SkipBuild.'
    }
} elseif ($NoTest) {
    Write-Host '[1/3] Building...' -ForegroundColor Cyan
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw "build failed ($LASTEXITCODE)" }
} else {
    Write-Host '[1/3] Building and running the checks...' -ForegroundColor Cyan
    & npm.cmd test
    if ($LASTEXITCODE -ne 0) { throw "npm test failed ($LASTEXITCODE). Use -NoTest to look at the build anyway." }
}

if (Test-TcpPort $Port) {
    Write-Host "ERROR: 127.0.0.1:$Port is already in use." -ForegroundColor Red
    Write-Host "Try .\run.ps1 -Port $($Port + 1)" -ForegroundColor Yellow
    exit 1
}

$env:PORT = [string]$Port
$url = "http://127.0.0.1:$Port/?seed=$Seed"

Write-Host '[2/3] Starting the local server...' -ForegroundColor Cyan
$server = Start-Process -FilePath (Get-Command node).Source -ArgumentList 'server.mjs' `
    -WorkingDirectory $PSScriptRoot -NoNewWindow -PassThru

try {
    $ready = $false
    for ($i = 0; $i -lt 80; $i++) {
        if ($server.HasExited) { throw "Server exited with code $($server.ExitCode)." }
        if (Test-TcpPort $Port 200) { $ready = $true; break }
        Start-Sleep -Milliseconds 100
    }
    if (-not $ready) { throw "Server never started listening on $Port." }

    Write-Host '[3/3] Server is listening.' -ForegroundColor Green
    Write-Host ''
    Write-Host "Open: $url" -ForegroundColor Green
    Write-Host 'WASD move | mouse aim | Shift or right mouse dash | Tab planning | wheel zoom | Space pause | R restart' -ForegroundColor Green
    Write-Host 'Stop the server with Ctrl+C.' -ForegroundColor Green
    Write-Host ''

    if (-not $NoBrowser) { Start-Process $url | Out-Null }

    while (-not $server.HasExited) { Start-Sleep -Milliseconds 500 }
} finally {
    if ($server -and -not $server.HasExited) {
        Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
    }
}
