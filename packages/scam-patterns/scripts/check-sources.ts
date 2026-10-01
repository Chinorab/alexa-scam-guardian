/** Usage: tsx scripts/check-sources.ts [--online] */
import { dataset } from "../src/index";
import { checkDataset, checkUrls } from "../src/check";

const problems = checkDataset(dataset);
if (process.argv.includes("--online")) problems.push(...(await checkUrls(dataset)));

for (const problem of problems) console.log(problem);
if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s) in the scam pattern dataset.`);
  process.exit(1);
}
console.log(
  `Dataset OK: ${dataset.warningSigns.length} warning signs, ${dataset.patterns.length} patterns, ${Object.keys(dataset.sources).length} sources.`,
);
