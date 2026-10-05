/**
 * Home page (T101), mode Persuade: a family member or a judge decides to try the Echo or set
 * up their family. Road sign world from docs/design/direction.md: the page is a roadside, the
 * dark band is the road itself. Every Alexa line quoted here is what the product says today in
 * the demo household.
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

const STEPS = [
  {
    title: "Sign in with your email",
    detail: "We send a link that works once. No password to remember.",
  },
  {
    title: "Add who Alexa can check with",
    detail: "A grandson by text, a daughter by email. Each person can opt out in one tap.",
  },
  {
    title: "Pick a family password",
    detail: "A phrase only family knows. It is stored scrambled and never shown again.",
  },
] as const;

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

/** A US route marker: a white shield on a black square, the step number in it. */
function RouteShield(props: { n: number }) {
  return (
    <svg class="route-shield" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <rect width="48" height="48" rx="5" class="route-shield-ground" />
      <path
        class="route-shield-face"
        d="M24 6c5.5 1.6 11 1.4 16-.8l2.6 5.2c-1.8 3.4-1.7 7.6-.6 12 1.9 8.6-5.6 15.6-18 20.6C11.6 38 4.1 31 6 22.4c1.1-4.4 1.2-8.6-.6-12L8 5.2c5 2.2 10.5 2.4 16 .8z"
      />
      <text x="24" y="31" text-anchor="middle" class="route-shield-number">
        {props.n}
      </text>
    </svg>
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
      {/* The roadside: the promise, and the sign assembly standing at the edge of the road. */}
      <section class="hero" aria-labelledby="hero-title">
        <div class="page page-home hero-grid">
          <div class="hero-text">
            <h1 id="hero-title">Check the call before you send money.</h1>
            <p class="lead hero-lead">
              For calls that sound just like family. Ruth hangs up and tells Alexa what happened.
              Alexa names the warning signs and checks with her grandson on the number the family
              saved.
            </p>
            <div class="hero-actions">
              <a class="button button-large button-go" href="/echo">
                Try the Echo demo
                <span class="button-go-arrow" aria-hidden="true">
                  <Arrow class="icon" />
                </span>
              </a>
              <a class="button button-secondary button-large" href="/family">
                Set up your family
              </a>
            </div>
          </div>
          <div class="hero-roadside">
            <SignPost />
          </div>
        </div>
      </section>

      {/* The road itself: what it sounds like on the kitchen counter. */}
      <section class="theme-asphalt road" aria-labelledby="dialogue-title">
        <div class="road-markings" aria-hidden="true" />
        <div class="page page-home road-grid">
          <div class="road-intro">
            <h2 id="dialogue-title">What it sounds like on the kitchen counter</h2>
            <p class="lead">
              Short sentences, one question at a time, and nothing happens without a yes.
            </p>
            <p class="road-note">
              The demo runs a simulated Echo Show in your browser, with a made up family. Speak or
              type.
            </p>
            <a class="button button-secondary" href="/echo">
              Open the demo
            </a>
          </div>
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

      <section class="page page-home section rules" aria-labelledby="promises-title">
        <div class="section-head">
          <h2 id="promises-title">Rules it keeps, every time</h2>
          <p class="lead">
            Built into the tools Alexa uses, and checked again on every sentence before it is
            spoken.
          </p>
        </div>
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
          <span class="stop-sign" aria-hidden="true">
            <span>911</span>
          </span>
          <span>Someone at the door, or a threat? Alexa says to call 911, first.</span>
        </p>
      </section>

      <section class="page page-home section setup" aria-labelledby="family-title">
        <div class="setup-text">
          <h2 id="family-title">Set it up from your phone</h2>
          <ol class="steps">
            {STEPS.map((step, index) => (
              <li>
                <RouteShield n={index + 1} />
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
          <a class="button button-large" href="/family">
            Set up your family
          </a>
        </div>
        <figure class="phone-frame">
          <img
            src="/images/family-phone.png"
            width="390"
            height="780"
            loading="lazy"
            alt="The family page on a phone: Ruth's family, with Michael saved as the grandson Alexa can check with."
          />
        </figure>
      </section>

      <section class="page page-home section listens" aria-labelledby="sources-title">
        <div class="section-head">
          <h2 id="sources-title">What Alexa listens for</h2>
          <p class="lead">
            {patterns.length} scam patterns, written only from official FTC and FBI alerts. Each one
            links to its source.
          </p>
        </div>
        <div class="listens-grid">
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
          <aside class="report-aside" aria-labelledby="report-title">
            <h3 id="report-title">Where to report one</h3>
            <p>The report summary Alexa prepares points to these two official sites.</p>
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
          </aside>
        </div>
      </section>

      {/* The last sign hangs over the road on its gantry. */}
      <section class="closing" aria-labelledby="closing-title">
        <h2 id="closing-title" class="visually-hidden">
          Try it
        </h2>
        <div class="gantry">
          <a class="guide-link" href="/echo">
            <span class="signpost-small">Next step</span>
            <span class="guide-link-legend">
              Try the Echo demo
              <Arrow class="signpost-arrow" />
            </span>
          </a>
        </div>
        <div class="theme-asphalt road road-end" aria-hidden="true">
          <div class="road-markings" />
        </div>
      </section>
    </Layout>
  );
}
