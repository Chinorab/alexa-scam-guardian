/**
 * The on screen demo phone (FR-014) on the shared table, so every Lambda instance sees the
 * same messages. Entries live under the household and expire after 24 hours.
 */
import { randomUUID } from "node:crypto";
import {
  epochSeconds,
  systemClock,
  type Clock,
  type EmailMessage,
  type TextMessage,
} from "@asg/core/ports/index";
import type { DemoOutbox, OutboxEntry } from "@asg/core/ports/outbox";
import { EVENT_SECONDS, hh } from "./dynamo-store";
import type { Table } from "./table";

export class DynamoOutbox implements DemoOutbox {
  constructor(
    private readonly table: Table,
    private readonly clock: Clock = systemClock,
  ) {}

  async send(message: EmailMessage | TextMessage): Promise<{ messageId: string }> {
    const messageId = `msg_${randomUUID()}`;
    // Without a household the phone could never show it; nothing is kept.
    if (!message.householdId) return { messageId };
    const now = this.clock.now();
    const entry: OutboxEntry =
      "subject" in message
        ? {
            messageId,
            householdId: message.householdId,
            kind: "email",
            to: message.to,
            subject: message.subject,
            body: message.text,
            at: now.toISOString(),
          }
        : {
            messageId,
            householdId: message.householdId,
            kind: "text",
            to: message.to,
            body: message.body,
            at: now.toISOString(),
          };
    if (message.memberId) entry.memberId = message.memberId;
    await this.table.put({
      PK: hh(message.householdId),
      SK: `OUT#${entry.at}#${messageId}`,
      body: JSON.stringify(entry),
      expiresAt: epochSeconds(now) + EVENT_SECONDS,
    });
    return { messageId };
  }

  async list(householdId: string): Promise<OutboxEntry[]> {
    const now = epochSeconds(this.clock.now());
    const rows = await this.table.query(hh(householdId), "OUT#", true);
    return rows
      .filter((row) => row.expiresAt === undefined || row.expiresAt > now)
      .map((row) => JSON.parse(row.body) as OutboxEntry);
  }

  async clear(householdId: string): Promise<void> {
    const rows = await this.table.query(hh(householdId), "OUT#");
    await this.table.deleteMany(rows.map(({ PK, SK }) => ({ PK, SK })));
  }
}
