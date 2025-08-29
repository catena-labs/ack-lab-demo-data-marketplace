import "dotenv/config"
import { generateText, stepCountIs, tool } from "ai"
import { serveAgent, serveAuthedAgent } from "./serve-agent"
import { anthropic } from "@ai-sdk/anthropic"
import { z } from "zod"
import { AckLabSdk } from "@ack-lab/sdk"
import { logger } from "./logger"

// ===== Configuration =====
const CONFIG = {
  DECODE_JWT: true,
  BUYER_BUDGET: parseInt(process.env.BUYER_BUDGET || "10"),
  MIN_PRICES: {
    housing: 8,
    ticker: 10,
    llm_paper: 12
  },
  PORTS: {
    buyer: 7576,
    seller: 7577
  },
  API: {
    baseUrl: process.env.ACK_LAB_BASE_URL ?? "https://api.ack-lab.com",
    marketplaceBuyer: {
      clientId: process.env.CLIENT_ID_MARKETPLACE_BUYER || "",
      clientSecret: process.env.CLIENT_SECRET_MARKETPLACE_BUYER || ""
    },
    marketplaceSeller: {
      clientId: process.env.CLIENT_ID_MARKETPLACE_SELLER || "",
      clientSecret: process.env.CLIENT_SECRET_MARKETPLACE_SELLER || ""
    }
  }
}

// ===== Data Models =====
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

interface PendingNegotiation {
  resource: DataResource
  currentOffer: number
  negotiationRound: number
  paymentToken?: string
}

// ===== Data Catalogue =====
const dataCatalogue: DataResource[] = [
  {
    id: "housing_inventory_2024",
    name: "US Housing Market Inventory 2024",
    description: "Comprehensive housing inventory data across all US metropolitan areas for 2024",
    format: "CSV",
    size: "12 MB",
    listPrice: 10,
    minimumPrice: CONFIG.MIN_PRICES.housing,
    category: "housing"
  },
  {
    id: "spy_ticker_365d",
    name: "SPY Minute-Level Ticker Data (365 days)",
    description: "Minute-by-minute ticker data for SPDR S&P 500 ETF (SPY) for the last 365 days",
    format: "CSV",
    size: "5 MB",
    listPrice: 12,
    minimumPrice: CONFIG.MIN_PRICES.ticker,
    category: "ticker"
  },
  {
    id: "llm_benchmark_paper",
    name: "Comprehensive LLM Benchmarking Study 2024",
    description: "Academic paper analyzing performance benchmarks of major LLMs with detailed methodology",
    format: "PDF",
    size: "2.5 MB",
    listPrice: 13,
    minimumPrice: CONFIG.MIN_PRICES.llm_paper,
    category: "llm_paper"
  }
]

// ===== Transaction Management =====
const pendingNegotiations = new Map<string, PendingNegotiation>()
const completedTransactions = new Map<string, { resourceId: string; finalPrice: number }>()

// ===== SDK Instances =====
function validateEnvironmentVariables() {
  const required = [
    'CLIENT_ID_MARKETPLACE_BUYER',
    'CLIENT_SECRET_MARKETPLACE_BUYER', 
    'CLIENT_ID_MARKETPLACE_SELLER',
    'CLIENT_SECRET_MARKETPLACE_SELLER'
  ]
  
  const missing = required.filter(key => !process.env[key])
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}

const marketplaceSellerSdk = new AckLabSdk({
  baseUrl: CONFIG.API.baseUrl,
  clientId: CONFIG.API.marketplaceSeller.clientId,
  clientSecret: CONFIG.API.marketplaceSeller.clientSecret
})

const marketplaceBuyerSdk = new AckLabSdk({
  baseUrl: CONFIG.API.baseUrl,
  clientId: CONFIG.API.marketplaceBuyer.clientId,
  clientSecret: CONFIG.API.marketplaceBuyer.clientSecret
})

const callAgent = marketplaceBuyerSdk.createAgentCaller(`http://localhost:${CONFIG.PORTS.seller}/chat`)

// ===== Helper Functions =====
function generateAccessToken(resourceId: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  return `access_${resourceId}_${timestamp}_${random}`
}

function getRandomResearchTopic(): string {
  const topics = [
    "housing market inventory",
    "ticker prices on S&P 500",
    "papers about LLMs"
  ]
  return topics[Math.floor(Math.random() * topics.length)]
}

function decodeJwtPayload(token: string): object | null {
  try {
    const tokenParts = token.split('.')
    if (tokenParts.length !== 3) return null
    return JSON.parse(Buffer.from(tokenParts[1], 'base64').toString())
  } catch {
    return null
  }
}

function logJwtIfEnabled(token: string, description: string) {
  if (!CONFIG.DECODE_JWT) return
  
  const payload = decodeJwtPayload(token)
  if (payload) {
    logger.debug(description, payload)
  } else {
    logger.warn(`Could not decode ${description}`)
  }
}

function findResourceByQuery(query: string): DataResource | undefined {
  const lowerQuery = query.toLowerCase()
  
  if (lowerQuery.includes("housing") || lowerQuery.includes("real estate")) {
    return dataCatalogue.find(r => r.category === "housing")
  }
  
  if (lowerQuery.includes("ticker") || lowerQuery.includes("spy") || lowerQuery.includes("s&p")) {
    return dataCatalogue.find(r => r.category === "ticker")
  }
  
  if (lowerQuery.includes("llm") || lowerQuery.includes("language model")) {
    return dataCatalogue.find(r => r.category === "llm_paper")
  }
  
  return undefined
}

// ===== Marketplace Seller Tools =====
const sellerTools = {
  findMatchingResource: tool({
    description: "Find a resource that matches the user's research needs",
    inputSchema: z.object({
      query: z.string().describe("What the user is looking for")
    }),
    execute: async ({ query }) => {
      logger.process('Searching catalogue', { query })
      
      const matchedResource = findResourceByQuery(query)
      
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
      if (!resource) return { error: "Resource not found" }
      
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
      }
      
      if (offeredPrice >= resource.minimumPrice) {
        return {
          accepted: true,
          finalPrice: offeredPrice,
          message: "Offer accepted"
        }
      }
      
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
  }),

  createDataPaymentRequest: tool({
    description: "Create a payment request for agreed data purchase",
    inputSchema: z.object({
      resourceId: z.string().describe("ID of the resource being purchased"),
      agreedPrice: z.number().describe("Final agreed price"),
      negotiationId: z.string().describe("Negotiation session ID")
    }),
    execute: async ({ resourceId, agreedPrice, negotiationId }) => {
      const resource = dataCatalogue.find(r => r.id === resourceId)
      if (!resource) return { error: "Resource not found" }
      
      logger.transaction('Creating payment request', {
        'Resource': resource.name,
        'Agreed price': `$${agreedPrice}`
      })
      
      const { url: paymentRequestUrl, paymentToken } = await marketplaceSellerSdk.createPaymentRequest(
        agreedPrice * 100,
        { description: `Purchase: ${resource.name}`}
      )

      const negotiation = pendingNegotiations.get(negotiationId)
      if (negotiation) {
        negotiation.paymentToken = paymentToken
      } else {
        pendingNegotiations.set(negotiationId, {
          resource,
          currentOffer: agreedPrice,
          negotiationRound: 1,
          paymentToken
        })
      }
      
      logger.info('Payment request generated', paymentRequestUrl)
      
      return {
        paymentRequestUrl,
        amount: agreedPrice,
        resource: {
          name: resource.name,
          format: resource.format,
          size: resource.size
        },
        instruction: `Please pay $${agreedPrice} using this payment request URL to receive access to the data`
      }
    }
  }),



  provideAccessDataURL: tool({
    description: "Generates direct download URL for confirmed payment using receipt URL",
    inputSchema: z.object({
      receiptUrl: z.string().describe("The receipt URL the buyer provided")
    }),
    execute: async ({ receiptUrl }) => {
      const receiptJwt = await fetch(receiptUrl).then(res => res.text())
      // Extract payment token from receipt JWT
      const receiptPayload = decodeJwtPayload(receiptJwt) as any
      if (!receiptPayload || !receiptPayload.vc?.credentialSubject?.paymentToken) {
        return { error: "Invalid receipt or missing payment token in receipt" }
      }
      const paymentToken = receiptPayload.vc.credentialSubject.paymentToken
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
      
      if (completedTransactions.has(paymentToken)) {
        return { error: "This transaction has already been completed" }
      }
      
      const accessToken = generateAccessToken(foundNegotiation.resource.id)
      const downloadUrl = `https://data-provider.example.com/download/${foundNegotiation.resource.id}?token=${accessToken}`
      
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
        receiptUrl,
        message: "Payment confirmed. Here is your direct download URL for the data."
      }
    }
  })
}

// ===== Marketplace Buyer Tools =====
const buyerTools = {
  callSeller: tool({
    description: "Call the marketplace seller agent to request data or negotiate",
    inputSchema: z.object({
      message: z.string()
    }),
    execute: async ({ message }) => {
      logger.agent('Calling marketplace seller', message)
      
      try {
        const response = await callAgent({ message })
        logger.incoming('Marketplace seller response', response)
        return response
      } catch (error) {
        logger.error('Error calling marketplace seller', error)
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
      paymentRequestUrl: z.string().describe("The payment request URL received from the marketplace seller")
    }),
    execute: async ({ paymentRequestUrl }) => {
      const paymentToken = await fetch(paymentRequestUrl).then(res => res.text())

      logger.transaction('Executing payment', { url: paymentRequestUrl })
      
      logJwtIfEnabled(paymentToken, 'Payment token being executed')
      
      try {
        const result = await marketplaceBuyerSdk.executePayment(paymentToken)
        
        logger.success('Payment successful!', `Receipt: ${result.url}`)
        
        return {
          success: true,
          receiptUrl: result.url,
          message: "Payment completed successfully"
        }
      } catch (error) {
        logger.error('Payment failed', error)
        
        const errorWithResponse = error as { response?: { data?: unknown } }
        
        return {
          success: false,
          error: error instanceof Error ? error.message : "Payment failed",
          details: errorWithResponse.response?.data || 
                   (error instanceof Error ? error.message : undefined)
        }
      }
    }
  })
}

// ===== Marketplace Seller =====
async function runMarketplaceSeller(message: string) {
  const catalogueDescription = dataCatalogue
    .map(r => `- ${r.name}: ${r.description} (${r.format}, ${r.size}) - List price: $${r.listPrice}`)
    .join('\n')

  const result = await generateText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: `You are a marketplace seller agent with a catalogue of data resources. 
    
    Your available resources are:
    ${catalogueDescription}
    
    WORKFLOW:
    1. When someone requests data: Use findMatchingResource to identify which resource matches their needs
    2. Present the resource with its list price and ask if they want to proceed
    3. If they negotiate: You can go down to minimum price but no lower
    4. Once price is agreed: Use createDataPaymentRequest to generate a payment request URL
    5. CRITICAL - When buyer confirms payment with a receipt:
       a. Use provideAccessDataURL with the receipt URL the buyer provided
       b. Share the resulting download URL with the buyer
    
    DO NOT apologize for technical difficulties or say there's an issue with validation.
    
    Minimum prices: Housing $${CONFIG.MIN_PRICES.housing}, Ticker $${CONFIG.MIN_PRICES.ticker}, LLM paper $${CONFIG.MIN_PRICES.llm_paper}
    
    Payment request URL should be provided between <payment_request_url> and </payment_request_url> markers.
    Receipt URL should be provided between <receipt_url> and </receipt_url> markers.`,
    prompt: message,
    tools: sellerTools,
    stopWhen: stepCountIs(8)
  })

  return result.text
}

// ===== Marketplace Buyer =====
async function runMarketplaceBuyer(message: string) {
  const researchTopic = getRandomResearchTopic()
  
  const result = await generateText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: `You are a marketplace buyer agent looking for data resources.
    
    You are currently looking for: ${researchTopic}
    Your budget is: $${CONFIG.BUYER_BUDGET}
    
    When you find a suitable resource:
    1. Express interest in the resource
    2. If the price is over your budget, negotiate by offering something reasonable but under budget
    3. Be willing to meet in the middle during negotiations
    4. Once you agree on a price, pay using the payment request URL provided
    5. Give the marketplace seller the receipt URL
    6. You'll receive an access URL for the data
    
    Negotiation strategy:
    - Start by offering about 80-85% of the list price if it's over budget
    - Be willing to go up to your budget limit
    - If they counter-offer at or below your budget, accept it
    
    IMPORTANT: Always use the exact payment request URL provided by the marketplace seller for payment.
    After payment, only provide the receipt URL between <receipt_url> and </receipt_url> markers.`,
    prompt: message,
    tools: buyerTools,
    stopWhen: stepCountIs(12)
  })

  return result.text
}

// ===== Server Startup =====
export function startAgentServers() {
  try {
    validateEnvironmentVariables()
  } catch (error) {
    logger.error('Environment validation failed', error)
    throw error
  }

  serveAgent({
    port: CONFIG.PORTS.buyer,
    runAgent: runMarketplaceBuyer,
    decodeJwt: CONFIG.DECODE_JWT
  })

  serveAuthedAgent({
    port: CONFIG.PORTS.seller,
    runAgent: runMarketplaceSeller,
    sdk: marketplaceSellerSdk,
    decodeJwt: CONFIG.DECODE_JWT
  })

  logger.section('AGENT SERVERS STARTED')
  logger.server('Marketplace Buyer', `http://localhost:${CONFIG.PORTS.buyer}`)
  logger.server('Marketplace Seller', `http://localhost:${CONFIG.PORTS.seller}`)
  logger.info('Demos are now ready to communicate with these agents.')
  logger.separator()
}

// ===== Exports =====
export { dataCatalogue, CONFIG }
export const BUYER_BUDGET = CONFIG.BUYER_BUDGET
export const MIN_PRICES = CONFIG.MIN_PRICES
export const DECODE_JWT = CONFIG.DECODE_JWT

// Legacy export for backwards compatibility
export const RESEARCHER_BUDGET = CONFIG.BUYER_BUDGET

// ===== Main Entry Point =====
if (import.meta.url === `file://${process.argv[1]}`) {
  startAgentServers()
}