import { NextRequest, NextResponse } from 'next/server';

// This route starts a data negotiation with Agent A
export async function POST(request: NextRequest) {
  try {
    const { resourceId, researchTopic } = await request.json();
    
    if (!resourceId || !researchTopic) {
      return NextResponse.json(
        { error: 'Missing resourceId or researchTopic' },
        { status: 400 }
      );
    }
    
    // Send the initial message to Agent A to start looking for data
    const message = `I need data about ${researchTopic}`;
    
    console.log('Starting negotiation for:', resourceId);
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
    const priceMatch = agentResponse.match(/\$(\d+)/g);
    const paymentTokenMatch = agentResponse.match(/pay_[a-zA-Z0-9._-]+/);
    const resourceNameMatch = agentResponse.match(/US Housing Market|SPY.*Ticker|LLM.*Study/i);
    
    return NextResponse.json({
      success: true,
      message: agentResponse,
      resourceName: resourceNameMatch?.[0],
      prices: priceMatch?.map(p => parseInt(p.replace('$', ''))),
      paymentToken: paymentTokenMatch?.[0],
      negotiationStarted: true
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
