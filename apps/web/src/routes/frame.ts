/**
 * Serves MCP Apps views to the Echo's sandboxed iframes. The view HTML comes from the MCP
 * server (resources/read). It runs with its own strict CSP in an opaque origin
 * (sandbox="allow-scripts" without allow-same-origin), so it can reach nothing but the host
 * through postMessage.
 */
import { Hono } from "hono";
import type { DeviceSessions } from "../device/sessions";
import type { McpSession } from "../agent/mcp-client";

const FRAME_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "font-src data:",
  "img-src data:",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
].join("; ");

export function frameRoutes(
  sessions: DeviceSessions,
  openSession: (device: { householdId: string; kind: "real" | "demo" }) => Promise<McpSession>,
) {
  const app = new Hono();
  // Views are static per server version; cache them after the first read.
  const cache = new Map<string, string>();

  app.get("/frame/:deviceId", async (c) => {
    const uri = c.req.query("uri") ?? "";
    if (!/^ui:\/\/guardian\/[a-z-]+$/.test(uri)) return c.text("Not found", 404);
    const device = await sessions.get(c.req.param("deviceId"));
    if (!device) return c.text("Not found", 404);

    let html = cache.get(uri);
    if (!html) {
      const session = await openSession(device);
      try {
        html = (await session.readUiResource(uri))?.html;
      } finally {
        await session.close().catch(() => {});
      }
      if (!html) return c.text("Not found", 404);
      cache.set(uri, html);
    }
    return c.html(html, 200, {
      "Content-Security-Policy": FRAME_CSP,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "private, max-age=300",
    });
  });
  return app;
}
