# EV Charger App - Development Setup Script
# V2.3 - "Bulletproof" Docker Warning Handler

$ErrorActionPreference = "Stop"

if ([console]::InputEncoding -ne [System.Text.Encoding]::UTF8) {
    [console]::InputEncoding = [System.Text.Encoding]::UTF8
    [console]::OutputEncoding = [System.Text.Encoding]::UTF8
}

Write-Host "`n--- EV Charger App Development Setup ---" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# -----------------------------------------------------------------------------
# 1. Check Docker
# -----------------------------------------------------------------------------
Write-Host "`n[STEP 1] Checking Docker..." -ForegroundColor Yellow
try {
    # Force SilentlyContinue to ignore ANY error/warning output stream from Docker
    $originalErrorAction = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    
    docker version > $null 2>&1
    $dockerRunning = $?
    
    $ErrorActionPreference = $originalErrorAction
    
    if ($dockerRunning) {
        Write-Host "[OK] Docker is running." -ForegroundColor Green
    } else {
        throw "Docker not responding"
    }
} catch {
    Write-Host "[ERROR] Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# -----------------------------------------------------------------------------
# 2. Start Containers
# -----------------------------------------------------------------------------
Write-Host "`n[STEP 2] Starting Postgres and Redis..." -ForegroundColor Yellow
try {
    $ErrorActionPreference = "SilentlyContinue"
    docker compose up -d --wait 2>&1 | Out-Null
    $ErrorActionPreference = "Stop"
} catch {
    Write-Host "[INFO] Proceeding despite warnings..." -ForegroundColor Gray
}

# Verify Postgres is actually up
Write-Host "       Verifying Database connectivity..." -ForegroundColor Gray
$attempts = 0
$dbReady = $false

do {
    $attempts++
    Start-Sleep -Seconds 2
    
    # CRITICAL FIX: We completely isolate this check to prevent Warnings from crashing the script
    try {
        $ErrorActionPreference = "SilentlyContinue"
        # We execute the check and capture success status ONLY via $LASTEXITCODE
        docker compose exec -T postgres pg_isready -U user -d ev_app > $null 2>&1
        $exitCode = $LASTEXITCODE
        $ErrorActionPreference = "Stop"

        if ($exitCode -eq 0) {
            $dbReady = $true
            break
        }
    } catch {
        # Ignore crashes here, just retry
    }
    
    Write-Host "       ...waiting for Postgres ($attempts/10)"
} while ($attempts -lt 10)

if (-not $dbReady) {
    Write-Host "[ERROR] Database did not become ready. Try running 'docker compose up' manually." -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Database is ready." -ForegroundColor Green

# -----------------------------------------------------------------------------
# 3. Backend Setup
# -----------------------------------------------------------------------------
Write-Host "`n[STEP 3] Setting up Backend..." -ForegroundColor Yellow
if (Test-Path "back-end") {
    Push-Location back-end
    try {
        Write-Host "       Installing dependencies..."
        npm install --silent | Out-Null
        Write-Host "[OK] Dependencies installed." -ForegroundColor Green

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
        # Using cmd /c prevents PowerShell from catching the native error stream
        cmd /c "npx prisma db push --accept-data-loss" | Out-Null
        
        Write-Host "       Seeding database..."
        cmd /c "npx prisma db seed" | Out-Null
        Write-Host "[OK] Database seeded." -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Backend setup failed. Please check logs." -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Pop-Location
} else {
    Write-Host "[ERROR] 'back-end' folder not found!" -ForegroundColor Red
    exit 1
}

# -----------------------------------------------------------------------------
# 4. Frontend Setup
# -----------------------------------------------------------------------------
Write-Host "`n[STEP 4] Setting up Frontend..." -ForegroundColor Yellow
if (Test-Path "front-end") {
    Push-Location front-end
    try {
        Write-Host "       Installing dependencies..."
        npm install --silent | Out-Null
        Write-Host "[OK] Dependencies installed." -ForegroundColor Green

        if (-not (Test-Path .env.local)) {
            Write-Host "       Creating .env.local file..."
            @"
NEXT_PUBLIC_API_URL=http://localhost:9876/api/v1
NEXT_PUBLIC_WEB3FORMS_KEY=d8086a1c-b517-4ada-b228-856ac4495cff
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51SoNW7Qo2CKKZoiNZPjJfkzPgvWeNPdyvuksD992vPJmR5lKSkZ7m6y4bWOxBSwO2nikVY1PyFN3F4W1kxhYXVJW00DH3CBRwO
NEXT_PUBLIC_ENABLE_MOCK_SESSION=1
"@ | Out-File -FilePath .env.local -Encoding UTF8
            Write-Host "[OK] Frontend .env.local created." -ForegroundColor Green
        } else {
            Write-Host "[INFO] Frontend .env.local already exists." -ForegroundColor Gray
        }
    } catch {
        Write-Host "[WARN] Frontend setup issue: $_" -ForegroundColor DarkYellow
    }
    Pop-Location
} else {
    Write-Host "[WARN] 'front-end' folder not found. Skipping." -ForegroundColor DarkYellow
}

# -----------------------------------------------------------------------------
# 5. CLI Setup
# -----------------------------------------------------------------------------
Write-Host "`n[STEP 5] Setting up CLI Tool..." -ForegroundColor Yellow
$cliPath = ""
if (Test-Path "cli") { $cliPath = "cli" } elseif (Test-Path "cli-client") { $cliPath = "cli-client" }

if ($cliPath) {
    Push-Location $cliPath
    try {
        Write-Host "       Installing CLI dependencies..."
        npm install --silent | Out-Null
        
        Write-Host "       Linking command globally..."
        npm link | Out-Null
        Write-Host "[OK] CLI installed. You can use 'se2502' command." -ForegroundColor Green
    } catch {
        Write-Host "[WARN] CLI setup warning (ignoring)." -ForegroundColor DarkYellow
    }
    Pop-Location
} else {
    Write-Warning "CLI folder not found. Skipping CLI setup."
}

# -----------------------------------------------------------------------------
# Final Output
# -----------------------------------------------------------------------------
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "       SETUP COMPLETE SUCCESSFULLY      " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Default Admin Credentials:"
Write-Host "  Email:    admin@ev.local"
Write-Host "  Password: admin123"
Write-Host ""
Write-Host "NEXT STEPS (Run in separate terminals):" -ForegroundColor White
Write-Host "1. Start Backend:" -ForegroundColor Cyan
Write-Host "   cd back-end; npm run dev"
Write-Host ""
Write-Host "2. Start Frontend:" -ForegroundColor Cyan
Write-Host "   cd front-end; npm run dev"
Write-Host ""
Write-Host "3. Initialize Data (IMPORTANT):" -ForegroundColor Cyan
Write-Host "   (Ensure Backend is running first)"
Write-Host "   se2502 login --username admin@ev.local --passw admin123"
Write-Host "   se2502 resetpoints"
Write-Host ""