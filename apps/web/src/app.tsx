import { Hono, type MiddlewareHandler } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { createMcpApp, type Deps } from "@asg/mcp-server";
import { HomePage } from "./views/home";
import { PrivacyPage } from "./views/privacy";

export interface WebAppOptions {
  deps: Deps;
  /** Serves /assets, /favicon.* from disk (local) or the bundle (Lambda). */
  staticFiles?: MiddlewareHandler[];
  /** Local runs mount the MCP server on the same origin at /mcp. */
  mountMcp?: boolean;
}

/** Strict CSP: everything from this origin, no inline scripts, no third parties. */
const csp = secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'"],
    imgSrc: ["'self'", "data:"],
    fontSrc: ["'self'"],
    connectSrc: ["'self'"],
    mediaSrc: ["'self'", "blob:"],
    frameSrc: ["'self'"],
    frameAncestors: ["'none'"],
    baseUri: ["'none'"],
    formAction: ["'self'"],
    objectSrc: ["'none'"],
  },
  referrerPolicy: "same-origin",
  permissionsPolicy: { microphone: ["self"], camera: [], geolocation: [] },
});

export function createWebApp(options: WebAppOptions) {
  const app = new Hono();

  if (options.mountMcp) {
    const mcp = createMcpApp(options.deps, { authorizationServer: options.deps.webUrl });
    app.route("/", mcp);
  }

  app.use("*", csp);
  for (const handler of options.staticFiles ?? []) app.use("*", handler);

  app.get("/", (c) => c.html(<HomePage />));
  app.get("/privacy", (c) => c.html(<PrivacyPage />));

  return app;
}
