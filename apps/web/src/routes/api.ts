import { Hono } from "hono";
import { z } from "zod";
import { epochSeconds } from "@asg/core/ports/index";
import { initialState } from "@asg/core/dialogue/engine";
import { phrases } from "@asg/core/dialogue/phrases";
import { startsSensitiveNumber } from "@asg/core/redact/redact";
import { seedDemoHousehold } from "@asg/core/demo/seed";
import { unreadCount, type Deps } from "@asg/mcp-server";
import type { DeviceSession, DeviceSessions } from "../device/sessions";
import { openMcpSession } from "../agent/mcp-client";
import { runTurn, type TurnDeps } from "../agent/turn";

export interface ApiContext {
  deps: Deps;
  sessions: DeviceSessions;
  agent: Omit<TurnDeps, "openSession" | "logger">;
  mcpUrl: string;
  /** Tests reach an in process MCP server through this. */
  mcpFetch?: typeof fetch;
}

const DAY_SECONDS = 24 * 60 * 60;

const converseBody = z.object({
  deviceId: z.string().min(1).max(64),
  text: z.string().max(2000),
});

const interimBody = z.object({
  deviceId: z.string().min(1).max(64),
  partialText: z.string().max(2000),
});

export function apiRoutes(ctx: ApiContext) {
  const api = new Hono();

  /** A private demo household per visitor, so judges never see each other's data. */
  api.post("/device/start", async (c) => {
    const household = await seedDemoHousehold(ctx.deps.store, ctx.deps.clock.now());
    const device: DeviceSession = {
      deviceId: crypto.randomUUID(),
      householdId: household.householdId,
      kind: "demo",
      olderAdultFirstName: household.olderAdultFirstName,
      history: [],
      engine: initialState(),
      expiresAt: household.expiresAt ?? epochSeconds(ctx.deps.clock.now()) + DAY_SECONDS,
    };
    await ctx.sessions.put(device);
    return c.json({
      deviceId: device.deviceId,
      householdKind: device.kind,
      olderAdultFirstName: device.olderAdultFirstName,
    });
  });

  api.post("/converse", async (c) => {
    const parsed = converseBody.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) return c.json({ error: "bad_request" }, 400);
    const device = await ctx.sessions.get(parsed.data.deviceId);
    if (!device) return c.json({ error: "unknown_device" }, 404);

    const { result, device: updated } = await runTurn(device, parsed.data.text, {
      ...ctx.agent,
      logger: ctx.deps.logger,
      openSession: (d) =>
        openMcpSession(
          { householdId: d.householdId, kind: d.kind },
          {
            url: ctx.mcpUrl,
            tokenSecret: ctx.deps.tokenSecret,
            ...(ctx.mcpFetch ? { fetch: ctx.mcpFetch } : {}),
          },
        ),
    });
    await ctx.sessions.put(updated);
    return c.json(result);
  });

  /** Start over: a fresh demo family for this device (FR-032). Demo households only. */
  api.post("/demo/reset", async (c) => {
    const parsed = z
      .object({ deviceId: z.string().min(1).max(64) })
      .safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) return c.json({ error: "bad_request" }, 400);
    const device = await ctx.sessions.get(parsed.data.deviceId);
    if (!device) return c.json({ error: "unknown_device" }, 404);
    if (device.kind !== "demo") return c.json({ error: "not_a_demo" }, 403);
    await ctx.deps.demoOutbox.clear(device.householdId);
    await ctx.deps.store.deleteHousehold(device.householdId);
    const household = await seedDemoHousehold(ctx.deps.store, ctx.deps.clock.now());
    await ctx.sessions.put({
      ...device,
      householdId: household.householdId,
      olderAdultFirstName: household.olderAdultFirstName,
      history: [],
      engine: initialState(),
    });
    return c.json({ ok: true, olderAdultFirstName: household.olderAdultFirstName });
  });

  /** Polled every 3 s: quiet notification state (FR-009). Content is spoken only when asked. */
  api.get("/device/:deviceId/events", async (c) => {
    const device = await ctx.sessions.get(c.req.param("deviceId"));
    if (!device) return c.json({ error: "unknown_device" }, 404);
    const unread = await unreadCount(ctx.deps, device.householdId);
    return c.json({ unread, light: unread > 0 ? "notification" : "idle" });
  });

  /** The on screen demo phone: messages for this household, newest first (FR-014, FR-032). */
  api.get("/device/:deviceId/demo-phone", async (c) => {
    const device = await ctx.sessions.get(c.req.param("deviceId"));
    if (!device) return c.json({ error: "unknown_device" }, 404);
    const members = await ctx.deps.store.listMembers(device.householdId);
    const messages = (await ctx.deps.demoOutbox.list(device.householdId)).map((m) => {
      const replyPath = m.body.match(/\/r\/[A-Za-z0-9_-]+/)?.[0];
      return {
        id: m.messageId,
        kind: m.kind,
        to: members.find((member) => member.memberId === m.memberId)?.name ?? "Family",
        subject: m.subject,
        body: m.body,
        at: m.at,
        ...(replyPath ? { replyPath } : {}),
      };
    });
    return c.json({ messages });
  });

  /** Interim speech: interrupt as soon as a sensitive number starts (FR-017). Stores nothing. */
  api.post("/interim", async (c) => {
    const parsed = interimBody.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) return c.json({ error: "bad_request" }, 400);
    if (!(await ctx.sessions.get(parsed.data.deviceId)))
      return c.json({ error: "unknown_device" }, 404);
    return startsSensitiveNumber(parsed.data.partialText)
      ? c.json({ interrupt: true, say: phrases.sensitiveStop() })
      : c.json({ interrupt: false });
  });

  return api;
}
