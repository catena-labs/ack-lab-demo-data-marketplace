import { NextRequest, NextResponse } from 'next/server';

// This route continues an ongoing negotiation conversation with Agent A
export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();
    
    if (!message) {
      return NextResponse.json(
        { error: 'Missing message' },
        { status: 400 }
      );
    }
    
    console.log('Continuing negotiation, sending to Agent A:', message);
    
    // Send the message to Agent A
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
    const receiptMatch = agentResponse.match(/receipt[:\s]+([^\s]+)/i);
    const downloadUrlMatch = agentResponse.match(/https?:\/\/[^\s]+/);
    
    // Determine the negotiation status
    let status = 'negotiating';
    if (downloadUrlMatch) {
      status = 'complete';
    } else if (paymentTokenMatch || receiptMatch) {
      status = 'payment';
    } else if (agentResponse.toLowerCase().includes('accept')) {
      status = 'accepted';
    }
    
    return NextResponse.json({
      success: true,
      message: agentResponse,
      prices: priceMatches?.map((p: string) => parseInt(p.replace('$', ''))),
      paymentToken: paymentTokenMatch?.[0],
      receiptId: receiptMatch?.[1],
      downloadUrl: downloadUrlMatch?.[0],
      status,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in negotiation continue API:', error);
    return NextResponse.json(
      { 
        error: 'Failed to continue negotiation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
