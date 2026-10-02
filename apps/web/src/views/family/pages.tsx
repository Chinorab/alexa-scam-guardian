/** Family page views (user story 4). Server rendered, forms work without JavaScript. */
import type { Check, FamilyMember, Household, ReportSummary } from "@asg/core/ports/index";
import type { Errors, MemberValues } from "../../family/forms";
import { WAIT_CHOICES } from "../../family/forms";
import { reportFacts } from "../../family/report-text";
import { claimedIdentityWords } from "@asg/core/copy/identity";
import { Layout } from "../layout";

function ErrorSummary(props: { errors: Errors }) {
  const entries = Object.entries(props.errors);
  if (entries.length === 0) return null;
  return (
    <div class="error-summary" role="alert" tabindex={-1}>
      <h2>Please fix {entries.length === 1 ? "this" : "these"}</h2>
      <ul>
        {entries.map(([field, message]) => (
          <li>
            <a href={`#${field}`}>{message}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field(props: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: unknown;
}) {
  const described = [props.hint ? `${props.id}-hint` : "", props.error ? `${props.id}-error` : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <div class={props.error ? "field field-error" : "field"} data-described={described}>
      <label for={props.id}>{props.label}</label>
      {props.hint && (
        <p class="field-hint" id={`${props.id}-hint`}>
          {props.hint}
        </p>
      )}
      {props.error && (
        <p class="field-message" id={`${props.id}-error`}>
          {props.error}
        </p>
      )}
      {props.children as never}
    </div>
  );
}

const describedBy = (id: string, hint: boolean, error?: string) =>
  [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;

/** Shown on every page of the public demo family (FR-026). */
function DemoNotice(props: { household: Household }) {
  if (props.household.kind !== "demo") return null;
  return (
    <div class="callout demo-notice">
      <p>
        <span class="sign-diamond" aria-hidden="true" /> <strong>Demo family.</strong> The people
        here are made up. Messages go to the demo phone on the Echo page, and everything is deleted
        within 24 hours.
      </p>
    </div>
  );
}

export function SignInPage(props: { error?: string; email?: string }) {
  return (
    <Layout
      title="Family sign in"
      description="Sign in to set up your family's Scam Guardian."
      current="family"
    >
      <h1>Family sign in</h1>
      <p class="lead">Set up who Alexa can check with. We email you a link; no password needed.</p>
      <form method="post" action="/family/sign-in" class="form" novalidate>
        <Field id="email" label="Your email" error={props.error}>
          <input
            id="email"
            name="email"
            type="email"
            autocomplete="email"
            required
            value={props.email ?? ""}
            aria-invalid={props.error ? "true" : undefined}
            aria-describedby={describedBy("email", false, props.error)}
          />
        </Field>
        <button class="button" type="submit">
          Email me a link
        </button>
      </form>
      <h2>Just looking?</h2>
      <p>Open a demo family with made up people. No email needed.</p>
      <form method="post" action="/family/demo">
        <button class="button button-secondary" type="submit">
          Open a demo family
        </button>
      </form>
    </Layout>
  );
}

export function LinkSentPage(props: { devLink?: string; limited?: boolean; failed?: boolean }) {
  const heading = props.failed
    ? "The email did not go out"
    : props.limited
      ? "Too many links"
      : "Check your email";
  const lead = props.failed
    ? "We could not send the sign in email just now. Please try again in a few minutes."
    : props.limited
      ? "We already sent several links this hour. Please use the latest one, or try again later."
      : "If that address can use the family page, a sign in link is on its way. It works once, for 15 minutes.";
  return (
    <Layout title="Check your email" description="We sent you a sign in link." current="family">
      <h1>{heading}</h1>
      <p class="lead">{lead}</p>
      {props.failed && (
        <p>
          <a class="button" href="/family/sign-in">
            Try again
          </a>
        </p>
      )}
      {props.devLink && (
        <div class="callout">
          <p>Local run without email: open your link here.</p>
          <p>
            <a href={props.devLink}>Open the sign in link</a>
          </p>
        </div>
      )}
    </Layout>
  );
}

export function ConfirmSignInPage(props: { token: string; expired?: boolean }) {
  return (
    <Layout title="Sign in" description="Finish signing in." current="family">
      {props.expired ? (
        <>
          <h1>This link has expired</h1>
          <p class="lead">Links work once, for 15 minutes.</p>
          <p>
            <a class="button" href="/family/sign-in">
              Get a new link
            </a>
          </p>
        </>
      ) : (
        <>
          <h1>Open your family page</h1>
          <form method="post" action={`/family/sign-in/${props.token}`}>
            <button class="button" type="submit">
              Sign in
            </button>
          </form>
        </>
      )}
    </Layout>
  );
}

function roleText(member: FamilyMember): string[] {
  const roles: string[] = [];
  if (member.canVerify) roles.push("Can confirm a call");
  if (member.getsHeadsUp) roles.push("Gets a heads up");
  return roles;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const relationshipLabel = (m: FamilyMember) =>
  capitalize(m.relationship === "other" ? (m.relationshipOther ?? "Other") : m.relationship);

const contactLabel = (m: FamilyMember) =>
  m.channel === "text"
    ? `Text ${m.phone?.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2 $3") ?? ""}`
    : `Email ${m.email ?? ""}`;

export function SettingsForm(props: {
  firstName: string;
  waitMinutes: number;
  errors?: Errors;
  first?: boolean;
}) {
  const errors = props.errors ?? {};
  return (
    <form method="post" action="/family/settings" class="form" novalidate>
      <ErrorSummary errors={errors} />
      <Field
        id="firstName"
        label="First name of the person you are protecting"
        hint="Alexa uses it, and it appears in messages to family."
        error={errors.firstName}
      >
        <input
          id="firstName"
          name="firstName"
          type="text"
          autocomplete="off"
          value={props.firstName}
          aria-invalid={errors.firstName ? "true" : undefined}
          aria-describedby={describedBy("firstName", true, errors.firstName)}
        />
      </Field>
      <Field
        id="waitMinutes"
        label="How long to wait for an answer"
        hint="After this, Alexa offers to try someone else. No answer never means the call was real."
        error={errors.waitMinutes}
      >
        <select
          id="waitMinutes"
          name="waitMinutes"
          aria-describedby={describedBy("waitMinutes", true, errors.waitMinutes)}
        >
          {WAIT_CHOICES.map((minutes) => (
            <option value={String(minutes)} selected={minutes === props.waitMinutes}>
              {minutes} minutes
            </option>
          ))}
        </select>
      </Field>
      <button class="button" type="submit">
        {props.first ? "Continue" : "Save settings"}
      </button>
    </form>
  );
}

export function WelcomePage(props: { household: Household; errors?: Errors }) {
  return (
    <Layout title="Set up" description="Set up your family page." current="family">
      <h1>Welcome</h1>
      <p class="lead">First, who are you protecting?</p>
      <SettingsForm
        firstName={props.household.olderAdultFirstName}
        waitMinutes={props.household.waitMinutes}
        errors={props.errors}
        first
      />
    </Layout>
  );
}

export function FamilyHome(props: {
  household: Household;
  members: FamilyMember[];
  hasPassword: boolean;
  notice?: string;
  settingsErrors?: Errors;
  passwordErrors?: Errors;
}) {
  const name = props.household.olderAdultFirstName;
  return (
    <Layout title={`${name}'s family`} description="Who Alexa can check with." current="family">
      <h1>{name}'s family</h1>
      <DemoNotice household={props.household} />
      {props.notice && (
        <p class="notice" role="status">
          {props.notice}
        </p>
      )}
      <p class="lead">These people are the only ones Alexa will ever contact for {name}.</p>

      <h2 id="people">People</h2>
      {props.members.length === 0 ? (
        <p>No one yet. Add the people a scammer might pretend to be, and someone to tell.</p>
      ) : (
        <ul class="people">
          {props.members.map((m) => (
            <li class="person">
              <div class="person-main">
                <h3>{m.name}</h3>
                <p class="person-meta">
                  {relationshipLabel(m)}. {contactLabel(m)}
                  {m.optedOut ? ". Stopped all messages" : ""}
                </p>
                <ul class="tags" aria-label="Roles">
                  {roleText(m).map((role) => (
                    <li class="tag">{role}</li>
                  ))}
                </ul>
              </div>
              <div class="person-actions">
                <a class="button button-secondary" href={`/family/members/${m.memberId}`}>
                  Edit<span class="visually-hidden"> {m.name}</span>
                </a>
                <form method="post" action={`/family/members/${m.memberId}/test`}>
                  <button class="button button-secondary" type="submit" disabled={m.optedOut}>
                    Send a test<span class="visually-hidden"> to {m.name}</span>
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p>
        <a class="button" href="/family/members/new">
          Add a person
        </a>
      </p>

      <h2 id="family-password">Family password</h2>
      <p>
        A secret word or phrase a real relative can say to prove who they are.{" "}
        <a href="https://www.ic3.gov/PSA/2024/PSA241203">The FBI suggests families agree on one.</a>{" "}
        {props.hasPassword
          ? "A family password is set. It is stored scrambled and can never be shown, only replaced or removed."
          : "No family password is set."}
      </p>
      <form method="post" action="/family/password" class="form" novalidate>
        <ErrorSummary errors={props.passwordErrors ?? {}} />
        <Field
          id="password"
          label={props.hasPassword ? "New family password" : "Family password"}
          error={props.passwordErrors?.password}
        >
          <input
            id="password"
            name="password"
            type="password"
            autocomplete="new-password"
            aria-describedby={describedBy("password", false, props.passwordErrors?.password)}
          />
        </Field>
        <Field id="confirm" label="Type it again" error={props.passwordErrors?.confirm}>
          <input
            id="confirm"
            name="confirm"
            type="password"
            autocomplete="new-password"
            aria-describedby={describedBy("confirm", false, props.passwordErrors?.confirm)}
          />
        </Field>
        <button class="button" type="submit">
          {props.hasPassword ? "Replace password" : "Save password"}
        </button>
      </form>
      {props.hasPassword && (
        <form method="post" action="/family/password/delete">
          <button class="button button-secondary" type="submit">
            Remove the family password
          </button>
        </form>
      )}

      <h2 id="settings">Settings</h2>
      <SettingsForm
        firstName={name}
        waitMinutes={props.household.waitMinutes}
        errors={props.settingsErrors}
      />

      <h2>Activity</h2>
      <p>
        <a href="/family/activity">See recent checks and report summaries</a>
      </p>
      <p>
        <a href="/echo">Open {name}'s simulated Echo</a>
      </p>

      <h2 id="delete">Delete everything</h2>
      <p>Erase every person, the family password and every check, right away.</p>
      <p>
        <a class="button button-danger" href="/family/delete-all">
          Delete all household data
        </a>
      </p>

      <form method="post" action="/family/sign-out" class="sign-out">
        <button class="button button-secondary" type="submit">
          Sign out
        </button>
      </form>
    </Layout>
  );
}

const RELATIONSHIP_OPTIONS = [
  "grandson",
  "granddaughter",
  "son",
  "daughter",
  "nephew",
  "niece",
  "other",
];

export function MemberFormPage(props: {
  action: string;
  values: MemberValues;
  errors: Errors;
  editing?: string;
  olderAdultFirstName: string;
}) {
  const v = props.values;
  const e = props.errors;
  const older = props.olderAdultFirstName;
  return (
    <Layout
      title={props.editing ? `Edit ${props.editing}` : "Add a person"}
      description="Who Alexa can contact."
      current="family"
    >
      <h1>{props.editing ? `Edit ${props.editing}` : "Add a person"}</h1>
      <form method="post" action={props.action} class="form" novalidate>
        <ErrorSummary errors={e} />
        <Field id="name" label="First name" error={e.name}>
          <input
            id="name"
            name="name"
            type="text"
            autocomplete="off"
            value={v.name}
            aria-invalid={e.name ? "true" : undefined}
            aria-describedby={describedBy("name", false, e.name)}
          />
        </Field>
        <Field id="relationship" label={`Relationship to ${older}`}>
          <select id="relationship" name="relationship">
            {RELATIONSHIP_OPTIONS.map((r) => (
              <option value={r} selected={r === v.relationship}>
                {r === "other" ? "Someone else" : r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </Field>
        <Field
          id="relationshipOther"
          label="If someone else, how are they related?"
          hint="For example: family friend, neighbor."
          error={e.relationshipOther}
        >
          <input
            id="relationshipOther"
            name="relationshipOther"
            type="text"
            value={v.relationshipOther}
            aria-describedby={describedBy("relationshipOther", true, e.relationshipOther)}
          />
        </Field>
        <Field
          id="nicknames"
          label={`Other names ${older} uses for them`}
          hint="Separate with commas. For example: Mike, Mikey."
          error={e.nicknames}
        >
          <input
            id="nicknames"
            name="nicknames"
            type="text"
            value={v.nicknames}
            aria-invalid={e.nicknames ? "true" : undefined}
            aria-describedby={describedBy("nicknames", true, e.nicknames)}
          />
        </Field>
        <fieldset class="field">
          <legend>How should we reach them?</legend>
          <label class="choice">
            <input type="radio" name="channel" value="text" checked={v.channel === "text"} /> Text
            message
          </label>
          <label class="choice">
            <input type="radio" name="channel" value="email" checked={v.channel === "email"} />{" "}
            Email
          </label>
        </fieldset>
        <Field
          id="phone"
          label="Mobile number (US)"
          hint="Needed for text messages."
          error={e.phone}
        >
          <input
            id="phone"
            name="phone"
            type="tel"
            autocomplete="off"
            value={v.phone}
            aria-invalid={e.phone ? "true" : undefined}
            aria-describedby={describedBy("phone", true, e.phone)}
          />
        </Field>
        <Field id="email" label="Email" hint="Needed for email." error={e.email}>
          <input
            id="email"
            name="email"
            type="email"
            autocomplete="off"
            value={v.email}
            aria-invalid={e.email ? "true" : undefined}
            aria-describedby={describedBy("email", true, e.email)}
          />
        </Field>
        <fieldset class={e.roles ? "field field-error" : "field"} id="roles">
          <legend>What can they do?</legend>
          {e.roles && <p class="field-message">{e.roles}</p>}
          <label class="choice">
            <input type="checkbox" name="canVerify" checked={v.canVerify} /> Confirm a call: we ask
            them if they really called {older}
          </label>
          <label class="choice">
            <input type="checkbox" name="getsHeadsUp" checked={v.getsHeadsUp} /> Get a heads up when{" "}
            {older} gets a suspicious call
          </label>
        </fieldset>
        <p class="field-hint">
          Only add people who agreed to get these messages. Every message has a link to stop them.
        </p>
        <div class="form-actions">
          <button class="button" type="submit">
            {props.editing ? "Save changes" : "Add this person"}
          </button>
          <a class="button button-secondary" href="/family">
            Cancel
          </a>
        </div>
      </form>
      {props.editing && (
        <form method="post" action={`${props.action}/delete`} class="remove-person">
          <button class="button button-danger" type="submit">
            Remove {props.editing}
          </button>
        </form>
      )}
    </Layout>
  );
}

const OUTCOMES: Record<Check["outcome"], string> = {
  unknown: "No answer from family yet",
  not_from_them: "Family said the story was not true",
  confirmed_by_them: "Family said the story was true",
  no_answer: "No answer in time",
  no_red_flags: "No warning signs found",
};

/** "No answer yet" only when someone was asked; otherwise say what really happened. */
function outcomeOf(item: ActivityItem): string {
  if (item.check.outcome !== "unknown") return OUTCOMES[item.check.outcome];
  if (item.messages.some((m) => m.kind === "Asked")) return OUTCOMES.unknown;
  if (item.messages.some((m) => m.kind === "Told")) return "A trusted contact was told";
  return "No one was contacted";
}

export interface ActivityItem {
  check: Check;
  signs: string[];
  messages: { name: string; kind: string; detail: string }[];
  report?: ReportSummary;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  });

export function ActivityPage(props: { household: Household; items: ActivityItem[] }) {
  return (
    <Layout title="Activity" description="Recent checks and report summaries." current="family">
      <p>
        <a href="/family">Back to {props.household.olderAdultFirstName}'s family</a>
      </p>
      <h1>Recent checks</h1>
      <DemoNotice household={props.household} />
      <p class="lead">
        Kept for 30 days. Card, bank and Social Security numbers were removed before anything was
        saved.
      </p>
      {props.items.length === 0 ? (
        <p>No checks yet.</p>
      ) : (
        <ol class="activity">
          {props.items.map((item) => (
            <li class="activity-item">
              <h2>{when(item.check.createdAt)}</h2>
              <p>
                A {item.check.contactKind}
                {item.check.claimedIdentity
                  ? ` from someone saying they were ${claimedIdentityWords(
                      item.check.claimedIdentity,
                      props.household.olderAdultFirstName,
                    )}`
                  : ""}
                . <strong>{outcomeOf(item)}.</strong>
              </p>
              {item.signs.length > 0 && <p>Warning signs: {item.signs.join(", ")}.</p>}
              {item.messages.length > 0 && (
                <ul>
                  {item.messages.map((m) => (
                    <li>
                      {m.kind} {m.name}: {m.detail}
                    </li>
                  ))}
                </ul>
              )}
              {item.report && (
                <div class="callout">
                  <h3>Report summary</h3>
                  <dl class="facts">
                    {reportFacts(item.report, props.household.olderAdultFirstName).map(
                      ([label, value]) => (
                        <div>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ),
                    )}
                  </dl>
                  <p>
                    <a href={`/family/activity/${item.check.checkId}/report.txt`}>
                      Open the summary as plain text
                    </a>
                    , to keep it or paste it into a report form.
                  </p>
                  <p>Nothing was sent to any agency. You can file it here:</p>
                  <ul>
                    {item.report.links.map((link) => (
                      <li>
                        <a href={link.url}>{link.name}</a>: {link.whenToUse}
                        {link.phone ? ` Call ${link.phone}.` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </Layout>
  );
}

export function DeleteAllPage(props: { firstName: string; error?: string }) {
  return (
    <Layout title="Delete all household data" description="Erase everything." current="family">
      <h1>Delete all household data</h1>
      <p class="lead">
        This erases every person, the family password and every check for {props.firstName}. It
        cannot be undone.
      </p>
      <form method="post" action="/family/delete-all" class="form" novalidate>
        <Field id="confirmName" label={`To confirm, type ${props.firstName}`} error={props.error}>
          <input
            id="confirmName"
            name="confirmName"
            type="text"
            autocomplete="off"
            aria-invalid={props.error ? "true" : undefined}
            aria-describedby={describedBy("confirmName", false, props.error)}
          />
        </Field>
        <div class="form-actions">
          <button class="button button-danger" type="submit">
            Delete everything
          </button>
          <a class="button button-secondary" href="/family">
            Keep my data
          </a>
        </div>
      </form>
    </Layout>
  );
}

export function DeletedPage() {
  return (
    <Layout title="Deleted" description="Household data deleted." current="family">
      <h1>Everything was deleted</h1>
      <p class="lead">Every person, the family password and every check are gone.</p>
      <p>
        <a href="/">Back to the home page</a>
      </p>
    </Layout>
  );
}
