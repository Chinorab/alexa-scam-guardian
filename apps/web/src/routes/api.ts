import { createHash } from "node:crypto";
import { Hono, type Context } from "hono";
import { z } from "zod";
import { epochSeconds } from "@asg/core/ports/index";
import { initialState } from "@asg/core/dialogue/engine";
import { phrases } from "@asg/core/dialogue/phrases";
import { startsSensitiveNumber } from "@asg/core/redact/redact";
import { seedDemoHousehold } from "@asg/core/demo/seed";
import { describeReplyLink, unreadCount, type Deps } from "@asg/mcp-server";
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
  /** The signed in family organizer's household, if any (T093). */
  householdFromRequest?: (c: Context) => Promise<string | undefined>;
}

const DAY_SECONDS = 24 * 60 * 60;
/**
 * New demo families per visitor address per hour. High enough for a whole judging team behind
 * one office address reloading the page; low enough to stop a script flooding the table.
 */
export const STARTS_PER_HOUR = 200;
/** Model backed turns per household per hour. Past this the rule based mode answers, so a
 *  person in the middle of a call is never refused, and the model bill stays bounded. */
export const FULL_TURNS_PER_HOUR = 120;
/** Model backed turns per hour for the whole site: the hard ceiling on the model bill. */
export const SITE_TURNS_PER_HOUR = 3000;

/**
 * The visitor address behind the Lambda Function URL, hashed: it is only a rate limit key and
 * is never stored as is. Local runs have no proxy header and no limit.
 */
export function visitorKey(c: Context): string | undefined {
  const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  if (!forwarded) return undefined;
  return createHash("sha256").update(`visitor:${forwarded}`).digest("base64url").slice(0, 22);
}

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
    const answer = (device: DeviceSession) =>
      c.json({
        deviceId: device.deviceId,
        householdKind: device.kind,
        olderAdultFirstName: device.olderAdultFirstName,
      });
    const ownId = await ctx.householdFromRequest?.(c);
    const own = ownId ? await ctx.deps.store.getHousehold(ownId) : undefined;

    // A reloaded Echo keeps its family, so its conversation and checks carry on. A device of
    // a real household resumes only for someone signed in to that household.
    const resume = z
      .object({ deviceId: z.string().min(1).max(64) })
      .safeParse(await c.req.json().catch(() => undefined));
    const previous = resume.success ? await ctx.sessions.get(resume.data.deviceId) : undefined;
    const alive = previous && (await ctx.deps.store.getHousehold(previous.householdId));
    if (previous && alive) {
      const mine = own?.householdId === previous.householdId;
      if (mine || (previous.kind === "demo" && !own)) return answer(previous);
    }

    // A signed in organizer gets their own household's Echo (the public demo family included);
    // everyone else a new demo family.
    if (own && own.olderAdultFirstName) {
      const device: DeviceSession = {
        deviceId: crypto.randomUUID(),
        householdId: own.householdId,
        kind: own.kind,
        olderAdultFirstName: own.olderAdultFirstName,
        history: [],
        engine: initialState(),
        expiresAt: own.expiresAt ?? epochSeconds(ctx.deps.clock.now()) + DAY_SECONDS,
      };
      await ctx.sessions.put(device);
      return answer(device);
    }
    const visitor = visitorKey(c);
    if (
      visitor &&
      (await ctx.deps.store.incrementRate(`start#${visitor}`, 3600)) > STARTS_PER_HOUR
    ) {
      return c.json({ error: "too_many_starts" }, 429);
    }
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

    const turns = await ctx.deps.store.incrementRate(`turns#${device.householdId}`, 3600);
    const siteTurns =
      ctx.agent.mode === "full" ? await ctx.deps.store.incrementRate("turns#site", 3600) : 0;
    const overBudget = turns > FULL_TURNS_PER_HOUR || siteTurns > SITE_TURNS_PER_HOUR;
    const agent = overBudget ? { mode: "simplified" as const, modelId: "none" } : ctx.agent;
    const { result, device: updated } = await runTurn(device, parsed.data.text, {
      ...agent,
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
    const outbox = await ctx.deps.demoOutbox.list(device.householdId);
    const messages = await Promise.all(
      outbox.map(async (m) => {
        const replyPath = m.body.match(/\/r\/[A-Za-z0-9_-]+/)?.[0];
        // The answers follow the question: "Was it you?" or, about someone else, "Is it true?"
        const link = replyPath ? await describeReplyLink(ctx.deps, replyPath.slice(3)) : undefined;
        return {
          id: m.messageId,
          kind: m.kind,
          to: members.find((member) => member.memberId === m.memberId)?.name ?? "Family",
          subject: m.subject,
          body: m.body,
          at: m.at,
          ...(replyPath ? { replyPath } : {}),
          ...(link && "aboutThemselves" in link ? { aboutThemselves: link.aboutThemselves } : {}),
        };
      }),
    );
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
