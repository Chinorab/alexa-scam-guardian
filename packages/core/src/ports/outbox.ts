import type { EmailMessage, Mailer, TextChannel, TextMessage } from "./index";

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
 * Local and demo delivery. Email (when SES is not configured) and every text message land
 * here; the demo phone in the simulated Echo reads them per household.
 */
export class Outbox implements Mailer, TextChannel {
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
      return this.push({
        kind: "email",
        householdId: message.householdId,
        to: message.to,
        subject: message.subject,
        body: message.text,
      });
    }
    return this.push({
      kind: "text",
      householdId: message.householdId,
      memberId: message.memberId,
      to: message.to,
      body: message.body,
    });
  }

  /** Newest first, as a phone shows them. */
  list(householdId: string): OutboxEntry[] {
    return this.entries.filter((entry) => entry.householdId === householdId).reverse();
  }

  clear(householdId: string): void {
    this.entries = this.entries.filter((entry) => entry.householdId !== householdId);
  }
}
