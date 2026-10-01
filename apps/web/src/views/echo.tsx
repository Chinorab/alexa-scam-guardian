import { Layout } from "./layout";

/** Simulated Echo page. The client mounts on #echo-root. */
export function EchoPage() {
  return (
    <Layout
      title="Try it"
      description="Tell a simulated Echo Show about a suspicious call and see how it helps."
      current="echo"
    >
      <h1>Try it</h1>
      <p class="lead">This is a simulated Echo Show with a sample family.</p>
      <link rel="stylesheet" href="/assets/echo.css" />
      <div id="echo-root" />
      <script type="module" src="/assets/echo.js" />
    </Layout>
  );
}
