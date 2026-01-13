# Start complete distributed setup
# Launches Gateway + Zone Server in separate windows

param(
    [string]$RedisUrl = "redis://localhost:6379",
    [string]$GatewayWindowTitle = "Ashes & Aether - Gateway",
    [string]$ZoneWindowTitle = "Ashes & Aether - Zone",
    [switch]$SkipRedisCheck
)

$repoRoot = (Resolve-Path $PSScriptRoot).Path

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Ashes & Aether - Distributed Setup" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

function Test-PortFast {
    param(
        [string]$Hostname = "localhost",
        [int]$Port = 6379,
        [int]$TimeoutMs = 500
    )

    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $async = $client.BeginConnect($Hostname, $Port, $null, $null)
        if (-not $async.AsyncWaitHandle.WaitOne($TimeoutMs, $false)) {
            return $false
        }
        $client.EndConnect($async) | Out-Null
        return $true
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

function Start-RedisIfMissing {
    Write-Host "Checking Redis connection..." -ForegroundColor Yellow

    $redisProcess = Get-Process -Name "redis-server" -ErrorAction SilentlyContinue
    if ($redisProcess) {
        Write-Host "OK - Redis process detected (PID $($redisProcess.Id))" -ForegroundColor Green
        return $true
    }

    if (Test-PortFast) {
        Write-Host "OK - Redis is running on localhost:6379" -ForegroundColor Green
        return $true
    }

    Write-Host "Redis not running. Starting redis-server..." -ForegroundColor Yellow
    try {
        Start-Process -FilePath "F:\Servers\redis\redis-server.exe" -WindowStyle Minimized | Out-Null
    } catch {
        Write-Host "WARN - Could not start Redis (redis-server not found or failed to launch)." -ForegroundColor Red
        return $false
    }

    $deadline = (Get-Date).AddSeconds(5)
    while ((Get-Date) -lt $deadline) {
        if (Test-PortFast) {
            Write-Host "OK - Redis started on localhost:6379" -ForegroundColor Green
            return $true
        }
        Start-Sleep -Milliseconds 250
    }

    Write-Host "WARN - Redis did not start within 5 seconds." -ForegroundColor Red
    return $false
}

# Check if Redis is running
if (-not $SkipRedisCheck) {
    $redisOk = Start-RedisIfMissing
    if (-not $redisOk) {
        Write-Host "Continuing anyway..." -ForegroundColor Gray
    }
}

Write-Host "`nStarting servers..." -ForegroundColor Yellow

# Start Gateway in new window
Write-Host "Launching Gateway Server..." -ForegroundColor Cyan
Start-Process powershell -WorkingDirectory $repoRoot -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle = '$GatewayWindowTitle'; & '$repoRoot\\start-gateway.ps1' -RedisUrl '$RedisUrl'"

# Wait a moment for Gateway to initialize
Start-Sleep -Seconds 2

# Start Zone Server in new window
Write-Host "Launching Zone Server..." -ForegroundColor Cyan
Start-Process powershell -WorkingDirectory $repoRoot -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle = '$ZoneWindowTitle'; & '$repoRoot\\start-zone.ps1' -RedisUrl '$RedisUrl'"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Servers launched!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "`nGateway:     http://localhost:3100" -ForegroundColor Gray
Write-Host "Health:      http://localhost:3100/health" -ForegroundColor Gray
Write-Host "API Info:    http://localhost:3100/api/info" -ForegroundColor Gray
Write-Host "`nTest Client: node test-client.js" -ForegroundColor Yellow
Write-Host "`nPress Ctrl+C in each window to stop servers" -ForegroundColor Gray
Write-Host "========================================`n" -ForegroundColor Cyan
