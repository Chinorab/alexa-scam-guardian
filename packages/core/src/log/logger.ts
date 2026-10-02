/**
 * Structured logger that cannot carry what the older adult said (constitution Principle III).
 * Events are typed and only hold ids, enums, counts and durations. At runtime every string
 * is checked again: free text or long digit runs are dropped (or throw in strict mode).
 */

export type LogEvent =
  | { event: "http"; route: string; status: number; durationMs: number }
  | { event: "tool_call"; tool: string; ok: boolean; durationMs: number; householdKind?: string }
  | {
      event: "turn";
      mode: "full" | "simplified";
      durationMs: number;
      fellBack: boolean;
      guardViolations: string[];
    }
  | { event: "outreach"; sent: number; failed: number; checkId: string }
  | { event: "reply"; reply: string; checkId: string }
  | { event: "error"; where: string; code: string };

const SAFE_STRING = /^[A-Za-z0-9_:/.-]{0,80}$/;
const LONG_DIGITS = /\d{6,}/;
/** Prefixed ULIDs (see ids.ts) may contain digit runs by chance; their shape is fixed. */
const PREFIXED_ULID = /^[a-z]{2,5}_[0-9A-HJKMNP-TV-Z]{26}$/;

export function isSafeLogString(value: string): boolean {
  if (PREFIXED_ULID.test(value)) return true;
  return SAFE_STRING.test(value) && !LONG_DIGITS.test(value);
}

export interface LoggerOptions {
  /** Throw on unsafe values instead of dropping them. On in tests and local runs. */
  strict?: boolean;
  sink?: (line: string) => void;
}

export class UnsafeLogValueError extends Error {
  constructor(field: string) {
    super(`Unsafe value in log field "${field}"`);
  }
}

export function createLogger(options: LoggerOptions = {}) {
  const sink = options.sink ?? ((line: string) => process.stdout.write(`${line}\n`));

  const clean = (field: string, value: unknown): { value: unknown; dropped: boolean } => {
    if (typeof value === "string") {
      if (isSafeLogString(value)) return { value, dropped: false };
      if (options.strict) throw new UnsafeLogValueError(field);
      return { value: "[dropped]", dropped: true };
    }
    if (Array.isArray(value)) {
      let dropped = false;
      const items = value.map((item, index) => {
        const result = clean(`${field}[${index}]`, item);
        dropped ||= result.dropped;
        return result.value;
      });
      return { value: items, dropped };
    }
    if (typeof value === "number" || typeof value === "boolean" || value === undefined) {
      return { value, dropped: false };
    }
    if (options.strict) throw new UnsafeLogValueError(field);
    return { value: "[dropped]", dropped: true };
  };

  return {
    log(event: LogEvent): void {
      const record: Record<string, unknown> = { at: new Date().toISOString() };
      let dropped = false;
      for (const [field, value] of Object.entries(event)) {
        const result = clean(field, value);
        record[field] = result.value;
        dropped ||= result.dropped;
      }
      if (dropped) record.dropped = true;
      sink(JSON.stringify(record));
    },
  };
}

export type Logger = ReturnType<typeof createLogger>;
