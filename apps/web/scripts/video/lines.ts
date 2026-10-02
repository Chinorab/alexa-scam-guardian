/**
 * What Ruth and the narrator say in the demo video (docs/demo-script.md). Alexa's lines are not
 * here: they are whatever the deployed product says, read from the recording.
 */
export interface Line {
  id: string;
  speaker: "ruth" | "narrator";
  text: string;
}

export const RUTH: Line[] = [
  {
    id: "r-opening",
    speaker: "ruth",
    text: "Alexa, my grandson just called. He's in jail and needs two thousand dollars in gift cards for bail.",
  },
  { id: "r-yes", speaker: "ruth", text: "Yes." },
  { id: "r-pay", speaker: "ruth", text: "So can I pay him?" },
  {
    id: "r-on-line",
    speaker: "ruth",
    text: "He's still on the other phone, he says I have to hurry.",
  },
  { id: "r-card", speaker: "ruth", text: "My card number is four one two two three three" },
  { id: "r-call-back", speaker: "ruth", text: "Call back the number that called me." },
  {
    id: "r-door",
    speaker: "ruth",
    text: "There's a man at my door, he says he's here for the money.",
  },
  { id: "r-report", speaker: "ruth", text: "Yes, help me report it." },
  {
    id: "r-paid",
    speaker: "ruth",
    text: "I already bought the cards and read him the numbers.",
  },
  { id: "r-yes-2", speaker: "ruth", text: "Yes." },
];

export const NARRATOR: Line[] = [
  {
    id: "n-title",
    speaker: "narrator",
    text: "Scam Guardian is an Alexa+ add-on for the moment right after a scary call.",
  },
  {
    id: "n-why",
    speaker: "narrator",
    text: "The FTC's advice is simple: hang up, and check with your family on a number you know. Scam Guardian turns that advice into a conversation.",
  },
  {
    id: "n-rules",
    speaker: "narrator",
    text: "It never says a payment is safe. It never contacts the caller. It never takes card numbers. And it never records the call.",
  },
  {
    id: "n-paid",
    speaker: "narrator",
    text: "No blame, one first step, and the family knows.",
  },
  {
    id: "n-family",
    speaker: "narrator",
    text: "A grandchild sets it up from their phone: who Alexa can check with, and who gets a heads up. An optional family password, and a history of every check.",
  },
  {
    id: "n-build",
    speaker: "narrator",
    text: "Under the hood is a real MCP server with eight tools, on AWS Lambda. The safety rules live inside the tools. Rules answer what must be exact, and Claude Haiku on Amazon Bedrock answers the open questions, through the same guard.",
  },
  {
    id: "n-close",
    speaker: "narrator",
    text: "Seventy five adversarial phrases run on every push, and the scam patterns are open source. Hang up. Ask Alexa. Check with family.",
  },
];

/** Polly neural voices: Alexa keeps the product's own voice. */
export const VOICES = { alexa: "Joanna", ruth: "Ruth", narrator: "Matthew" } as const;
