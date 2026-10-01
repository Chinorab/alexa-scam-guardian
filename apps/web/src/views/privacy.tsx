import { Layout } from "./layout";

/** Privacy page (FR-033, constitution Principle III). Plain words, no legal fog. */
export function PrivacyPage() {
  return (
    <Layout
      title="Privacy"
      description="What Scam Guardian stores, why, for how long, and how to delete it."
      current="privacy"
    >
      <h1>Privacy</h1>
      <p class="lead">
        Scam Guardian helps you check a suspicious call with your family. It keeps as little as it
        can, for as short a time as it can.
      </p>

      <h2>What we never do</h2>
      <ul>
        <li>We never record your phone calls. We only work with what you tell us.</li>
        <li>
          We never ask for card, bank or Social Security numbers. If you start saying one, we stop
          you and remove it before anything is saved.
        </li>
        <li>We never call, text or email the person who contacted you.</li>
        <li>We never file a report for you. You or your family send it.</li>
        <li>We never sell or share your information.</li>
      </ul>

      <h2>What we keep and why</h2>
      <h3>The family page</h3>
      <ul>
        <li>The email of the family member who set it up, so they can sign in.</li>
        <li>The first name we use to greet the person we protect.</li>
        <li>
          For each person your family saves: name, relationship, nicknames, and a phone number or
          email, so we can check with them when you ask.
        </li>
        <li>
          The family password, if you set one. We store it scrambled. Nobody can read it back, not
          even us. We can only tell whether a word matches it.
        </li>
      </ul>
      <h3>Each check</h3>
      <ul>
        <li>What you told us about the call, with any long numbers removed.</li>
        <li>The warning signs we found, the messages we sent with your yes, and the replies.</li>
        <li>The report summary, if you asked for one.</li>
      </ul>

      <h2>How long we keep it</h2>
      <ul>
        <li>Checks and report summaries: 30 days, then they are deleted.</li>
        <li>Sign in links: 15 minutes, and each works only once.</li>
        <li>Demo households: 24 hours.</li>
        <li>Your family page: until your family deletes it.</li>
      </ul>

      <h2>Speaking instead of typing</h2>
      <p>
        When you talk to the demo, your browser turns your voice into text. Some browsers send that
        audio to the company that makes the browser to do this. If you prefer, type instead. Typing
        works everywhere on this site.
      </p>

      <h2>Who receives messages</h2>
      <p>
        Only the people your family saved, and only after you say yes. Every message has a link to
        stop all messages from us.
      </p>

      <h2>Delete everything</h2>
      <p>
        On the family page, choose Delete all household data. Every person, password and check is
        erased right away.
      </p>

      <h2>Questions</h2>
      <p>
        Open an issue on{" "}
        <a href="https://github.com/Chinorab/alexa-scam-guardian/issues">our GitHub page</a>.
      </p>
    </Layout>
  );
}
