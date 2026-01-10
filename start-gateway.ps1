# Start Gateway Server
# Handles all client WebSocket connections

param(
    [string]$ServerId = "gateway-1",
    [int]$Port = 3100,
    [string]$RedisUrl = "redis://localhost:6379"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "World of Darkness - Gateway Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Server ID: $ServerId" -ForegroundColor Gray
Write-Host "Port: $Port" -ForegroundColor Gray
Write-Host "Redis: $RedisUrl" -ForegroundColor Gray
Write-Host "========================================`n" -ForegroundColor Cyan

# Set environment variables
$env:SERVER_ID = $ServerId
$env:GATEWAY_PORT = $Port
$env:REDIS_URL = $RedisUrl

# Start server
npm run dev:gateway
