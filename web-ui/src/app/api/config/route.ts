import { NextResponse } from 'next/server';

// Data catalogue and configuration matching the server
const dataCatalogue = [
  {
    id: "housing_inventory_2024",
    name: "US Housing Market Inventory 2024",
    description: "Comprehensive housing inventory data across all US metropolitan areas for 2024",
    format: "CSV",
    size: "12 MB",
    listPrice: 10,
    minimumPrice: 8,
    category: "housing"
  },
  {
    id: "spy_ticker_365d",
    name: "SPY Minute-Level Ticker Data (365 days)",
    description: "Minute-by-minute ticker data for SPDR S&P 500 ETF (SPY) for the last 365 days",
    format: "CSV",
    size: "5 MB",
    listPrice: 12,
    minimumPrice: 10,
    category: "ticker"
  },
  {
    id: "llm_benchmark_paper",
    name: "Comprehensive LLM Benchmarking Study 2024",
    description: "Academic paper analyzing performance benchmarks of major LLMs with detailed methodology",
    format: "PDF",
    size: "2.5 MB",
    listPrice: 13,
    minimumPrice: 12,
    category: "llm_paper"
  }
];

const RESEARCHER_BUDGET = parseInt(process.env.RESEARCHER_BUDGET || "10");
const MIN_PRICES = {
  housing: 8,
  ticker: 10,
  llm_paper: 12
};

// This route provides configuration data from the actual agents server
export async function GET() {
  return NextResponse.json({
    researcherBudget: RESEARCHER_BUDGET,
    minPrices: MIN_PRICES,
    dataCatalogue: dataCatalogue,
    agentAUrl: 'http://localhost:7576',
    agentBUrl: 'http://localhost:7577'
  });
}
