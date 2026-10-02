/**
 * Family page routes (user story 4, FR-025 to FR-030). Every route below /family except sign
 * in needs a signed session cookie. Forms post and redirect; nothing needs JavaScript.
 */
import { Hono, type Context } from "hono";
import { hashFamilyPassword } from "@asg/core/auth/family-password";
import { stopToken } from "@asg/core/auth/link-tokens";
import { newId } from "@asg/core/ids";
import { claimedToBe } from "@asg/core/copy/identity";
import type { FamilyMember, Household, Reply } from "@asg/core/ports/index";
import { seedDemoHousehold } from "@asg/core/demo/seed";
import { dataset } from "@asg/scam-patterns";
import { deliver, PRODUCT_NAME, type Deps } from "@asg/mcp-server";
import {
  memberValues,
  parseMember,
  parsePassword,
  parseSettings,
  type FormBody,
} from "../family/forms";
import type { DeviceSessions } from "../device/sessions";
import { STARTS_PER_HOUR, visitorKey } from "./api";
import { reportText } from "../family/report-text";
import {
  endSession,
  looksLikeEmail,
  normalizeEmail,
  readSession,
  sameOrigin,
  sendSignInLink,
  startSession,
  useSignInLink,
  type FamilySessionConfig,
} from "../family/session";
import {
  ActivityPage,
  ConfirmSignInPage,
  DeleteAllPage,
  DeletedPage,
  FamilyHome,
  LinkSentPage,
  MemberFormPage,
  SignInPage,
  WelcomePage,
  type ActivityItem,
} from "../views/family/pages";

export interface FamilyOptions {
  deps: Deps;
  session: FamilySessionConfig;
  /** Echo devices, to open the family page of the demo family an Echo is using. */
  sessions?: DeviceSessions;
  /** Local runs only: show the sign in link on screen when no email service is set up. */
  showSignInLink?: boolean;
  /**
   * False when no email service is set up and links are not shown on screen (a cloud deploy
   * without SES): the page says so and offers the demo family instead of a link that never comes.
   */
  emailSignIn?: boolean;
}

export const TEST_MESSAGES_PER_HOUR = 3;

const labelOf = (signId: string) => dataset.warningSigns.find((s) => s.id === signId)?.label;

type Env = { Variables: { household: Household } };

const NOTICES: Record<string, string> = {
  added: "Saved.",
  removed: "Removed.",
  password: "Family password saved.",
  "password-removed": "Family password removed.",
  settings: "Settings saved.",
  test: "Test message sent.",
  "test-limit": "Test messages are limited to 3 per person per hour.",
  "test-failed": "That test message did not go through. Check the number or email.",
};

/** A relative asked about someone else answers whether the story is true. */
const replyText = (reply: Reply, aboutThemselves: boolean) =>
  reply === "none"
    ? "no answer yet"
    : aboutThemselves
      ? reply === "it_was_me"
        ? "said it was them"
        : "said it was not them"
      : reply === "it_was_me"
        ? "said it is true"
        : "said it is not true";

export function familyRoutes(options: FamilyOptions) {
  const { deps } = options;
  const app = new Hono<Env>();
  app.use("/family", sameOrigin(deps.webUrl));
  app.use("/family/*", sameOrigin(deps.webUrl));

  // Sign in
  const emailOff = options.emailSignIn === false && !options.showSignInLink;
  app.get("/family/sign-in", (c) => c.html(<SignInPage emailOff={emailOff} />));

  app.post("/family/sign-in", async (c) => {
    if (emailOff) return c.html(<SignInPage emailOff />);
    const body = await c.req.parseBody();
    const email = normalizeEmail(typeof body.email === "string" ? body.email : "");
    if (!looksLikeEmail(email)) {
      return c.html(
        <SignInPage email={email} error="Enter an email address like name@example.com." />,
        400,
      );
    }
    const sent = await sendSignInLink(deps, email);
    const devLink = options.showSignInLink && sent.link ? sent.link : undefined;
    return c.html(
      <LinkSentPage
        limited={sent.limited}
        {...(sent.failed ? { failed: true } : {})}
        {...(devLink ? { devLink } : {})}
      />,
      sent.failed ? 503 : 200,
    );
  });

  // GET only shows a button: mail scanners open links on their own and must not use them up.
  app.get("/family/sign-in/:token", (c) =>
    c.html(<ConfirmSignInPage token={c.req.param("token")} />),
  );

  app.post("/family/sign-in/:token", async (c) => {
    const household = await useSignInLink(deps, c.req.param("token"));
    if (!household) return c.html(<ConfirmSignInPage token="" expired />, 410);
    await startSession(c, options.session, household.householdId);
    return c.redirect("/family", 303);
  });

  /**
   * The public demo family (FR-026): no sign in, sample data only, gone within 24 hours.
   * From an Echo, it opens that Echo's own demo family, so its checks show in Activity.
   * Never a real household: a real device falls back to a new demo family.
   */
  app.post("/family/demo", async (c) => {
    const body = await c.req.parseBody();
    const deviceId = typeof body.deviceId === "string" ? body.deviceId.slice(0, 64) : "";
    const device = deviceId ? await options.sessions?.get(deviceId) : undefined;
    let householdId = device?.kind === "demo" ? device.householdId : undefined;
    if (!householdId) {
      const visitor = visitorKey(c);
      const starts = visitor ? await deps.store.incrementRate(`start#${visitor}`, 3600) : 0;
      if (starts > STARTS_PER_HOUR)
        return c.text("Too many demo families from here. Try later.", 429);
      householdId = (await seedDemoHousehold(deps.store, deps.clock.now())).householdId;
    }
    await startSession(c, options.session, householdId);
    return c.redirect("/family", 303);
  });

  app.post("/family/sign-out", (c) => {
    endSession(c);
    return c.redirect("/", 303);
  });

  // Everything else needs a session
  const protectedPaths = [
    "/family",
    "/family/members/*",
    "/family/password",
    "/family/password/*",
    "/family/settings",
    "/family/activity",
    "/family/activity/*",
    "/family/delete-all",
  ];
  for (const path of protectedPaths) {
    app.use(path, async (c, next) => {
      const householdId = await readSession(c, options.session);
      const household = householdId ? await deps.store.getHousehold(householdId) : undefined;
      if (!household) return c.redirect("/family/sign-in", 303);
      c.set("household", household);
      await next();
    });
  }

  const home = async (
    c: Context<Env>,
    extra: {
      notice?: string;
      settingsErrors?: Record<string, string>;
      passwordErrors?: Record<string, string>;
    } = {},
    status: 200 | 400 = 200,
  ) => {
    const household = c.get("household");
    if (!household.olderAdultFirstName) return c.html(<WelcomePage household={household} />);
    const [members, password] = await Promise.all([
      deps.store.listMembers(household.householdId),
      deps.store.getPassword(household.householdId),
    ]);
    return c.html(
      <FamilyHome
        household={household}
        members={members}
        hasPassword={password !== undefined}
        {...extra}
      />,
      status,
    );
  };

  app.get("/family", (c) => {
    const notice = NOTICES[c.req.query("notice") ?? ""];
    return home(c, notice ? { notice } : {});
  });

  app.post("/family/settings", async (c) => {
    const household = c.get("household");
    const parsed = parseSettings((await c.req.parseBody()) as FormBody);
    if (Object.keys(parsed.errors).length > 0) {
      if (!household.olderAdultFirstName) {
        return c.html(<WelcomePage household={household} errors={parsed.errors} />, 400);
      }
      return home(c, { settingsErrors: parsed.errors }, 400);
    }
    await deps.store.putHousehold({
      ...household,
      olderAdultFirstName: parsed.firstName,
      waitMinutes: parsed.waitMinutes,
      updatedAt: deps.clock.now().toISOString(),
    });
    return c.redirect("/family?notice=settings", 303);
  });

  // People
  app.get("/family/members/new", (c) =>
    c.html(
      <MemberFormPage
        action="/family/members"
        values={memberValues()}
        errors={{}}
        olderAdultFirstName={c.get("household").olderAdultFirstName}
      />,
    ),
  );

  app.post("/family/members", async (c) => {
    const household = c.get("household");
    const parsed = parseMember((await c.req.parseBody()) as FormBody);
    if (!parsed.fields) {
      return c.html(
        <MemberFormPage
          action="/family/members"
          values={parsed.values}
          errors={parsed.errors}
          olderAdultFirstName={household.olderAdultFirstName}
        />,
        400,
      );
    }
    await deps.store.putMember({
      ...parsed.fields,
      memberId: newId("member"),
      householdId: household.householdId,
      optedOut: false,
    });
    return c.redirect("/family?notice=added", 303);
  });

  const loadMember = (c: Context<Env>) =>
    deps.store.getMember(c.get("household").householdId, c.req.param("memberId") ?? "");

  app.get("/family/members/:memberId", async (c) => {
    const member = await loadMember(c);
    if (!member) return c.redirect("/family", 303);
    return c.html(
      <MemberFormPage
        action={`/family/members/${member.memberId}`}
        values={memberValues(member)}
        errors={{}}
        editing={member.name}
        olderAdultFirstName={c.get("household").olderAdultFirstName}
      />,
    );
  });

  app.post("/family/members/:memberId", async (c) => {
    const member = await loadMember(c);
    if (!member) return c.redirect("/family", 303);
    const parsed = parseMember((await c.req.parseBody()) as FormBody);
    if (!parsed.fields) {
      return c.html(
        <MemberFormPage
          action={`/family/members/${member.memberId}`}
          values={parsed.values}
          errors={parsed.errors}
          editing={member.name}
          olderAdultFirstName={c.get("household").olderAdultFirstName}
        />,
        400,
      );
    }
    const updated: FamilyMember = {
      ...parsed.fields,
      memberId: member.memberId,
      householdId: member.householdId,
      optedOut: member.optedOut,
    };
    await deps.store.putMember(updated);
    return c.redirect("/family?notice=added", 303);
  });

  app.post("/family/members/:memberId/delete", async (c) => {
    const member = await loadMember(c);
    if (member) await deps.store.deleteMember(member.householdId, member.memberId);
    return c.redirect("/family?notice=removed", 303);
  });

  app.post("/family/members/:memberId/test", async (c) => {
    const household = c.get("household");
    const member = await loadMember(c);
    if (!member || member.optedOut) return c.redirect("/family", 303);
    const count = await deps.store.incrementRate(`test#${member.memberId}`, 3600);
    if (count > TEST_MESSAGES_PER_HOUR) return c.redirect("/family?notice=test-limit", 303);
    const older = household.olderAdultFirstName;
    const token = stopToken(household.householdId, member.memberId, deps.tokenSecret);
    const delivery = await deliver(deps, household, member, {
      subject: `A test from ${PRODUCT_NAME} for ${older}`,
      text: [
        `Hi ${member.name}, this is a test from ${PRODUCT_NAME} for ${older}.`,
        `${older}'s family saved you as someone to contact if ${older} gets a suspicious call.`,
        "There is nothing to do now.",
        `To stop all messages from ${PRODUCT_NAME}: ${deps.webUrl}/stop/${token}`,
      ].join("\n"),
    });
    return c.redirect(`/family?notice=${delivery === "sent" ? "test" : "test-failed"}`, 303);
  });

  // Family password: stored as a hash, never shown
  app.post("/family/password", async (c) => {
    const household = c.get("household");
    const parsed = parsePassword((await c.req.parseBody()) as FormBody);
    if (Object.keys(parsed.errors).length > 0) {
      return home(c, { passwordErrors: parsed.errors }, 400);
    }
    const stored = await hashFamilyPassword(parsed.password);
    await deps.store.putPassword({
      householdId: household.householdId,
      ...stored,
      setAt: deps.clock.now().toISOString(),
    });
    return c.redirect("/family?notice=password", 303);
  });

  app.post("/family/password/delete", async (c) => {
    await deps.store.deletePassword(c.get("household").householdId);
    return c.redirect("/family?notice=password-removed", 303);
  });

  // Activity (FR-028)
  app.get("/family/activity", async (c) => {
    const household = c.get("household");
    const [checks, members] = await Promise.all([
      deps.store.listChecks(household.householdId),
      deps.store.listMembers(household.householdId),
    ]);
    const nameOf = (id: string) => members.find((m) => m.memberId === id)?.name ?? "Someone";
    const items: ActivityItem[] = [];
    for (const check of checks.slice(0, 20)) {
      const aboutThemselves = (memberId: string) => {
        const member = members.find((m) => m.memberId === memberId);
        return member ? claimedToBe(check.claimedIdentity, member.relationship) : false;
      };
      const [requests, headsUps, report] = await Promise.all([
        deps.store.listVerifications(household.householdId, check.checkId),
        deps.store.listHeadsUps(household.householdId, check.checkId),
        deps.store.getReport(household.householdId, check.checkId),
      ]);
      const item: ActivityItem = {
        check,
        // A familiar voice is context, not a warning sign, as in the messages to family.
        signs: check.matchedSigns
          .filter((s) => s.signId !== "family-voice")
          .map((s) => labelOf(s.signId))
          .filter((l): l is string => l !== undefined),
        messages: [
          ...requests.map((r) => ({
            name: nameOf(r.memberId),
            kind: "Asked",
            detail:
              r.delivery === "failed"
                ? "message did not go through"
                : replyText(r.reply, aboutThemselves(r.memberId)),
          })),
          ...headsUps.map((h) => ({
            name: nameOf(h.memberId),
            kind: "Told",
            detail: h.delivery === "failed" ? "message did not go through" : "heads up sent",
          })),
        ],
      };
      if (report) item.report = report;
      items.push(item);
    }
    return c.html(<ActivityPage household={household} items={items} />);
  });

  // The report summary as plain text, to keep or paste into ReportFraud.ftc.gov or ic3.gov.
  app.get("/family/activity/:checkId/report.txt", async (c) => {
    const household = c.get("household");
    const report = await deps.store.getReport(household.householdId, c.req.param("checkId"));
    if (!report) return c.text("No report summary for this check.", 404);
    return c.text(reportText(report, household.olderAdultFirstName), 200, {
      "content-disposition": "inline",
      "cache-control": "no-store",
    });
  });

  // Delete everything (FR-029)
  app.get("/family/delete-all", (c) =>
    c.html(<DeleteAllPage firstName={c.get("household").olderAdultFirstName} />),
  );

  app.post("/family/delete-all", async (c) => {
    const household = c.get("household");
    const body = await c.req.parseBody();
    const typed = typeof body.confirmName === "string" ? body.confirmName.trim().toLowerCase() : "";
    const expected = household.olderAdultFirstName.trim().toLowerCase();
    if (!typed || typed !== expected) {
      return c.html(
        <DeleteAllPage
          firstName={household.olderAdultFirstName}
          error={`Type ${household.olderAdultFirstName} to confirm.`}
        />,
        400,
      );
    }
    await deps.store.deleteHousehold(household.householdId);
    await deps.demoOutbox.clear(household.householdId);
    endSession(c);
    return c.html(<DeletedPage />);
  });

  return app;
}
