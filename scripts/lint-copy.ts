/**
 * Copy lint (constitution Principle VIII): user facing strings must contain no emojis,
 * no en or em dashes, no spaced or double hyphens, and never the word "AI".
 *
 * Scans string literals and JSX text in TypeScript, text and labelled attributes in HTML,
 * and string values in JSON datasets. Test files are skipped because they hold bad examples
 * on purpose. Add `copy-lint-ignore` on the same or previous line to silence one line.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

import { checkCopy, type CopyRule } from "../packages/core/src/copy/rules";

export type Rule = CopyRule;

export interface Violation {
  file: string;
  line: number;
  rule: Rule;
  text: string;
}

interface Snippet {
  text: string;
  line: number;
}

/** Directories whose strings reach users (pages, Echo, cards, messages, phrases, dataset). */
export const COPY_ROOTS = [
  "apps/web/src",
  "apps/web/echo/src",
  "apps/mcp-server/src",
  "packages/core/src/dialogue",
  "packages/scam-patterns/data",
];

const LABELLED_ATTRIBUTES = ["alt", "title", "aria-label", "placeholder", "aria-description"];
// "title" holds official source titles verbatim: citations, not product copy.
const JSON_SKIPPED_KEYS = new Set([
  "url",
  "id",
  "$schema",
  "$id",
  "sourceRefs",
  "signIds",
  "cues",
  "retrievedOn",
  "title",
]);

export const checkText = checkCopy;

function isModuleSpecifier(node: ts.Node): boolean {
  const parent = node.parent;
  return (
    (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) &&
    parent.moduleSpecifier === node
  );
}

function isPropertyName(node: ts.Node): boolean {
  const parent = node.parent;
  return (
    (ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent)) && parent.name === node
  );
}

export function extractFromTs(source: string, fileName = "file.tsx"): Snippet[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const out: Snippet[] = [];
  const lineOf = (node: ts.Node) =>
    file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;

  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (!isModuleSpecifier(node) && !isPropertyName(node) && !ts.isLiteralTypeNode(node.parent)) {
        out.push({ text: node.text, line: lineOf(node) });
      }
    } else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      out.push({ text: node.text, line: lineOf(node) });
    } else if (ts.isJsxText(node)) {
      const text = node.text.trim();
      if (text) out.push({ text, line: lineOf(node) });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return out;
}

export function extractFromHtml(source: string): Snippet[] {
  const out: Snippet[] = [];
  const blank = (match: string) => match.replace(/[^\n]/g, " ");
  const cleaned = source
    .replace(/<script[\s\S]*?<\/script>/gi, blank)
    .replace(/<style[\s\S]*?<\/style>/gi, blank)
    .replace(/<!--[\s\S]*?-->/g, blank);

  const lineAt = (index: number) => cleaned.slice(0, index).split("\n").length;

  const attr = new RegExp(`\\b(?:${LABELLED_ATTRIBUTES.join("|")})\\s*=\\s*"([^"]*)"`, "gi");
  for (const match of cleaned.matchAll(attr)) {
    out.push({ text: match[1] ?? "", line: lineAt(match.index ?? 0) });
  }
  for (const match of cleaned.matchAll(/>([^<]+)</g)) {
    const text = (match[1] ?? "").trim();
    if (text) out.push({ text, line: lineAt(match.index ?? 0) });
  }
  return out;
}

export function extractFromJson(source: string): Snippet[] {
  const out: Snippet[] = [];
  const lines = source.split("\n");
  const lineOf = (value: string) => {
    const needle = JSON.stringify(value);
    const index = lines.findIndex((line) => line.includes(needle));
    return index === -1 ? 1 : index + 1;
  };
  const walk = (value: unknown, key?: string): void => {
    if (typeof value === "string") {
      if (!key || !JSON_SKIPPED_KEYS.has(key)) out.push({ text: value, line: lineOf(value) });
    } else if (Array.isArray(value)) {
      value.forEach((item) => walk(item, key));
    } else if (value && typeof value === "object") {
      for (const [childKey, child] of Object.entries(value)) walk(child, childKey);
    }
  };
  walk(JSON.parse(source));
  return out;
}

function ignoredLines(source: string): Set<number> {
  const ignored = new Set<number>();
  source.split("\n").forEach((line, index) => {
    if (line.includes("copy-lint-ignore")) {
      ignored.add(index + 1);
      ignored.add(index + 2);
    }
  });
  return ignored;
}

export function lintSource(file: string, source: string): Violation[] {
  const ext = extname(file);
  const snippets =
    ext === ".json"
      ? extractFromJson(source)
      : ext === ".html"
        ? extractFromHtml(source)
        : extractFromTs(source, file);
  const ignored = ignoredLines(source);
  return snippets.flatMap(({ text, line }) =>
    ignored.has(line) ? [] : checkText(text).map((rule) => ({ file, line, rule, text })),
  );
}

const SCANNED = new Set([".ts", ".tsx", ".html", ".json"]);

function* walkFiles(dir: string): Generator<string> {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === "dist") continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* walkFiles(path);
    else if (SCANNED.has(extname(path)) && !/\.test\.tsx?$/.test(path)) yield path;
  }
}

export function lintRepo(root: string): Violation[] {
  return COPY_ROOTS.flatMap((dir) =>
    [...walkFiles(join(root, dir))].flatMap((path) =>
      lintSource(relative(root, path).replaceAll("\\", "/"), readFileSync(path, "utf8")),
    ),
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const violations = lintRepo(process.cwd());
  for (const v of violations)
    console.log(`${v.file}:${v.line}  ${v.rule}  ${JSON.stringify(v.text)}`);
  if (violations.length > 0) {
    console.error(`\nCopy lint: ${violations.length} problem(s). See constitution Principle VIII.`);
    process.exit(1);
  }
  console.log("Copy lint: no problems.");
}
