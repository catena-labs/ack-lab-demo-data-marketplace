# Data Negotiation Marketplace - Web UI

An educational web interface demonstrating AI agents negotiating data prices in real-time using the ACK Lab SDK.

## 🎯 Overview

This web UI provides a visual, interactive demonstration of automated data negotiation between AI agents:

- **Real-time Agent Communication**: Watch as Agent A (researcher) and Agent B (data provider) negotiate prices
- **Automated Negotiation**: See agents automatically negotiate based on budgets and minimum prices
- **Step-by-Step Process Visualization**: Follow the entire negotiation and payment flow
- **Transaction Results**: View download URLs and access tokens for completed purchases

## 🚀 Getting Started

### Prerequisites

1. **Start the Agent Servers** (from the root project directory):
   ```bash
   node data-negotiation-agents-server.ts
   ```
   
   This will start:
   - Agent A (Researcher) on `http://localhost:7576`
   - Agent B (Data Provider) on `http://localhost:7577`

2. **Install Web UI Dependencies** (in a new terminal, from the web-ui directory):
   ```bash
   cd web-ui
   npm install
   ```

3. **Start the Development Server**:
   ```bash
   npm run dev
   ```

4. **Open the Application**:
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser

## 📊 Features

### Data Catalogue
Browse available research data resources:
- **Housing Market Data**: US housing inventory for 2024
- **Ticker Data**: SPY minute-level data for 365 days  
- **Research Papers**: LLM benchmarking studies

### Negotiation Process
Watch automated price negotiation in real-time:
1. **Browse**: Select a data resource from the catalogue
2. **Negotiate**: Agents automatically negotiate based on:
   - List price vs researcher budget
   - Minimum acceptable prices
   - Counter-offers and acceptance logic
3. **Payment**: Automated payment execution via ACK Lab SDK
4. **Complete**: Data is added to your Purchased Data tab with download URL

### Purchased Data
Once a negotiation completes successfully:
- The resource button changes from "Negotiating..." to "Purchased"
- Purchased datasets appear in the "Purchased Data" tab
- Each purchase includes:
  - Download URL and access token
  - Purchase price and timestamp
  - Copy URL functionality for easy access

### Visual Indicators
- **Progress Bar**: Track negotiation phases (Browse → Negotiate → Payment → Complete)
- **Message Timeline**: See the full conversation between agents
- **Price Badges**: Visual price indicators throughout negotiation
- **Status Updates**: Real-time status of negotiation progress

## 🏗 Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Web UI    │────▶│   Agent A    │────▶│   Agent B    │
│  (Next.js)  │     │ (Researcher) │     │(Data Provider│
└─────────────┘     └──────────────┘     └──────────────┘
                          │                      │
                          └─────── SDK ──────────┘
                            (ACK Lab SDK)
```

## 📁 Project Structure

```
web-ui/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── config/           # Configuration endpoint
│   │   │   └── negotiation/      # Negotiation API routes
│   │   │       ├── start/        # Start negotiation
│   │   │       ├── continue/     # Continue negotiation
│   │   │       └── pay/          # Execute payment
│   │   ├── layout.tsx            # Root layout
│   │   └── page.tsx              # Home page
│   ├── components/
│   │   ├── ui/                   # shadcn/ui components
│   │   └── data-negotiation-interface.tsx # Main interface component
│   └── lib/
│       └── utils.ts              # Utility functions
├── package.json
└── README.md
```

## 🔧 Configuration

The system uses environment variables for configuration:
- `RESEARCHER_BUDGET`: Maximum budget for Agent A (default: $10)

Minimum prices are configured in the server:
- Housing data: $8
- Ticker data: $10
- LLM papers: $12

## 🎓 Educational Value

This demo illustrates:
- **Agent-to-Agent Communication**: How AI agents can negotiate autonomously
- **Price Discovery**: Automated negotiation based on constraints
- **Payment Processing**: SDK-based payment execution
- **Data Marketplace Dynamics**: Supply, demand, and price equilibrium

## 🛠 Technologies

- **Next.js 14**: App Router for modern React development
- **TypeScript**: Type-safe code throughout
- **shadcn/ui**: Beautiful, accessible UI components
- **Tailwind CSS**: Utility-first styling
- **ACK Lab SDK**: Agent communication and payments

## 📝 License

This is an educational demo project.