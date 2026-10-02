/** User story 4: the family page (FR-025 to FR-030, research R10). */
import { describe, expect, it } from "vitest";
import { createWebApp } from "@asg/web";
import { MemoryDeviceSessions } from "../../apps/web/src/device/sessions";
import type { Deps } from "@asg/mcp-server";
import { SESSION, makeDeps } from "./helpers";

const ORIGIN = "https://guardian.test";

function family(overrides: Partial<Deps> = {}) {
  const made = makeDeps(overrides);
  const mcpFetch = (async (input: string | URL | Request, init?: RequestInit) =>
    app.request(input instanceof URL ? input.href : String(input), init)) as typeof fetch;
  const app: ReturnType<typeof createWebApp> = createWebApp({
    deps: made.deps,
    sessions: new MemoryDeviceSessions(),
    agent: { mode: "simplified", modelId: "none" },
    mcpUrl: `${ORIGIN}/mcp`,
    mcpFetch,
    mountMcp: true,
    session: SESSION,
    showSignInLink: true,
  });
  let cookie = "";
  const request = async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (cookie) headers.set("cookie", cookie);
    const response = await app.request(`${ORIGIN}${path}`, {
      ...init,
      headers,
      redirect: "manual",
    });
    const set = response.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0] ?? "";
    return response;
  };
  const form = (path: string, fields: Record<string, string>, origin = ORIGIN) =>
    request(path, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", origin },
      body: new URLSearchParams(fields).toString(),
    });
  return { ...made, app, request, form, clearCookie: () => (cookie = "") };
}

/** Sign in links go through the mailer; locally the page also shows them. */
async function signIn(f: ReturnType<typeof family>, email = "anna@example.com") {
  const sent = await f.form("/family/sign-in", { email });
  const html = await sent.text();
  const token = html.match(/\/family\/sign-in\/([A-Za-z0-9_-]+)/)?.[1];
  expect(token).toBeTruthy();
  const page = await f.request(`/family/sign-in/${token}`);
  expect(await page.text()).toContain("Sign in");
  const done = await f.form(`/family/sign-in/${token}`, {});
  expect(done.status).toBe(303);
  return token ?? "";
}

async function setUp(f: ReturnType<typeof family>) {
  await signIn(f);
  await f.form("/family/settings", { firstName: "Ruth", waitMinutes: "10" });
}

describe("sign in", () => {
  it("sends nothing to the page without a session", async () => {
    const f = family();
    const response = await f.request("/family");
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/family/sign-in");
  });

  it("uses a link once, and only on a button press", async () => {
    const f = family();
    const token = await signIn(f);
    expect((await f.request("/family")).status).toBe(200);
    f.clearCookie();
    expect((await f.form(`/family/sign-in/${token}`, {})).status).toBe(410);
  });

  it("expires links after 15 minutes", async () => {
    const f = family();
    const sent = await (await f.form("/family/sign-in", { email: "anna@example.com" })).text();
    const token = sent.match(/\/family\/sign-in\/([A-Za-z0-9_-]+)/)?.[1];
    f.advance(16 * 60_000);
    expect((await f.form(`/family/sign-in/${token}`, {})).status).toBe(410);
  });

  it("limits sign in links to 5 per email per hour, with the same message for everyone", async () => {
    const f = family();
    for (let i = 0; i < 5; i++) {
      expect(
        await (await f.form("/family/sign-in", { email: "anna@example.com" })).text(),
      ).toContain("Check your email");
    }
    expect(await (await f.form("/family/sign-in", { email: "anna@example.com" })).text()).toContain(
      "Too many links",
    );
  });

  it("says when the email could not go out, without naming the address", async () => {
    const f = family({
      mailer: {
        send: () => Promise.reject(new Error("MessageRejected: Email address is not verified.")),
      },
    });
    const response = await f.form("/family/sign-in", { email: "anna@example.com" });
    const html = await response.text();
    expect(response.status).toBe(503);
    expect(html).toContain("The email did not go out");
    expect(html).not.toContain("anna@example.com");
    expect(html).not.toMatch(/\/family\/sign-in\/[A-Za-z0-9_-]{20,}/);
  });

  it("refuses form posts from another site", async () => {
    const f = family();
    await setUp(f);
    const response = await f.form(
      "/family/delete-all",
      { confirmName: "Ruth" },
      "https://evil.example",
    );
    expect(response.status).toBe(403);
  });

  it("asks for the first name before anything else", async () => {
    const f = family();
    await signIn(f);
    expect(await (await f.request("/family")).text()).toContain("who are you protecting");
  });
});

describe("people", () => {
  it("adds a person and lists them with their roles", async () => {
    const f = family();
    await setUp(f);
    const added = await f.form("/family/members", {
      name: "Michael",
      relationship: "grandson",
      nicknames: "Mike, Mikey",
      channel: "text",
      phone: "(555) 555 0142",
      canVerify: "on",
    });
    expect(added.status).toBe(303);
    const html = await (await f.request("/family?notice=added")).text();
    expect(html).toContain("Michael");
    expect(html).toContain("Can confirm a call");
    expect(html).toContain("(555) 555 0142");
  });

  it("explains what to fix", async () => {
    const f = family();
    await setUp(f);
    const response = await f.form("/family/members", {
      name: "",
      relationship: "other",
      channel: "text",
      phone: "12",
    });
    expect(response.status).toBe(400);
    const html = await response.text();
    expect(html).toContain("Enter a first name.");
    expect(html).toContain("Enter a US mobile number with 10 digits.");
    expect(html).toContain("Choose at least one");
    expect(html).toContain('role="alert"');
  });

  it("sends a test message, at most 3 per person per hour", async () => {
    const f = family();
    await setUp(f);
    await f.form("/family/members", {
      name: "Sarah",
      relationship: "daughter",
      channel: "email",
      email: "sarah@example.com",
      getsHeadsUp: "on",
    });
    const members = await f.deps.store.listMembers(
      (await f.deps.store.findHouseholdByEmail("anna@example.com"))?.householdId ?? "",
    );
    const id = members[0]?.memberId ?? "";
    for (let i = 0; i < 3; i++) {
      expect((await f.form(`/family/members/${id}/test`, {})).headers.get("location")).toBe(
        "/family?notice=test",
      );
    }
    expect((await f.form(`/family/members/${id}/test`, {})).headers.get("location")).toBe(
      "/family?notice=test-limit",
    );
  });
});

describe("family password", () => {
  it("saves it scrambled and never shows it", async () => {
    const f = family();
    await setUp(f);
    await f.form("/family/password", { password: "blue river", confirm: "blue river" });
    const html = await (await f.request("/family?notice=password")).text();
    expect(html).toContain("A family password is set");
    expect(html).not.toMatch(/blue river/i);
    const household = await f.deps.store.findHouseholdByEmail("anna@example.com");
    const stored = await f.deps.store.getPassword(household?.householdId ?? "");
    expect(JSON.stringify(stored)).not.toMatch(/blue|river/);
  });

  it("rejects entries that do not match", async () => {
    const f = family();
    await setUp(f);
    const response = await f.form("/family/password", {
      password: "blue river",
      confirm: "blue lake",
    });
    expect(response.status).toBe(400);
    expect(await response.text()).toContain("The two entries do not match.");
  });
});

describe("activity and delete all", () => {
  it("shows checks made on the household's Echo", async () => {
    const f = family();
    await setUp(f);
    const started = await f.request("/api/device/start", { method: "POST" });
    const device = (await started.json()) as { deviceId: string; householdKind: string };
    expect(device.householdKind).toBe("real");
    await f.request("/api/converse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        deviceId: device.deviceId,
        text: "My grandson needs bail in gift cards now",
      }),
    });
    const html = await (await f.request("/family/activity")).text();
    expect(html).toContain("Warning signs: emergency story, gift cards.");
  });

  it("deletes everything only after the first name is typed", async () => {
    const f = family();
    await setUp(f);
    const wrong = await f.form("/family/delete-all", { confirmName: "Rut" });
    expect(wrong.status).toBe(400);
    const right = await f.form("/family/delete-all", { confirmName: "ruth" });
    expect(await right.text()).toContain("Everything was deleted");
    expect(await f.deps.store.findHouseholdByEmail("anna@example.com")).toBeUndefined();
  });
});

describe("public demo family (FR-026)", () => {
  const json = (f: ReturnType<typeof family>, path: string, body: unknown) =>
    f.request(path, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: JSON.stringify(body),
    });

  it("opens the family page of the Echo's own demo family, with its checks", async () => {
    const f = family();
    const { deviceId } = (await (await json(f, "/api/device/start", {})).json()) as {
      deviceId: string;
    };
    await json(f, "/api/converse", {
      deviceId,
      text: "My grandson is in jail and needs gift cards for bail.",
    });
    const opened = await f.form("/family/demo", { deviceId });
    expect(opened.status).toBe(303);
    const home = await (await f.request("/family")).text();
    expect(home).toContain("Ruth&#39;s family");
    expect(home).toContain("Demo family.");
    expect(home).toContain("Michael");
    const activity = await (await f.request("/family/activity")).text();
    expect(activity).toContain("gift cards");
  });

  it("opens a fresh demo family without an Echo, with no email", async () => {
    const f = family();
    expect((await f.form("/family/demo", {})).status).toBe(303);
    const home = await (await f.request("/family")).text();
    expect(home).toContain("Demo family.");
  });

  it("never opens a real household through the demo door", async () => {
    const f = family();
    await signIn(f);
    await f.form("/family/settings", { firstName: "Ada", waitMinutes: "10" });
    const { deviceId, householdKind } = (await (await json(f, "/api/device/start", {})).json()) as {
      deviceId: string;
      householdKind: string;
    };
    expect(householdKind).toBe("real");
    f.clearCookie();
    await f.form("/family/demo", { deviceId });
    const home = await (await f.request("/family")).text();
    expect(home).not.toContain("Ada&#39;s family");
    expect(home).toContain("Ruth&#39;s family");
    expect(home).toContain("Demo family.");
  });

  it("lets a reloaded Echo keep its demo family", async () => {
    const f = family();
    const first = (await (await json(f, "/api/device/start", {})).json()) as { deviceId: string };
    const again = (await (
      await json(f, "/api/device/start", { deviceId: first.deviceId })
    ).json()) as { deviceId: string };
    expect(again.deviceId).toBe(first.deviceId);
    const unknown = (await (
      await json(f, "/api/device/start", { deviceId: "not-a-device" })
    ).json()) as { deviceId: string };
    expect(unknown.deviceId).not.toBe(first.deviceId);
  });
});

describe("a household with nobody saved yet", () => {
  it("still names the signs, and suggests setting up the family page", async () => {
    const f = family();
    await signIn(f);
    await f.form("/family/settings", { firstName: "Ada", waitMinutes: "10" });
    const started = await f.request("/api/device/start", {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: "{}",
    });
    const { deviceId } = (await started.json()) as { deviceId: string };
    const reply = await f.request("/api/converse", {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: JSON.stringify({ deviceId, text: "My grandson is in jail and needs gift cards." }),
    });
    const { say } = (await reply.json()) as { say: string };
    expect(say).toBe(
      "I'm glad you asked me first. The emergency story and the gift cards are common signs of a scam. Please don't send any money, and ask someone in your family to set up the family page so I can check with them.",
    );
  });
});

describe("names on the family page", () => {
  it("accepts names in any language and refuses markup or line breaks", async () => {
    const f = family();
    await setUp(f);
    const add = (name: string, nicknames = "") =>
      f.form("/family/members", {
        name,
        relationship: "grandson",
        nicknames,
        channel: "text",
        phone: "555 555 0142",
        canVerify: "on",
      });
    expect((await add("José O'Brien-Nguyễn")).status).toBe(303);
    const markup = await add("<img src=x onerror=alert(1)>");
    expect(markup.status).toBe(400);
    expect(await markup.text()).toContain("Use letters only");
    expect((await add("Bob\nBcc: someone")).status).toBe(400);
    expect((await add("Michael", "Mike, <b>Mikey</b>")).status).toBe(400);
    const home = await (await f.request("/family")).text();
    expect(home).toContain("José O&#39;Brien-Nguyễn");
  });
});

describe("report summary on the family page (FR-019)", () => {
  it("shows the facts, and offers them as plain text behind sign in", async () => {
    const f = family();
    const post = (path: string, body: unknown) =>
      f.request(path, {
        method: "POST",
        headers: { "content-type": "application/json", origin: ORIGIN },
        body: JSON.stringify(body),
      });
    const { deviceId } = (await (await post("/api/device/start", {})).json()) as {
      deviceId: string;
    };
    await post("/api/converse", {
      deviceId,
      text: "My grandson called from 212 555 0199, he is in jail and needs two thousand dollars in gift cards.",
    });
    await post("/api/converse", { deviceId, text: "No" });
    await post("/api/converse", { deviceId, text: "Help me report it." });
    await f.form("/family/demo", { deviceId });

    const activity = await (await f.request("/family/activity")).text();
    expect(activity).toContain("Report summary");
    expect(activity).toContain("They asked for");
    expect(activity).toContain("Money by gift cards");
    expect(activity).toContain("(212) 555 0199");
    const checkId = activity.match(/\/family\/activity\/([^/]+)\/report\.txt/)?.[1];
    expect(checkId).toBeTruthy();

    const text = await (await f.request(`/family/activity/${checkId}/report.txt`)).text();
    expect(text).toContain("Scam report summary for Ruth");
    expect(text).toContain("Warning signs:");
    expect(text).toContain("https://reportfraud.ftc.gov");
    expect(text).toContain("nothing was sent to any agency");

    f.clearCookie();
    const anonymous = await f.request(`/family/activity/${checkId}/report.txt`);
    expect(anonymous.status).toBe(303);
  });
});
