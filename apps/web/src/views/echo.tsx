import { Layout } from "./layout";

/** Simulated Echo Show page. The client mounts on #echo-root. */
export function EchoPage(props: { pollMs: number }) {
  return (
    <Layout
      title="Try it"
      description="Tell a simulated Echo Show about a suspicious call and see how it helps."
      current="echo"
      device
    >
      <header class="echo-head">
        <h1>Try it on a simulated Echo Show</h1>
        <p class="echo-intro">
          Ruth's kitchen, with a sample family: her grandson Michael and her daughter Sarah. Talk or
          type as Ruth, and answer as Michael on the demo phone.
        </p>
      </header>
      <link rel="stylesheet" href="/assets/echo.css" />
      <div id="echo-root" data-poll-ms={String(props.pollMs)} />
      <script type="module" src="/assets/echo.js" />
    </Layout>
  );
}
