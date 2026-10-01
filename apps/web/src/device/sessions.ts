import type { Message } from "@aws-sdk/client-bedrock-runtime";
import type { EngineState } from "@asg/core/dialogue/engine";
import type { HouseholdKind } from "@asg/core/ports/index";
import type { Table } from "@asg/mcp-server/adapters/table";

/** One simulated Echo in one browser. Holds the conversation, never the raw words. */
export interface DeviceSession {
  deviceId: string;
  householdId: string;
  kind: HouseholdKind;
  olderAdultFirstName: string;
  /** Redacted conversation for the full mode, last 20 messages. */
  history: Message[];
  engine: EngineState;
  expiresAt: number;
}

export interface DeviceSessions {
  get(deviceId: string): Promise<DeviceSession | undefined>;
  put(session: DeviceSession): Promise<void>;
}

/** In memory sessions with a 24 hour lifetime, for local runs and tests. */
export class MemoryDeviceSessions implements DeviceSessions {
  private sessions = new Map<string, DeviceSession>();

  async get(deviceId: string) {
    const session = this.sessions.get(deviceId);
    if (!session || session.expiresAt < Date.now() / 1000) return undefined;
    return structuredClone(session);
  }

  async put(session: DeviceSession) {
    this.sessions.set(session.deviceId, structuredClone(session));
  }
}

/** Sessions on the shared DynamoDB table, so every Lambda instance sees the same Echo. */
export class TableDeviceSessions implements DeviceSessions {
  constructor(private readonly table: Table) {}

  async get(deviceId: string) {
    const row = await this.table.get({ PK: `DEV#${deviceId}`, SK: "SESSION" });
    if (!row || (row.expiresAt ?? 0) < Date.now() / 1000) return undefined;
    return JSON.parse(row.body) as DeviceSession;
  }

  async put(session: DeviceSession) {
    await this.table.put({
      PK: `DEV#${session.deviceId}`,
      SK: "SESSION",
      body: JSON.stringify(session),
      expiresAt: session.expiresAt,
    });
  }
}
