#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}==================================${NC}"
echo -e "${BLUE}   Data Marketplace Demo Setup    ${NC}"
echo -e "${BLUE}==================================${NC}"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found!${NC}"
    echo "Please create a .env file with your credentials:"
    echo "  CLIENT_ID_AGENT_A=your_client_id_a"
    echo "  CLIENT_SECRET_AGENT_A=your_client_secret_a"
    echo "  CLIENT_ID_AGENT_B=your_client_id_b"
    echo "  CLIENT_SECRET_AGENT_B=your_client_secret_b"
    exit 1
fi

# Function to kill background processes on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down services...${NC}"
    kill $(jobs -p) 2>/dev/null
    exit
}

# Set up trap to catch exit signals
trap cleanup EXIT INT TERM

# Install dependencies if needed
echo -e "${GREEN}📦 Checking dependencies...${NC}"
if [ ! -d "node_modules" ]; then
    echo "Installing root dependencies..."
    pnpm install
fi

if [ ! -d "web-ui/node_modules" ]; then
    echo "Installing web UI dependencies..."
    cd web-ui && npm install && cd ..
fi

# Start the agent servers
echo ""
echo -e "${GREEN}🤖 Starting Agent Servers...${NC}"
npx tsx data-negotiation-agents-server.ts &
AGENTS_PID=$!

# Wait for agents to start
sleep 3

# Start the web UI
echo ""
echo -e "${GREEN}🌐 Starting Web UI...${NC}"
cd web-ui && npm run dev &
WEB_PID=$!

# Wait for web UI to start
sleep 3

echo ""
echo -e "${GREEN}✅ All services started successfully!${NC}"
echo ""
echo -e "${BLUE}Access the demo at:${NC}"
echo -e "  ${GREEN}➜${NC} Web UI: http://localhost:3000"
echo ""
echo -e "${BLUE}Agent endpoints:${NC}"
echo -e "  ${GREEN}➜${NC} Agent A (Researcher): http://localhost:7576"
echo -e "  ${GREEN}➜${NC} Agent B (Data Provider): http://localhost:7577"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Keep the script running
wait
