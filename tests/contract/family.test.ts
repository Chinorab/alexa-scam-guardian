/** User story 4: the family page (FR-025 to FR-030, research R10). */
import { describe, expect, it } from "vitest";
import { createWebApp } from "@asg/web";
import { MemoryDeviceSessions } from "../../apps/web/src/device/sessions";
import { SESSION, makeDeps } from "./helpers";

const ORIGIN = "https://guardian.test";

function family() {
  const made = makeDeps();
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
