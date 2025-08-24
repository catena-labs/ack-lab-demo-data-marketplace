import "dotenv/config"
import { generateText, stepCountIs, tool } from "ai"
import { serveAgent, serveAuthedAgent } from "./serve-agent"
import { anthropic } from "@ai-sdk/anthropic"
import { z } from "zod"
import { AckLabSdk } from "@ack-hub/sdk"

// Configuration
const DECODE_JWT = true // Flag to decode and display JWT payloads
const RESEARCHER_BUDGET = 275 // Maximum budget for Agent A
const MIN_PRICES = {
  housing: 200,    // Minimum price for housing market data
  ticker: 250,     // Minimum price for ticker data
  llm_paper: 150   // Minimum price for LLM research paper
}

// Agent B SDK instance for payment handling
const agentBSdk = new AckLabSdk({
  baseUrl: "https://api.ack-lab.com",
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
    listPrice: 300,
    minimumPrice: MIN_PRICES.housing,
    category: "housing"
  },
  {
    id: "spy_ticker_365d",
    name: "SPY Minute-Level Ticker Data (365 days)",
    description: "Minute-by-minute ticker data for SPDR S&P 500 ETF (SPY) for the last 365 days",
    format: "CSV",
    size: "5 MB",
    listPrice: 350,
    minimumPrice: MIN_PRICES.ticker,
    category: "ticker"
  },
  {
    id: "llm_benchmark_paper",
    name: "Comprehensive LLM Benchmarking Study 2024",
    description: "Academic paper analyzing performance benchmarks of major LLMs with detailed methodology",
    format: "PDF",
    size: "2.5 MB",
    listPrice: 200,
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
    
    When someone requests data:
    1. Identify which resource matches their needs
    2. Present the resource with its list price
    3. If they negotiate, you can go down to the minimum price but no lower
    4. Be firm but professional in negotiations
    5. Once a price is agreed, create a payment request
    6. After payment confirmation, provide an access token
    
    Minimum prices (do not go below these):
    - Housing data: $${MIN_PRICES.housing}
    - Ticker data: $${MIN_PRICES.ticker}
    - LLM paper: $${MIN_PRICES.llm_paper}
    
    During negotiation, if their offer is below minimum, suggest a price between their offer and list price, but not below minimum.`,
    prompt: message,
    tools: {
      findMatchingResource: tool({
        description: "Find a resource that matches the user's research needs",
        inputSchema: z.object({
          query: z.string().describe("What the user is looking for")
        }),
        execute: async ({ query }) => {
          console.log("🔍 Searching catalogue for:", query)
          
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
            console.log("✓ Found matching resource:", matchedResource.name)
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
          
          console.log("💰 Negotiation:", `Offered $${offeredPrice} for ${resource.name}`)
          console.log(`   List price: $${resource.listPrice}, Minimum: $${resource.minimumPrice}`)
          
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
        description: "Create a payment request for agreed data purchase",
        inputSchema: z.object({
          resourceId: z.string().describe("ID of the resource being purchased"),
          agreedPrice: z.number().describe("Final agreed price"),
          negotiationId: z.string().describe("Negotiation session ID")
        }),
        execute: async ({ resourceId, agreedPrice, negotiationId }) => {
          const resource = dataCatalogue.find(r => r.id === resourceId)
          if (!resource) {
            return { error: "Resource not found" }
          }
          
          console.log(">>> Creating payment request for:", resource.name)
          console.log(">>> Agreed price:", `$${agreedPrice}`)
          
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
          
          console.log(">>> Payment token generated:", paymentToken)
          
          // Decode and display JWT payload if flag is enabled
          if (DECODE_JWT) {
            const tokenParts = paymentToken.split('.')
            if (tokenParts.length === 3) {
              try {
                const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString())
                console.log(">>> Decoded JWT payload:", JSON.stringify(payload, null, 2))
              } catch {
                console.log(">>> Could not decode payment token as JWT")
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
      provideAccessToken: tool({
        description: "Provide access token after payment confirmation",
        inputSchema: z.object({
          paymentToken: z.string().describe("The payment token that was paid"),
          receiptId: z.string().describe("The receipt ID from the payment")
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
          
          // Generate access token
          const accessToken = generateAccessToken(foundNegotiation.resource.id)
          
          // Mark as completed
          completedTransactions.set(paymentToken, {
            resourceId: foundNegotiation.resource.id,
            finalPrice: foundNegotiation.currentOffer
          })
          pendingNegotiations.delete(negotiationId)
          
          console.log("✅ Access token generated:", accessToken)
          
          return {
            success: true,
            accessToken,
            resource: {
              name: foundNegotiation.resource.name,
              format: foundNegotiation.resource.format,
              size: foundNegotiation.resource.size,
              downloadUrl: `https://data-provider.example.com/download/${foundNegotiation.resource.id}?token=${accessToken}`
            },
            receipt: receiptId,
            message: "Payment confirmed. Here is your access token for the data."
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
  baseUrl: "https://api.ack-lab.com",
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
    4. Once you agree on a price, pay using the payment token provided
    5. After payment, you'll receive an access token for the data
    
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
          console.log(">>>> Calling data provider:", message)
          try {
            const response = await callAgent({ message })
            console.log(">>>> Data provider response:", response)
            
            // Try to extract payment token if present
            const paymentTokenMatch = response.match(/pay_[a-zA-Z0-9]+/)
            if (paymentTokenMatch) {
              console.log(">>>> Detected payment token:", paymentTokenMatch[0])
            }
            
            return response
          } catch (error) {
            console.error(">>>> Error calling data provider:", error)
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
          console.log(">>>> Executing payment for token:", paymentToken)
          
          try {
            // Decode the payment token to see its contents if flag is enabled
            if (DECODE_JWT) {
              const tokenParts = paymentToken.split('.')
              if (tokenParts.length === 3) {
                try {
                  const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString())
                  console.log("    Decoded JWT payload:", JSON.stringify(payload, null, 2))
                } catch {
                  console.log("    Could not decode payment token as JWT")
                }
              }
            }
            
            const result = await agentASdk.executePayment(paymentToken)
            console.log(">>>> Payment successful! Receipt ID:", result.receipt.id)
            
            // For demo purposes, we'll extract the amount from context
            // In a real implementation, this would come from the payment result
            console.log("    Payment confirmed")
            
            return {
              success: true,
              receiptId: result.receipt.id,
              message: "Payment completed successfully"
            }
          } catch (error) {
            console.error(">>>> Payment failed:", error)
            
            if (error instanceof Error) {
              console.error("    Error message:", error.message)
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
    runAgent: runAgentA
  })

  // Start Agent B server on port 7577
  serveAuthedAgent({
    port: 7577,
    runAgent: runAgentB,
    sdk: agentBSdk
  })

  console.log("✅ Agent servers started:")
  console.log("   - Agent A (Researcher): http://localhost:7576")
  console.log("   - Agent B (Data Provider): http://localhost:7577")
  console.log("")
  console.log("The web UI can now communicate with these agents.")
}

// Export additional data for the UI
export { dataCatalogue, RESEARCHER_BUDGET, MIN_PRICES }

// If this file is run directly, start the servers
if (import.meta.url === `file://${process.argv[1]}`) {
  startAgentServers()
}
