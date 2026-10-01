/**
 * Family page routes (user story 4, FR-025 to FR-030). Every route below /family except sign
 * in needs a signed session cookie. Forms post and redirect; nothing needs JavaScript.
 */
import { Hono, type Context } from "hono";
import { hashFamilyPassword } from "@asg/core/auth/family-password";
import { stopToken } from "@asg/core/auth/link-tokens";
import { newId } from "@asg/core/ids";
import type { FamilyMember, Household } from "@asg/core/ports/index";
import { dataset } from "@asg/scam-patterns";
import { deliver, PRODUCT_NAME, type Deps } from "@asg/mcp-server";
import {
  memberValues,
  parseMember,
  parsePassword,
  parseSettings,
  type FormBody,
} from "../family/forms";
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
  /** Local runs only: show the sign in link on screen when no email service is set up. */
  showSignInLink?: boolean;
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

const REPLY_TEXT = {
  none: "no answer yet",
  it_was_me: "said it was them",
  it_wasnt_me: "said it was not them",
} as const;

export function familyRoutes(options: FamilyOptions) {
  const { deps } = options;
  const app = new Hono<Env>();
  app.use("/family", sameOrigin(deps.webUrl));
  app.use("/family/*", sameOrigin(deps.webUrl));

  // Sign in
  app.get("/family/sign-in", (c) => c.html(<SignInPage />));

  app.post("/family/sign-in", async (c) => {
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
    return c.html(<LinkSentPage limited={sent.limited} {...(devLink ? { devLink } : {})} />);
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
            detail: r.delivery === "failed" ? "message did not go through" : REPLY_TEXT[r.reply],
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
