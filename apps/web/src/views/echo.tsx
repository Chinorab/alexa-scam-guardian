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
      <h1 class="visually-hidden">Try it on a simulated Echo Show</h1>
      <p class="echo-intro">
        A simulated Echo Show with a sample family: Ruth, her grandson Michael and her daughter
        Sarah. Try: <q>My grandson just called. He's in jail and needs gift cards for bail.</q>
      </p>
      <link rel="stylesheet" href="/assets/echo.css" />
      <div id="echo-root" data-poll-ms={String(props.pollMs)} />
      <script type="module" src="/assets/echo.js" />
    </Layout>
  );
}
