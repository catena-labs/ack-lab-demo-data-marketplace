import { z } from "zod"
import colors from "yoctocolors"
import { input } from "@inquirer/prompts"

const CONFIG = {
  BUYER_BUDGET: parseInt(process.env.BUYER_BUDGET || "10"),
  MIN_PRICES: {
    housing: 8,
    ticker: 10,
    llm_paper: 12
  },
  AGENTS: {
    buyer: { port: 7576, name: "Agent A (Marketplace Buyer)" },
    seller: { port: 7577, name: "Agent B (Marketplace Seller)" }
  },
  HEALTH_CHECK: {
    maxRetries: 10,
    retryDelay: 1000,
    timeout: 2000
  }
}

const responseSchema = z.object({ text: z.string() })

async function isAgentHealthy(port: number): Promise<boolean> {
  try {
    await fetch(`http://localhost:${port}/`, {
      method: "GET",
      signal: AbortSignal.timeout(CONFIG.HEALTH_CHECK.timeout)
    })
    return true
  } catch {
    return false
  }
}

async function waitForAgents(): Promise<boolean> {
  console.log(colors.cyan("Checking if agents are running..."))
  
  const { maxRetries, retryDelay } = CONFIG.HEALTH_CHECK
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const buyerHealthy = await isAgentHealthy(CONFIG.AGENTS.buyer.port)
    const sellerHealthy = await isAgentHealthy(CONFIG.AGENTS.seller.port)
    
    if (buyerHealthy && sellerHealthy) {
      console.log(colors.green("✅ Both agents are live and ready!"))
      return true
    }
    
    if (attempt === 0) {
      console.log(colors.yellow("⏳ Waiting for agents to be ready..."))
      console.log(colors.gray("   Make sure to run the agent server first with:"))
      console.log(colors.gray("   npm run agents:start"))
    }
    
    console.log(
      colors.gray(
        `   Retry ${attempt + 1}/${maxRetries} - ` +
        `Buyer: ${buyerHealthy ? '✓' : '✗'}, ` +
        `Seller: ${sellerHealthy ? '✓' : '✗'}`
      )
    )
    
    if (attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, retryDelay))
    }
  }
  
  return false
}

async function sendAgentMessage(message: string): Promise<string> {
  const response = await fetch(`http://localhost:${CONFIG.AGENTS.buyer.port}/chat`, {
    method: "POST",
    body: JSON.stringify({ message }),
    headers: { "Content-Type": "application/json" }
  })

  const { text } = responseSchema.parse(await response.json())
  return text
}

function printWelcome() {
  console.log(colors.cyan("\n=== Data Negotiation Demo ==="))
  console.log(colors.yellow("Marketplace buyer negotiates with seller for data resources"))
  console.log(colors.gray(`Buyer budget: $${CONFIG.BUYER_BUDGET}`))
  console.log(colors.gray(
    `Minimum prices: Housing $${CONFIG.MIN_PRICES.housing}, ` +
    `Ticker $${CONFIG.MIN_PRICES.ticker}, ` +
    `LLM Paper $${CONFIG.MIN_PRICES.llm_paper}`
  ))
  console.log(colors.gray("Type /exit to quit\n"))
}

function printResult(text: string) {
  console.log(colors.green("\n>>> Result:"), text)
  console.log(colors.gray("\n" + "=".repeat(50) + "\n"))
}

async function runInteractiveSession() {
  while (true) {
    const userInput = await input({
      message: colors.cyan("Enter command (or /exit to quit):")
    })

    if (userInput.trim().toLowerCase() === "/exit") {
      console.log(colors.blue("Goodbye!"))
      break
    }

    console.log(colors.green("\n>>> Processing:"), userInput)
    
    try {
      const result = await sendAgentMessage(userInput)
      printResult(result)
    } catch (error) {
      console.error(colors.red("Error:"), error)
    }
  }
}

async function main() {
  const agentsReady = await waitForAgents()
  
  if (!agentsReady) {
    console.log(colors.red("\n❌ Agents are not running!"))
    console.log(colors.yellow("Please start the agent servers first by running:"))
    console.log(colors.cyan("  npm run agents:start"))
    console.log(colors.gray("  or"))
    console.log(colors.cyan("  tsx data-negotiation-agents-server.ts"))
    process.exit(1)
  }

  printWelcome()
  
  console.log(colors.green("\n>>> Starting negotiation..."))
  const initialResult = await sendAgentMessage("Start looking for data resources")
  printResult(initialResult)
  
  await runInteractiveSession()
}

main().catch(console.error)