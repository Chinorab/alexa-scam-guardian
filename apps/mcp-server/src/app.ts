import { Hono } from "hono";
import { authenticate } from "./auth/token";
import { METADATA_PATH, protectedResourceMetadata } from "./auth/metadata";
import type { Deps } from "./deps";
import { createHandler } from "./server";

export interface McpAppOptions {
  /** Public base URL of this server, without trailing slash. Defaults to the request origin. */
  publicUrl?: string;
  /** Where clients get tokens. Today the web app; later an OAuth 2.1 server. */
  authorizationServer: string;
}

/** Hono app serving POST /mcp (Streamable HTTP) and the protected resource metadata. */
export function createMcpApp(deps: Deps, options: McpAppOptions) {
  const handler = createHandler(deps);
  const app = new Hono();
  const base = (url: string) => options.publicUrl ?? new URL(url).origin;

  app.get(METADATA_PATH, (c) =>
    c.json(protectedResourceMetadata(base(c.req.url), options.authorizationServer)),
  );

  app.all("/mcp", async (c) => {
    const started = Date.now();
    const authInfo = await authenticate(c.req.header("authorization"), deps.tokenSecret);
    if (!authInfo) {
      return c.json({ error: "invalid_token" }, 401, {
        "WWW-Authenticate": `Bearer resource_metadata="${base(c.req.url)}${METADATA_PATH}"`,
      });
    }
    const response = await handler.fetch(c.req.raw, { authInfo });
    deps.logger.log({
      event: "http",
      route: "/mcp",
      status: response.status,
      durationMs: Date.now() - started,
    });
    return response;
  });

  app.get("/health", (c) => c.json({ ok: true }));
  return app;
}
