/**
 * Home page (T101), mode Persuade: a family member or a judge decides to try the Echo or set
 * up their family. Road sign world from docs/design/direction.md. Every Alexa line quoted here
 * is what the product says today in the demo household.
 */
import { dataset } from "@asg/scam-patterns";
import { Layout } from "./layout";

const PROMISES = [
  {
    legend: ["Never calls", "the caller back"],
    detail: "Checks only go to the people your family saved, on the numbers they saved.",
  },
  {
    legend: ["Never says", "it is safe to pay"],
    detail: "It names warning signs and reports what family said. When in doubt, it says wait.",
  },
  {
    legend: ["Never takes", "card or bank numbers"],
    detail: "If someone starts reading one out, it stops them politely.",
  },
  {
    legend: ["Never records", "the call"],
    detail: "It only works with what the person tells it, after they hang up.",
  },
  {
    legend: ["Never files", "a report alone"],
    detail: "It prepares a summary and shows where to report. The person decides.",
  },
] as const;

const DIALOGUE: { who: "ruth" | "alexa" | "michael"; text: string }[] = [
  {
    who: "ruth",
    text: "Alexa, my grandson just called. He's in jail and needs two thousand dollars in gift cards for bail.",
  },
  {
    who: "alexa",
    text: "I'm glad you asked me first. The emergency story and the gift cards are common signs of a scam. Should I text Michael to check, and tell Sarah you got this call?",
  },
  { who: "ruth", text: "Yes." },
  { who: "alexa", text: "Done. I'll tell you when Michael answers." },
  { who: "michael", text: "Michael opens the link in the text and taps: It wasn't me." },
  {
    who: "alexa",
    text: "Michael says he did not call you, so you did the right thing by checking. Please don't send any money, and hang up if they call back. Would you like help reporting this call?",
  },
];

const SPEAKER = { ruth: "Ruth", alexa: "Alexa", michael: "Michael's phone" } as const;

function Arrow(props: { class?: string }) {
  return (
    <svg class={props.class} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path d="M8 21h22.5l-8.8-8.8 4.6-4.6L43 24.3 26.3 41l-4.6-4.6 8.8-8.8H8z" />
    </svg>
  );
}

/** The sign assembly on its post: what the product does, in the language of the road. */
function SignPost() {
  return (
    <div class="signpost" aria-hidden="true">
      <div class="signpost-diamond">
        <span>
          Gift cards
          <br />
          for bail
        </span>
      </div>
      <div class="signpost-guide">
        <span class="signpost-small">Check with</span>
        <span class="signpost-big">
          Michael
          <Arrow class="signpost-arrow" />
        </span>
        <span class="signpost-small">Saved number</span>
      </div>
      <div class="signpost-services">
        <span>Report</span>
        <span class="signpost-small signpost-pair">
          <span>FTC</span>
          <span>IC3</span>
        </span>
      </div>
      <div class="signpost-pole" />
    </div>
  );
}

export function HomePage() {
  const patterns = dataset.patterns.map((pattern) => ({
    name: pattern.name,
    sources: pattern.sourceRefs
      .map((ref) => dataset.sources[ref])
      .filter((source) => source !== undefined),
  }));

  return (
    <Layout
      title="Check a call before you pay"
      description="Hang up, tell Alexa what happened, and check with your real family before sending money."
      current="home"
      bare
    >
      <section class="hero" aria-labelledby="hero-title">
        <div class="page hero-grid">
          <div class="hero-text">
            <p class="eyebrow">
              <span class="sign-diamond" aria-hidden="true" />
              For calls that sound just like family
            </p>
            <h1 id="hero-title">Check the call before you send money.</h1>
            <p class="lead">
              Ruth hangs up and tells Alexa what happened. Alexa names the warning signs, texts her
              grandson on the number the family saved, and tells her what he answered.
            </p>
            <div class="hero-actions">
              <a class="button button-large" href="/echo">
                Try the Echo demo
                <Arrow class="icon" />
              </a>
              <a class="button button-secondary button-large" href="/family">
                Set up your family
              </a>
            </div>
            <p class="hero-note">
              The demo runs a simulated Echo Show in your browser, with a made up family. Speak or
              type.
            </p>
          </div>
          <SignPost />
        </div>
      </section>

      <section class="theme-asphalt band" aria-labelledby="dialogue-title">
        <div class="page">
          <h2 id="dialogue-title">What it sounds like on the kitchen counter</h2>
          <p class="lead">
            Short sentences, one question at a time, and nothing happens without a yes.
          </p>
          <ol class="dialogue">
            {DIALOGUE.map((line) => (
              <li class={`line line-${line.who}`}>
                <span class="line-who">{SPEAKER[line.who]}</span>
                <p>{line.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section class="page section" aria-labelledby="promises-title">
        <h2 id="promises-title">Rules it keeps, every time</h2>
        <p class="lead">
          Built into the tools Alexa uses, and checked again on every sentence before it is spoken.
        </p>
        <ul class="promises">
          {PROMISES.map((promise) => (
            <li class="promise">
              <p class="regulatory">
                <span>{promise.legend[0]}</span>
                <span>{promise.legend[1]}</span>
              </p>
              <p class="promise-detail">{promise.detail}</p>
            </li>
          ))}
        </ul>
        <p class="stop-line">
          <span class="stop-mark" aria-hidden="true" />
          Someone at the door, or a threat? Alexa says to call 911, first.
        </p>
      </section>

      <section class="page section" aria-labelledby="family-title">
        <h2 id="family-title">Set it up from your phone</h2>
        <ol class="steps">
          <li>
            <span class="step-mark" aria-hidden="true">
              1
            </span>
            <div>
              <h3>Sign in with your email</h3>
              <p>We send a link that works once. No password to remember.</p>
            </div>
          </li>
          <li>
            <span class="step-mark" aria-hidden="true">
              2
            </span>
            <div>
              <h3>Add who Alexa can check with</h3>
              <p>A grandson by text, a daughter by email. Each person can opt out in one tap.</p>
            </div>
          </li>
          <li>
            <span class="step-mark" aria-hidden="true">
              3
            </span>
            <div>
              <h3>Pick a family password</h3>
              <p>A phrase only family knows. It is stored scrambled and never shown again.</p>
            </div>
          </li>
        </ol>
        <p>
          <a class="button button-large" href="/family">
            Set up your family
          </a>
        </p>
      </section>

      <section class="page section" aria-labelledby="sources-title">
        <h2 id="sources-title">What Alexa listens for</h2>
        <p class="lead">
          {patterns.length} scam patterns, written only from official FTC and FBI alerts. Each one
          links to its source.
        </p>
        <ul class="patterns">
          {patterns.map((pattern) => (
            <li>
              <span class="sign-diamond" aria-hidden="true" />
              <span class="pattern-name">{pattern.name}</span>
              <span class="pattern-sources">
                {pattern.sources.map((source) => (
                  <a href={source.url} rel="noopener">
                    {source.label}
                  </a>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <div class="report-signs">
          <a class="services-sign" href="https://reportfraud.ftc.gov/" rel="noopener">
            <span class="signpost-small">Report a scam</span>
            <span>ReportFraud.ftc.gov</span>
          </a>
          <a class="services-sign" href="https://www.ic3.gov/" rel="noopener">
            <span class="signpost-small">Report online fraud</span>
            <span>ic3.gov</span>
          </a>
        </div>
      </section>

      <section class="page section closing" aria-labelledby="closing-title">
        <h2 id="closing-title" class="visually-hidden">
          Try it
        </h2>
        <a class="guide-link" href="/echo">
          <span class="signpost-small">Next step</span>
          <span class="guide-link-legend">
            Try the Echo demo
            <Arrow class="signpost-arrow" />
          </span>
        </a>
      </section>
    </Layout>
  );
}
