import type { Message } from "@aws-sdk/client-bedrock-runtime";
import type { EngineState } from "@asg/core/dialogue/engine";
import type { HouseholdKind } from "@asg/core/ports/index";

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

/** In memory sessions with a 24 hour lifetime. DynamoDB backed in the cloud phase. */
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
