import type { Child } from "hono/jsx";

export const PRODUCT_NAME = "Scam Guardian";
/** Link preview image; absolute because chat apps and Devpost fetch it from elsewhere. */
const SHARE_IMAGE =
  "https://raw.githubusercontent.com/Chinorab/alexa-scam-guardian/main/docs/video/devpost-cover.png";

type NavKey = "home" | "echo" | "family" | "privacy";

const NAV: { key: NavKey; href: string; label: string }[] = [
  { key: "echo", href: "/echo", label: "Try it" },
  { key: "family", href: "/family", label: "Family page" },
  { key: "privacy", href: "/privacy", label: "Privacy" },
];

export function Layout(props: {
  title: string;
  description: string;
  current?: NavKey;
  /** Echo page: always the asphalt theme and a wider column. */
  device?: boolean;
  /** Home page: main spans the window; sections set their own column. */
  bare?: boolean;
  children: Child;
}) {
  // Header and footer line up with the page they frame.
  const frame = props.bare ? "page page-home" : props.device ? "page page-wide" : "page";
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{`${props.title} | ${PRODUCT_NAME}`}</title>
        <meta name="description" content={props.description} />
        <meta name="color-scheme" content="light dark" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#1f2326" media="(prefers-color-scheme: dark)" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={PRODUCT_NAME} />
        <meta property="og:title" content={`${props.title} | ${PRODUCT_NAME}`} />
        <meta property="og:description" content={props.description} />
        <meta property="og:image" content={SHARE_IMAGE} />
        <meta
          property="og:image:alt"
          content="Road signs: gift cards for bail, check with Michael, report."
        />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="stylesheet" href="/assets/site.css" />
      </head>
      <body class={props.device ? "theme-asphalt" : props.bare ? "home" : undefined}>
        <a class="skip-link" href="#main">
          Skip to content
        </a>
        <header class="site-header">
          <div class={frame}>
            <a class="brand" href="/" aria-current={props.current === "home" ? "page" : undefined}>
              <img src="/favicon.svg" alt="" width="40" height="40" />
              {PRODUCT_NAME}
            </a>
            <nav class="site-nav" aria-label="Main">
              <ul>
                {NAV.map((item) => (
                  <li>
                    <a
                      href={item.href}
                      class={item.key === "echo" ? "nav-cta" : undefined}
                      aria-current={props.current === item.key ? "page" : undefined}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </header>
        <main
          id="main"
          class={props.bare ? "main-bare" : props.device ? "page page-wide" : "page"}
          tabindex={-1}
        >
          {props.children}
        </main>
        <footer class="site-footer">
          <div class={frame}>
            <ul>
              <li>
                <a href="/privacy">Privacy</a>
              </li>
              <li>In danger right now? Call 911.</li>
            </ul>
          </div>
        </footer>
      </body>
    </html>
  );
}
