# EV Charger App - Development Setup Script
# V2.0 - Safe for Windows PowerShell

$ErrorActionPreference = "Stop"

# Fix for encoding issues in PowerShell 5.1
if ([console]::InputEncoding -ne [System.Text.Encoding]::UTF8) {
    [console]::InputEncoding = [System.Text.Encoding]::UTF8
    [console]::OutputEncoding = [System.Text.Encoding]::UTF8
}

Write-Host "`n--- EV Charger App Development Setup ---" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Check Docker
Write-Host "`n[STEP 1] Checking Docker..." -ForegroundColor Yellow
try {
    docker info | Out-Null
    Write-Host "[OK] Docker is running." -ForegroundColor Green
} catch {
    Write-Error "Docker is not running. Please start Docker Desktop and try again."
    exit 1
}

# 2. Start Containers
Write-Host "`n[STEP 2] Starting Postgres and Redis..." -ForegroundColor Yellow
docker compose up -d
Write-Host "[OK] Docker containers started." -ForegroundColor Green

# Wait for Postgres
Write-Host "       Waiting for Database to be ready..." -ForegroundColor Gray
Start-Sleep -Seconds 5
$attempts = 0
do {
    $attempts++
    try {
        docker compose exec -T postgres pg_isready -U user -d ev_app | Out-Null
        break
    } catch {
        Write-Host "       ...waiting ($attempts)"
        Start-Sleep -Seconds 2
    }
} while ($attempts -lt 15)
Write-Host "[OK] Database is ready." -ForegroundColor Green

# 3. Backend Setup
Write-Host "`n[STEP 3] Setting up Backend..." -ForegroundColor Yellow
Push-Location back-end

Write-Host "       Installing dependencies..."
npm install | Out-Null
Write-Host "[OK] Backend dependencies installed." -ForegroundColor Green

if (-not (Test-Path .env)) {
    Write-Host "       Creating .env file..."
    @"
DATABASE_URL=postgresql://user:pass@localhost:5432/ev_app
REDIS_URL=redis://localhost:6379
JWT_SECRET=supersecretkey
PORT=9876
ENTSOE_TOKEN=97d0b853-32c7-41c4-b819-f30869b35682
ENABLE_PRICING=1
STRIPE_SECRET_KEY=sk_test_51SoNW7Qo2CKKZoiNYzjJEbJmxfiKb0JyoPwvHYst2ofoisB6LnieocFMGHp2MfGinjKu76EcVlG0VASwR4HAmDHa006oB6TZsu
"@ | Out-File -FilePath .env -Encoding UTF8
    Write-Host "[OK] Backend .env created." -ForegroundColor Green
} else {
    Write-Host "[INFO] Backend .env already exists." -ForegroundColor Gray
}

Write-Host "       Syncing database schema..."
npx prisma db push --accept-data-loss
Write-Host "[OK] Schema synced." -ForegroundColor Green

Write-Host "       Seeding database..."
npx prisma db seed
Write-Host "[OK] Database seeded (Admin user created)." -ForegroundColor Green

Pop-Location

# 4. Frontend Setup
Write-Host "`n[STEP 4] Setting up Frontend..." -ForegroundColor Yellow
Push-Location front-end

Write-Host "       Installing dependencies..."
npm install | Out-Null
Write-Host "[OK] Frontend dependencies installed." -ForegroundColor Green

if (-not (Test-Path .env.local)) {
    Write-Host "       Creating .env.local file..."
    @"
NEXT_PUBLIC_API_URL=http://localhost:9876/api/v1
NEXT_PUBLIC_WEB3FORMS_KEY=d8086a1c-b517-4ada-b228-856ac4495cff
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51SoNW7Qo2CKKZoiNZPjJfkzPgvWeNPdyvuksD992vPJmR5lKSkZ7m6y4bWOxBSwO2nikVY1PyFN3F4W1kxhYXVJW00DH3CBRwO
"@ | Out-File -FilePath .env.local -Encoding UTF8
    Write-Host "[OK] Frontend .env.local created." -ForegroundColor Green
} else {
    Write-Host "[INFO] Frontend .env.local already exists." -ForegroundColor Gray
}

Pop-Location

# 5. CLI Setup (NEW SECTION)
Write-Host "`n[STEP 5] Setting up CLI Tool..." -ForegroundColor Yellow
# Έλεγχος αν ο φάκελος λέγεται 'cli' ή 'cli-client'. Προσαρμόστε ανάλογα.
if (Test-Path "cli") { Push-Location cli } elseif (Test-Path "cli-client") { Push-Location cli-client } else {
    Write-Warning "CLI folder not found. Skipping CLI setup."
}

if ((Get-Location).Path -match "cli") {
    Write-Host "       Installing CLI dependencies..."
    npm install | Out-Null
    
    Write-Host "       Linking command globally..."
    npm link
    Write-Host "[OK] CLI installed. You can use 'se2502' command." -ForegroundColor Green
    Pop-Location
}

# 6. Load Demo Chargers
Write-Host "`n[STEP 6] Loading demo charger data..." -ForegroundColor Yellow
Push-Location back-end
$backendJob = Start-Job -ScriptBlock { 
    Set-Location $using:PWD
    npm run dev 2>&1 | Out-Null
}
Start-Sleep -Seconds 8

try {
    $loginBody = '{"email":"admin@ev.local","password":"admin123"}'
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:9876/api/v1/auth/signin" -Method POST -Body $loginBody -ContentType "application/json"
    $token = $loginResponse.token

    if ($token) {
        $headers = @{ "Authorization" = "Bearer $token" }
        $resetResponse = Invoke-RestMethod -Uri "http://localhost:9876/api/v1/admin/resetpoints" -Method POST -Headers $headers
        Write-Host "[OK] Demo data loaded: $($resetResponse.message)" -ForegroundColor Green
    }
} catch {
    Write-Host "[WARN] Could not load demo data automatically. Run 'se2502 resetpoints' later." -ForegroundColor Yellow
}

Stop-Job -Job $backendJob -ErrorAction SilentlyContinue
Remove-Job -Job $backendJob -ErrorAction SilentlyContinue
Pop-Location

# Final Output
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "       SETUP COMPLETE SUCCESSFULLY      " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Default Admin:"
Write-Host "  Email:    admin@ev.local"
Write-Host "  Password: admin123"
Write-Host ""
Write-Host "INSTRUCTIONS:"
Write-Host "1. Open Terminal 1 (Backend):" -ForegroundColor Cyan
Write-Host "   cd back-end; npm run dev"
Write-Host ""
Write-Host "2. Open Terminal 2 (Frontend):" -ForegroundColor Cyan
Write-Host "   cd front-end; npm run dev"
Write-Host ""
Write-Host "3. Open Terminal 3 (CLI / Data):" -ForegroundColor Cyan
Write-Host "   se2502 login --username admin@ev.local --passw admin123"
Write-Host "   se2502 resetpoints  <-- Run this to load initial stations!"
Write-Host ""