#!/bin/bash

# EV Charger App - Development Setup Script
# This script sets up the development environment for a new developer

set -e  # Exit on any error

echo "🚀 EV Charger App - Development Setup"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
echo -e "\n${YELLOW}Checking Docker...${NC}"
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker Desktop and try again.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"

# Start Docker containers (Postgres & Redis)
echo -e "\n${YELLOW}Starting Docker containers (Postgres & Redis)...${NC}"
docker compose up -d
echo -e "${GREEN}✓ Docker containers started${NC}"

# Wait for Postgres to be ready
echo -e "\n${YELLOW}Waiting for Postgres to be ready...${NC}"
sleep 3
until docker compose exec -T postgres pg_isready -U user -d ev_app > /dev/null 2>&1; do
    echo "Waiting for Postgres..."
    sleep 2
done
echo -e "${GREEN}✓ Postgres is ready${NC}"

# Install backend dependencies
echo -e "\n${YELLOW}Installing backend dependencies...${NC}"
cd back-end
npm install
echo -e "${GREEN}✓ Backend dependencies installed${NC}"

# Create backend .env file if it doesn't exist
if [ ! -f .env ]; then
    echo -e "\n${YELLOW}Creating backend .env file...${NC}"
    cat > .env << EOF
DATABASE_URL=postgresql://user:pass@localhost:5432/ev_app
REDIS_URL=redis://localhost:6379
JWT_SECRET=supersecretkey
PORT=9876
ENTSOE_TOKEN=97d0b853-32c7-41c4-b819-f30869b35682
ENABLE_PRICING=1
STRIPE_SECRET_KEY=sk_test_51SoNW7Qo2CKKZoiNYzjJEbJmxfiKb0JyoPwvHYst2ofoisB6LnieocFMGHp2MfGinjKu76EcVlG0VASwR4HAmDHa006oB6TZsu
EOF
    echo -e "${GREEN}✓ Backend .env created${NC}"
else
    echo -e "${GREEN}✓ Backend .env already exists${NC}"
fi

# Run database migrations
echo -e "\n${YELLOW}Syncing database schema...${NC}"
npx prisma db push --accept-data-loss
echo -e "${GREEN}✓ Database schema synced${NC}"

# Seed the database (creates admin user)
echo -e "\n${YELLOW}Seeding database (creating admin user)...${NC}"
npx prisma db seed
echo -e "${GREEN}✓ Database seeded${NC}"

# Go back to root
cd ..

# Install frontend dependencies
echo -e "\n${YELLOW}Installing frontend dependencies...${NC}"
cd front-end
npm install
echo -e "${GREEN}✓ Frontend dependencies installed${NC}"

# Create frontend .env.local file if it doesn't exist
if [ ! -f .env.local ]; then
    echo -e "\n${YELLOW}Creating frontend .env.local file...${NC}"
    cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:9876/api/v1
NEXT_PUBLIC_WEB3FORMS_KEY=d8086a1c-b517-4ada-b228-856ac4495cff
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51SoNW7Qo2CKKZoiNZPjJfkzPgvWeNPdyvuksD992vPJmR5lKSkZ7m6y4bWOxBSwO2nikVY1PyFN3F4W1kxhYXVJW00DH3CBRwO
EOF
    echo -e "${GREEN}✓ Frontend .env.local created${NC}"
else
    echo -e "${GREEN}✓ Frontend .env.local already exists${NC}"
fi

cd ..

# Install CLI tool
echo -e "\n${YELLOW}Setting up CLI tool...${NC}"
if [ -d "cli" ]; then
    cd cli
elif [ -d "cli-client" ]; then
    cd cli-client
else
    echo -e "${YELLOW}⚠ CLI folder not found. Skipping CLI setup.${NC}"
fi

if [[ $(pwd) == *"cli"* ]]; then
    npm install
    npm link
    echo -e "${GREEN}✓ CLI installed. You can use 'se2502' command.${NC}"
    cd ..
fi

# Start backend in background and load demo data
echo -e "\n${YELLOW}Starting backend temporarily to load demo data...${NC}"
cd back-end
npm run dev &
BACKEND_PID=$!
sleep 5

# Login as admin and load demo chargers
echo -e "\n${YELLOW}Loading demo charger data...${NC}"
TOKEN=$(curl -s -X POST http://localhost:9876/api/v1/auth/signin \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@ev.local","password":"admin123"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
    RESULT=$(curl -s -X POST http://localhost:9876/api/v1/admin/resetpoints \
        -H "Authorization: Bearer $TOKEN")
    echo -e "${GREEN}✓ Demo data loaded: $RESULT${NC}"
else
    echo -e "${YELLOW}⚠ Could not load demo data (will need to be done manually)${NC}"
fi

# Stop the temporary backend
kill $BACKEND_PID 2>/dev/null || true
cd ..

echo -e "\n${GREEN}======================================"
echo "✅ Setup Complete!"
echo "======================================${NC}"
echo ""
echo "Default admin credentials:"
echo "  Email:    admin@ev.local"
echo "  Password: admin123"
echo ""
echo "To start the app, run these commands in separate terminals:"
echo ""
echo "  Terminal 1 (Backend):"
echo "    cd back-end && npm run dev"
echo ""
echo "  Terminal 2 (Frontend):"
echo "    cd front-end && npm run dev"
echo ""
echo "Then open http://localhost:3000 in your browser"
echo ""
