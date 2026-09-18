[CmdletBinding()]
param(
    [ValidateRange(1, 65535)][int]$Port = 8080,
    [int]$Seed = 12345,
    [switch]$SkipBuild,
    [switch]$NoBrowser
)
$ErrorActionPreference='Stop'
Set-Location -LiteralPath $PSScriptRoot
function Require-Command([string]$Name,[string]$Hint=''){
  if(-not (Get-Command $Name -ErrorAction SilentlyContinue)){
    Write-Host "ERROR: '$Name' not found in PATH." -ForegroundColor Red
    if($Hint){Write-Host $Hint -ForegroundColor Yellow}; exit 1
  }
}
function Test-TcpPort([int]$PortToTest){
  $c=New-Object System.Net.Sockets.TcpClient
  try{$a=$c.BeginConnect('127.0.0.1',$PortToTest,$null,$null);if(-not $a.AsyncWaitHandle.WaitOne(250)){return $false};$c.EndConnect($a);return $true}catch{return $false}finally{$c.Close()}
}
Require-Command node 'Install current Node.js LTS and reopen PowerShell.'
Require-Command npm 'npm comes with Node.js.'
Write-Host ""; Write-Host 'Roguelike prototype v0.8 - systems rewrite / build calibration' -ForegroundColor Cyan
Write-Host "Project: $PSScriptRoot"; Write-Host "Node: $(node --version)"; Write-Host "npm:  $(npm --version)"; Write-Host ""
if(-not $SkipBuild){
  if(Get-Command tsc -ErrorAction SilentlyContinue){
    Write-Host '[1/3] Build + deterministic headless test...' -ForegroundColor Cyan
    & npm.cmd test
    if($LASTEXITCODE -ne 0){throw "npm test failed ($LASTEXITCODE)"}
  }else{
    Write-Host '[1/3] tsc not found; using prebuilt dist/.' -ForegroundColor Yellow
    if(-not (Test-Path (Join-Path $PSScriptRoot 'dist/platform/main.js'))){throw 'dist/ missing and TypeScript compiler not installed.'}
  }
}else{Write-Host '[1/3] Build/test skipped.' -ForegroundColor DarkGray}
if(Test-TcpPort $Port){Write-Host "ERROR: localhost:$Port already in use." -ForegroundColor Red;Write-Host 'Try .\run.ps1 -Port 8081' -ForegroundColor Yellow;exit 1}
$env:PORT=[string]$Port
$url="http://localhost:$Port/?seed=$Seed&build=080"
Write-Host '[2/3] Starting local server...' -ForegroundColor Cyan
$server=Start-Process -FilePath (Get-Command node).Source -ArgumentList 'server.mjs' -WorkingDirectory $PSScriptRoot -NoNewWindow -PassThru
try{
  $ready=$false
  for($i=0;$i -lt 60;$i++){
    if($server.HasExited){throw "Server exited: $($server.ExitCode)"}
    try{$r=Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 1;if($r.StatusCode -eq 200){$ready=$true;break}}catch{}
    Start-Sleep -Milliseconds 100
  }
  if(-not $ready){throw "Server did not answer HTTP 200 on $Port"}
  Write-Host '[3/3] HTTP smoke test: OK' -ForegroundColor Green
  Write-Host "";Write-Host "Running: $url" -ForegroundColor Green
  Write-Host 'WASD = movement | Mouse = aim | Tab = planning | Wheel = zoom | Space = pause | R = restart' -ForegroundColor Green
  Write-Host 'Stop server: Ctrl+C' -ForegroundColor Green;Write-Host ""
  if(-not $NoBrowser){Start-Process $url}
  while(-not $server.HasExited){Start-Sleep -Milliseconds 500}
}finally{if($server -and -not $server.HasExited){Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue}}
