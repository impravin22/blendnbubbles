/**
 * BNB Ops Telegram MCP — Cloudflare Worker
 *
 * Remote MCP server exposing one tool: send_telegram_message.
 * Sends to the Blend N Bubbles Digest group via the @blendnbubbles_ops_bot.
 *
 * REQUIRED environment variables (Settings → Variables and Secrets):
 *   TELEGRAM_BOT_TOKEN  — bot token from BotFather (store as Secret)
 *   TELEGRAM_CHAT_ID    — -5088053974  (BlendNBubbles Digest group)
 *
 * No secrets are hardcoded in this file.
 */

const TOOL = {
  name: "send_telegram_message",
  description:
    "Send a message to the Blend N Bubbles Digest Telegram group. " +
    "Defaults to HTML parse mode — wrap headlines in <b>...</b>, italics in <i>...</i>, " +
    "and escape any user-supplied < > & in the body.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      text: {
        type: "string",
        description: "Message body. Telegram caps individual messages at 4096 characters.",
      },
      parse_mode: {
        type: "string",
        enum: ["HTML", "MarkdownV2", "Markdown"],
        description: "Optional Telegram parse mode. Defaults to 'HTML'.",
      },
      disable_web_page_preview: {
        type: "boolean",
        description: "Optional. Suppresses link previews. Defaults to true for cleaner reports.",
      },
    },
    required: ["text"],
  },
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, GET, OPTIONS",
      "access-control-allow-headers": "content-type, accept, authorization, mcp-session-id, mcp-protocol-version",
    },
  });
}

const rpcResult = (id, result) => json({ jsonrpc: "2.0", id, result });
const rpcError = (id, code, message) => json({ jsonrpc: "2.0", id, error: { code, message } });
const toolFailure = (id, message) =>
  rpcResult(id, { content: [{ type: "text", text: message }], isError: true });

async function sendTelegram(env, args) {
  const payload = {
    chat_id: env.TELEGRAM_CHAT_ID,
    text: String(args.text ?? "").slice(0, 4096),
    parse_mode: args.parse_mode ?? "HTML",
    disable_web_page_preview: args.disable_web_page_preview ?? true,
  };
  const resp = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  return resp.json();
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return json({}, 204);
    if (request.method === "GET") {
      return new Response("BNB Ops Telegram MCP is up.", { status: 200 });
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    let message;
    try {
      message = await request.json();
    } catch {
      return rpcError(null, -32700, "Parse error");
    }

    const { id, method, params } = message ?? {};

    // JSON-RPC notifications (no id) get an empty ack.
    if (id === undefined || id === null) return new Response(null, { status: 202 });

    switch (method) {
      case "initialize":
        return rpcResult(id, {
          protocolVersion: params?.protocolVersion ?? "2025-06-18",
          capabilities: { tools: {} },
          serverInfo: { name: "bnb-ops-telegram-mcp", version: "1.0.0" },
        });

      case "ping":
        return rpcResult(id, {});

      case "tools/list":
        return rpcResult(id, { tools: [TOOL] });

      case "tools/call": {
        if (params?.name !== TOOL.name) {
          return rpcError(id, -32602, `Unknown tool: ${params?.name}`);
        }
        if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
          return toolFailure(
            id,
            "Server not configured: set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in the Worker's variables.",
          );
        }
        try {
          const data = await sendTelegram(env, params.arguments ?? {});
          if (!data.ok) {
            return toolFailure(id, `Telegram API error: ${data.description ?? "unknown"}`);
          }
          return rpcResult(id, {
            content: [
              { type: "text", text: `Sent to Telegram (message_id=${data.result.message_id}).` },
            ],
          });
        } catch (err) {
          return toolFailure(id, `Failed to reach Telegram API: ${err.message}`);
        }
      }

      default:
        return rpcError(id, -32601, `Method not found: ${method}`);
    }
  },
};
