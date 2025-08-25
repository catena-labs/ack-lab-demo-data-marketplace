import "dotenv/config"
import { generateText, stepCountIs, tool } from "ai"
import { serveAgent, serveAuthedAgent } from "./serve-agent"
import { anthropic } from "@ai-sdk/anthropic"
import { z } from "zod"
import { AckLabSdk } from "@ack-hub/sdk"
import { logger } from "./logger"

// Configuration
const DECODE_JWT = true // Flag to decode and display JWT payloads
const RESEARCHER_BUDGET = parseInt(process.env.RESEARCHER_BUDGET || "10") // Maximum budget for Agent A (from env or default 275)
const MIN_PRICES = {
  housing: 8,    // Minimum price for housing market data
  ticker: 10,     // Minimum price for ticker data
  llm_paper: 12   // Minimum price for LLM research paper
}

// Agent B SDK instance for payment handling
const agentBSdk = new AckLabSdk({
  // baseUrl: "https://api.ack-lab.com",
  clientId: process.env.CLIENT_ID_AGENT_B!,
  clientSecret: process.env.CLIENT_SECRET_AGENT_B!
})

// Data catalogue
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

const dataCatalogue: DataResource[] = [
  {
    id: "housing_inventory_2024",
    name: "US Housing Market Inventory 2024",
    description: "Comprehensive housing inventory data across all US metropolitan areas for 2024",
    format: "CSV",
    size: "12 MB",
    listPrice: 10,
    minimumPrice: MIN_PRICES.housing,
    category: "housing"
  },
  {
    id: "spy_ticker_365d",
    name: "SPY Minute-Level Ticker Data (365 days)",
    description: "Minute-by-minute ticker data for SPDR S&P 500 ETF (SPY) for the last 365 days",
    format: "CSV",
    size: "5 MB",
    listPrice: 12,
    minimumPrice: MIN_PRICES.ticker,
    category: "ticker"
  },
  {
    id: "llm_benchmark_paper",
    name: "Comprehensive LLM Benchmarking Study 2024",
    description: "Academic paper analyzing performance benchmarks of major LLMs with detailed methodology",
    format: "PDF",
    size: "2.5 MB",
    listPrice: 13,
    minimumPrice: MIN_PRICES.llm_paper,
    category: "llm_paper"
  }
]

// Store pending negotiations and completed transactions
interface PendingNegotiation {
  resource: DataResource
  currentOffer: number
  negotiationRound: number
  paymentToken?: string
}

const pendingNegotiations = new Map<string, PendingNegotiation>()
const completedTransactions = new Map<string, { resourceId: string; finalPrice: number }>()
let lastProvidedPaymentToken: string | null = null // Track the last payment token provided

// Generate access token
function generateAccessToken(resourceId: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  return `access_${resourceId}_${timestamp}_${random}`
}

// Randomly select research topic
function getRandomResearchTopic(): string {
  const topics = [
    "housing market inventory",
    "ticker prices on S&P 500",
    "papers about LLMs"
  ]
  return topics[Math.floor(Math.random() * topics.length)]
}

async function runAgentB(message: string) {
  const result = await generateText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: `You are a data provider agent with a catalogue of research resources. 
    
    Your available resources are:
    ${dataCatalogue.map(r => `- ${r.name}: ${r.description} (${r.format}, ${r.size}) - List price: $${r.listPrice}`).join('\n')}
    
    WORKFLOW:
    1. When someone requests data: Use findMatchingResource to identify which resource matches their needs
    2. Present the resource with its list price and ask if they want to proceed
    3. If they negotiate: You can go down to minimum price but no lower
    4. Once price is agreed: Use createDataPaymentRequest to generate a payment token
    5. CRITICAL - When buyer confirms payment with a receipt:
       a. First, use getLastPaymentToken to retrieve the payment token you provided
       b. Then immediately use provideAccessDataURL with BOTH:
          - paymentToken: the token from getLastPaymentToken (or extract from your previous message)
          - receiptId: the receipt JWT the buyer just provided
       c. Share the resulting download URL with the buyer
    
    EXAMPLE FLOW when buyer provides receipt:
    Buyer: "Payment completed! Here's my receipt: eyJ..."
    You should:
    1. Call getLastPaymentToken() to get the payment token
    2. Call provideAccessDataURL(paymentToken: [from step 1], receiptId: "eyJ...")
    3. Respond: "Perfect! Here's your direct download URL: [downloadUrl from step 2]"
    
    DO NOT apologize for technical difficulties or say there's an issue with validation.
    The provideAccessDataURL tool WILL work if you provide both tokens correctly.
    NEVER return a payment token as an access token or download URL - they are completely different.
    
    Minimum prices (do not go below these):
    - Housing data: $${MIN_PRICES.housing}
    - Ticker data: $${MIN_PRICES.ticker}
    - LLM paper: $${MIN_PRICES.llm_paper}`,
    prompt: message,
    tools: {
      findMatchingResource: tool({
        description: "Find a resource that matches the user's research needs",
        inputSchema: z.object({
          query: z.string().describe("What the user is looking for")
        }),
        execute: async ({ query }) => {
          logger.process('Searching catalogue', { query })
          
          // Simple keyword matching
          let matchedResource: DataResource | undefined
          
          if (query.toLowerCase().includes("housing") || query.toLowerCase().includes("real estate")) {
            matchedResource = dataCatalogue.find(r => r.category === "housing")
          } else if (query.toLowerCase().includes("ticker") || query.toLowerCase().includes("spy") || query.toLowerCase().includes("s&p")) {
            matchedResource = dataCatalogue.find(r => r.category === "ticker")
          } else if (query.toLowerCase().includes("llm") || query.toLowerCase().includes("language model")) {
            matchedResource = dataCatalogue.find(r => r.category === "llm_paper")
          }
          
          if (matchedResource) {
            logger.success('Found matching resource', matchedResource.name)
            return {
              found: true,
              resource: matchedResource
            }
          }
          
          return {
            found: false,
            message: "No matching resources found in our catalogue"
          }
        }
      }),
      negotiatePrice: tool({
        description: "Handle price negotiation for a resource",
        inputSchema: z.object({
          resourceId: z.string().describe("ID of the resource being negotiated"),
          offeredPrice: z.number().describe("Price offered by the buyer"),
          negotiationId: z.string().describe("Unique ID for this negotiation session")
        }),
        execute: async ({ resourceId, offeredPrice, negotiationId }) => {
          const resource = dataCatalogue.find(r => r.id === resourceId)
          if (!resource) {
            return { error: "Resource not found" }
          }
          
          let negotiation = pendingNegotiations.get(negotiationId)
          if (!negotiation) {
            negotiation = {
              resource,
              currentOffer: offeredPrice,
              negotiationRound: 1
            }
            pendingNegotiations.set(negotiationId, negotiation)
          } else {
            negotiation.currentOffer = offeredPrice
            negotiation.negotiationRound++
          }
          
          logger.market('Negotiation', {
            'Resource': resource.name,
            'Offered': `$${offeredPrice}`,
            'List price': `$${resource.listPrice}`,
            'Minimum': `$${resource.minimumPrice}`
          })
          
          if (offeredPrice >= resource.listPrice) {
            return {
              accepted: true,
              finalPrice: resource.listPrice,
              message: "Offer accepted at list price"
            }
          } else if (offeredPrice >= resource.minimumPrice) {
            return {
              accepted: true,
              finalPrice: offeredPrice,
              message: "Offer accepted"
            }
          } else {
            // Counter offer
            const counterOffer = Math.max(
              resource.minimumPrice,
              Math.floor((offeredPrice + resource.listPrice) / 2)
            )
            
            return {
              accepted: false,
              counterOffer,
              minimumPrice: resource.minimumPrice,
              message: `Cannot accept $${offeredPrice}. Minimum price is $${resource.minimumPrice}. Would you accept $${counterOffer}?`
            }
          }
        }
      }),
      createDataPaymentRequest: tool({
        description: "Create a payment request for agreed data purchase - generates a payment token that buyer will use to pay",
        inputSchema: z.object({
          resourceId: z.string().describe("ID of the resource being purchased"),
          agreedPrice: z.number().describe("Final agreed price"),
          negotiationId: z.string().describe("Negotiation session ID - use the same ID throughout the conversation")
        }),
        execute: async ({ resourceId, agreedPrice, negotiationId }) => {
          const resource = dataCatalogue.find(r => r.id === resourceId)
          if (!resource) {
            return { error: "Resource not found" }
          }
          
          logger.transaction('Creating payment request', {
            'Resource': resource.name,
            'Agreed price': `$${agreedPrice}`
          })
          
          // Create payment request (price in cents)
          const { paymentToken } = await agentBSdk.createPaymentRequest(
            agreedPrice * 100,
            `Purchase: ${resource.name}`
          )
          
          // Update negotiation with payment token
          const negotiation = pendingNegotiations.get(negotiationId)
          if (negotiation) {
            negotiation.paymentToken = paymentToken
          }
          
          // Store as last provided payment token
          lastProvidedPaymentToken = paymentToken
          
          logger.info('Payment token generated', paymentToken)
          
          // Decode and display JWT payload if flag is enabled
          if (DECODE_JWT) {
            const tokenParts = paymentToken.split('.')
            if (tokenParts.length === 3) {
              try {
                const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString())
                logger.debug('Decoded JWT payload', payload)
              } catch {
                logger.warn('Could not decode payment token as JWT')
              }
            }
          }
          
          return {
            paymentToken,
            amount: agreedPrice,
            resource: {
              name: resource.name,
              format: resource.format,
              size: resource.size
            },
            instruction: `Please pay $${agreedPrice} using this payment token to receive access to the data`
          }
        }
      }),
      getLastPaymentToken: tool({
        description: "ALWAYS use this first when buyer provides a receipt - retrieves the payment token you previously gave them",
        inputSchema: z.object({}),
        execute: async () => {
          if (lastProvidedPaymentToken) {
            return {
              paymentToken: lastProvidedPaymentToken,
              message: "Found the last payment token provided"
            }
          }
          return {
            paymentToken: null,
            message: "No payment token has been provided yet"
          }
        }
      }),
      provideAccessDataURL: tool({
        description: "MUST use this when buyer provides receipt - generates direct download URL for confirmed payment. Call getLastPaymentToken first to get the paymentToken",
        inputSchema: z.object({
          paymentToken: z.string().describe("The payment token YOU provided earlier (get from getLastPaymentToken)"),
          receiptId: z.string().describe("The receipt JWT the buyer just provided (starts with eyJ)")
        }),
        execute: async ({ paymentToken, receiptId }) => {
          // Find the negotiation with this payment token
          let foundNegotiation: PendingNegotiation | undefined
          let negotiationId: string | undefined
          
          for (const [id, negotiation] of pendingNegotiations) {
            if (negotiation.paymentToken === paymentToken) {
              foundNegotiation = negotiation
              negotiationId = id
              break
            }
          }
          
          if (!foundNegotiation || !negotiationId) {
            return { error: "Payment token not found or invalid" }
          }
          
          // Check if already completed
          if (completedTransactions.has(paymentToken)) {
            return { error: "This transaction has already been completed" }
          }
          
          // Generate access token for URL
          const accessToken = generateAccessToken(foundNegotiation.resource.id)
          
          // Create download URL
          const downloadUrl = `https://data-provider.example.com/download/${foundNegotiation.resource.id}?token=${accessToken}`
          
          // Mark as completed
          completedTransactions.set(paymentToken, {
            resourceId: foundNegotiation.resource.id,
            finalPrice: foundNegotiation.currentOffer
          })
          pendingNegotiations.delete(negotiationId)
          
          logger.success('Download URL generated', downloadUrl)
          
          return {
            success: true,
            downloadUrl,
            resource: {
              name: foundNegotiation.resource.name,
              format: foundNegotiation.resource.format,
              size: foundNegotiation.resource.size
            },
            accessDetails: {
              url: downloadUrl,
              validUntil: "48 hours from now",
              accessKey: accessToken
            },
            receipt: receiptId,
            message: "Payment confirmed. Here is your direct download URL for the data."
          }
        }
      })
    },
    stopWhen: stepCountIs(8)
  })

  return result.text
}

// Agent A SDK instance
const agentASdk = new AckLabSdk({
  // baseUrl: "https://api.ack-lab.com",
  clientId: process.env.CLIENT_ID_AGENT_A!,
  clientSecret: process.env.CLIENT_SECRET_AGENT_A!
})

const callAgent = agentASdk.createAgentCaller("http://localhost:7577/chat")

async function runAgentA(message: string) {
  const researchTopic = getRandomResearchTopic()
  const researchBudget = RESEARCHER_BUDGET
  
  const result = await generateText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: `You are a researcher agent looking for data and research resources.
    
    You are currently researching: ${researchTopic}
    Your research budget is: $${researchBudget}
    
    When you find a suitable resource:
    1. Express interest in the resource
    2. If the price is over your budget, negotiate by offering something reasonable but under budget
    3. Be willing to meet in the middle during negotiations
    4. Once you agree on a price, pay using the payment token provided.
    5. Give the data provider BOTH the payment token and the receipt ID.
    6. You'll receive an access URL for the data
    
    Negotiation strategy:
    - Start by offering about 80-85% of the list price if it's over budget
    - Be willing to go up to your budget limit
    - If they counter-offer at or below your budget, accept it
    
    IMPORTANT: Always use the exact paymentToken provided by the data provider.`,
    prompt: message,
    tools: {
      callDataProvider: tool({
        description: "Call the data provider agent to request data or negotiate",
        inputSchema: z.object({
          message: z.string()
        }),
        execute: async ({ message }) => {
          logger.agent('Calling data provider', message)
          try {
            const response = await callAgent({ message })
            logger.incoming('Data provider response', response)
            
            // Try to extract and decode payment token if present (JWT format)
            // JWTs start with eyJ and have three base64 parts separated by dots
            const paymentTokenMatch = response.match(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/)
            if (paymentTokenMatch) {
              const paymentToken = paymentTokenMatch[0]
              logger.process('Detected payment token (JWT)', { token: paymentToken.substring(0, 50) + '...' })
              
              // Decode payment token if it's a JWT
              if (DECODE_JWT) {
                try {
                  const tokenParts = paymentToken.split('.')
                  if (tokenParts.length === 3) {
                    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString())
                    logger.debug('Payment token JWT payload', payload)
                  }
                } catch {
                  logger.warn('Payment token is not a valid JWT')
                }
              }
            }
            
            return response
          } catch (error) {
            logger.error('Error calling data provider', error)
            return {
              error: true,
              message: error instanceof Error ? error.message : "Unknown error"
            }
          }
        }
      }),
      executePayment: tool({
        description: "Execute payment for data purchase",
        inputSchema: z.object({
          paymentToken: z.string().describe("The exact payment token received from the data provider")
        }),
        execute: async ({ paymentToken }) => {
          logger.transaction('Executing payment', { token: paymentToken })
          
          try {
            // Decode the payment token to see its contents if flag is enabled
            if (DECODE_JWT) {
              const tokenParts = paymentToken.split('.')
              if (tokenParts.length === 3) {
                try {
                  const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString())
                  logger.debug('Decoded JWT payload', payload)
                } catch {
                  logger.warn('Could not decode payment token as JWT')
                }
              }
            }
            
            const result = await agentASdk.executePayment(paymentToken)

            const receiptJwt = result.receipt
            logger.success('Payment successful!', `Receipt ID: ${receiptJwt}`)
            
            return {
              success: true,
              receiptId: receiptJwt,
              message: "Payment completed successfully"
            }
          } catch (error) {
            logger.error('Payment failed', error)
            
            if (error instanceof Error) {
              logger.error('Error details', error.message)
            }
            
            const errorWithResponse = error as { response?: { data?: unknown } }
            
            return {
              success: false,
              error: error instanceof Error ? error.message : "Payment failed",
              details: errorWithResponse.response?.data || (error instanceof Error ? error.message : undefined)
            }
          }
        }
      })
    },
    stopWhen: stepCountIs(12) // More steps for negotiation
  })

  return result.text
}

export function startAgentServers() {
  // Start Agent A server on port 7576
  serveAgent({
    port: 7576,
    runAgent: runAgentA,
    decodeJwt: DECODE_JWT
  })

  // Start Agent B server on port 7577
  serveAuthedAgent({
    port: 7577,
    runAgent: runAgentB,
    sdk: agentBSdk,
    decodeJwt: DECODE_JWT
  })

  logger.section('AGENT SERVERS STARTED')
  logger.server('Agent A (Researcher)', 'http://localhost:7576')
  logger.server('Agent B (Data Provider)', 'http://localhost:7577')
  logger.info('Demos are now ready to communicate with these agents.')
  logger.separator()
}

// Export additional data for the UI
export { dataCatalogue, RESEARCHER_BUDGET, MIN_PRICES, DECODE_JWT }

// If this file is run directly, start the servers
if (import.meta.url === `file://${process.argv[1]}`) {
  startAgentServers()
}
