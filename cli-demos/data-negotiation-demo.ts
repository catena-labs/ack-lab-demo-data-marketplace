import { z } from "zod"
import colors from "yoctocolors"
import { input } from "@inquirer/prompts"

// Configuration for display purposes
const RESEARCHER_BUDGET = 275 // Maximum budget for Agent A
const MIN_PRICES = {
  housing: 200,    // Minimum price for housing market data
  ticker: 250,     // Minimum price for ticker data
  llm_paper: 150   // Minimum price for LLM research paper
}

async function checkAgentHealth(port: number): Promise<boolean> {
  try {
    // Just check if the server responds on the port
    // Any response (even 404) means the server is running
    await fetch(`http://localhost:${port}/`, {
      method: "GET",
      signal: AbortSignal.timeout(2000) // 2 second timeout
    })
    // If we get any response, the server is running
    return true
  } catch {
    // Connection refused or timeout means server is not running
    return false
  }
}

async function waitForAgents(maxRetries = 10, retryDelay = 1000): Promise<boolean> {
  console.log(colors.cyan("Checking if agents are running..."))
  
  for (let i = 0; i < maxRetries; i++) {
    const agentALive = await checkAgentHealth(7576)
    const agentBLive = await checkAgentHealth(7577)
    
    if (agentALive && agentBLive) {
      console.log(colors.green("✅ Both agents are live and ready!"))
      return true
    }
    
    if (i === 0) {
      console.log(colors.yellow("⏳ Waiting for agents to be ready..."))
      console.log(colors.gray("   Make sure to run the agent server first with:"))
      console.log(colors.gray("   npm run agents:start"))
    }
    
    console.log(colors.gray(`   Retry ${i + 1}/${maxRetries} - Agent A: ${agentALive ? '✓' : '✗'}, Agent B: ${agentBLive ? '✓' : '✗'}`))
    
    if (i < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, retryDelay))
    }
  }
  
  return false
}

async function main() {
  // Check if agents are running
  const agentsReady = await waitForAgents()
  
  if (!agentsReady) {
    console.log(colors.red("\n❌ Agents are not running!"))
    console.log(colors.yellow("Please start the agent servers first by running:"))
    console.log(colors.cyan("  npm run agents:start"))
    console.log(colors.gray("  or"))
    console.log(colors.cyan("  tsx data-negotiation-agents-server.ts"))
    process.exit(1)
  }

  console.log(colors.cyan("\n=== Data Negotiation Demo ==="))
  console.log(colors.yellow("Researcher negotiates with data provider for research resources"))
  console.log(colors.gray(`Researcher budget: $${RESEARCHER_BUDGET}`))
  console.log(colors.gray(`Minimum prices: Housing $${MIN_PRICES.housing}, Ticker $${MIN_PRICES.ticker}, LLM Paper $${MIN_PRICES.llm_paper}`))
  console.log(colors.gray("Type /exit to quit\n"))

  // Initial trigger to start the conversation
  console.log(colors.green("\n>>> Starting negotiation..."))
  
  const result = await fetch("http://localhost:7576/chat", {
    method: "POST",
    body: JSON.stringify({ message: "Start looking for research data" }),
    headers: {
      "Content-Type": "application/json"
    }
  })

  const { text } = z.parse(
    z.object({ text: z.string() }),
    await result.json()
  )

  console.log(colors.green("\n>>> Result:"), text)
  console.log(colors.gray("\n" + "=".repeat(50) + "\n"))

  // Interactive mode for additional queries
  while (true) {
    const userInput = await input({
      message: colors.cyan("Enter command (or /exit to quit):")
    })

    if (userInput.trim().toLowerCase() === "/exit") {
      console.log(colors.blue("Goodbye!"))
      break
    }

    console.log(colors.green("\n>>> Processing:"), userInput)

    const interactiveResult = await fetch("http://localhost:7576/chat", {
      method: "POST",
      body: JSON.stringify({ message: userInput }),
      headers: {
        "Content-Type": "application/json"
      }
    })

    const { text: interactiveText } = z.parse(
      z.object({ text: z.string() }),
      await interactiveResult.json()
    )

    console.log(colors.green("\n>>> Result:"), interactiveText)
    console.log(colors.gray("\n" + "=".repeat(50) + "\n"))
  }
}

main().catch(console.error)
