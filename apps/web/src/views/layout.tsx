import type { Child } from "hono/jsx";

export const PRODUCT_NAME = "Scam Guardian";

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
  children: Child;
}) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{`${props.title} | ${PRODUCT_NAME}`}</title>
        <meta name="description" content={props.description} />
        <meta name="color-scheme" content="light dark" />
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="stylesheet" href="/assets/site.css" />
      </head>
      <body>
        <a class="skip-link" href="#main">
          Skip to content
        </a>
        <header class="site-header">
          <div class="page">
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
        <main id="main" class="page" tabindex={-1}>
          {props.children}
        </main>
        <footer class="site-footer">
          <div class="page">
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
