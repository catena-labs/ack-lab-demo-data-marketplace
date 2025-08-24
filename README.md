# Data Marketplace Demo

A visual and interactive demonstration of AI agents negotiating data purchases in a research marketplace. This demo showcases agent-to-agent communication where a researcher agent negotiates with a data provider agent to purchase research resources within a budget.

## 🎯 Demo Overview

This demo simulates a real-world scenario where:
- **Agent A (Researcher)** has a $275 budget and needs research data
- **Agent B (Data Provider)** offers various research resources at different prices
- The agents negotiate prices automatically, with the provider having minimum acceptable prices
- Once agreed, payment is processed and access tokens are provided

## 📊 Available Data Resources

1. **US Housing Market Inventory 2024**
   - Format: CSV, 12 MB
   - List Price: $300 (negotiable down to $200)
   - Comprehensive housing data across US metro areas

2. **SPY Minute-Level Ticker Data (365 days)**
   - Format: CSV, 5 MB  
   - List Price: $350 (negotiable down to $250)
   - Minute-by-minute S&P 500 ETF ticker data

3. **Comprehensive LLM Benchmarking Study 2024**
   - Format: PDF, 2.5 MB
   - List Price: $200 (negotiable down to $150)
   - Academic paper on LLM performance benchmarks

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- pnpm (or npm)
- API credentials from ACK Lab

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ack-data-marketplace-demo
   ```

2. **Create `.env` file** with your ACK Lab credentials:
   ```env
   CLIENT_ID_AGENT_A=your_client_id_for_agent_a
   CLIENT_SECRET_AGENT_A=your_client_secret_for_agent_a
   CLIENT_ID_AGENT_B=your_client_id_for_agent_b
   CLIENT_SECRET_AGENT_B=your_client_secret_for_agent_b
   ```

3. **Run the demo**
   ```bash
   ./start-demo.sh
   ```

   This will:
   - Install all dependencies
   - Start the agent servers (ports 7576 & 7577)
   - Launch the web UI (port 3000)
   - Open your browser to http://localhost:3000

### Alternative Manual Setup

If you prefer to run services separately:

1. **Install dependencies**
   ```bash
   pnpm install
   cd web-ui && npm install
   ```

2. **Start agent servers** (in one terminal)
   ```bash
   npx tsx data-negotiation-agents-server.ts
   ```

3. **Start web UI** (in another terminal)
   ```bash
   cd web-ui
   npm run dev
   ```

## 🎮 Using the Demo

### Web Interface

1. **Browse Catalog**: View available research resources with prices
2. **Start Negotiation**: Click on any resource card to begin
3. **Watch Negotiation**: See real-time agent conversation and price negotiations
4. **Payment Process**: Observe automatic payment processing
5. **Access Token**: Receive access token upon successful transaction

### Visual Features

- **Data Catalog Tab**: Browse available resources with pricing indicators
- **Negotiation Tab**: Live conversation view with price offers and counter-offers
- **Transaction Tab**: Payment processing and access token delivery
- **Budget Display**: Shows researcher's available budget ($275)
- **Price Indicators**: Visual cues for resources over budget

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                 │     │                  │     │                 │
│   Web UI        │────▶│  Agent A         │────▶│  Agent B        │
│  (Next.js)      │     │  (Researcher)    │     │  (Data Provider)│
│                 │     │  Port: 7576      │     │  Port: 7577     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                       │                         │
        │                       └─────────────────────────┘
        │                                 │
        │                           ACK Lab SDK
        │                          (Payment Processing)
        ▼
   User Interface
   - Data Catalog
   - Negotiation View  
   - Transaction Status
```

## 📁 Project Structure

```
ack-data-marketplace-demo/
├── data-negotiation-agents-server.ts  # Agent server implementation
├── web-ui/                            # Next.js web interface
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/                  # API routes for negotiation
│   │   │   └── page.tsx              # Main page
│   │   └── components/
│   │       └── data-negotiation-interface.tsx  # Main UI component
├── cli-demos/                         # CLI version of the demo
├── start-demo.sh                      # Quick start script
└── .env                              # Environment variables
```

## 🔧 Configuration

### Agent Budget
- Researcher budget: $275 (configured in `data-negotiation-agents-server.ts`)

### Minimum Prices
- Housing data: $200
- Ticker data: $250  
- LLM paper: $150

### Negotiation Strategy
- Researcher starts at 80-85% of list price if over budget
- Provider counters with prices between offer and list price
- Automatic acceptance when price is within budget

## 🐛 Troubleshooting

### Port Already in Use
If ports 3000, 7576, or 7577 are already in use:
```bash
# Kill processes on specific ports
lsof -ti:3000 | xargs kill
lsof -ti:7576 | xargs kill  
lsof -ti:7577 | xargs kill
```

### Missing Dependencies
```bash
# Reinstall all dependencies
rm -rf node_modules web-ui/node_modules
pnpm install
cd web-ui && npm install
```

### Environment Variables
Ensure `.env` file has all required credentials:
- CLIENT_ID_AGENT_A
- CLIENT_SECRET_AGENT_A
- CLIENT_ID_AGENT_B
- CLIENT_SECRET_AGENT_B

## 📝 Notes

- The demo uses mock data and simulated transactions for demonstration purposes
- Payment tokens and access tokens are generated locally
- The negotiation logic can be customized in `data-negotiation-agents-server.ts`
- UI components can be modified in `web-ui/src/components/`

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

## 📄 License

MIT