# ACK Data Marketplace Demo

![Agent Commerce Kit](./assets/README-Header.png)

[![Run on Replit](https://replit.com/badge?caption=Run%20on%20Replit)](https://replit.new/github.com/catena-labs/ack-data-marketplace-demo)

A demonstration of secure agent-to-agent commerce where autonomous AI agents negotiate and transact data purchases with built-in authentication and payment processing.

> ⚠️ **Important Notice**: This is a vibe-coded example project created for demonstration purposes. Unlike ACK-Lab and other production systems, this code has not undergone extensive testing or performance optimization. It's designed to showcase concepts and inspire ideas, not for production use.

## 🚀 Quick Start

### 1. Run on Replit (Easiest)
[![Run on Replit](https://replit.com/badge?caption=Run%20on%20Replit)](https://replit.new/github.com/catena-labs/ack-data-marketplace-demo)

### 2. Get Your Credentials
1. Go to [ack-lab.catenalabs.com](https://ack-lab.catenalabs.com)
2. Sign up for the developer preview
3. Register two agents through the app flow
4. Copy your credentials

### 3. Configure & Run
1. Click "Run" on Replit (or run `./setup-and-run.sh` locally)
2. Enter your credentials when prompted:
   - Anthropic API key. Note: This demo requires `claude-sonnet-4-20250514`. We cannot guarantee it works end-to-end with smaller models from Anthropic or other providers.
   - Agent A client ID & secret  
   - Agent B client ID & secret
3. Choose your demo mode (CLI or Web UI)

<div align="center">
  <img src="./assets/replit-run-icon.png" alt="Get Started on Replit" width="100">
</div>

## 📊 What This Demo Does

Watch two AI agents negotiate a data marketplace transaction:

- **Agent A (Marketplace Buyer)**: Has a budget and needs data resources
- **Agent B (Marketplace Seller)**: Offers premium datasets at negotiable prices
- **Real Payments**: Agents use ACK-Lab to process actual transactions
- **Secure Communication**: All agent-to-agent messages are authenticated and encrypted

### Available Datasets
1. **US Housing Market Inventory 2024**: $300 (negotiable down to $200)
2. **SPY Ticker Data (365 days)**: $350 (negotiable down to $250)  
3. **LLM Benchmarking Study 2024**: $200 (negotiable down to $150)

### Demo Modes
- **CLI Demo**: Watch agents negotiate in real-time through the terminal
- **Web UI**: Visual interface to monitor negotiations and transactions

## 🏗️ Technical Details

The demo spins up two independent agent servers that communicate via HTTP endpoints:

```
┌─────────────────┐                      ┌─────────────────┐
│   Agent A       │  HTTP POST /chat     │   Agent B       │
│ (Marketplace    │─────────────────────▶│ (Marketplace    │
│    Buyer)       │◀─────────────────────│    Seller)      │
│  Port: 7576     │                       │  Port: 7577     │
└─────────────────┘  Negotiation Flow    └─────────────────┘
        │                                          │
        └──────────────────┬───────────────────────┘
                           │
                    ACK Lab SDK
                 (api.ack-lab.com)
              ┌────────────┴────────────┐
              │ • Identity Verification  │
              │ • Payment Processing     │
              │ • Token Generation       │
              └─────────────────────────┘
```

### Environment Variables
```env
ANTHROPIC_API_KEY=your_anthropic_key
CLIENT_ID_AGENT_A=your_agent_a_client_id
CLIENT_SECRET_AGENT_A=your_agent_a_client_secret
CLIENT_ID_AGENT_B=your_agent_b_client_id  
CLIENT_SECRET_AGENT_B=your_agent_b_client_secret
BUYER_BUDGET=10  # Optional: Set custom budget (default: 10)
```

### Replit Port Configuration
- **Agent A**: Internal port 7576 → External port 3000
- **Agent B**: Internal port 7577 → External port 3001  
- **Web UI**: Internal port 3000 → External port 80

## 💻 Local Development

### Prerequisites
- Node.js 18+
- npm or pnpm
- ACK Lab credentials from [ack-lab.catenalabs.com](https://ack-lab.catenalabs.com)

### Setup
```bash
git clone <repository-url>
cd ack-private-data-marketplace
./setup-and-run.sh
```

### Local Access Points
- Agent A: `http://localhost:7576`
- Agent B: `http://localhost:7577`
- Web UI: `http://localhost:3000`

## 🐛 Troubleshooting

- **Missing credentials**: Get them from [ack-lab.catenalabs.com](https://ack-lab.catenalabs.com)
- **Not registered**: Complete the agent registration flow at ACK-Lab first
- **Port conflicts on Replit**: Check `.replit` file for correct port mappings
- **Connection refused**: Verify agent servers are running on correct ports
- **Payment failures**: Check ACK Lab API connectivity and credentials

## 📖 About Agent Commerce Kit (ACK)

**Agent Commerce Kit (ACK)** is an open-source framework by [Catena Labs](https://www.catenalabs.com) that enables AI agents to participate securely in commerce. 

### What ACK Provides

- **ACK-ID**: Verifiable agent identity through DIDs and VCs
- **ACK-Pay**: Agent-native payment patterns for diverse payment rails
- **ACK-Lab**: Developer preview platform providing identity, wallet, and rulebook for agents

ACK solves the fundamental challenge that today's financial infrastructure wasn't designed for AI agents - no identity standards, high transaction barriers, and limited support for agent-specific transaction models.

### Learn More

- [Agent Commerce Kit Documentation](https://agentcommercekit.com)
- [ACK-Lab Developer Preview](https://ack-lab.catenalabs.com)
- [Catena Labs](https://www.catenalabs.com)

## 📄 License

MIT