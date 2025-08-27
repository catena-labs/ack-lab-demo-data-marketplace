#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_color() {
    echo -e "${1}${2}${NC}"
}

print_color "$CYAN" "🚀 ACK Data Marketplace Demo Setup"
print_color "$BLUE" "===================================="
echo ""

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_color "$YELLOW" "📝 Creating .env file..."
    # Create .env with required first two lines
    echo "DECODE_JWT=true" > .env
    echo "NODE_NO_WARNINGS=1" >> .env
    print_color "$GREEN" "✅ .env file created with required settings"
else
    print_color "$GREEN" "✅ .env file found"
    
    # Check if required lines exist, add them if missing
    NEEDS_UPDATE=false
    
    # Check for DECODE_JWT
    if ! grep -q "^DECODE_JWT=" .env 2>/dev/null; then
        NEEDS_UPDATE=true
    fi
    
    # Check for NODE_NO_WARNINGS
    if ! grep -q "^NODE_NO_WARNINGS=" .env 2>/dev/null; then
        NEEDS_UPDATE=true
    fi
    
    # If either is missing, we need to restructure the file
    if [ "$NEEDS_UPDATE" = true ]; then
        print_color "$YELLOW" "📝 Updating .env file with required settings..."
        
        # Create a temporary file with the required lines first
        TEMP_FILE=$(mktemp)
        
        # Add required lines at the top
        echo "DECODE_JWT=true" > "$TEMP_FILE"
        echo "NODE_NO_WARNINGS=1" >> "$TEMP_FILE"
        
        # Add existing content, skipping any existing DECODE_JWT or NODE_NO_WARNINGS lines
        while IFS= read -r line || [ -n "$line" ]; do
            if [[ ! "$line" =~ ^DECODE_JWT= ]] && [[ ! "$line" =~ ^NODE_NO_WARNINGS= ]] && [ -n "$line" ]; then
                echo "$line" >> "$TEMP_FILE"
            fi
        done < .env
        
        # Replace the original file
        mv "$TEMP_FILE" .env
        print_color "$GREEN" "✅ .env file updated with required settings"
    else
        # Check if the values are correct
        UPDATE_DECODE_JWT=false
        UPDATE_NODE_NO_WARNINGS=false
        
        if grep -q "^DECODE_JWT=" .env 2>/dev/null; then
            CURRENT_DECODE_JWT=$(grep "^DECODE_JWT=" .env | cut -d'=' -f2)
            if [ "$CURRENT_DECODE_JWT" != "true" ]; then
                UPDATE_DECODE_JWT=true
            fi
        fi
        
        if grep -q "^NODE_NO_WARNINGS=" .env 2>/dev/null; then
            CURRENT_NODE_NO_WARNINGS=$(grep "^NODE_NO_WARNINGS=" .env | cut -d'=' -f2)
            if [ "$CURRENT_NODE_NO_WARNINGS" != "1" ]; then
                UPDATE_NODE_NO_WARNINGS=true
            fi
        fi
        
        if [ "$UPDATE_DECODE_JWT" = true ] || [ "$UPDATE_NODE_NO_WARNINGS" = true ]; then
            print_color "$YELLOW" "📝 Correcting values in .env file..."
            
            if [ "$UPDATE_DECODE_JWT" = true ]; then
                sed -i.bak "s|^DECODE_JWT=.*|DECODE_JWT=true|" .env && rm .env.bak
            fi
            
            if [ "$UPDATE_NODE_NO_WARNINGS" = true ]; then
                sed -i.bak "s|^NODE_NO_WARNINGS=.*|NODE_NO_WARNINGS=1|" .env && rm .env.bak
            fi
            
            print_color "$GREEN" "✅ .env values corrected"
        fi
    fi
fi

# Load existing .env if it exists
if [ -f ".env" ]; then
    set -a
    source .env 2>/dev/null || true
    set +a
fi

echo ""
print_color "$BLUE" "🔧 Checking required credentials..."

# Required environment variables
REQUIRED_VARS=("ANTHROPIC_API_KEY" "CLIENT_ID_AGENT_A" "CLIENT_SECRET_AGENT_A" "CLIENT_ID_AGENT_B" "CLIENT_SECRET_AGENT_B")
OPTIONAL_VARS=("BUYER_BUDGET")
MISSING_VARS=()

# Check which variables are missing
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ] && ! grep -q "^${var}=" .env 2>/dev/null; then
        MISSING_VARS+=("$var")
    fi
done

# If we have missing variables, prompt for them
if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    print_color "$YELLOW" "⚠️  Missing required credentials!"
    echo ""
    print_color "$BLUE" "This demo requires:"
    print_color "$BLUE" "• Anthropic API Key for AI capabilities (claude-sonnet model)"
    print_color "$BLUE" "• ACK Lab SDK credentials for two agents:"
    print_color "$BLUE" "  - Agent A: Marketplace buyer agent with a configurable budget (default \$10)"
    print_color "$BLUE" "  - Agent B: Marketplace seller agent with data resources"
    echo ""
    print_color "$BLUE" "Get Anthropic API key from: https://console.anthropic.com/"
    print_color "$BLUE" "Get ACK Lab credentials from: https://ack-lab.catenalabs.com"
    echo ""

    for var in "${MISSING_VARS[@]}"; do
        case $var in
            "ANTHROPIC_API_KEY")
                print_color "$CYAN" "Enter your Anthropic API Key:"
                ;;
            "CLIENT_ID_AGENT_A")
                print_color "$CYAN" "Enter CLIENT_ID for Agent A (Marketplace Buyer):"
                ;;
            "CLIENT_SECRET_AGENT_A")
                print_color "$CYAN" "Enter CLIENT_SECRET for Agent A (Marketplace Buyer):"
                ;;
            "CLIENT_ID_AGENT_B")
                print_color "$CYAN" "Enter CLIENT_ID for Agent B (Marketplace Seller):"
                ;;
            "CLIENT_SECRET_AGENT_B")
                print_color "$CYAN" "Enter CLIENT_SECRET for Agent B (Marketplace Seller):"
                ;;
        esac
        
        read -p "> " value
        
        if [ -n "$value" ]; then
            # Check if the variable already exists in .env, update it, otherwise append
            if grep -q "^${var}=" .env 2>/dev/null; then
                # Use different delimiters to avoid issues with special characters
                sed -i.bak "s|^${var}=.*|${var}=${value}|" .env && rm .env.bak
            else
                echo "${var}=${value}" >> .env
            fi
            print_color "$GREEN" "✅ ${var} saved to .env"
        else
            print_color "$RED" "❌ ${var} is required for the demo to work!"
            print_color "$YELLOW" "You can add it manually to the .env file later."
        fi
        echo ""
    done

    # Reload environment after updates
    set -a
    source .env 2>/dev/null || true
    set +a
else
    print_color "$GREEN" "✅ All required credentials are configured"
fi

# Check optional BUYER_BUDGET
if [ -z "$BUYER_BUDGET" ] && ! grep -q "^BUYER_BUDGET=" .env 2>/dev/null; then
    print_color "$CYAN" "\n💰 Buyer Budget Configuration"
    print_color "$YELLOW" "Set the budget for the marketplace buyer agent (default: \$10)"
    print_color "$YELLOW" "Press Enter to use the default value of \$10"
    read -p "> \$" budget_value
    
    # Use default if empty
    if [ -z "$budget_value" ]; then
        budget_value="10"
        print_color "$GREEN" "✅ Using default budget: \$10"
    else
        # Validate that it's a number
        if ! [[ "$budget_value" =~ ^[0-9]+$ ]]; then
            print_color "$RED" "❌ Invalid budget value. Using default: \$10"
            budget_value="10"
        else
            print_color "$GREEN" "✅ Budget set to: \$$budget_value"
        fi
    fi
    
    # Save to .env
    echo "BUYER_BUDGET=$budget_value" >> .env
    
    # Reload environment
    set -a
    source .env 2>/dev/null || true
    set +a
fi

echo ""
print_color "$BLUE" "📦 Installing root dependencies..."

# Check if node_modules exists, if not or if package.json is newer, install
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    print_color "$YELLOW" "Running npm install..."
    
    # Check if npm is available
    if ! command -v npm &> /dev/null; then
        print_color "$RED" "❌ npm is not installed. Please install Node.js and npm first."
        exit 1
    fi
    
    npm install
    
    if [ $? -eq 0 ]; then
        print_color "$GREEN" "✅ Root dependencies installed successfully"
    else
        print_color "$RED" "❌ Failed to install dependencies"
        exit 1
    fi
else
    print_color "$GREEN" "✅ Root dependencies are up to date"
fi

echo ""
# Check if running on Replit or similar environment
if [ -n "$REPLIT_DEV_DOMAIN" ]; then
    print_color "$GREEN" "🌐 Running on Replit!"
    print_color "$BLUE" "Domain: $REPLIT_DEV_DOMAIN"
    ENVIRONMENT="replit"
else
    print_color "$YELLOW" "💻 Running locally"
    ENVIRONMENT="local"
fi

# Final check that all required variables are set
FINAL_CHECK_FAILED=false
for var in "${REQUIRED_VARS[@]}"; do
    # Re-source the .env file to get latest values
    set -a
    source .env 2>/dev/null || true
    set +a
    
    if [ -z "${!var}" ]; then
        print_color "$RED" "❌ ${var} is still not set!"
        FINAL_CHECK_FAILED=true
    fi
done

if [ "$FINAL_CHECK_FAILED" = true ]; then
    print_color "$RED" "❌ Cannot start demo without all required credentials."
    print_color "$YELLOW" "Please add the missing credentials to your .env file and run this script again."
    exit 1
fi

echo ""
print_color "$BLUE" "🎯 Starting Data Negotiation Agents Server..."
print_color "$YELLOW" "This will start two agent servers:"
# Get the budget value from environment
if [ -n "$BUYER_BUDGET" ]; then
    BUDGET_DISPLAY="\$$BUYER_BUDGET"
else
    BUDGET_DISPLAY="\$10"
fi
print_color "$YELLOW" "• Agent A (Marketplace Buyer): Port 7576 - Has a $BUDGET_DISPLAY budget"
print_color "$YELLOW" "• Agent B (Marketplace Seller): Port 7577 - Offers data resources"
echo ""

# Start the agents server in the background
print_color "$GREEN" "🚀 Starting agent servers..."
npx tsx data-negotiation-agents-server.ts &
AGENTS_PID=$!

# Wait a bit for the servers to start
sleep 3

# Check if agents are running
AGENT_A_RUNNING=false
AGENT_B_RUNNING=false

for i in {1..5}; do
    if curl -f -s http://localhost:7576 > /dev/null 2>&1; then
        AGENT_A_RUNNING=true
    fi
    if curl -f -s http://localhost:7577 > /dev/null 2>&1; then
        AGENT_B_RUNNING=true
    fi
    
    if [ "$AGENT_A_RUNNING" = true ] && [ "$AGENT_B_RUNNING" = true ]; then
        break
    fi
    
    sleep 1
done

if [ "$AGENT_A_RUNNING" = true ] && [ "$AGENT_B_RUNNING" = true ]; then
    print_color "$GREEN" "✅ Both agent servers are running!"
else
    print_color "$YELLOW" "⚠️  Agent servers may still be starting..."
fi

# Display service endpoints
print_color "$BLUE" "\nAgent Server Endpoints:"
if [ "$ENVIRONMENT" = "replit" ]; then
    # On Replit, ports are forwarded: 7576->3000, 7577->3001
    print_color "$GREEN" "  • Agent A (Marketplace Buyer): https://$REPLIT_DEV_DOMAIN:3000"
    print_color "$GREEN" "  • Agent B (Marketplace Seller): https://$REPLIT_DEV_DOMAIN:3001"
else
    print_color "$GREEN" "  • Agent A (Marketplace Buyer): http://localhost:7576"
    print_color "$GREEN" "  • Agent B (Marketplace Seller): http://localhost:7577"
fi

echo ""
print_color "$BLUE" "📊 Available Data Resources:"
print_color "$CYAN" "  1. US Housing Market Inventory 2024 - \$300 (negotiable to \$200)"
print_color "$CYAN" "  2. SPY Ticker Data (365 days) - \$350 (negotiable to \$250)"
print_color "$CYAN" "  3. LLM Benchmarking Study 2024 - \$200 (negotiable to \$150)"
# Display actual budget from environment
if [ -n "$BUYER_BUDGET" ]; then
    print_color "$YELLOW" "  💰 Buyer Budget: \$$BUYER_BUDGET"
else
    print_color "$YELLOW" "  💰 Buyer Budget: \$10 (default)"
fi

echo ""
print_color "$GREEN" "🚀 Ready to start CLI Demo..."
print_color "$YELLOW" "You can interact with the agents directly from the command line."
print_color "$YELLOW" "Type /exit to quit the CLI demo."
print_color "$CYAN" "Or use Ctrl+C to force exit the demo.\n"

print_color "$CYAN" "Press Enter to start the demo..."
read

print_color "$GREEN" "🚀 Starting CLI Demo...\n"

# Run the CLI demo
npx tsx cli-demos/data-negotiation-demo.ts
