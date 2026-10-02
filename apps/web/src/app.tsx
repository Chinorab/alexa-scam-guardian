import { Hono, type MiddlewareHandler } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { createMcpApp, type Deps } from "@asg/mcp-server";
import type { DeviceSessions } from "./device/sessions";
import { openMcpSession } from "./agent/mcp-client";
import { apiRoutes, type ApiContext } from "./routes/api";
import { frameRoutes } from "./routes/frame";
import { replyRoutes } from "./routes/reply";
import { ttsRoutes, type SpeechSynth } from "./routes/tts";
import { familyRoutes } from "./routes/family";
import { readSession, type FamilySessionConfig } from "./family/session";
import { EchoPage } from "./views/echo";
import { HomePage } from "./views/home";
import { PrivacyPage } from "./views/privacy";

export interface WebAppOptions {
  deps: Deps;
  sessions: DeviceSessions;
  agent: ApiContext["agent"];
  mcpUrl: string;
  mcpFetch?: typeof fetch;
  /** Amazon Polly when configured; otherwise the Echo uses the browser's voice. */
  speech?: SpeechSynth;
  /** How often the Echo polls for news, in milliseconds. */
  pollMs?: number;
  /** Family page sessions: cookie signing secret and whether cookies need HTTPS. */
  session: FamilySessionConfig;
  /** Local runs without an email service: show the sign in link on screen. */
  showSignInLink?: boolean;
  /** False when sign in links cannot be emailed (no SES sender): the page offers the demo. */
  emailSignIn?: boolean;
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

  // MCP Apps frames carry their own CSP, so they are routed before the site wide one.
  app.route(
    "/",
    frameRoutes(options.sessions, (device) =>
      openMcpSession(device, {
        url: options.mcpUrl,
        tokenSecret: options.deps.tokenSecret,
        ...(options.mcpFetch ? { fetch: options.mcpFetch } : {}),
      }),
    ),
  );

  app.use("*", csp);
  for (const handler of options.staticFiles ?? []) app.use("*", handler);

  const api: ApiContext = {
    deps: options.deps,
    sessions: options.sessions,
    agent: options.agent,
    mcpUrl: options.mcpUrl,
    householdFromRequest: (c) => readSession(c, options.session),
  };
  if (options.mcpFetch) api.mcpFetch = options.mcpFetch;
  app.route("/api", apiRoutes(api));
  app.route("/api", ttsRoutes(options.sessions, options.speech));

  app.route("/", replyRoutes(options.deps));
  app.route(
    "/",
    familyRoutes({
      deps: options.deps,
      session: options.session,
      sessions: options.sessions,
      ...(options.showSignInLink ? { showSignInLink: true } : {}),
      ...(options.emailSignIn === false ? { emailSignIn: false } : {}),
    }),
  );

  app.get("/", (c) => c.html(<HomePage />));
  app.get("/privacy", (c) => c.html(<PrivacyPage />));
  app.get("/echo", (c) => c.html(<EchoPage pollMs={options.pollMs ?? 3000} />));

  return app;
}
