import { NextRequest, NextResponse } from 'next/server';

// This route handles payment processing through Agent A for data negotiation
export async function POST(request: NextRequest) {
  try {
    const { paymentToken, amount } = await request.json();
    
    if (!paymentToken) {
      return NextResponse.json(
        { error: 'Missing paymentToken' },
        { status: 400 }
      );
    }
    
    console.log('Processing payment through Agent A:', { paymentToken, amount });
    
    // Create the message for Agent A to execute the payment
    // Agent A will use its executePayment tool with the provided token
    const paymentMessage = `Please execute the payment using this token: ${paymentToken}`;
    
    // Send payment execution request to Agent A
    const response = await fetch('http://localhost:7576/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: paymentMessage }),
    });
    
    if (!response.ok) {
      console.error('Agent A payment response not OK:', response.status);
      throw new Error('Failed to execute payment through Agent A');
    }
    
    const result = await response.json();
    const agentResponse = result.text;
    
    console.log('Agent A payment response:', agentResponse);
    
    // Extract receipt JWT from response (starts with eyJ)
    const receiptMatch = agentResponse.match(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/);
    
    if (!receiptMatch) {
      // Payment might have failed
      return NextResponse.json({
        success: false,
        message: agentResponse,
        error: 'Payment failed or receipt not found in response'
      }, { status: 400 });
    }
    
    const receiptId = receiptMatch[0];
    
    return NextResponse.json({
      success: true,
      receiptId,
      amount,
      message: 'Payment processed successfully through Agent A',
      agentResponse,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in payment API:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process payment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
