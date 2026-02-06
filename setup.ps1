# EV Charger App - Development Setup Script (Windows PowerShell)
# This script sets up the development environment for a new developer

$ErrorActionPreference = "Stop"

Write-Host "`n🚀 EV Charger App - Development Setup" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

# Check if Docker is running
Write-Host "`nChecking Docker..." -ForegroundColor Yellow
try {
    docker info | Out-Null
    Write-Host "✓ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop and try again." -ForegroundColor Red
    exit 1
}

# Start Docker containers (Postgres & Redis)
Write-Host "`nStarting Docker containers (Postgres & Redis)..." -ForegroundColor Yellow
docker compose up -d
Write-Host "✓ Docker containers started" -ForegroundColor Green

# Wait for Postgres to be ready
Write-Host "`nWaiting for Postgres to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
$attempts = 0
do {
    $attempts++
    try {
        docker compose exec -T postgres pg_isready -U user -d ev_app | Out-Null
        break
    } catch {
        Write-Host "Waiting for Postgres... (attempt $attempts)"
        Start-Sleep -Seconds 2
    }
} while ($attempts -lt 15)
Write-Host "✓ Postgres is ready" -ForegroundColor Green

# Install backend dependencies
Write-Host "`nInstalling backend dependencies..." -ForegroundColor Yellow
Set-Location back-end
npm install
Write-Host "✓ Backend dependencies installed" -ForegroundColor Green

# Create backend .env file if it doesn't exist
if (-not (Test-Path .env)) {
    Write-Host "`nCreating backend .env file..." -ForegroundColor Yellow
    @"
DATABASE_URL=postgresql://user:pass@localhost:5432/ev_app
REDIS_URL=redis://localhost:6379
JWT_SECRET=supersecretkey
PORT=9876
ENTSOE_TOKEN=97d0b853-32c7-41c4-b819-f30869b35682
ENABLE_PRICING=1
STRIPE_SECRET_KEY=sk_test_51SoNW7Qo2CKKZoiNYzjJEbJmxfiKb0JyoPwvHYst2ofoisB6LnieocFMGHp2MfGinjKu76EcVlG0VASwR4HAmDHa006oB6TZsu
"@ | Out-File -FilePath .env -Encoding UTF8
    Write-Host "✓ Backend .env created" -ForegroundColor Green
} else {
    Write-Host "✓ Backend .env already exists" -ForegroundColor Green
}

# Sync database schema
Write-Host "`nSyncing database schema..." -ForegroundColor Yellow
npx prisma db push --accept-data-loss
Write-Host "✓ Database schema synced" -ForegroundColor Green

# Seed the database (creates admin user)
Write-Host "`nSeeding database (creating admin user)..." -ForegroundColor Yellow
npx prisma db seed
Write-Host "✓ Database seeded" -ForegroundColor Green

# Go back to root
Set-Location ..

# Install frontend dependencies
Write-Host "`nInstalling frontend dependencies..." -ForegroundColor Yellow
Set-Location front-end
npm install
Write-Host "✓ Frontend dependencies installed" -ForegroundColor Green

# Create frontend .env.local file if it doesn't exist
if (-not (Test-Path .env.local)) {
    Write-Host "`nCreating frontend .env.local file..." -ForegroundColor Yellow
    @"
NEXT_PUBLIC_API_URL=http://localhost:9876/api/v1
"@ | Out-File -FilePath .env.local -Encoding UTF8
    Write-Host "✓ Frontend .env.local created" -ForegroundColor Green
} else {
    Write-Host "✓ Frontend .env.local already exists" -ForegroundColor Green
}

Set-Location ..

# Start backend temporarily to load demo data
Write-Host "`nStarting backend temporarily to load demo data..." -ForegroundColor Yellow
Set-Location back-end
$backendJob = Start-Job -ScriptBlock { 
    Set-Location $using:PWD
    npm run dev 
}
Start-Sleep -Seconds 8

# Login as admin and load demo chargers
Write-Host "`nLoading demo charger data..." -ForegroundColor Yellow
try {
    $loginBody = '{"email":"admin@ev.local","password":"admin123"}'
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:9876/api/v1/auth/signin" -Method POST -Body $loginBody -ContentType "application/json"
    $token = $loginResponse.token

    if ($token) {
        $headers = @{ "Authorization" = "Bearer $token" }
        $resetResponse = Invoke-RestMethod -Uri "http://localhost:9876/api/v1/admin/resetpoints" -Method POST -Headers $headers
        Write-Host "✓ Demo data loaded: $($resetResponse.message)" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠ Could not load demo data (will need to be done manually)" -ForegroundColor Yellow
}

# Stop the temporary backend
Stop-Job -Job $backendJob -ErrorAction SilentlyContinue
Remove-Job -Job $backendJob -ErrorAction SilentlyContinue
Set-Location ..

Write-Host "`n======================================" -ForegroundColor Green
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "Default admin credentials:"
Write-Host "  Email:    admin@ev.local"
Write-Host "  Password: admin123"
Write-Host ""
Write-Host "To start the app, run these commands in separate terminals:"
Write-Host ""
Write-Host "  Terminal 1 (Backend):" -ForegroundColor Cyan
Write-Host "    cd back-end; npm run dev"
Write-Host ""
Write-Host "  Terminal 2 (Frontend):" -ForegroundColor Cyan
Write-Host "    cd front-end; npm run dev"
Write-Host ""
Write-Host "Then open http://localhost:3000 in your browser"
Write-Host ""
