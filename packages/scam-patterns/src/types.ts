export type Publisher = "FTC" | "FBI" | "IC3" | "DOJ";

export interface Source {
  publisher: Publisher;
  /** Official title, verbatim. Not shown as product copy. */
  title: string;
  /** Short label shown on screen. */
  label: string;
  url: string;
  retrievedOn: string;
}

export interface WarningSign {
  id: string;
  label: string;
  explanation: string;
  cues: string[];
  sourceRefs: string[];
}

export interface ScamPattern {
  id: string;
  name: string;
  description: string;
  signIds: string[];
  advice: string[];
  sourceRefs: string[];
}

export type PaidMethod =
  | "gift_card"
  | "wire"
  | "money_order"
  | "money_transfer_app"
  | "crypto"
  | "cash_mail"
  | "cash_courier"
  | "bank_transfer"
  | "other";

export interface PaidSteps {
  steps: string[];
  sourceRefs: string[];
}

export interface HelpResource {
  id: string;
  name: string;
  whenToUse: string;
  url: string;
  phone?: string;
  hours?: string;
  sourceRefs: string[];
}

export interface Dataset {
  version: string;
  sources: Record<string, Source>;
  warningSigns: WarningSign[];
  patterns: ScamPattern[];
  ifPaid: Record<PaidMethod, PaidSteps>;
  resources: HelpResource[];
}
