import { Layout } from "./layout";

/** Placeholder home; designed in the polish phase (T101). */
export function HomePage() {
  return (
    <Layout
      title="Check a call before you pay"
      description="Hang up, tell Alexa what happened, and check with your real family before sending money."
      current="home"
    >
      <h1>Check a call before you pay</h1>
      <p class="lead">
        Hang up, tell Alexa what happened, and check with your real family before sending any money.
      </p>
      <p>
        <a class="button" href="/echo">
          Try it
        </a>
      </p>
    </Layout>
  );
}
