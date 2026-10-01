import { describe, expect, it } from "vitest";
import { dataset } from "@asg/scam-patterns";
import { findViolations } from "../guard/guard";
import { phrases, pronouns, type Person } from "./phrases";

const michael: Person = { name: "Michael", relationship: "grandson", channel: "text" };
const sarah: Person = { name: "Sarah", relationship: "daughter", channel: "email" };
const sam: Person = { name: "Sam", relationship: "other", channel: "text" };

/** Every line the simplified mode can say, with representative arguments. */
function allLines(): string[] {
  const people = [michael, sarah, sam];
  const lines: string[] = [
    phrases.thanks(),
    phrases.signs(["rush", "emergency story", "gift cards"]),
    phrases.signs(["gift cards"]),
    phrases.noSigns(),
    phrases.waitBeforePaying(),
    phrases.offerVerify(michael, sarah),
    phrases.pickMember("grandson", ["Michael", "Daniel"]),
    phrases.unknownRelative(sarah),
    phrases.unknownRelative(),
    phrases.noFamilySetup(),
    phrases.sent("Michael"),
    phrases.sent(undefined, ["Sarah"]),
    phrases.nothingSent(),
    phrases.unclearConfirm(phrases.offerVerify(michael)),
    phrases.deliveryFailed(michael, sarah),
    phrases.deliveryFailed(michael),
    phrases.noNews(),
    phrases.hangUpFirst(),
    phrases.dangerAtDoor(),
    phrases.danger(),
    phrases.sensitiveStop(),
    phrases.callBackRefusal(michael),
    phrases.callBackRefusal(),
    phrases.canIPay(michael),
    phrases.canIPay(),
    phrases.passwordMatches(michael),
    phrases.passwordMatches(),
    phrases.passwordNoMatch(),
    phrases.passwordNotSet(),
    phrases.passwordLocked(),
    phrases.passwordRefuse(),
    phrases.hotline(),
    phrases.offerReport(),
    phrases.reportReady(),
    phrases.cannotFile(sarah),
    phrases.cannotFile(),
    phrases.backToCheck(),
    `${phrases.cantHelpHere()} ${phrases.backToCheck()} ${phrases.offerVerify(michael)}`,
    phrases.closing(),
  ];
  for (const person of people) {
    lines.push(
      phrases.offerVerify(person),
      phrases.offerHeadsUp(person),
      phrases.replyDenied(person),
      phrases.replyConfirmed(person),
      phrases.noAnswer(person, sarah),
      phrases.noAnswer(person),
      phrases.stillWaiting(person),
    );
  }
  for (const sign of dataset.warningSigns) {
    if (!sign.explanation.includes(". ")) lines.push(phrases.whileWaiting(sign.explanation));
  }
  for (const paid of Object.values(dataset.ifPaid)) {
    lines.push(phrases.thankForTelling(paid.steps[0] ?? ""));
    for (const step of paid.steps) lines.push(step);
  }
  return lines;
}

describe("phrase catalog", () => {
  it.each(allLines())("passes the output guard: %s", (line) => {
    expect(findViolations(line)).toEqual([]);
  });

  it("reads the reference signs line", () => {
    expect(phrases.signs(["rush", "emergency story", "gift cards"])).toBe(
      "The rush, the emergency story and the gift cards are common signs of a scam.",
    );
  });

  it("takes pronouns from the relationship only", () => {
    expect(pronouns(michael).object).toBe("him");
    expect(pronouns(sarah).subject).toBe("she");
    expect(pronouns(sam)).toEqual({ subject: "they", object: "them" });
    expect(phrases.replyConfirmed(sam)).toBe(
      "Sam says it was them. Before you send anything, please call them on the number you know and talk with them.",
    );
  });
});
