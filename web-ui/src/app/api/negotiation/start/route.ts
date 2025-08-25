import { NextRequest, NextResponse } from 'next/server';

// Import the data catalogue with proper typing
interface DataResource {
  id: string
  name: string
  description: string
  format: string
  size: string
  listPrice: number
  minimumPrice: number
  category: string
}

// Use dynamic import or define locally for now to avoid build issues
const dataCatalogue: DataResource[] = [
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

// This route starts a data negotiation with Agent A
export async function POST(request: NextRequest) {
  try {
    const { resourceId, researchTopic } = await request.json();
    
    if (!resourceId) {
      return NextResponse.json(
        { error: 'Missing resourceId' },
        { status: 400 }
      );
    }
    
    // Find the resource from the catalogue
    const resource = dataCatalogue.find((r: DataResource) => r.id === resourceId);
    if (!resource) {
      return NextResponse.json(
        { error: 'Resource not found' },
        { status: 404 }
      );
    }
    
    // Determine the appropriate research topic based on the resource
    let topic = researchTopic;
    if (!topic) {
      // Auto-select topic based on resource category
      if (resource.category === 'housing') {
        topic = 'housing market inventory';
      } else if (resource.category === 'ticker') {
        topic = 'ticker prices on S&P 500';
      } else if (resource.category === 'llm_paper') {
        topic = 'papers about LLMs';
      }
    }
    
    // Send the initial message to Agent A to start looking for data
    const message = `I need data about ${topic}`;
    
    console.log('Starting negotiation for resource:', resource.name);
    console.log('Research topic:', topic);
    console.log('Sending to Agent A:', message);
    
    const response = await fetch('http://localhost:7576/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });
    
    if (!response.ok) {
      console.error('Agent A response not OK:', response.status);
      throw new Error('Failed to communicate with Agent A');
    }
    
    const result = await response.json();
    const agentResponse = result.text;
    
    console.log('Agent A response:', agentResponse);
    
    // Parse the agent response to extract negotiation details
    const priceMatches = agentResponse.match(/\$(\d+)/g);
    // Extract JWT payment token (JWTs start with eyJ and have three base64 parts separated by dots)
    const paymentTokenMatch = agentResponse.match(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/);
    
    // Check if Agent B response is included (Agent A might have already contacted Agent B)
    const hasProviderResponse = agentResponse.includes('Provider') || agentResponse.includes('provider') || agentResponse.includes('Agent B');
    
    return NextResponse.json({
      success: true,
      message: agentResponse,
      resourceName: resource.name,
      resourceId: resource.id,
      prices: priceMatches?.map((p: string) => parseInt(p.replace('$', ''))),
      paymentToken: paymentTokenMatch?.[0],
      negotiationStarted: true,
      hasProviderResponse
    });
    
  } catch (error) {
    console.error('Error in negotiation start API:', error);
    return NextResponse.json(
      { 
        error: 'Failed to start negotiation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
