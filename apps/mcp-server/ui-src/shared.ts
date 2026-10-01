/**
 * Shared runtime for the MCP Apps views shown on Echo Show screens. A minimal, dependency
 * free implementation of the view side of the MCP Apps protocol (JSON-RPC over postMessage):
 * ui/initialize, ui/notifications/initialized, ui/notifications/tool-result,
 * ui/notifications/size-changed, ui/resource-teardown. Keeps each view small.
 */

export type Structured = Record<string, unknown>;

const PROTOCOL_VERSION = "2026-01-26";

interface JsonRpc {
  jsonrpc: "2.0";
  id?: number | string;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

const send = (message: JsonRpc) => window.parent.postMessage(message, "*");

/** Connects to the host and calls render with every tool result. */
export function runView(name: string, render: (data: Structured) => string): void {
  const root = document.getElementById("view");
  if (!root) return;
  const initId = 1;
  let initialized = false;

  const reportSize = () =>
    send({
      jsonrpc: "2.0",
      method: "ui/notifications/size-changed",
      params: { width: document.body.scrollWidth, height: document.body.scrollHeight },
    });

  window.addEventListener("message", (event: MessageEvent<JsonRpc>) => {
    if (event.source !== window.parent) return;
    const message = event.data;
    if (!message || message.jsonrpc !== "2.0") return;

    if (message.id === initId && "result" in message) {
      if (initialized) return;
      initialized = true;
      send({ jsonrpc: "2.0", method: "ui/notifications/initialized", params: {} });
      return;
    }
    if (message.method === "ui/notifications/tool-result") {
      const data = (message.params?.structuredContent ?? {}) as Structured;
      root.innerHTML = render(data);
      root.setAttribute("aria-busy", "false");
      // setTimeout, not requestAnimationFrame: hidden or background hosts pause frames.
      window.setTimeout(reportSize, 30);
      return;
    }
    if (message.method === "ui/resource-teardown" && message.id !== undefined) {
      send({ jsonrpc: "2.0", id: message.id, result: {} });
    }
  });

  const initialize = () =>
    send({
      jsonrpc: "2.0",
      id: initId,
      method: "ui/initialize",
      params: {
        appInfo: { name, version: "0.1.0" },
        appCapabilities: {},
        protocolVersion: PROTOCOL_VERSION,
      },
    });
  // The host may attach its listener a moment after the view starts: ask again until it answers.
  initialize();
  let tries = 0;
  const retry = window.setInterval(() => {
    if (initialized || ++tries > 20) window.clearInterval(retry);
    else initialize();
  }, 250);
}

/** Road sign diamond drawn in SVG: yellow, black inset border, exclamation legend. */
export const DIAMOND = `<svg class="diamond" viewBox="0 0 64 64" aria-hidden="true"><rect x="11" y="11" width="42" height="42" rx="6" transform="rotate(45 32 32)" fill="#FFCD1C" stroke="#111417" stroke-width="2"/><rect x="15" y="15" width="34" height="34" rx="4" transform="rotate(45 32 32)" fill="none" stroke="#111417" stroke-width="2.5"/><path d="M32 20v15" stroke="#111417" stroke-width="5" stroke-linecap="round"/><circle cx="32" cy="43" r="3.2" fill="#111417"/></svg>`;
