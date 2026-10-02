/**
 * Pages for relatives (FR-008): /r/:token answers a check message in one tap, /stop/:token
 * stops all messages. GET only shows; POST records (link scanners open links on their own).
 */
import { Hono } from "hono";
import { readStopToken } from "@asg/core/auth/link-tokens";
import { describeReplyLink, recordReply, type Deps } from "@asg/mcp-server";
import { Layout } from "../views/layout";

function Notice(props: { title: string; children: unknown }) {
  return (
    <Layout title={props.title} description="A message from Scam Guardian.">
      <h1>{props.title}</h1>
      {props.children as never}
    </Layout>
  );
}

export function replyRoutes(deps: Deps) {
  const app = new Hono();

  app.get("/r/:token", async (c) => {
    const state = await describeReplyLink(deps, c.req.param("token"));
    if (!("olderAdultFirstName" in state)) {
      return c.html(
        <Notice title="This link has expired">
          <p class="lead">Please call your family member on the number you know.</p>
        </Notice>,
        state.status === "unknown" ? 404 : 410,
      );
    }
    const older = state.olderAdultFirstName;
    if (state.status === "answered") {
      return c.html(
        <Notice title="Thank you, we already have your answer">
          <p class="lead">Please call {older} on the number you know.</p>
        </Notice>,
      );
    }
    return c.html(
      <Layout title={`Help ${older} check a call`} description="Answer in one tap.">
        <h1>
          Hi {state.memberName}, did you just call {older}?
        </h1>
        <p class="lead">
          Someone called {older} asking for money and said they were family. Your answer goes
          straight to {older}.
        </p>
        <div class="reply-actions">
          <form method="post" action={`/r/${c.req.param("token")}`}>
            <input type="hidden" name="answer" value="it_was_me" />
            <button class="button" type="submit">
              It was me
            </button>
          </form>
          <form method="post" action={`/r/${c.req.param("token")}`}>
            <input type="hidden" name="answer" value="it_wasnt_me" />
            <button class="button button-warning" type="submit">
              It wasn't me
            </button>
          </form>
        </div>
        <p>Either way, please also call {older} on the number you know.</p>
      </Layout>,
    );
  });

  app.post("/r/:token", async (c) => {
    const form = await c.req.parseBody();
    const answer =
      form.answer === "it_was_me"
        ? "it_was_me"
        : form.answer === "it_wasnt_me"
          ? "it_wasnt_me"
          : undefined;
    if (!answer) return c.redirect(`/r/${c.req.param("token")}`, 303);
    const result = await recordReply(deps, c.req.param("token"), answer);
    if (!result.ok) {
      return c.html(
        <Notice
          title={
            result.reason === "already_answered"
              ? "We already have your answer"
              : "This link has expired"
          }
        >
          <p class="lead">Please call your family member on the number you know.</p>
        </Notice>,
        result.reason === "already_answered" ? 409 : 410,
      );
    }
    const older = result.olderAdultFirstName;
    return c.html(
      <Notice title="Thank you">
        <p class="lead">
          {answer === "it_wasnt_me"
            ? `We will tell ${older} it was not you, so ${older} knows not to send money.`
            : `We will tell ${older} you confirmed it. ${older} will still talk with you before sending anything.`}
        </p>
        <p>Please call {older} on the number you know as soon as you can.</p>
      </Notice>,
    );
  });

  app.get("/stop/:token", async (c) => {
    const target = readStopToken(c.req.param("token"), deps.tokenSecret);
    if (!target) {
      return c.html(
        <Notice title="This link is not valid">
          <p class="lead">No change was made.</p>
        </Notice>,
        404,
      );
    }
    return c.html(
      <Notice title="Stop messages from Scam Guardian?">
        <p class="lead">You will not get any more messages about suspicious calls.</p>
        <form method="post" action={`/stop/${c.req.param("token")}`}>
          <button class="button" type="submit">
            Stop all messages
          </button>
        </form>
      </Notice>,
    );
  });

  app.post("/stop/:token", async (c) => {
    const target = readStopToken(c.req.param("token"), deps.tokenSecret);
    const member = target && (await deps.store.getMember(target.householdId, target.memberId));
    if (member) await deps.store.putMember({ ...member, optedOut: true });
    return c.html(
      <Notice title="Messages stopped">
        <p class="lead">You will not get any more messages from Scam Guardian.</p>
      </Notice>,
    );
  });

  return app;
}
