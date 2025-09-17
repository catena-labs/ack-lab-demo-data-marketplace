import { serve } from "@hono/node-server";
import { vValidator } from "@hono/valibot-validator";
import { Hono, type TypedResponse } from "hono";
import * as v from "valibot";
import { type JwtString } from "agentcommercekit";
import { jwtStringSchema } from "agentcommercekit/schemas/valibot";
import type { AckLabAgent } from "@ack-lab/sdk";
import { logger } from "./logger";
import z from "zod";

const DECODE_JWT = process.env.DECODE_JWT !== "false";

type AgentFn = (prompt: string) => Promise<string>;

interface ServeAgentConfig {
  runAgent: AgentFn;
  port: number;
  decodeJwt?: boolean;
}

interface ServeAuthedAgentConfig extends ServeAgentConfig {
  agent: AckLabAgent;
}

function decodeJwtPayload(jwt: string): object | null {
  try {
    const tokenParts = jwt.split(".");
    if (tokenParts.length !== 3) return null;

    const payload = JSON.parse(Buffer.from(tokenParts[1], "base64").toString());
    return payload;
  } catch {
    return null;
  }
}

function logJwtIfEnabled(
  jwt: string,
  type: "incoming" | "outgoing",
  decodeJwt: boolean
) {
  if (!decodeJwt || !jwt) return;

  const payload = decodeJwtPayload(jwt);
  if (payload) {
    logger.debug(
      `${type === "incoming" ? "Incoming" : "Outgoing"} JWT payload`,
      payload
    );
  } else {
    logger.warn(`Could not decode ${type} JWT`);
  }
}

function findJwtTokensInMessage(message: string): string[] {
  const jwtPattern = /\b[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\b/g;
  return message.match(jwtPattern) || [];
}

function createAgentHtml(
  title: string,
  port: number,
  isAuthenticated: boolean
): string {
  const authContent = isAuthenticated
    ? `
    <div class="info-card">
        <h2>🔐 Authentication</h2>
        <p>This server uses the Agent Commerce Kit SDK for secure, authenticated agent interactions.</p>
        <p>Send requests to <code>/chat</code> with a JSON payload containing a valid JWT token:</p>
        <pre style="background: #f8f9fa; padding: 1rem; border-radius: 4px; overflow-x: auto;">
{
  "jwt": "your-jwt-token-here"
}</pre>
    </div>`
    : `
    <div class="info-card">
        <h2>💬 Usage</h2>
        <p>Send requests to <code>/chat</code> with a JSON payload containing your message:</p>
        <pre style="background: #f8f9fa; padding: 1rem; border-radius: 4px; overflow-x: auto;">
{
  "message": "Hello, agent!"
}</pre>
        <p>The agent will process your message and return a response in the following format:</p>
        <pre style="background: #f8f9fa; padding: 1rem; border-radius: 4px; overflow-x: auto;">
{
  "text": "Agent response here"
}</pre>
    </div>`;

  const endpointDescription = isAuthenticated
    ? "Send authenticated requests with JWT tokens"
    : "Send messages directly to the agent";

  const description = isAuthenticated
    ? "This agent requires JWT authentication for all chat interactions."
    : "This is a simple agent that accepts plain text messages without authentication.";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Agent Commerce Kit - ${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            background: #f8f9fa;
            color: #333;
        }
        .header {
            text-align: center;
            margin-bottom: 2rem;
            padding: 2rem;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .info-card {
            background: white;
            padding: 1.5rem;
            margin: 1rem 0;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .endpoint {
            background: #f1f3f4;
            padding: 0.5rem 1rem;
            border-radius: 4px;
            font-family: 'Monaco', 'Courier New', monospace;
            margin: 0.5rem 0;
        }
        .status {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            background: #28a745;
            color: white;
            border-radius: 20px;
            font-size: 0.875rem;
            font-weight: 500;
        }
        code {
            background: #f1f3f4;
            padding: 0.2rem 0.4rem;
            border-radius: 3px;
            font-family: 'Monaco', 'Courier New', monospace;
        }
        pre {
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 4px;
            overflow-x: auto;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🤖 Agent Commerce Kit</h1>
        <p>${title}</p>
        <span class="status">Running on Port ${port}</span>
    </div>

    <div class="info-card">
        <h2>📡 Available Endpoints</h2>
        <div class="endpoint">
            <strong>POST /chat</strong> - ${endpointDescription}
        </div>
        <p>${description}</p>
    </div>

    ${authContent}

    <div class="info-card">
        <h2>🚀 About</h2>
        <p>${
          isAuthenticated
            ? "This agent server is designed to handle secure commerce and transaction operations through authenticated API calls."
            : "This is a simple agent server that processes text messages and returns responses."
        }</p>
        <p>${
          isAuthenticated
            ? "The agent processes your requests and returns responses in JWT format for secure communication."
            : "Perfect for testing and development purposes without the complexity of authentication."
        }</p>
    </div>
</body>
</html>`;
}

function createRequestLogger() {
  return async (
    c: { req: { method: string; path: string }; res: { status: number } },
    next: () => Promise<void>
  ) => {
    const start = Date.now();
    await next();
    const time = Date.now() - start;
    logger.http(c.req.method, c.req.path, c.res.status, `${time}ms`);
  };
}

export function serveAuthedAgent({
  port,
  runAgent,
  agent,
  decodeJwt = DECODE_JWT,
}: ServeAuthedAgentConfig) {
  logger.info("Starting authenticated agent server...");

  const agentHandler = agent.createRequestHandler(z.string(), runAgent);
  const app = new Hono();

  app.use("*", createRequestLogger());

  app.get("/", (c) => {
    return c.html(createAgentHtml("Authenticated Agent Server", port, true));
  });

  app.post(
    "/chat",
    vValidator("json", v.object({ jwt: jwtStringSchema })),
    async (c): Promise<TypedResponse<{ jwt: JwtString }>> => {
      const { jwt } = c.req.valid("json");

      logJwtIfEnabled(jwt, "incoming", decodeJwt);

      try {
        const result = await agentHandler(jwt);

        if (result?.jwt) {
          logJwtIfEnabled(result.jwt, "outgoing", decodeJwt);
        }

        return c.json(result);
      } catch (error) {
        logger.error("Failed to handle JWT request", error);
        throw error;
      }
    }
  );

  serve({ fetch: app.fetch, port });
}

export function serveAgent({
  port,
  runAgent,
  decodeJwt = DECODE_JWT,
}: ServeAgentConfig) {
  logger.info("Starting simple agent server...");

  const app = new Hono();

  app.use("*", createRequestLogger());

  app.get("/", (c) => {
    return c.html(createAgentHtml("Simple Agent Server", port, false));
  });

  app.post(
    "/chat",
    vValidator("json", v.object({ message: v.string() })),
    async (c) => {
      const { message } = c.req.valid("json");

      logger.incoming("Message", message);

      if (decodeJwt) {
        const jwtTokens = findJwtTokensInMessage(message);
        jwtTokens.forEach((token, index) => {
          const payload = decodeJwtPayload(token);
          if (payload) {
            logger.debug(`JWT token #${index + 1} in message`, payload);
          }
        });
      }

      try {
        const text = await runAgent(message);
        logger.outgoing("Response", text);
        return c.json({ text });
      } catch (error) {
        logger.error("Failed to process message", error);
        throw error;
      }
    }
  );

  serve({ fetch: app.fetch, port });
}
