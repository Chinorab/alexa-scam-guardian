import type { EmailMessage, TextMessage } from "./index";

export interface OutboxEntry {
  messageId: string;
  householdId?: string;
  memberId?: string;
  kind: "email" | "text";
  to: string;
  subject?: string;
  body: string;
  at: string;
}

/**
 * Messages that land on the on screen demo phone instead of a real inbox (FR-014): every text
 * message, and every message of a demo household. In memory locally, DynamoDB in the cloud.
 */
export interface DemoOutbox {
  send(message: EmailMessage | TextMessage): Promise<{ messageId: string }>;
  /** Newest first, as a phone shows them. */
  list(householdId: string): Promise<OutboxEntry[]>;
  clear(householdId: string): Promise<void>;
}

/** In memory demo outbox. Also the Mailer for local runs without SES. */
export class Outbox implements DemoOutbox {
  private entries: OutboxEntry[] = [];
  private counter = 0;

  constructor(private readonly onDeliver?: (entry: OutboxEntry) => void) {}

  private push(entry: Omit<OutboxEntry, "messageId" | "at">): { messageId: string } {
    const messageId = `outbox-${++this.counter}`;
    const full: OutboxEntry = { ...entry, messageId, at: new Date().toISOString() };
    this.entries.push(full);
    this.onDeliver?.(full);
    return { messageId };
  }

  async send(message: EmailMessage | TextMessage): Promise<{ messageId: string }> {
    if ("subject" in message) {
      const entry: Omit<OutboxEntry, "messageId" | "at"> = {
        kind: "email",
        to: message.to,
        subject: message.subject,
        body: message.text,
      };
      if (message.householdId) entry.householdId = message.householdId;
      if (message.memberId) entry.memberId = message.memberId;
      return this.push(entry);
    }
    return this.push({
      kind: "text",
      householdId: message.householdId,
      memberId: message.memberId,
      to: message.to,
      body: message.body,
    });
  }

  async list(householdId: string): Promise<OutboxEntry[]> {
    return this.entries.filter((entry) => entry.householdId === householdId).reverse();
  }

  async clear(householdId: string): Promise<void> {
    this.entries = this.entries.filter((entry) => entry.householdId !== householdId);
  }
}
