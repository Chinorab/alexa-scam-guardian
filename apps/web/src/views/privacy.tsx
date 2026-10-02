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
        <li>
          What you told us about the call, with card, bank and Social Security numbers removed. The
          phone number the caller used is kept for the report summary, and we never call it.
        </li>
        <li>The warning signs we found, the messages we sent with your yes, and the replies.</li>
        <li>The report summary, if you asked for one.</li>
      </ul>

      <h2>How long we keep it</h2>
      <ul>
        <li>Checks and report summaries: 30 days, then they are deleted.</li>
        <li>Sign in links: 15 minutes, and each works only once.</li>
        <li>Demo households, the demo phone and the simulated Echo conversation: 24 hours.</li>
        <li>Your family page: until your family deletes it.</li>
        <li>
          Server logs: one week. They hold only ids, timings and error codes, never what you said.
        </li>
        <li>
          To stop one visitor from starting hundreds of demos, we keep a scrambled version of your
          internet address for one hour. We cannot turn it back into the address.
        </li>
      </ul>
      <h2>Where it runs</h2>
      <p>
        Scam Guardian runs on Amazon Web Services in the United States. Your information is kept in
        Amazon DynamoDB, emails go through Amazon SES, and Amazon Polly reads Alexa's answers aloud.
      </p>
      <p>
        To understand what you said, the text of what you told us, with card, bank and Social
        Security numbers already removed, is sent to a language model on Amazon Bedrock. Amazon runs
        the model itself: the company that made the model does not see what is sent to it. If that
        service is slow or unavailable, Scam Guardian answers with its own fixed sentences instead.
      </p>

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
