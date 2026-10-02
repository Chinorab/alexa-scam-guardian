import type { Clock, IdGen, Mailer, Store, TextChannel } from "@asg/core/ports/index";
import type { Logger } from "@asg/core/log/logger";
import type { DemoOutbox } from "@asg/core/ports/outbox";

/** Everything a tool needs from the outside world. Swapped for in memory ones in tests. */
export interface Deps {
  store: Store;
  mailer: Mailer;
  textChannel: TextChannel;
  /** On screen demo phone: all text messages, and every message of a demo household. */
  demoOutbox: DemoOutbox;
  clock: Clock;
  newId: IdGen;
  logger: Logger;
  /** Public web URL, used in reply and stop links inside messages. */
  webUrl: string;
  /** Secret that signs household tokens (HOUSEHOLD_TOKEN_SECRET). */
  tokenSecret: string;
}

/** The household a request acts for, taken from its verified token. */
export interface Caller {
  householdId: string;
  kind: "real" | "demo";
}
